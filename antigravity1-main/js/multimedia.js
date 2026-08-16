// ==============================================================================
// Multimedia Module (Imágenes y Videos) - Versión 2.1.36
// Gestión de galería de imágenes y subida / reproducción de videos
// Integración Directa con Cloudflare Stream y CDN (Enlaces Online Automáticos)
// ==============================================================================

const MultimediaModule = {
    version: '2.1.36',
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
    pendingFileForUpload: null,
    db: null,
    errorsLog: [],

    // --------------------------------------------------------------------------
    // 0. Configuración de Cloudflare
    // --------------------------------------------------------------------------
    getCloudflareConfig() {
        return {
            accountId: localStorage.getItem('cf_account_id') || '',
            apiToken: localStorage.getItem('cf_api_token') || '',
            deliveryDomain: localStorage.getItem('cf_delivery_domain') || ''
        };
    },

    openCloudflareConfigModal() {
        try {
            console.log('⚡ Activando configuración de Cloudflare v' + this.version);
            this.switchTab('videos');

            const cf = this.getCloudflareConfig();
            
            // 1. Llenar campos principales en pantalla
            const mainAcc = document.getElementById('cfAccountIdInputMain');
            const mainTok = document.getElementById('cfApiTokenInputMain');
            if (mainAcc) mainAcc.value = cf.accountId || '';
            if (mainTok) mainTok.value = cf.apiToken || '';

            // 2. Llenar campos en modal si existe
            const accInput = document.getElementById('cfAccountIdInput');
            const tokenInput = document.getElementById('cfApiTokenInput');
            const domainInput = document.getElementById('cfDeliveryDomainInput');
            if (accInput) accInput.value = cf.accountId || '';
            if (tokenInput) tokenInput.value = cf.apiToken || '';
            if (domainInput) domainInput.value = cf.deliveryDomain || '';

            // 3. Enfocar el campo en pantalla
            const mainCard = document.getElementById('cfMainConfigCard');
            if (mainCard) {
                mainCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
                if (mainAcc) {
                    mainAcc.focus();
                    mainCard.style.boxShadow = '0 0 15px rgba(249, 115, 22, 0.4)';
                    setTimeout(() => { mainCard.style.boxShadow = ''; }, 2000);
                }
            }

            // 4. Intentar abrir modal como alternativa
            const modal = document.getElementById('modalCloudflareConfig');
            if (modal) {
                modal.classList.add('active');
                modal.style.setProperty('display', 'flex', 'important');
                modal.style.zIndex = '10005';
            }

            if (typeof Utils !== 'undefined' && Utils.openModal) {
                Utils.openModal('modalCloudflareConfig');
            }
        } catch(e) {
            console.error('Error al abrir configuración de Cloudflare:', e);
        }
    },

    closeCloudflareConfigModal() {
        if (typeof Utils !== 'undefined' && Utils.closeModal) {
            Utils.closeModal('modalCloudflareConfig');
        } else {
            const modal = document.getElementById('modalCloudflareConfig');
            if (modal) {
                modal.classList.remove('active');
                modal.style.display = '';
            }
        }
    },

    saveMainCloudflareForm() {
        const mainAcc = document.getElementById('cfAccountIdInputMain');
        const mainTok = document.getElementById('cfApiTokenInputMain');
        const accountId = mainAcc ? mainAcc.value.trim() : '';
        const apiToken = mainTok ? mainTok.value.trim() : '';

        if (!accountId || !apiToken) {
            alert('Por favor ingresa tu Cloudflare Account ID y tu API Token.');
            if (mainAcc && !accountId) mainAcc.focus();
            else if (mainTok && !apiToken) mainTok.focus();
            return;
        }

        localStorage.setItem('cf_account_id', accountId);
        localStorage.setItem('cf_api_token', apiToken);

        this.closeCloudflareConfigModal();
        this.updateCloudflareUI();
        this.updateDiagnosticsUI();

        if (typeof Utils !== 'undefined' && Utils.showToast) {
            Utils.showToast('✅ ¡Cloudflare conectado con éxito para videos!', 'success');
        } else {
            alert('✅ ¡Cloudflare conectado con éxito!');
        }

        if (this.pendingFileForUpload) {
            const file = this.pendingFileForUpload;
            this.pendingFileForUpload = null;
            this.processVideoUpload(file);
        }
    },

    saveCloudflareForm() {
        const accInput = document.getElementById('cfAccountIdInput');
        const tokenInput = document.getElementById('cfApiTokenInput');
        const domainInput = document.getElementById('cfDeliveryDomainInput');
        const accountId = accInput ? accInput.value.trim() : '';
        const apiToken = tokenInput ? tokenInput.value.trim() : '';
        const deliveryDomain = domainInput ? domainInput.value.trim() : '';

        if (!accountId || !apiToken) {
            alert('Por favor ingresa tu Cloudflare Account ID y tu API Token.');
            return;
        }

        localStorage.setItem('cf_account_id', accountId);
        localStorage.setItem('cf_api_token', apiToken);
        if (deliveryDomain) localStorage.setItem('cf_delivery_domain', deliveryDomain);

        this.closeCloudflareConfigModal();
        this.updateCloudflareUI();
        this.updateDiagnosticsUI();

        if (typeof Utils !== 'undefined' && Utils.showToast) {
            Utils.showToast('✅ ¡Cloudflare conectado con éxito para videos!', 'success');
        } else {
            alert('✅ ¡Cloudflare conectado con éxito!');
        }

        if (this.pendingFileForUpload) {
            const file = this.pendingFileForUpload;
            this.pendingFileForUpload = null;
            this.processVideoUpload(file);
        }
    },

    updateCloudflareUI() {
        const cf = this.getCloudflareConfig();
        const isConfigured = Boolean(cf.accountId && cf.apiToken);

        // Actualizar inputs en pantalla
        const mainAcc = document.getElementById('cfAccountIdInputMain');
        const mainTok = document.getElementById('cfApiTokenInputMain');
        if (mainAcc && !mainAcc.value) mainAcc.value = cf.accountId || '';
        if (mainTok && !mainTok.value) mainTok.value = cf.apiToken || '';

        // Actualizar badge de estado en la tarjeta
        const badge = document.getElementById('cfConnectionStatusBadge');
        if (badge) {
            if (isConfigured) {
                badge.innerHTML = '✅ Conectado a Cloudflare';
                badge.style.background = 'rgba(16, 185, 129, 0.15)';
                badge.style.color = '#34d399';
                badge.style.borderColor = 'rgba(16, 185, 129, 0.3)';
            } else {
                badge.innerHTML = '⚠️ Sin configurar';
                badge.style.background = 'rgba(249, 115, 22, 0.15)';
                badge.style.color = '#fb923c';
                badge.style.borderColor = 'rgba(249, 115, 22, 0.3)';
            }
        }
    },

    // --------------------------------------------------------------------------
    // 1. Subida Online Directa a Cloudflare Stream
    // --------------------------------------------------------------------------
    async uploadToCloudflare(file) {
        const cf = this.getCloudflareConfig();
        if (!cf.accountId || !cf.apiToken) {
            return {
                success: false,
                requiresConfig: true,
                error: 'Faltan las credenciales de Cloudflare. Configúralas en la tarjeta superior.'
            };
        }

        try {
            // Método A: Direct Creator Upload
            const initRes = await fetch(`https://api.cloudflare.com/client/v4/accounts/${cf.accountId}/stream/direct_upload`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${cf.apiToken}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    maxDurationSeconds: 3600,
                    meta: { name: file.name }
                })
            });

            const initData = await initRes.json();

            if (initData.success && initData.result && initData.result.uploadURL) {
                const uploadUrl = initData.result.uploadURL;
                const uid = initData.result.uid;

                const uploadFormData = new FormData();
                uploadFormData.append('file', file);

                const uploadRes = await fetch(uploadUrl, {
                    method: 'POST',
                    body: uploadFormData
                });

                if (!uploadRes.ok) {
                    throw new Error('Error al transmitir el video a Cloudflare.');
                }

                const watchUrl = `https://iframe.videodelivery.net/${uid}`;
                const manifestUrl = `https://videodelivery.net/${uid}/manifest/video.m3u8`;
                const thumbUrl = `https://videodelivery.net/${uid}/thumbnails/thumbnail.jpg`;

                return {
                    success: true,
                    uid: uid,
                    publicUrl: watchUrl,
                    downloadUrl: `https://videodelivery.net/${uid}`,
                    playbackUrl: manifestUrl,
                    thumbnailUrl: thumbUrl,
                    sourceType: 'cloudflare'
                };
            }

            // Método B: Subida multipart directa
            const directFormData = new FormData();
            directFormData.append('file', file);

            const directRes = await fetch(`https://api.cloudflare.com/client/v4/accounts/${cf.accountId}/stream`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${cf.apiToken}`
                },
                body: directFormData
            });

            const directData = await directRes.json();
            if (directData.success && directData.result) {
                const uid = directData.result.uid;
                const watchUrl = `https://iframe.videodelivery.net/${uid}`;
                const manifestUrl = `https://videodelivery.net/${uid}/manifest/video.m3u8`;
                const thumbUrl = directData.result.thumbnail || `https://videodelivery.net/${uid}/thumbnails/thumbnail.jpg`;

                return {
                    success: true,
                    uid: uid,
                    publicUrl: watchUrl,
                    downloadUrl: `https://videodelivery.net/${uid}`,
                    playbackUrl: manifestUrl,
                    thumbnailUrl: thumbUrl,
                    sourceType: 'cloudflare'
                };
            }

            const errorMsg = directData.errors && directData.errors[0] ? directData.errors[0].message : 'Error al conectar con Cloudflare Stream';
            return { success: false, error: errorMsg };

        } catch (err) {
            return { success: false, error: err.message || String(err) };
        }
    },

    async uploadExistingVideoToCloudflare(videoId) {
        const video = this.videos.find(v => v.id === videoId);
        if (!video) return;

        const cf = this.getCloudflareConfig();
        if (!cf.accountId || !cf.apiToken) {
            this.pendingFileForUpload = null;
            this.openCloudflareConfigModal();
            return;
        }

        const blob = await this.getVideoBlob(videoId);
        if (!blob) {
            this.logError('ERR_NO_LOCAL_BLOB', 'No se encontró el archivo del video en la memoria.');
            return;
        }

        if (typeof Utils !== 'undefined' && Utils.showToast) {
            Utils.showToast('Subiendo video a Cloudflare Stream...', 'info');
        }

        const file = new File([blob], (video.title || 'video').replace(/[^a-zA-Z0-9._-]/g, '_') + '.mp4', { 
            type: video.file_type || 'video/mp4' 
        });

        const res = await this.uploadToCloudflare(file);

        if (res.success) {
            video.url = res.publicUrl;
            video.thumbnail_url = res.thumbnailUrl || '';
            video.source_type = 'cloudflare';
            video.updated_at = new Date().toISOString();

            this.saveLocalMeta();
            await this.renderVideosList();
            this.updateStats();

            if (typeof Utils !== 'undefined' && Utils.showToast) {
                Utils.showToast('¡Video subido a Cloudflare Stream con éxito! Enlace online generado.', 'success');
            }
        } else {
            this.logError('ERR_CF_UPLOAD', 'Error al subir a Cloudflare: ' + res.error);
        }
    },

    // --------------------------------------------------------------------------
    // 2. Sistema de Diagnóstico y Errores
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

        if (typeof Utils !== 'undefined' && Utils.showToast) {
            Utils.showToast(`${errObj.code} ${message}`, 'danger');
        }

        this.updateDiagnosticsUI();
        return errObj;
    },

    openDiagnosticsModal() {
        try {
            this.updateDiagnosticsUI();

            const inPageDiag = document.getElementById('multimediaInPageDiag');
            if (inPageDiag) {
                inPageDiag.style.display = 'block';
                inPageDiag.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }

            const modal = document.getElementById('modalMultimediaDiagnostics');
            if (modal) {
                modal.classList.add('active');
                modal.style.setProperty('display', 'flex', 'important');
                modal.style.zIndex = '10004';
            }

            if (typeof Utils !== 'undefined' && Utils.openModal) {
                Utils.openModal('modalMultimediaDiagnostics');
            }
        } catch(e) {
            console.error('Error al abrir diagnóstico:', e);
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

        const cf = this.getCloudflareConfig();
        const hasCf = Boolean(cf.accountId && cf.apiToken);

        if (versionEl) versionEl.textContent = `v${this.version}`;
        if (initEl) initEl.innerHTML = this.initialized ? '<span style="color: #10b981;">✅ Inicializado</span>' : '<span style="color: #f59e0b;">⏳ Pendiente</span>';
        if (dbEl) dbEl.innerHTML = hasCf ? '<span style="color: #f97316;">⚡ Cloudflare Stream Conectado</span>' : '<span style="color: #3b82f6;">ℹ️ Memoria Local</span>';
        
        const uploadModal = document.getElementById('modalUploadVideo');
        if (modalEl) modalEl.innerHTML = uploadModal ? '<span style="color: #10b981;">✅ Modal en DOM</span>' : '<span style="color: #ef4444;">❌ Modal ausente</span>';
        
        const cfCount = this.videos.filter(v => v.source_type === 'cloudflare').length;
        const onlineCount = this.videos.filter(v => v.source_type === 'cloudflare' || v.source_type === 'youtube' || v.source_type === 'url').length;
        if (countEl) countEl.textContent = `${this.videos.length} videos (${cfCount} Cloudflare ⚡, ${onlineCount} Online 🌐)`;

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
                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 0.5rem; margin-bottom: 0.75rem;">
                    <div><strong>Versión:</strong> v${this.version}</div>
                    <div><strong>Cloudflare:</strong> ${hasCf ? '<span style="color: #10b981;">✅ Conectado</span>' : '<span style="color: #fbbf24;">⚠️ Sin Token</span>'}</div>
                    <div><strong>Videos Cloudflare:</strong> <span style="color: #f97316;">${cfCount} ⚡</span></div>
                    <div><strong>Total Videos:</strong> ${this.videos.length}</div>
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
    // 3. Almacenamiento Local en IndexedDB
    // --------------------------------------------------------------------------
    async initDB() {
        return new Promise((resolve) => {
            if (this.db) return resolve(this.db);
            
            const safetyTimeout = setTimeout(() => {
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
                request.onerror = () => {
                    clearTimeout(safetyTimeout);
                    resolve(null);
                };
            } catch (e) {
                clearTimeout(safetyTimeout);
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
        } catch (e) {}
    },

    // --------------------------------------------------------------------------
    // 4. Inicialización del Módulo
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
            this.updateCloudflareUI();
            console.log(`✅ MultimediaModule v${this.version} listo.`);
        } catch(err) {
            this.logError('ERR_MODULE_INIT', 'Error al inicializar MultimediaModule', err);
        }
    },

    async render() {
        this.switchTab(this.activeTab, false);
        if (this.activeTab === 'videos') {
            await this.renderVideosList();
            this.updateStats();
            this.updateCloudflareUI();
        }
    },

    // --------------------------------------------------------------------------
    // 5. Gestión de Pestañas (Imágenes vs Videos)
    // --------------------------------------------------------------------------
    switchTab(tabName, save = true) {
        this.activeTab = tabName;
        if (save) {
            localStorage.setItem('multimedia_active_tab', tabName);
        }

        document.querySelectorAll('.multimedia-tab-btn').forEach(btn => {
            if (btn.dataset.tab === tabName) {
                btn.classList.add('active');
            } else {
                btn.classList.remove('active');
            }
        });

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
                this.updateCloudflareUI();
            }
        }
    },

    // --------------------------------------------------------------------------
    // 6. Carga y Persistencia de Videos
    // --------------------------------------------------------------------------
    async loadVideos() {
        let loadedVideos = [];

        try {
            const localSaved = localStorage.getItem('multimedia_videos_meta');
            if (localSaved) {
                loadedVideos = JSON.parse(localSaved);
            }
        } catch (e) {
            this.logError('ERR_LOCAL_STORAGE_READ', 'Error leyendo videos de localStorage', e);
        }

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
    // 7. Configuración de Eventos de la Interfaz
    // --------------------------------------------------------------------------
    setupEventListeners() {
        document.querySelectorAll('.multimedia-tab-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const tab = e.currentTarget.dataset.tab;
                if (tab) this.switchTab(tab);
            });
        });

        const searchInput = document.getElementById('videoSearchInput');
        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                this.searchQuery = e.target.value.toLowerCase().trim();
                this.renderVideosList();
            });
        }

        const sortSelect = document.getElementById('videoSortSelect');
        if (sortSelect) {
            sortSelect.addEventListener('change', (e) => {
                this.sortBy = e.target.value;
                this.renderVideosList();
            });
        }

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
    // 8. Subida Directa desde Tarjeta en Pantalla
    // --------------------------------------------------------------------------
    async handleDirectFileUpload(input) {
        if (!input || !input.files || input.files.length === 0) return;
        const file = input.files[0];
        await this.processVideoUpload(file);
        input.value = '';
    },

    async processVideoUpload(file) {
        const cf = this.getCloudflareConfig();
        const statusEl = document.getElementById('directVideoStatus');
        const titleInput = document.getElementById('directVideoTitleInput');
        const catSelect = document.getElementById('directVideoCategorySelect');
        
        let title = (titleInput && titleInput.value.trim()) ? titleInput.value.trim() : file.name.replace(/\.[^/.]+$/, "");
        let category = (catSelect && catSelect.value) ? catSelect.value : 'General';

        if (!cf.accountId || !cf.apiToken) {
            this.pendingFileForUpload = file;
            if (statusEl) {
                statusEl.style.display = 'block';
                statusEl.innerHTML = `<span style="color: #fb923c;">⚠️ Completa tu Account ID y Token de Cloudflare en la tarjeta superior para continuar la subida automática.</span>`;
            }
            this.openCloudflareConfigModal();
            return;
        }
        
        if (statusEl) {
            statusEl.style.display = 'block';
            statusEl.innerHTML = `<span>⚡ Transmitiendo video <strong>"${this.escapeHtml(file.name)}"</strong> a <strong>Cloudflare Stream</strong>...</span>`;
        }
        
        try {
            const videoId = 'vid_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6);
            
            await this.saveVideoBlob(videoId, file);
            let finalUrl = URL.createObjectURL(file);
            let sourceType = 'local';
            let thumbnailUrl = '';

            const cfRes = await this.uploadToCloudflare(file);
            if (cfRes.success) {
                finalUrl = cfRes.publicUrl;
                sourceType = 'cloudflare';
                thumbnailUrl = cfRes.thumbnailUrl || '';
            } else {
                console.warn('⚠️ Subida a Cloudflare falló:', cfRes.error);
            }
            
            const videoRecord = {
                id: videoId,
                title: title,
                description: '',
                category: category,
                url: finalUrl,
                storage_path: '',
                thumbnail_url: thumbnailUrl,
                size_bytes: file.size,
                duration_seconds: 0,
                file_type: file.type || 'video/mp4',
                source_type: sourceType,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
            };
            
            this.videos.unshift(videoRecord);
            this.saveLocalMeta();
            await this.renderVideosList();
            this.updateStats();
            
            if (titleInput) titleInput.value = '';
            if (statusEl) {
                if (sourceType === 'cloudflare') {
                    statusEl.innerHTML = `<span style="color: #10b981;">⚡ ¡Video <strong>"${this.escapeHtml(title)}"</strong> subido a <strong>Cloudflare Stream</strong> con éxito! Enlace online disponible.</span>`;
                } else {
                    statusEl.innerHTML = `<span style="color: #fbbf24;">💾 Video listo en la galería. Haz clic en "⚡ Subir a Cloudflare" para subirlo.</span>`;
                }
                setTimeout(() => { statusEl.style.display = 'none'; }, 6000);
            }

            if (typeof Utils !== 'undefined' && Utils.showToast) {
                Utils.showToast(sourceType === 'cloudflare' ? `¡Video "${title}" subido a Cloudflare!` : `Video "${title}" agregado a la galería`, 'success');
            }
        } catch(err) {
            this.logError('ERR_DIRECT_UPLOAD', 'Error al procesar el video', err);
            if (statusEl) {
                statusEl.innerHTML = `<span style="color: #ef4444;">❌ Error: ${err.message}</span>`;
            }
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
    // 9. Manejo de Archivo Seleccionado
    // --------------------------------------------------------------------------
    handleFileSelected(file) {
        if (!file) {
            this.logError('ERR_FILE_NULL', 'No se detectó ningún archivo seleccionado');
            return;
        }

        if (!file.type.startsWith('video/') && !file.name.match(/\.(mp4|webm|mov|mkv|avi|m4v)$/i)) {
            this.logError('ERR_INVALID_FORMAT', `El archivo "${file.name}" no es un video válido (.mp4, .webm, .mov)`);
            return;
        }

        this.selectedFileObject = file;

        const titleInput = document.getElementById('videoTitleInput');
        if (titleInput && (!titleInput.value || titleInput.value.trim() === '')) {
            const cleanName = file.name.replace(/\.[^/.]+$/, "");
            titleInput.value = cleanName;
        }

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

                if (previewContainer) previewContainer.style.display = 'block';
            }
        } catch(previewErr) {
            this.logError('ERR_PREVIEW_GEN', 'No se pudo generar vista previa', previewErr);
        }
    },

    // --------------------------------------------------------------------------
    // 10. Guardar / Subir Video desde Modal
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
                if (!this.selectedFileObject) {
                    this.logError('ERR_NO_FILE_ATTACHED', 'Por favor selecciona un archivo de video antes de guardar.');
                    if (submitBtn) submitBtn.disabled = false;
                    if (progressContainer) progressContainer.style.display = 'none';
                    return;
                }

                const file = this.selectedFileObject;
                sizeBytes = file.size;
                durationSeconds = this.selectedFileMetadata ? this.selectedFileMetadata.duration_seconds : 0;
                fileType = file.type || 'video/mp4';

                if (progressBar) progressBar.style.width = '40%';
                if (progressStatus) progressStatus.textContent = 'Guardando copia local...';

                await this.saveVideoBlob(videoId, file);
                finalUrl = URL.createObjectURL(file);

                const cf = this.getCloudflareConfig();
                if (cf.accountId && cf.apiToken) {
                    if (progressBar) progressBar.style.width = '65%';
                    if (progressStatus) progressStatus.textContent = 'Subiendo a Cloudflare Stream...';

                    const cfRes = await this.uploadToCloudflare(file);
                    if (cfRes.success) {
                        finalUrl = cfRes.publicUrl;
                        thumbnailUrl = cfRes.thumbnailUrl || '';
                        sourceType = 'cloudflare';
                    }
                }
            } else {
                const urlInput = document.getElementById('videoUrlInput');
                const urlVal = urlInput ? urlInput.value.trim() : '';
                if (!urlVal) {
                    this.logError('ERR_URL_EMPTY', 'Por favor ingresa el enlace del video.');
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
                if (sourceType === 'cloudflare' && urlVal.includes('videodelivery.net/')) {
                    const uidMatch = urlVal.match(/videodelivery\.net\/([a-zA-Z0-9_-]+)/);
                    if (uidMatch && uidMatch[1]) {
                        thumbnailUrl = `https://videodelivery.net/${uidMatch[1]}/thumbnails/thumbnail.jpg`;
                    }
                }
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

            this.saveLocalMeta();
            this.closeUploadModal();
            await this.renderVideosList();
            this.updateStats();

            if (typeof Utils !== 'undefined' && Utils.showToast) {
                Utils.showToast(this.editingVideoId ? '¡Video actualizado!' : (sourceType === 'cloudflare' ? '¡Video subido a Cloudflare!' : '¡Video agregado a la galería!'), 'success');
            }
        } catch (error) {
            this.logError('ERR_SAVE_EXCEPTION', 'Excepción al guardar el video', error);
        } finally {
            if (submitBtn) submitBtn.disabled = false;
            if (progressContainer) progressContainer.style.display = 'none';
        }
    },

    detectSourceType(url) {
        if (!url) return 'url';
        if (url.includes('cloudflarestream.com') || url.includes('videodelivery.net') || url.includes('cloudflare') || url.includes('pages.dev') || url.includes('r2.dev') || url.includes('workers.dev')) return 'cloudflare';
        if (url.includes('youtube.com') || url.includes('youtu.be')) return 'youtube';
        if (url.includes('vimeo.com')) return 'vimeo';
        if (url.includes('drive.google.com')) return 'google-drive';
        return 'url';
    },

    // --------------------------------------------------------------------------
    // 11. Renderizado de la Lista de Videos
    // --------------------------------------------------------------------------
    async renderVideosList() {
        const grid = document.getElementById('multimediaVideosGrid');
        const emptyState = document.getElementById('multimediaVideosEmpty');
        if (!grid) return;

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

        grid.innerHTML = filtered.map(v => {
            const durationLabel = v.duration_seconds ? this.formatDuration(v.duration_seconds) : '';
            const sizeLabel = v.size_bytes ? this.formatFileSize(v.size_bytes) : (v.source_type === 'youtube' ? 'YouTube' : 'Cloudflare / Web');
            const dateLabel = this.formatDate(v.created_at);
            const isOnline = v.source_type === 'cloudflare' || v.source_type === 'youtube' || v.source_type === 'url';
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
                                    style="width: 100%; font-size: 0.76rem; padding: 4px 8px; background: rgba(249, 115, 22, 0.12); color: #fb923c; border: 1px solid rgba(249, 115, 22, 0.3); display: flex; align-items: center; justify-content: center; gap: 0.35rem; border-radius: 6px;">
                                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
                                    <span>Copiar Enlace Cloudflare</span>
                                </button>
                            ` : `
                                <button type="button" class="btn btn-sm" onclick="MultimediaModule.uploadExistingVideoToCloudflare('${v.id}')" 
                                    style="width: 100%; font-size: 0.76rem; padding: 4px 8px; background: rgba(249, 115, 22, 0.12); color: #fb923c; border: 1px solid rgba(249, 115, 22, 0.3); display: flex; align-items: center; justify-content: center; gap: 0.35rem; border-radius: 6px;">
                                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z"></path></svg>
                                    <span>⚡ Subir a Cloudflare</span>
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
    // 12. Reproductor de Video en Modal
    // --------------------------------------------------------------------------
    async openPlayerModal(videoId) {
        try {
            const video = this.videos.find(v => v.id === videoId);
            if (!video) return;

            this.currentPlayingVideo = video;
            const modal = document.getElementById('modalVideoPlayer');
            const titleEl = document.getElementById('playerModalTitle');
            const descEl = document.getElementById('playerModalDesc');
            const container = document.getElementById('playerModalMediaContainer');

            if (!modal) return;

            if (titleEl) titleEl.textContent = video.title;
            if (descEl) descEl.textContent = video.description || `Categoría: ${video.category || 'General'} • Subido el ${this.formatDate(video.created_at)}`;

            let playUrl = video.url;
            if ((!playUrl || playUrl === '') && video.source_type === 'local') {
                const blob = await this.getVideoBlob(video.id);
                if (blob) {
                    playUrl = URL.createObjectURL(blob);
                    video.url = playUrl;
                }
            }

            if (container) {
                if (video.source_type === 'cloudflare' && (playUrl.includes('iframe.videodelivery.net') || playUrl.includes('cloudflarestream.com'))) {
                    container.innerHTML = `<iframe src="${playUrl}?autoplay=true" allow="accelerometer; gyroscope; autoplay; encrypted-media; picture-in-picture;" allowfullscreen="true" style="border: none; width: 100%; height: 450px; border-radius: 8px;"></iframe>`;
                } else if (video.source_type === 'youtube') {
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
    // 13. Copiar Enlace, Descargar, Editar, Eliminar
    // --------------------------------------------------------------------------
    async copyVideoUrl(videoId) {
        const video = this.videos.find(v => v.id === videoId);
        if (!video) return;

        let urlToCopy = video.url;

        if (!urlToCopy || urlToCopy.startsWith('blob:') || video.source_type === 'local') {
            await this.uploadExistingVideoToCloudflare(videoId);
            return;
        }

        try {
            await navigator.clipboard.writeText(urlToCopy);
            if (typeof Utils !== 'undefined' && Utils.showToast) {
                Utils.showToast(`¡Enlace copiado al portapapeles! 📋\n${urlToCopy}`, 'success');
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
            this.logError('ERR_DOWNLOAD_UNAVAILABLE', 'No se pudo generar enlace de descarga.');
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
            this.editingVideoId = null;
            const modal = document.getElementById('modalUploadVideo');
            const titleEl = document.getElementById('uploadModalTitle');
            const submitBtn = document.getElementById('btnSubmitVideo');
            const form = document.getElementById('videoUploadForm');
            const previewContainer = document.getElementById('videoFilePreviewContainer');
            const fileSection = document.getElementById('videoUploadFileSection');
            const urlSection = document.getElementById('videoUploadUrlSection');
            const progressContainer = document.getElementById('videoUploadProgressContainer');

            if (!modal) return;

            if (form) form.reset();
            if (titleEl) titleEl.textContent = 'Subir Nuevo Video a Cloudflare';
            if (submitBtn) submitBtn.textContent = 'Subir y Guardar Video';
            if (previewContainer) previewContainer.style.display = 'none';
            if (progressContainer) progressContainer.style.display = 'none';

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
                document.body.style.overflow = 'hidden';
            }
        } catch(err) {
            this.logError('ERR_OPEN_MODAL_EXCEPTION', 'Excepción al abrir modal de subida', err);
        }
    },

    openEditModal(videoId) {
        try {
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

            if (!modal) return;

            if (titleEl) titleEl.textContent = 'Editar Detalles del Video';
            if (submitBtn) submitBtn.textContent = 'Guardar Cambios';
            if (titleInput) titleInput.value = video.title || '';
            if (catSelect) catSelect.value = video.category || 'General';
            if (descInput) descInput.value = video.description || '';

            if (fileSection) fileSection.style.display = 'none';
            if (urlSection) urlSection.style.display = 'none';
            if (previewContainer) previewContainer.style.display = 'none';
            if (progressContainer) progressContainer.style.display = 'none';

            if (typeof Utils !== 'undefined' && Utils.openModal) {
                Utils.openModal('modalUploadVideo');
            } else {
                modal.classList.add('active');
                modal.style.setProperty('display', 'flex', 'important');
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

        if (!confirm(`¿Estás seguro de que deseas eliminar el video "${video.title}"?`)) {
            return;
        }

        try {
            await this.deleteVideoBlob(videoId);
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
    // 14. Estadísticas del Módulo
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
    // 15. Utilidades Formato
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
window.openCloudflareConfigModal = function() {
    try {
        if (window.MultimediaModule && typeof window.MultimediaModule.openCloudflareConfigModal === 'function') {
            window.MultimediaModule.openCloudflareConfigModal();
        } else {
            const mainCard = document.getElementById('cfMainConfigCard');
            if (mainCard) {
                mainCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
            const modal = document.getElementById('modalCloudflareConfig');
            if (modal) {
                modal.classList.add('active');
                modal.style.setProperty('display', 'flex', 'important');
                modal.style.zIndex = '10005';
            }
        }
    } catch(e) {
        console.error('Error openCloudflareConfigModal:', e);
    }
};

window.openVideoUploadModal = function() {
    try {
        if (window.MultimediaModule) {
            window.MultimediaModule.openUploadModal();
        }
    } catch(e) {
        console.error('Error openVideoUploadModal:', e);
    }
};

window.openVideoDiagnosticsModal = function() {
    try {
        if (window.MultimediaModule) {
            window.MultimediaModule.openDiagnosticsModal();
        }
    } catch(e) {
        console.error('Error openVideoDiagnosticsModal:', e);
    }
};

window.switchMultimediaTab = function(tab) {
    try {
        if (window.MultimediaModule) {
            window.MultimediaModule.switchTab(tab);
        }
    } catch(e) {}
};

// Auto-inicializar
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => MultimediaModule.init());
} else {
    setTimeout(() => MultimediaModule.init(), 50);
}
