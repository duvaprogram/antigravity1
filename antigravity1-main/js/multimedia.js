// ==============================================================================
// Multimedia Module (Imágenes y Videos)
// Gestión de galería de imágenes y subida / reproducción de videos
// ==============================================================================

const MultimediaModule = {
    initialized: false,
    activeTab: 'images', // 'images' | 'videos'
    videos: [],
    categories: ['Todos', 'Anuncios / Ads', 'Creativos', 'Productos', 'UGC', 'Testimonios', 'Tutoriales', 'General'],
    selectedCategory: 'Todos',
    searchQuery: '',
    sortBy: 'newest', // 'newest' | 'oldest' | 'name' | 'size'
    currentPlayingVideo: null,
    editingVideoId: null,
    selectedFileObject: null,
    selectedFileMetadata: null,
    db: null,

    // --------------------------------------------------------------------------
    // 1. Inicialización de IndexedDB para almacenamiento de videos pesados (Blobs)
    // --------------------------------------------------------------------------
    async initDB() {
        return new Promise((resolve) => {
            if (this.db) return resolve(this.db);
            try {
                const request = indexedDB.open('MultimediaDB', 1);
                request.onupgradeneeded = (e) => {
                    const db = e.target.result;
                    if (!db.objectStoreNames.contains('video_files')) {
                        db.createObjectStore('video_files', { keyPath: 'id' });
                    }
                };
                request.onsuccess = (e) => {
                    this.db = e.target.result;
                    resolve(this.db);
                };
                request.onerror = (err) => {
                    console.warn('⚠️ No se pudo inicializar IndexedDB para videos:', err);
                    resolve(null);
                };
            } catch (e) {
                console.warn('⚠️ Error al abrir IndexedDB:', e);
                resolve(null);
            }
        });
    },

    async saveVideoBlob(id, blob) {
        if (!this.db) await this.initDB();
        if (!this.db) return false;
        return new Promise((resolve) => {
            try {
                const tx = this.db.transaction('video_files', 'readwrite');
                const store = tx.objectStore('video_files');
                store.put({ id, blob, updated_at: new Date().toISOString() });
                tx.oncomplete = () => resolve(true);
                tx.onerror = () => resolve(false);
            } catch (e) {
                console.warn('Error guardando blob:', e);
                resolve(false);
            }
        });
    },

    async getVideoBlob(id) {
        if (!this.db) await this.initDB();
        if (!this.db) return null;
        return new Promise((resolve) => {
            try {
                const tx = this.db.transaction('video_files', 'readonly');
                const store = tx.objectStore('video_files');
                const req = store.get(id);
                req.onsuccess = () => resolve(req.result ? req.result.blob : null);
                req.onerror = () => resolve(null);
            } catch (e) {
                resolve(null);
            }
        });
    },

    async deleteVideoBlob(id) {
        if (!this.db) await this.initDB();
        if (!this.db) return;
        try {
            const tx = this.db.transaction('video_files', 'readwrite');
            const store = tx.objectStore('video_files');
            store.delete(id);
        } catch (e) {
            console.warn('Error eliminando blob:', e);
        }
    },

    // --------------------------------------------------------------------------
    // 2. Inicialización del Módulo
    // --------------------------------------------------------------------------
    async init() {
        if (this.initialized) {
            this.render();
            return;
        }

        await this.initDB();
        this.setupEventListeners();
        await this.loadVideos();

        const savedTab = localStorage.getItem('multimedia_active_tab');
        if (savedTab && (savedTab === 'images' || savedTab === 'videos')) {
            this.activeTab = savedTab;
        }

        this.initialized = true;
        this.render();
    },

    async render() {
        this.switchTab(this.activeTab, false);
        if (this.activeTab === 'videos') {
            await this.renderVideosList();
            this.updateStats();
        }
    },

    // --------------------------------------------------------------------------
    // 3. Gestión de Pestañas (Imágenes vs Videos)
    // --------------------------------------------------------------------------
    switchTab(tabName, save = true) {
        this.activeTab = tabName;
        if (save) {
            localStorage.setItem('multimedia_active_tab', tabName);
        }

        // Actualizar botones de pestañas
        document.querySelectorAll('.multimedia-tab-btn').forEach(btn => {
            if (btn.dataset.tab === tabName) {
                btn.classList.add('active');
            } else {
                btn.classList.remove('active');
            }
        });

        // Alternar vistas
        const imagesView = document.getElementById('multimedia-subtab-images');
        const videosView = document.getElementById('multimedia-subtab-videos');

        if (imagesView && videosView) {
            if (tabName === 'images') {
                imagesView.style.display = 'block';
                videosView.style.display = 'none';
            } else {
                imagesView.style.display = 'none';
                videosView.style.display = 'block';
                this.renderCategoryPills();
                this.renderVideosList();
                this.updateStats();
            }
        }
    },

    // --------------------------------------------------------------------------
    // 4. Carga y Persistencia de Videos (Supabase + LocalStorage + IndexedDB)
    // --------------------------------------------------------------------------
    async loadVideos() {
        let loadedVideos = [];

        // 1. Cargar desde LocalStorage
        try {
            const localSaved = localStorage.getItem('multimedia_videos_meta');
            if (localSaved) {
                loadedVideos = JSON.parse(localSaved);
            }
        } catch (e) {
            console.warn('Error leyendo videos locales:', e);
        }

        // 2. Intentar cargar desde Supabase si está disponible
        if (window.supabaseClient) {
            try {
                const { data, error } = await supabaseClient
                    .from('multimedia_videos')
                    .select('*')
                    .order('created_at', { ascending: false });

                if (!error && data && data.length > 0) {
                    const cloudIds = new Set(data.map(v => v.id));
                    const localOnly = loadedVideos.filter(v => !cloudIds.has(v.id));
                    loadedVideos = [...data, ...localOnly];
                }
            } catch (err) {
                console.log('ℹ️ Modo local activo para videos');
            }
        }

        // 3. Rehidratar Object URLs para videos almacenados en IndexedDB
        for (const video of loadedVideos) {
            if (video.source_type === 'local' && (!video.url || video.url.startsWith('blob:'))) {
                const blob = await this.getVideoBlob(video.id);
                if (blob) {
                    video.url = URL.createObjectURL(blob);
                }
            }
        }

        this.videos = loadedVideos;
        this.saveLocalMeta();
    },

    saveLocalMeta() {
        try {
            const metaList = this.videos.map(v => ({
                id: v.id,
                title: v.title,
                description: v.description || '',
                category: v.category || 'General',
                url: v.source_type === 'local' ? '' : v.url,
                storage_path: v.storage_path || '',
                thumbnail_url: v.thumbnail_url || '',
                size_bytes: v.size_bytes || 0,
                duration_seconds: v.duration_seconds || 0,
                file_type: v.file_type || 'video/mp4',
                source_type: v.source_type || 'local',
                created_at: v.created_at || new Date().toISOString()
            }));
            localStorage.setItem('multimedia_videos_meta', JSON.stringify(metaList));
        } catch (e) {
            console.warn('Error guardando metadata local de videos:', e);
        }
    },

    // --------------------------------------------------------------------------
    // 5. Configuración de Eventos de la Interfaz
    // --------------------------------------------------------------------------
    setupEventListeners() {
        // Selector de Pestañas
        document.querySelectorAll('.multimedia-tab-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const tab = e.currentTarget.dataset.tab;
                if (tab) this.switchTab(tab);
            });
        });

        // Buscador de videos
        const searchInput = document.getElementById('videoSearchInput');
        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                this.searchQuery = e.target.value.toLowerCase().trim();
                this.renderVideosList();
            });
        }

        // Ordenamiento
        const sortSelect = document.getElementById('videoSortSelect');
        if (sortSelect) {
            sortSelect.addEventListener('change', (e) => {
                this.sortBy = e.target.value;
                this.renderVideosList();
            });
        }

        // Botón Subir Video
        const btnOpenUpload = document.getElementById('btnOpenUploadVideoModal');
        if (btnOpenUpload) {
            btnOpenUpload.addEventListener('click', () => this.openUploadModal());
        }

        // Drag & Drop en el Modal de Subida
        const dropzone = document.getElementById('videoDropzone');
        const fileInput = document.getElementById('videoFileInput');

        if (dropzone && fileInput) {
            dropzone.addEventListener('click', () => fileInput.click());

            dropzone.addEventListener('dragover', (e) => {
                e.preventDefault();
                dropzone.classList.add('dragover');
            });

            dropzone.addEventListener('dragleave', () => {
                dropzone.classList.remove('dragover');
            });

            dropzone.addEventListener('drop', (e) => {
                e.preventDefault();
                dropzone.classList.remove('dragover');
                if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
                    fileInput.files = e.dataTransfer.files;
                    this.handleFileSelected(e.dataTransfer.files[0]);
                }
            });

            fileInput.addEventListener('change', (e) => {
                if (e.target.files && e.target.files.length > 0) {
                    this.handleFileSelected(e.target.files[0]);
                }
            });
        }

        // Formulario de Subida/Guardado
        const uploadForm = document.getElementById('videoUploadForm');
        if (uploadForm) {
            uploadForm.addEventListener('submit', (e) => {
                e.preventDefault();
                this.saveVideo();
            });
        }

        this.renderCategoryPills();
    },

    onSourceTypeChange(type) {
        const isFile = type === 'file';
        const fileSection = document.getElementById('videoUploadFileSection');
        const urlSection = document.getElementById('videoUploadUrlSection');
        if (fileSection) fileSection.style.display = isFile ? 'block' : 'none';
        if (urlSection) urlSection.style.display = isFile ? 'none' : 'block';
    },

    handleFileInputChange(input) {
        if (input && input.files && input.files.length > 0) {
            this.handleFileSelected(input.files[0]);
        }
    },

    onSortChange(sortBy) {
        this.sortBy = sortBy;
        this.renderVideosList();
    },

    renderCategoryPills() {
        const container = document.getElementById('videoCategoryPills');
        if (!container) return;

        container.innerHTML = this.categories.map(cat => `
            <button type="button" class="category-pill ${this.selectedCategory === cat ? 'active' : ''}" 
                onclick="MultimediaModule.filterByCategory('${cat}')">
                ${cat}
            </button>
        `).join('');
    },

    filterByCategory(cat) {
        this.selectedCategory = cat;
        this.renderCategoryPills();
        this.renderVideosList();
    },

    // --------------------------------------------------------------------------
    // 6. Manejo de Selección de Archivo y Extracción de Metadatos
    // --------------------------------------------------------------------------
    handleFileSelected(file) {
        if (!file || !file.type.startsWith('video/')) {
            if (typeof Utils !== 'undefined' && Utils.showToast) {
                Utils.showToast('Por favor selecciona un archivo de video válido (.mp4, .webm, .mov, etc.)', 'warning');
            } else {
                alert('Por favor selecciona un archivo de video válido (.mp4, .webm, .mov, etc.)');
            }
            return;
        }

        this.selectedFileObject = file;

        // Auto-completar título si está vacío
        const titleInput = document.getElementById('videoTitleInput');
        if (titleInput && (!titleInput.value || titleInput.value.trim() === '')) {
            const cleanName = file.name.replace(/\.[^/.]+$/, "");
            titleInput.value = cleanName;
        }

        // Previsualizar archivo y leer duración / dimensiones
        const previewContainer = document.getElementById('videoFilePreviewContainer');
        const previewVideo = document.getElementById('videoFilePreview');
        const previewInfo = document.getElementById('videoFilePreviewInfo');

        const tempUrl = URL.createObjectURL(file);
        if (previewVideo) {
            previewVideo.src = tempUrl;
            previewVideo.onloadedmetadata = () => {
                const duration = previewVideo.duration || 0;
                const width = previewVideo.videoWidth || 0;
                const height = previewVideo.videoHeight || 0;

                this.selectedFileMetadata = {
                    duration_seconds: duration,
                    width,
                    height,
                    size_bytes: file.size,
                    file_type: file.type || 'video/mp4'
                };

                if (previewInfo) {
                    previewInfo.innerHTML = `
                        <strong>${file.name}</strong> • ${this.formatFileSize(file.size)} • ${this.formatDuration(duration)} 
                        ${width && height ? `(${width}x${height}px)` : ''}
                    `;
                }
            };

            if (previewContainer) previewContainer.style.display = 'block';
        }
    },

    // --------------------------------------------------------------------------
    // 7. Guardar / Subir Video
    // --------------------------------------------------------------------------
    async saveVideo() {
        const titleInput = document.getElementById('videoTitleInput');
        const title = titleInput ? titleInput.value.trim() : '';
        const catSelect = document.getElementById('videoCategorySelect');
        const category = catSelect ? catSelect.value : 'General';
        const descInput = document.getElementById('videoDescriptionInput');
        const description = descInput ? descInput.value.trim() : '';
        const sourceTypeRadio = document.querySelector('input[name="videoSourceType"]:checked');
        const isFile = sourceTypeRadio ? sourceTypeRadio.value === 'file' : true;

        if (!title) {
            if (typeof Utils !== 'undefined' && Utils.showToast) {
                Utils.showToast('El título del video es obligatorio', 'warning');
            } else {
                alert('El título del video es obligatorio');
            }
            return;
        }

        const submitBtn = document.getElementById('btnSubmitVideo');
        const progressContainer = document.getElementById('videoUploadProgressContainer');
        const progressBar = document.getElementById('videoUploadProgressBar');
        const progressStatus = document.getElementById('videoUploadProgressText');

        if (submitBtn) submitBtn.disabled = true;
        if (progressContainer) progressContainer.style.display = 'block';
        if (progressBar) progressBar.style.width = '15%';
        if (progressStatus) progressStatus.textContent = 'Procesando video...';

        try {
            const videoId = this.editingVideoId || 'vid_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6);
            let finalUrl = '';
            let sizeBytes = 0;
            let durationSeconds = 0;
            let fileType = 'video/mp4';
            let sourceType = isFile ? 'local' : 'url';
            let storagePath = '';
            let thumbnailUrl = '';

            if (this.editingVideoId) {
                // Modo Edición
                const existing = this.videos.find(v => v.id === this.editingVideoId);
                if (existing) {
                    existing.title = title;
                    existing.category = category;
                    existing.description = description;
                    finalUrl = existing.url;
                    sizeBytes = existing.size_bytes;
                    durationSeconds = existing.duration_seconds;
                    fileType = existing.file_type;
                    sourceType = existing.source_type;
                    storagePath = existing.storage_path;
                    thumbnailUrl = existing.thumbnail_url;
                }
            } else if (isFile) {
                // Modo Subida de Archivo
                if (!this.selectedFileObject) {
                    if (typeof Utils !== 'undefined' && Utils.showToast) {
                        Utils.showToast('Por favor selecciona un archivo de video primero', 'warning');
                    } else {
                        alert('Por favor selecciona un archivo de video primero');
                    }
                    if (submitBtn) submitBtn.disabled = false;
                    if (progressContainer) progressContainer.style.display = 'none';
                    return;
                }

                const file = this.selectedFileObject;
                sizeBytes = file.size;
                durationSeconds = this.selectedFileMetadata ? this.selectedFileMetadata.duration_seconds : 0;
                fileType = file.type || 'video/mp4';

                if (progressBar) progressBar.style.width = '45%';
                if (progressStatus) progressStatus.textContent = 'Guardando en biblioteca segura...';

                // Guardar Blob en IndexedDB
                await this.saveVideoBlob(videoId, file);
                finalUrl = URL.createObjectURL(file);

                // Intentar subir a Supabase Storage si está configurado y accesible
                if (window.supabaseClient && window.supabaseClient.storage) {
                    try {
                        if (progressBar) progressBar.style.width = '70%';
                        if (progressStatus) progressStatus.textContent = 'Sincronizando con la nube...';
                        const path = `videos/${videoId}_${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
                        const { data: uploadRes, error: uploadErr } = await supabaseClient.storage
                            .from('multimedia')
                            .upload(path, file, { cacheControl: '3600', upsert: true });

                        if (!uploadErr && uploadRes) {
                            const { data: publicUrlData } = supabaseClient.storage
                                .from('multimedia')
                                .getPublicUrl(path);

                            if (publicUrlData && publicUrlData.publicUrl) {
                                finalUrl = publicUrlData.publicUrl;
                                storagePath = path;
                                sourceType = 'supabase';
                            }
                        }
                    } catch (storageErr) {
                        console.log('ℹ️ Almacenamiento local IndexedDB activo');
                    }
                }
            } else {
                // Modo Enlace URL Externo
                const urlInput = document.getElementById('videoUrlInput');
                const urlVal = urlInput ? urlInput.value.trim() : '';
                if (!urlVal) {
                    if (typeof Utils !== 'undefined' && Utils.showToast) {
                        Utils.showToast('Por favor ingresa la URL del video', 'warning');
                    } else {
                        alert('Por favor ingresa la URL del video');
                    }
                    if (submitBtn) submitBtn.disabled = false;
                    if (progressContainer) progressContainer.style.display = 'none';
                    return;
                }

                finalUrl = urlVal;
                sourceType = this.detectSourceType(urlVal);
                fileType = 'video/url';
                sizeBytes = 0;
                durationSeconds = 0;
            }

            if (progressBar) progressBar.style.width = '90%';
            if (progressStatus) progressStatus.textContent = 'Finalizando...';

            const videoRecord = {
                id: videoId,
                title,
                description,
                category,
                url: finalUrl,
                storage_path: storagePath,
                thumbnail_url: thumbnailUrl,
                size_bytes: sizeBytes,
                duration_seconds: durationSeconds,
                file_type: fileType,
                source_type: sourceType,
                created_at: this.editingVideoId ? (this.videos.find(v => v.id === this.editingVideoId)?.created_at || new Date().toISOString()) : new Date().toISOString(),
                updated_at: new Date().toISOString()
            };

            if (this.editingVideoId) {
                const idx = this.videos.findIndex(v => v.id === this.editingVideoId);
                if (idx !== -1) this.videos[idx] = videoRecord;
            } else {
                this.videos.unshift(videoRecord);
            }

            // Sincronizar con base de datos de Supabase si está disponible
            if (window.supabaseClient) {
                try {
                    await supabaseClient.from('multimedia_videos').upsert({
                        id: videoRecord.id,
                        title: videoRecord.title,
                        description: videoRecord.description,
                        category: videoRecord.category,
                        url: videoRecord.url.startsWith('blob:') ? '' : videoRecord.url,
                        storage_path: videoRecord.storage_path,
                        thumbnail_url: videoRecord.thumbnail_url,
                        size_bytes: videoRecord.size_bytes,
                        duration_seconds: videoRecord.duration_seconds,
                        file_type: videoRecord.file_type,
                        source_type: videoRecord.source_type,
                        created_at: videoRecord.created_at,
                        updated_at: videoRecord.updated_at
                    });
                } catch(dbErr) {
                    console.log('ℹ️ Registro guardado localmente');
                }
            }

            this.saveLocalMeta();
            this.closeUploadModal();
            await this.renderVideosList();
            this.updateStats();

            if (typeof Utils !== 'undefined' && Utils.showToast) {
                Utils.showToast(this.editingVideoId ? '¡Video actualizado con éxito!' : '¡Video subido y agregado a la galería!', 'success');
            }
        } catch (error) {
            console.error('Error al guardar el video:', error);
            if (typeof Utils !== 'undefined' && Utils.showToast) {
                Utils.showToast('Ocurrió un error al guardar el video: ' + error.message, 'danger');
            } else {
                alert('Error al guardar el video: ' + error.message);
            }
        } finally {
            if (submitBtn) submitBtn.disabled = false;
            if (progressContainer) progressContainer.style.display = 'none';
        }
    },

    detectSourceType(url) {
        if (!url) return 'url';
        if (url.includes('youtube.com') || url.includes('youtu.be')) return 'youtube';
        if (url.includes('vimeo.com')) return 'vimeo';
        if (url.includes('cloudflarestream.com') || url.includes('videodelivery.net')) return 'cloudflare';
        if (url.includes('drive.google.com')) return 'google-drive';
        return 'url';
    },

    // --------------------------------------------------------------------------
    // 8. Renderizado de la Lista de Videos
    // --------------------------------------------------------------------------
    async renderVideosList() {
        const grid = document.getElementById('multimediaVideosGrid');
        const emptyState = document.getElementById('multimediaVideosEmpty');
        if (!grid) return;

        // Filtrar
        let filtered = [...this.videos];

        if (this.selectedCategory && this.selectedCategory !== 'Todos') {
            filtered = filtered.filter(v => (v.category || 'General') === this.selectedCategory);
        }

        if (this.searchQuery) {
            filtered = filtered.filter(v => 
                (v.title && v.title.toLowerCase().includes(this.searchQuery)) ||
                (v.description && v.description.toLowerCase().includes(this.searchQuery)) ||
                (v.category && v.category.toLowerCase().includes(this.searchQuery))
            );
        }

        // Ordenar
        filtered.sort((a, b) => {
            if (this.sortBy === 'newest') return new Date(b.created_at) - new Date(a.created_at);
            if (this.sortBy === 'oldest') return new Date(a.created_at) - new Date(b.created_at);
            if (this.sortBy === 'name') return (a.title || '').localeCompare(b.title || '');
            if (this.sortBy === 'size') return (b.size_bytes || 0) - (a.size_bytes || 0);
            return 0;
        });

        if (filtered.length === 0) {
            grid.innerHTML = '';
            if (emptyState) emptyState.style.display = 'block';
            return;
        }

        if (emptyState) emptyState.style.display = 'none';

        // Construir HTML de las tarjetas
        grid.innerHTML = filtered.map(v => {
            const durationLabel = v.duration_seconds ? this.formatDuration(v.duration_seconds) : '';
            const sizeLabel = v.size_bytes ? this.formatFileSize(v.size_bytes) : (v.source_type === 'youtube' ? 'YouTube' : 'Enlace Web');
            const dateLabel = this.formatDate(v.created_at);
            const sourceBadge = this.getSourceBadge(v.source_type);

            return `
                <div class="video-card glass-card" data-id="${v.id}">
                    <div class="video-card-thumb" onclick="MultimediaModule.openPlayerModal('${v.id}')">
                        ${this.renderCardMedia(v)}
                        <div class="video-play-overlay">
                            <div class="play-btn-circle">
                                <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>
                            </div>
                        </div>
                        ${durationLabel ? `<span class="video-duration-badge">${durationLabel}</span>` : ''}
                        <span class="video-source-badge">${sourceBadge}</span>
                    </div>
                    <div class="video-card-body">
                        <div class="video-card-header">
                            <span class="video-category-tag">${v.category || 'General'}</span>
                            <span class="video-date-text">${dateLabel}</span>
                        </div>
                        <h4 class="video-card-title" title="${this.escapeHtml(v.title)}">${this.escapeHtml(v.title)}</h4>
                        ${v.description ? `<p class="video-card-desc">${this.escapeHtml(v.description)}</p>` : ''}
                        
                        <div class="video-card-footer">
                            <span class="video-size-info">${sizeLabel}</span>
                            <div class="video-card-actions">
                                <button type="button" class="btn-video-action" title="Copiar Enlace" onclick="MultimediaModule.copyVideoUrl('${v.id}')">
                                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
                                </button>
                                <button type="button" class="btn-video-action" title="Descargar Video" onclick="MultimediaModule.downloadVideo('${v.id}')">
                                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
                                </button>
                                <button type="button" class="btn-video-action" title="Editar Detalles" onclick="MultimediaModule.openEditModal('${v.id}')">
                                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                                </button>
                                <button type="button" class="btn-video-action btn-danger-action" title="Eliminar Video" onclick="MultimediaModule.confirmDeleteVideo('${v.id}')">
                                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            `;
        }).join('');
    },

    renderCardMedia(video) {
        if (video.thumbnail_url) {
            return `<img src="${video.thumbnail_url}" alt="${this.escapeHtml(video.title)}" class="video-thumb-img" loading="lazy">`;
        }
        if (video.url && (video.url.startsWith('blob:') || video.url.includes('.mp4') || video.url.includes('.webm'))) {
            return `<video src="${video.url}#t=0.5" preload="metadata" muted playsinline class="video-thumb-preview"></video>`;
        }
        return `
            <div class="video-thumb-placeholder">
                <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="2" y="2" width="20" height="20" rx="2.18" ry="2.18"></rect><line x1="7" y1="2" x2="7" y2="22"></line><line x1="17" y1="2" x2="17" y2="22"></line><line x1="2" y1="12" x2="22" y2="12"></line><line x1="2" y1="7" x2="7" y2="7"></line><line x1="2" y1="17" x2="7" y2="17"></line><line x1="17" y1="17" x2="22" y2="17"></line><line x1="17" y1="7" x2="22" y2="7"></line></svg>
            </div>
        `;
    },

    getSourceBadge(sourceType) {
        switch (sourceType) {
            case 'youtube': return 'YouTube';
            case 'vimeo': return 'Vimeo';
            case 'cloudflare': return 'Cloudflare';
            case 'supabase': return 'Nube';
            default: return 'Local';
        }
    },

    // --------------------------------------------------------------------------
    // 9. Reproductor de Video en Modal
    // --------------------------------------------------------------------------
    async openPlayerModal(videoId) {
        const video = this.videos.find(v => v.id === videoId);
        if (!video) return;

        this.currentPlayingVideo = video;
        const modal = document.getElementById('modalVideoPlayer');
        const titleEl = document.getElementById('playerModalTitle');
        const descEl = document.getElementById('playerModalDesc');
        const container = document.getElementById('playerModalMediaContainer');

        if (titleEl) titleEl.textContent = video.title;
        if (descEl) descEl.textContent = video.description || `Categoría: ${video.category || 'General'} • Subido el ${this.formatDate(video.created_at)}`;

        // Rehidratar URL si es local y aún no tiene objectUrl
        let playUrl = video.url;
        if ((!playUrl || playUrl === '') && video.source_type === 'local') {
            const blob = await this.getVideoBlob(video.id);
            if (blob) {
                playUrl = URL.createObjectURL(blob);
                video.url = playUrl;
            }
        }

        if (container) {
            if (video.source_type === 'youtube') {
                const embedUrl = this.getYoutubeEmbedUrl(playUrl);
                container.innerHTML = `<iframe src="${embedUrl}?autoplay=1" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen style="width: 100%; height: 450px; border: none; border-radius: 8px;"></iframe>`;
            } else {
                container.innerHTML = `
                    <video id="activeModalVideoPlayer" controls autoplay playsinline style="width: 100%; max-height: 70vh; background: #000; border-radius: 8px;">
                        <source src="${playUrl}" type="${video.file_type || 'video/mp4'}">
                        Tu navegador no soporta reproducción de video HTML5.
                    </video>
                    <div class="video-player-quick-controls">
                        <div style="display: flex; gap: 0.5rem; align-items: center; margin-top: 0.75rem;">
                            <span style="font-size: 0.8rem; color: var(--text-muted);">Velocidad:</span>
                            <button type="button" class="btn btn-sm btn-secondary" onclick="MultimediaModule.setPlaybackRate(1)">1.0x</button>
                            <button type="button" class="btn btn-sm btn-secondary" onclick="MultimediaModule.setPlaybackRate(1.25)">1.25x</button>
                            <button type="button" class="btn btn-sm btn-secondary" onclick="MultimediaModule.setPlaybackRate(1.5)">1.5x</button>
                            <button type="button" class="btn btn-sm btn-secondary" onclick="MultimediaModule.setPlaybackRate(2)">2.0x</button>
                        </div>
                    </div>
                `;
            }
        }

        if (modal) {
            modal.classList.add('active');
            modal.style.display = 'flex';
            document.body.style.overflow = 'hidden';
        }
    },

    setPlaybackRate(rate) {
        const player = document.getElementById('activeModalVideoPlayer');
        if (player) {
            player.playbackRate = rate;
            if (typeof Utils !== 'undefined' && Utils.showToast) {
                Utils.showToast(`Velocidad de reproducción: ${rate}x`, 'info');
            }
        }
    },

    closePlayerModal() {
        const modal = document.getElementById('modalVideoPlayer');
        const container = document.getElementById('playerModalMediaContainer');
        if (container) container.innerHTML = '';
        if (modal) {
            modal.classList.remove('active');
            modal.style.display = 'none';
            document.body.style.overflow = '';
        }
        this.currentPlayingVideo = null;
    },

    getYoutubeEmbedUrl(url) {
        if (!url) return '';
        const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
        const match = url.match(regExp);
        return (match && match[2].length === 11) ? `https://www.youtube.com/embed/${match[2]}` : url;
    },

    // --------------------------------------------------------------------------
    // 10. Acciones Rápidas: Copiar URL, Descargar, Editar, Eliminar
    // --------------------------------------------------------------------------
    async copyVideoUrl(videoId) {
        const video = this.videos.find(v => v.id === videoId);
        if (!video) return;

        let urlToCopy = video.url;
        if (!urlToCopy || urlToCopy.startsWith('blob:')) {
            urlToCopy = window.location.origin + window.location.pathname + '#multimedia';
        }

        try {
            await navigator.clipboard.writeText(urlToCopy);
            if (typeof Utils !== 'undefined' && Utils.showToast) {
                Utils.showToast('¡Enlace del video copiado al portapapeles!', 'success');
            }
        } catch(e) {
            const tempInput = document.createElement('input');
            tempInput.value = urlToCopy;
            document.body.appendChild(tempInput);
            tempInput.select();
            document.execCommand('copy');
            document.body.removeChild(tempInput);
            if (typeof Utils !== 'undefined' && Utils.showToast) {
                Utils.showToast('¡Enlace del video copiado al portapapeles!', 'success');
            }
        }
    },

    async downloadVideo(videoId) {
        const video = this.videos.find(v => v.id === videoId);
        if (!video) return;

        let downloadUrl = video.url;
        if ((!downloadUrl || downloadUrl === '') && video.source_type === 'local') {
            const blob = await this.getVideoBlob(video.id);
            if (blob) downloadUrl = URL.createObjectURL(blob);
        }

        if (!downloadUrl) {
            if (typeof Utils !== 'undefined' && Utils.showToast) {
                Utils.showToast('No se puede descargar este video directamente', 'warning');
            } else {
                alert('No se puede descargar este video directamente');
            }
            return;
        }

        const a = document.createElement('a');
        a.href = downloadUrl;
        a.download = (video.title || 'video').replace(/[^a-zA-Z0-9_-]/g, '_') + '.mp4';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        if (typeof Utils !== 'undefined' && Utils.showToast) {
            Utils.showToast('Descargando video...', 'info');
        }
    },

    openUploadModal() {
        this.editingVideoId = null;
        const modal = document.getElementById('modalUploadVideo');
        const titleEl = document.getElementById('uploadModalTitle');
        const submitBtn = document.getElementById('btnSubmitVideo');
        const form = document.getElementById('videoUploadForm');
        const previewContainer = document.getElementById('videoFilePreviewContainer');
        const fileSection = document.getElementById('videoUploadFileSection');
        const urlSection = document.getElementById('videoUploadUrlSection');
        const progressContainer = document.getElementById('videoUploadProgressContainer');

        if (form) form.reset();
        if (titleEl) titleEl.textContent = 'Subir Nuevo Video';
        if (submitBtn) submitBtn.textContent = 'Subir y Guardar Video';
        if (previewContainer) previewContainer.style.display = 'none';
        if (progressContainer) progressContainer.style.display = 'none';

        // Mostrar sección de archivo por defecto
        if (fileSection) fileSection.style.display = 'block';
        if (urlSection) urlSection.style.display = 'none';

        this.selectedFileObject = null;
        this.selectedFileMetadata = null;

        const radioFile = document.querySelector('input[name="videoSourceType"][value="file"]');
        if (radioFile) radioFile.checked = true;

        if (modal) {
            modal.classList.add('active');
            modal.style.display = 'flex';
            document.body.style.overflow = 'hidden';
        }
    },

    openEditModal(videoId) {
        const video = this.videos.find(v => v.id === videoId);
        if (!video) return;

        this.editingVideoId = videoId;
        const modal = document.getElementById('modalUploadVideo');
        const titleEl = document.getElementById('uploadModalTitle');
        const submitBtn = document.getElementById('btnSubmitVideo');
        const titleInput = document.getElementById('videoTitleInput');
        const catSelect = document.getElementById('videoCategorySelect');
        const descInput = document.getElementById('videoDescriptionInput');
        const previewContainer = document.getElementById('videoFilePreviewContainer');
        const fileSection = document.getElementById('videoUploadFileSection');
        const urlSection = document.getElementById('videoUploadUrlSection');
        const progressContainer = document.getElementById('videoUploadProgressContainer');

        if (titleEl) titleEl.textContent = 'Editar Detalles del Video';
        if (submitBtn) submitBtn.textContent = 'Guardar Cambios';
        if (titleInput) titleInput.value = video.title || '';
        if (catSelect) catSelect.value = video.category || 'General';
        if (descInput) descInput.value = video.description || '';

        // Ocultar zonas de archivo en modo edición rápida de metadatos
        if (fileSection) fileSection.style.display = 'none';
        if (urlSection) urlSection.style.display = 'none';
        if (previewContainer) previewContainer.style.display = 'none';
        if (progressContainer) progressContainer.style.display = 'none';

        if (modal) {
            modal.classList.add('active');
            modal.style.display = 'flex';
            document.body.style.overflow = 'hidden';
        }
    },

    closeUploadModal() {
        const modal = document.getElementById('modalUploadVideo');
        if (modal) {
            modal.classList.remove('active');
            modal.style.display = 'none';
            document.body.style.overflow = '';
        }
        this.editingVideoId = null;
        this.selectedFileObject = null;
        this.selectedFileMetadata = null;
    },

    async confirmDeleteVideo(videoId) {
        const video = this.videos.find(v => v.id === videoId);
        if (!video) return;

        if (!confirm(`¿Estás seguro de que deseas eliminar el video "${video.title}"? Esta acción no se puede deshacer.`)) {
            return;
        }

        try {
            // Eliminar de IndexedDB
            await this.deleteVideoBlob(videoId);

            // Eliminar de Supabase si existe
            if (window.supabaseClient) {
                try {
                    await supabaseClient.from('multimedia_videos').delete().eq('id', videoId);
                    if (video.storage_path) {
                        await supabaseClient.storage.from('multimedia').remove([video.storage_path]);
                    }
                } catch(err) {
                    console.warn('Error eliminando de Supabase:', err);
                }
            }

            this.videos = this.videos.filter(v => v.id !== videoId);
            this.saveLocalMeta();
            await this.renderVideosList();
            this.updateStats();

            if (typeof Utils !== 'undefined' && Utils.showToast) {
                Utils.showToast('Video eliminado con éxito', 'info');
            }
        } catch (e) {
            console.error('Error al eliminar video:', e);
            if (typeof Utils !== 'undefined' && Utils.showToast) {
                Utils.showToast('Error al eliminar el video', 'danger');
            }
        }
    },

    // --------------------------------------------------------------------------
    // 11. Estadísticas del Módulo
    // --------------------------------------------------------------------------
    updateStats() {
        const totalCountEl = document.getElementById('statTotalVideos');
        const totalStorageEl = document.getElementById('statTotalVideoStorage');
        const totalCategoriesEl = document.getElementById('statTotalVideoCategories');

        if (totalCountEl) totalCountEl.textContent = this.videos.length;

        if (totalStorageEl) {
            const totalBytes = this.videos.reduce((acc, v) => acc + (v.size_bytes || 0), 0);
            totalStorageEl.textContent = this.formatFileSize(totalBytes);
        }

        if (totalCategoriesEl) {
            const uniqueCats = new Set(this.videos.map(v => v.category || 'General'));
            totalCategoriesEl.textContent = uniqueCats.size;
        }
    },

    // --------------------------------------------------------------------------
    // 12. Utilidades Formato
    // --------------------------------------------------------------------------
    formatFileSize(bytes) {
        if (!bytes || bytes === 0) return '0 MB';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    },

    formatDuration(seconds) {
        if (!seconds || isNaN(seconds)) return '0:00';
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
    },

    formatDate(dateStr) {
        if (!dateStr) return '';
        try {
            const d = new Date(dateStr);
            return d.toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' });
        } catch(e) {
            return dateStr;
        }
    },

    escapeHtml(text) {
        if (!text) return '';
        return text
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }
};

// Auto-inicializar si el DOM ya cargó
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => MultimediaModule.init());
} else {
    setTimeout(() => MultimediaModule.init(), 100);
}

window.MultimediaModule = MultimediaModule;
