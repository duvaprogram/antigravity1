// ==============================================================================
// Multimedia Module (Imágenes y Videos) - Versión 2.1.31
// Gestión de galería de imágenes y subida / reproducción de videos
// Con soporte completo de subida Online a la nube (Supabase Storage / CDN)
// y generación de enlaces públicos para anuncios y campañas.
// ==============================================================================

const MultimediaModule = {
    version: '2.1.31',
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
    errorsLog: [], // Registro de errores con identificadores únicos

    // --------------------------------------------------------------------------
    // 0. Sistema de Identificación y Diagnóstico de Errores
    // --------------------------------------------------------------------------
    logError(code, message, details = null) {
        const timestamp = new Date().toLocaleTimeString();
        const errObj = {
            id: 'ERR-' + Date.now().toString().slice(-4),
            code: `[${code}]`,
            message: String(message || 'Error desconocido'),
            details: details ? (details.message || String(details)) : null,
            time: timestamp
        };

        this.errorsLog.unshift(errObj);
        if (this.errorsLog.length > 25) this.errorsLog.pop();

        console.error(`🚨 MULTIMEDIA ERROR ${errObj.code} (${errObj.time}): ${errObj.message}`, details || '');

        // Notificación visual destacada con el código del error
        if (typeof Utils !== 'undefined' && Utils.showToast) {
            Utils.showToast(`${errObj.code} ${message}`, 'danger');
        } else {
            alert(`${errObj.code}: ${message}`);
        }

        this.updateDiagnosticsUI();
        return errObj;
    },

    openDiagnosticsModal() {
        try {
            console.log('🩺 Abriendo diagnóstico Multimedia v' + this.version);
            this.updateDiagnosticsUI();

            // 1. Mostrar panel en página si existe
            const inPageDiag = document.getElementById('multimediaInPageDiag');
            if (inPageDiag) {
                inPageDiag.style.display = 'block';
                inPageDiag.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }

            // 2. Abrir modal
            if (typeof Utils !== 'undefined' && Utils.openModal) {
                Utils.openModal('modalMultimediaDiagnostics');
            } else {
                const modal = document.getElementById('modalMultimediaDiagnostics');
                if (modal) {
                    modal.classList.add('active');
                    modal.style.setProperty('display', 'flex', 'important');
                    modal.style.zIndex = '10002';
                    document.body.style.overflow = 'hidden';
                }
            }
        } catch(e) {
            alert('[ERR_DIAG_EXCEPTION] ' + e.message);
        }
    },

    closeDiagnosticsModal() {
        if (typeof Utils !== 'undefined' && Utils.closeModal) {
            Utils.closeModal('modalMultimediaDiagnostics');
        } else {
            const modal = document.getElementById('modalMultimediaDiagnostics');
            if (modal) {
                modal.classList.remove('active');
                modal.style.display = '';
                document.body.style.overflow = '';
            }
        }
    },

    updateDiagnosticsUI() {
        const versionEl = document.getElementById('diagVersion');
        const initEl = document.getElementById('diagInitStatus');
        const dbEl = document.getElementById('diagDbStatus');
        const modalEl = document.getElementById('diagModalStatus');
        const countEl = document.getElementById('diagVideoCount');
        const errorsContainer = document.getElementById('diagErrorsList');
        const inPageContent = document.getElementById('inPageDiagContent');

        if (versionEl) versionEl.textContent = `v${this.version}`;
        if (initEl) initEl.innerHTML = this.initialized ? '<span style="color: #10b981;">✅ Inicializado (Activo)</span>' : '<span style="color: #f59e0b;">⏳ Pendiente de inicialización</span>';
        if (dbEl) dbEl.innerHTML = this.db ? '<span style="color: #10b981;">✅ IndexedDB Conectado</span>' : '<span style="color: #3b82f6;">ℹ️ Memoria Local / Supabase</span>';
        
        const uploadModal = document.getElementById('modalUploadVideo');
        if (modalEl) modalEl.innerHTML = uploadModal ? '<span style="color: #10b981;">✅ Modal en DOM (#modalUploadVideo)</span>' : '<span style="color: #ef4444;">❌ Modal ausente en el DOM</span>';
        
        const onlineCount = this.videos.filter(v => v.source_type === 'supabase' || v.source_type === 'cloudflare' || v.source_type === 'youtube' || v.source_type === 'url').length;
        const localCount = this.videos.filter(v => v.source_type === 'local').length;
        if (countEl) countEl.textContent = `${this.videos.length} videos (${onlineCount} Online 🌐, ${localCount} Local 💾)`;

        const errorsHtml = this.errorsLog.length === 0
            ? '<div style="color: #10b981; font-size: 0.85rem; padding: 0.5rem 0;">✅ Todo en orden. Sin errores registrados.</div>'
            : this.errorsLog.map(e => `
                <div style="background: rgba(239, 68, 68, 0.12); border-left: 3px solid #ef4444; padding: 0.6rem 0.8rem; border-radius: 4px; margin-bottom: 0.5rem; font-size: 0.82rem;">
                    <div style="display: flex; justify-content: space-between; align-items: center;">
                        <strong style="color: #f87171;">${e.code} ${e.id}</strong>
                        <span style="color: var(--text-muted); font-size: 0.75rem;">${e.time}</span>
                    </div>
                    <div style="color: var(--text-primary); margin-top: 0.2rem;">${this.escapeHtml(e.message)}</div>
                    ${e.details ? `<div style="color: var(--text-secondary); font-size: 0.75rem; margin-top: 0.2rem; font-family: monospace;">${this.escapeHtml(e.details)}</div>` : ''}
                </div>
            `).join('');

        if (errorsContainer) errorsContainer.innerHTML = errorsHtml;
        if (inPageContent) {
            inPageContent.innerHTML = `
                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 0.5rem; margin-bottom: 0.75rem;">
                    <div><strong>Versión:</strong> v${this.version}</div>
                    <div><strong>Módulo:</strong> ${this.initialized ? '✅ Listo' : '❌ Pendiente'}</div>
                    <div><strong>Videos Online:</strong> <span style="color: #10b981;">${onlineCount} 🌐</span></div>
                    <div><strong>Videos Locales:</strong> ${localCount} 💾</div>
                </div>
                <div>${errorsHtml}</div>
            `;
        }
    },

    clearErrorsLog() {
        this.errorsLog = [];
        this.updateDiagnosticsUI();
        if (typeof Utils !== 'undefined' && Utils.showToast) {
            Utils.showToast('Historial de errores limpiado', 'info');
        }
    },

    // --------------------------------------------------------------------------
    // 1. Subida a la Nube (Supabase Storage con Fallback de Buckets)
    // --------------------------------------------------------------------------
    async uploadFileToCloud(videoId, file) {
        if (!window.supabaseClient || !window.supabaseClient.storage) {
            return { success: false, error: 'Cliente de Supabase Storage no disponible' };
        }

        const cleanFileName = (file.name || 'video.mp4').replace(/[^a-zA-Z0-9._-]/g, '_');
        const path = `videos/${videoId}_${cleanFileName}`;

        // Intentar en los buckets disponibles en Supabase
        const bucketsToTry = ['multimedia', 'videos', 'images', 'public'];
        let lastError = null;

        for (const bucket of bucketsToTry) {
            try {
                const { data, error } = await supabaseClient.storage
                    .from(bucket)
                    .upload(path, file, { cacheControl: '3600', upsert: true });

                if (!error && data) {
                    const { data: publicUrlData } = supabaseClient.storage
                        .from(bucket)
                        .getPublicUrl(path);

                    if (publicUrlData && publicUrlData.publicUrl) {
                        return {
                            success: true,
                            publicUrl: publicUrlData.publicUrl,
                            storagePath: path,
                            bucket: bucket
                        };
                    }
                } else if (error) {
                    lastError = error;
                }
            } catch (e) {
                lastError = e;
            }
        }

        return { 
            success: false, 
            error: lastError ? (lastError.message || String(lastError)) : 'No se pudo subir a Supabase Storage' 
        };
    },

    async uploadExistingLocalVideoToCloud(videoId) {
        const video = this.videos.find(v => v.id === videoId);
        if (!video) return;

        const blob = await this.getVideoBlob(videoId);
        if (!blob) {
            this.logError('ERR_NO_LOCAL_BLOB', 'No se encontró el archivo del video en la memoria local.');
            return;
        }

        if (typeof Utils !== 'undefined' && Utils.showToast) {
            Utils.showToast('Subiendo video a la nube para generar enlace público online...', 'info');
        }

        const file = new File([blob], (video.title || 'video').replace(/[^a-zA-Z0-9._-]/g, '_') + '.mp4', { 
            type: video.file_type || 'video/mp4' 
        });

        const cloudRes = await this.uploadFileToCloud(videoId, file);

        if (cloudRes.success) {
            video.url = cloudRes.publicUrl;
            video.storage_path = cloudRes.storagePath;
            video.source_type = 'supabase';
            video.updated_at = new Date().toISOString();

            if (window.supabaseClient) {
                try {
                    await supabaseClient.from('multimedia_videos').upsert({
                        id: video.id,
                        title: video.title,
                        description: video.description,
                        category: video.category,
                        url: video.url,
                        storage_path: video.storage_path,
                        thumbnail_url: video.thumbnail_url,
                        size_bytes: video.size_bytes,
                        duration_seconds: video.duration_seconds,
                        file_type: video.file_type,
                        source_type: 'supabase',
                        created_at: video.created_at,
                        updated_at: video.updated_at
                    });
                } catch(e) {
                    console.warn('Error guardando en BD Supabase:', e);
                }
            }

            this.saveLocalMeta();
            await this.renderVideosList();
            this.updateStats();

            if (typeof Utils !== 'undefined' && Utils.showToast) {
                Utils.showToast('¡Video subido a la nube con éxito! Enlace público generado.', 'success');
            }
        } else {
            this.logError('ERR_CLOUD_UPLOAD', 'No se pudo subir a Supabase Storage: ' + cloudRes.error);
            alert(`Para que los videos se suban a la nube de Supabase:\n1. Ve a Supabase -> Storage\n2. Crea un bucket público llamado "multimedia"\n3. Ejecuta el archivo SQL "supabase_multimedia_schema.sql" en el editor SQL.\n\nDetalle: ${cloudRes.error}`);
        }
    },

    // --------------------------------------------------------------------------
    // 2. Almacenamiento Local en IndexedDB (Caché / Offline)
    // --------------------------------------------------------------------------
    async initDB() {
        return new Promise((resolve) => {
            if (this.db) return resolve(this.db);
            
            const safetyTimeout = setTimeout(() => {
                console.warn('⚠️ [ERR_INDEXEDDB_TIMEOUT] Tiempo agotado al conectar IndexedDB. Usando modo memoria.');
                resolve(null);
            }, 1500);

            try {
                if (!window.indexedDB) {
                    clearTimeout(safetyTimeout);
                    return resolve(null);
                }

                const request = indexedDB.open('MultimediaDB', 1);
                request.onupgradeneeded = (e) => {
                    const db = e.target.result;
                    if (!db.objectStoreNames.contains('video_files')) {
                        db.createObjectStore('video_files', { keyPath: 'id' });
                    }
                };
                request.onsuccess = (e) => {
                    clearTimeout(safetyTimeout);
                    this.db = e.target.result;
                    resolve(this.db);
                };
                request.onerror = (err) => {
                    clearTimeout(safetyTimeout);
                    this.logError('ERR_INDEXEDDB_INIT', 'No se pudo abrir la base de datos local IndexedDB', err);
                    resolve(null);
                };
            } catch (e) {
                clearTimeout(safetyTimeout);
                this.logError('ERR_INDEXEDDB_EXCEPTION', 'Excepción al inicializar IndexedDB', e);
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
                tx.onerror = (err) => {
                    this.logError('ERR_BLOB_WRITE', 'Error al escribir el archivo de video en IndexedDB', err);
                    resolve(false);
                };
            } catch (e) {
                this.logError('ERR_BLOB_TX_EXCEPTION', 'Excepción en transacción de guardado blob', e);
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
    // 3. Inicialización del Módulo
    // --------------------------------------------------------------------------
    async init() {
        if (this.initialized) {
            this.render();
            return;
        }

        try {
            await this.initDB();
            this.setupEventListeners();
            await this.loadVideos();

            const savedTab = localStorage.getItem('multimedia_active_tab');
            if (savedTab && (savedTab === 'images' || savedTab === 'videos')) {
                this.activeTab = savedTab;
            }

            this.initialized = true;
            this.render();
            console.log(`✅ MultimediaModule v${this.version} listo.`);
        } catch(err) {
            this.logError('ERR_MODULE_INIT', 'Error general al inicializar MultimediaModule', err);
        }
    },

    async render() {
        this.switchTab(this.activeTab, false);
        if (this.activeTab === 'videos') {
            await this.renderVideosList();
            this.updateStats();
        }
    },

    // --------------------------------------------------------------------------
    // 4. Gestión de Pestañas (Imágenes vs Videos)
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
    // 5. Carga y Persistencia de Videos
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
            this.logError('ERR_LOCAL_STORAGE_READ', 'Error leyendo videos de localStorage', e);
        }

        // 2. Intentar sincronizar desde Supabase DB
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
                url: (v.source_type === 'local' && v.url && v.url.startsWith('blob:')) ? '' : v.url,
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
            this.logError('ERR_LOCAL_STORAGE_SAVE', 'Error guardando metadata local de videos', e);
        }
    },

    // --------------------------------------------------------------------------
    // 6. Configuración de Eventos de la Interfaz
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

    // --------------------------------------------------------------------------
    // 7. Subida Directa desde Tarjeta en Pantalla
    // --------------------------------------------------------------------------
    async handleDirectFileUpload(input) {
        if (!input || !input.files || input.files.length === 0) return;
        const file = input.files[0];
        const statusEl = document.getElementById('directVideoStatus');
        const titleInput = document.getElementById('directVideoTitleInput');
        const catSelect = document.getElementById('directVideoCategorySelect');
        
        let title = (titleInput && titleInput.value.trim()) ? titleInput.value.trim() : file.name.replace(/\.[^/.]+$/, "");
        let category = (catSelect && catSelect.value) ? catSelect.value : 'General';
        
        if (statusEl) {
            statusEl.style.display = 'block';
            statusEl.innerHTML = `<span>⏳ Subiendo video <strong>"${this.escapeHtml(file.name)}"</strong> a la nube para generar enlace online...</span>`;
        }
        
        try {
            const videoId = 'vid_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6);
            
            // 1. Guardar blob en IndexedDB como copia local inmediata
            await this.saveVideoBlob(videoId, file);
            let finalUrl = URL.createObjectURL(file);
            let sourceType = 'local';
            let storagePath = '';

            // 2. Intentar subir a Supabase Storage para tener link ONLINE público
            const cloudRes = await this.uploadFileToCloud(videoId, file);
            if (cloudRes.success) {
                finalUrl = cloudRes.publicUrl;
                sourceType = 'supabase';
                storagePath = cloudRes.storagePath;
            } else {
                console.warn('⚠️ No se pudo subir a Supabase Storage, guardado localmente:', cloudRes.error);
            }
            
            const videoRecord = {
                id: videoId,
                title: title,
                description: '',
                category: category,
                url: finalUrl,
                storage_path: storagePath,
                thumbnail_url: '',
                size_bytes: file.size,
                duration_seconds: 0,
                file_type: file.type || 'video/mp4',
                source_type: sourceType,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
            };
            
            this.videos.unshift(videoRecord);

            // Sincronizar en BD Supabase si existe
            if (window.supabaseClient) {
                try {
                    await supabaseClient.from('multimedia_videos').upsert({
                        id: videoRecord.id,
                        title: videoRecord.title,
                        description: videoRecord.description,
                        category: videoRecord.category,
                        url: videoRecord.source_type === 'local' ? '' : videoRecord.url,
                        storage_path: videoRecord.storage_path,
                        thumbnail_url: videoRecord.thumbnail_url,
                        size_bytes: videoRecord.size_bytes,
                        duration_seconds: videoRecord.duration_seconds,
                        file_type: videoRecord.file_type,
                        source_type: videoRecord.source_type,
                        created_at: videoRecord.created_at,
                        updated_at: videoRecord.updated_at
                    });
                } catch(e) {}
            }

            this.saveLocalMeta();
            await this.renderVideosList();
            this.updateStats();
            
            if (titleInput) titleInput.value = '';
            if (statusEl) {
                if (sourceType === 'supabase') {
                    statusEl.innerHTML = `<span style="color: #10b981;">✅ ¡Video <strong>"${this.escapeHtml(title)}"</strong> subido ONLINE a la nube con éxito! Enlace público disponible.</span>`;
                } else {
                    statusEl.innerHTML = `<span style="color: #fbbf24;">💾 Guardado localmente. Haz clic en "Subir a la nube" en la tarjeta para generar su enlace público.</span>`;
                }
                setTimeout(() => { statusEl.style.display = 'none'; }, 6000);
            }

            if (typeof Utils !== 'undefined' && Utils.showToast) {
                Utils.showToast(sourceType === 'supabase' ? `¡Video "${title}" subido ONLINE con éxito!` : `Video "${title}" guardado`, 'success');
            }
        } catch(err) {
            this.logError('ERR_DIRECT_UPLOAD', 'Error al subir el video directamente', err);
            if (statusEl) {
                statusEl.innerHTML = `<span style="color: #ef4444;">❌ Error: ${err.message}</span>`;
            }
        } finally {
            input.value = '';
        }
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
    // 8. Manejo de Selección de Archivo y Extracción de Metadatos
    // --------------------------------------------------------------------------
    handleFileSelected(file) {
        if (!file) {
            this.logError('ERR_FILE_NULL', 'No se detectó ningún archivo seleccionado');
            return;
        }

        if (!file.type.startsWith('video/') && !file.name.match(/\.(mp4|webm|mov|mkv|avi|m4v)$/i)) {
            this.logError('ERR_INVALID_FORMAT', `El archivo "${file.name}" no parece ser un formato de video válido (.mp4, .webm, .mov, etc.)`);
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

        try {
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

                previewVideo.onerror = () => {
                    if (previewInfo) {
                        previewInfo.innerHTML = `<strong>${file.name}</strong> • ${this.formatFileSize(file.size)}`;
                    }
                };

                if (previewContainer) previewContainer.style.display = 'block';
            }
        } catch(previewErr) {
            this.logError('ERR_PREVIEW_GEN', 'No se pudo generar vista previa del archivo', previewErr);
        }
    },

    // --------------------------------------------------------------------------
    // 9. Guardar / Subir Video desde Modal
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
            this.logError('ERR_TITLE_REQUIRED', 'Debes escribir un título para el video');
            if (titleInput) titleInput.focus();
            return;
        }

        const submitBtn = document.getElementById('btnSubmitVideo');
        const progressContainer = document.getElementById('videoUploadProgressContainer');
        const progressBar = document.getElementById('videoUploadProgressBar');
        const progressStatus = document.getElementById('videoUploadProgressText');

        if (submitBtn) submitBtn.disabled = true;
        if (progressContainer) progressContainer.style.display = 'block';
        if (progressBar) progressBar.style.width = '20%';
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
                    this.logError('ERR_NO_FILE_ATTACHED', 'Por favor selecciona o arrastra un archivo de video antes de guardar.');
                    if (submitBtn) submitBtn.disabled = false;
                    if (progressContainer) progressContainer.style.display = 'none';
                    return;
                }

                const file = this.selectedFileObject;
                sizeBytes = file.size;
                durationSeconds = this.selectedFileMetadata ? this.selectedFileMetadata.duration_seconds : 0;
                fileType = file.type || 'video/mp4';

                if (progressBar) progressBar.style.width = '40%';
                if (progressStatus) progressStatus.textContent = 'Guardando copia local segura...';

                // Guardar Blob en IndexedDB
                await this.saveVideoBlob(videoId, file);
                finalUrl = URL.createObjectURL(file);

                // Subir a Supabase Storage para tener link público ONLINE
                if (progressBar) progressBar.style.width = '65%';
                if (progressStatus) progressStatus.textContent = 'Subiendo a la nube de Supabase para generar enlace online...';

                const cloudRes = await this.uploadFileToCloud(videoId, file);
                if (cloudRes.success) {
                    finalUrl = cloudRes.publicUrl;
                    storagePath = cloudRes.storagePath;
                    sourceType = 'supabase';
                } else {
                    console.warn('⚠️ Almacenamiento online falló, usando local:', cloudRes.error);
                }
            } else {
                // Modo Enlace URL Externo
                const urlInput = document.getElementById('videoUrlInput');
                const urlVal = urlInput ? urlInput.value.trim() : '';
                if (!urlVal) {
                    this.logError('ERR_URL_EMPTY', 'Por favor ingresa el enlace o URL del video.');
                    if (urlInput) urlInput.focus();
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

            if (progressBar) progressBar.style.width = '95%';
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

            // Sincronizar con Supabase DB si está disponible
            if (window.supabaseClient) {
                try {
                    await supabaseClient.from('multimedia_videos').upsert({
                        id: videoRecord.id,
                        title: videoRecord.title,
                        description: videoRecord.description,
                        category: videoRecord.category,
                        url: videoRecord.source_type === 'local' ? '' : videoRecord.url,
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
                    console.log('ℹ️ Registro persistido localmente');
                }
            }

            this.saveLocalMeta();
            this.closeUploadModal();
            await this.renderVideosList();
            this.updateStats();

            if (typeof Utils !== 'undefined' && Utils.showToast) {
                Utils.showToast(this.editingVideoId ? '¡Video actualizado con éxito!' : (sourceType === 'supabase' ? '¡Video subido ONLINE con éxito!' : '¡Video agregado a la galería!'), 'success');
            }
        } catch (error) {
            this.logError('ERR_SAVE_EXCEPTION', 'Excepción al procesar o guardar el video', error);
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
        if (url.includes('supabase.co')) return 'supabase';
        return 'url';
    },

    // --------------------------------------------------------------------------
    // 10. Renderizado de la Lista de Videos
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
            const isOnline = v.source_type === 'supabase' || v.source_type === 'cloudflare' || v.source_type === 'youtube' || v.source_type === 'url';
            const sourceBadgeHtml = this.getSourceBadgeHtml(v.source_type);

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
                        ${sourceBadgeHtml}
                    </div>
                    <div class="video-card-body">
                        <div class="video-card-header">
                            <span class="video-category-tag">${this.escapeHtml(v.category || 'General')}</span>
                            <span class="video-date-text">${dateLabel}</span>
                        </div>
                        <h4 class="video-card-title" title="${this.escapeHtml(v.title)}">${this.escapeHtml(v.title)}</h4>
                        ${v.description ? `<p class="video-card-desc">${this.escapeHtml(v.description)}</p>` : ''}
                        
                        <!-- Barra de Enlace Online Directo -->
                        <div style="margin-top: 0.25rem;">
                            ${isOnline ? `
                                <button type="button" class="btn btn-sm" onclick="MultimediaModule.copyVideoUrl('${v.id}')" 
                                    style="width: 100%; font-size: 0.76rem; padding: 4px 8px; background: rgba(16, 185, 129, 0.12); color: #34d399; border: 1px solid rgba(16, 185, 129, 0.3); display: flex; align-items: center; justify-content: center; gap: 0.35rem; border-radius: 6px;">
                                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
                                    <span>Copiar Enlace Online</span>
                                </button>
                            ` : `
                                <button type="button" class="btn btn-sm" onclick="MultimediaModule.uploadExistingLocalVideoToCloud('${v.id}')" 
                                    style="width: 100%; font-size: 0.76rem; padding: 4px 8px; background: rgba(99, 102, 241, 0.12); color: #818cf8; border: 1px solid rgba(99, 102, 241, 0.3); display: flex; align-items: center; justify-content: center; gap: 0.35rem; border-radius: 6px;">
                                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z"></path></svg>
                                    <span>☁️ Subir a la Nube (Online)</span>
                                </button>
                            `}
                        </div>

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

    getSourceBadgeHtml(sourceType) {
        switch (sourceType) {
            case 'supabase':
                return `<span class="video-source-badge badge-online">🌐 Online</span>`;
            case 'cloudflare':
                return `<span class="video-source-badge badge-cloudflare">⚡ Cloudflare</span>`;
            case 'youtube':
                return `<span class="video-source-badge badge-youtube">▶️ YouTube</span>`;
            case 'url':
                return `<span class="video-source-badge badge-web">🔗 Web URL</span>`;
            default:
                return `<span class="video-source-badge badge-local">💾 Local</span>`;
        }
    },

    // --------------------------------------------------------------------------
    // 11. Reproductor de Video en Modal
    // --------------------------------------------------------------------------
    async openPlayerModal(videoId) {
        try {
            const video = this.videos.find(v => v.id === videoId);
            if (!video) {
                this.logError('ERR_PLAYER_VIDEO_NOT_FOUND', `Video con ID "${videoId}" no encontrado.`);
                return;
            }

            this.currentPlayingVideo = video;
            const modal = document.getElementById('modalVideoPlayer');
            const titleEl = document.getElementById('playerModalTitle');
            const descEl = document.getElementById('playerModalDesc');
            const container = document.getElementById('playerModalMediaContainer');

            if (!modal) {
                this.logError('ERR_PLAYER_MODAL_404', 'Modal de reproducción #modalVideoPlayer no encontrado en el DOM.');
                return;
            }

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

            if (typeof Utils !== 'undefined' && Utils.openModal) {
                Utils.openModal('modalVideoPlayer');
            } else {
                modal.classList.add('active');
                modal.style.setProperty('display', 'flex', 'important');
                modal.style.zIndex = '10001';
                document.body.style.overflow = 'hidden';
            }
        } catch(playerErr) {
            this.logError('ERR_PLAYER_EXCEPTION', 'Excepción al abrir el reproductor de video', playerErr);
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
        const container = document.getElementById('playerModalMediaContainer');
        if (container) container.innerHTML = '';
        if (typeof Utils !== 'undefined' && Utils.closeModal) {
            Utils.closeModal('modalVideoPlayer');
        } else {
            const modal = document.getElementById('modalVideoPlayer');
            if (modal) {
                modal.classList.remove('active');
                modal.style.display = '';
                document.body.style.overflow = '';
            }
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
    // 12. Acciones Rápidas: Copiar URL, Descargar, Editar, Eliminar
    // --------------------------------------------------------------------------
    async copyVideoUrl(videoId) {
        const video = this.videos.find(v => v.id === videoId);
        if (!video) return;

        let urlToCopy = video.url;

        // Si es un video local sin link online, ofrecer subir a la nube
        if (!urlToCopy || urlToCopy.startsWith('blob:') || video.source_type === 'local') {
            if (confirm('Este video se encuentra guardado en tu equipo local.\n\n¿Deseas subirlo a la nube ahora para generar un enlace online público compatible con anuncios y redes?')) {
                await this.uploadExistingLocalVideoToCloud(videoId);
                return;
            } else {
                urlToCopy = window.location.origin + window.location.pathname + '#multimedia';
            }
        }

        try {
            await navigator.clipboard.writeText(urlToCopy);
            if (typeof Utils !== 'undefined' && Utils.showToast) {
                Utils.showToast(`¡Enlace online copiado al portapapeles! 📋\n${urlToCopy}`, 'success');
            } else {
                alert(`¡Enlace copiado!\n${urlToCopy}`);
            }
        } catch(e) {
            const tempInput = document.createElement('input');
            tempInput.value = urlToCopy;
            document.body.appendChild(tempInput);
            tempInput.select();
            document.execCommand('copy');
            document.body.removeChild(tempInput);
            if (typeof Utils !== 'undefined' && Utils.showToast) {
                Utils.showToast(`¡Enlace online copiado! 📋`, 'success');
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
            this.logError('ERR_DOWNLOAD_UNAVAILABLE', 'No se pudo generar enlace directo para descargar este video.');
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
        try {
            console.log('🚀 Abriendo modal de subida de video v' + this.version);
            this.editingVideoId = null;
            const modal = document.getElementById('modalUploadVideo');
            const titleEl = document.getElementById('uploadModalTitle');
            const submitBtn = document.getElementById('btnSubmitVideo');
            const form = document.getElementById('videoUploadForm');
            const previewContainer = document.getElementById('videoFilePreviewContainer');
            const fileSection = document.getElementById('videoUploadFileSection');
            const urlSection = document.getElementById('videoUploadUrlSection');
            const progressContainer = document.getElementById('videoUploadProgressContainer');

            if (!modal) {
                this.logError('ERR_MODAL_NOT_FOUND', 'El elemento #modalUploadVideo no existe en el DOM.');
                alert('[ERR_MODAL_NOT_FOUND] No se encontró el modal #modalUploadVideo');
                return;
            }

            if (form) form.reset();
            if (titleEl) titleEl.textContent = 'Subir Nuevo Video a la Nube';
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

            if (typeof Utils !== 'undefined' && Utils.openModal) {
                Utils.openModal('modalUploadVideo');
            } else {
                modal.classList.add('active');
                modal.style.setProperty('display', 'flex', 'important');
                modal.style.zIndex = '10001';
                document.body.style.overflow = 'hidden';
            }
        } catch(err) {
            this.logError('ERR_OPEN_MODAL_EXCEPTION', 'Excepción al intentar abrir el modal de subida', err);
        }
    },

    openEditModal(videoId) {
        try {
            const video = this.videos.find(v => v.id === videoId);
            if (!video) {
                this.logError('ERR_EDIT_NOT_FOUND', `Video con ID "${videoId}" no encontrado para edición.`);
                return;
            }

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

            if (!modal) {
                this.logError('ERR_MODAL_NOT_FOUND', 'El modal de subida no está en el DOM');
                return;
            }

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

            if (typeof Utils !== 'undefined' && Utils.openModal) {
                Utils.openModal('modalUploadVideo');
            } else {
                modal.classList.add('active');
                modal.style.setProperty('display', 'flex', 'important');
                modal.style.zIndex = '10001';
                document.body.style.overflow = 'hidden';
            }
        } catch(err) {
            this.logError('ERR_EDIT_EXCEPTION', 'Excepción al abrir modal de edición', err);
        }
    },

    closeUploadModal() {
        if (typeof Utils !== 'undefined' && Utils.closeModal) {
            Utils.closeModal('modalUploadVideo');
        } else {
            const modal = document.getElementById('modalUploadVideo');
            if (modal) {
                modal.classList.remove('active');
                modal.style.display = '';
                document.body.style.overflow = '';
            }
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
            await this.deleteVideoBlob(videoId);

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
            this.logError('ERR_DELETE_VIDEO', 'Error al eliminar el video', e);
        }
    },

    // --------------------------------------------------------------------------
    // 13. Estadísticas del Módulo
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
    // 14. Utilidades Formato
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
            return String(dateStr);
        }
    },

    escapeHtml(text) {
        if (!text) return '';
        return String(text)
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }
};

// Exportar globalmente
window.MultimediaModule = MultimediaModule;

// Funciones globales seguras directas para HTML
window.openVideoUploadModal = function() {
    try {
        if (window.MultimediaModule) {
            window.MultimediaModule.openUploadModal();
        } else {
            alert('[ERR_MULTIMEDIA_NOT_FOUND] MultimediaModule no está cargado');
        }
    } catch(e) {
        alert('[ERR_OPEN_UPLOAD_MODAL] ' + e.message);
    }
};

window.openVideoDiagnosticsModal = function() {
    try {
        if (window.MultimediaModule) {
            window.MultimediaModule.openDiagnosticsModal();
        } else {
            alert('[ERR_MULTIMEDIA_NOT_FOUND] MultimediaModule no está cargado');
        }
    } catch(e) {
        alert('[ERR_OPEN_DIAG_MODAL] ' + e.message);
    }
};

window.switchMultimediaTab = function(tab) {
    try {
        if (window.MultimediaModule) {
            window.MultimediaModule.switchTab(tab);
        }
    } catch(e) {
        console.error('Error al cambiar pestaña:', e);
    }
};

// Auto-inicializar si el DOM ya cargó
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => MultimediaModule.init());
} else {
    setTimeout(() => MultimediaModule.init(), 50);
}
