// ========================================
// Clients Module (Async - Supabase)
// ========================================

const ClientsModule = {
    _initialized: false,

    init() {
        if (this._initialized) return;
        this._initialized = true;
        this.bindEvents();
    },

    bindEvents() {
        // New client button
        document.getElementById('btnNewClient')?.addEventListener('click', () => {
            this.openClientModal();
        });

        // Client form submission
        document.getElementById('formClient')?.addEventListener('submit', (e) => {
            e.preventDefault();
            this.saveClient();
        });

        // Origin select toggle in modal
        document.getElementById('clientOrigin')?.addEventListener('change', (e) => {
            const val = e.target.value;
            const customGroup = document.getElementById('clientOriginCustomGroup');
            const customInput = document.getElementById('clientOriginCustom');
            if (val === 'Otro') {
                if (customGroup) customGroup.style.display = 'block';
                if (customInput) {
                    customInput.required = true;
                    customInput.focus();
                }
            } else {
                if (customGroup) customGroup.style.display = 'none';
                if (customInput) {
                    customInput.required = false;
                    customInput.value = '';
                }
            }
        });

        // Search clients
        document.getElementById('searchClients')?.addEventListener('input',
            Utils.debounce((e) => this.filterClients(e.target.value), 300)
        );

        // Filter clients by origin
        document.getElementById('filterClientOrigin')?.addEventListener('change', () => {
            this.filterClients(document.getElementById('searchClients')?.value || '');
        });

        // Modal close buttons
        document.querySelectorAll('[data-close="modalClient"]').forEach(btn => {
            btn.addEventListener('click', () => Utils.closeModal('modalClient'));
        });
    },

    async render() {
        await this.filterClients(document.getElementById('searchClients')?.value || '');
    },

    getOriginBadge(origin) {
        if (!origin) return '';
        const lower = origin.toLowerCase();
        if (lower.includes('whatsapp') || lower.includes('wpp')) {
            return `<span class="origin-badge whatsapp" title="Canal: WhatsApp">💬 WhatsApp</span>`;
        }
        if (lower.includes('página') || lower.includes('pagina') || lower.includes('web')) {
            return `<span class="origin-badge pagina" title="Canal: Página Web">🌐 Página Web</span>`;
        }
        const cleanOrigin = origin.replace(/^Otro\s*[-:]\s*/i, '').trim();
        return `<span class="origin-badge otro" title="Canal: ${Utils.escapeHtml(cleanOrigin || 'Otro')}">📝 ${Utils.escapeHtml(cleanOrigin || 'Otro')}</span>`;
    },

    async filterClients(query = '') {
        let clients = await Database.getClients();
        const originFilter = document.getElementById('filterClientOrigin')?.value || '';

        if (query) {
            const q = query.toLowerCase().trim();
            clients = clients.filter(c =>
                (c.fullName && c.fullName.toLowerCase().includes(q)) ||
                (c.phone && c.phone.toLowerCase().includes(q)) ||
                (c.address && c.address.toLowerCase().includes(q)) ||
                (c.city && c.city.toLowerCase().includes(q)) ||
                (c.origin && c.origin.toLowerCase().includes(q))
            );
        }

        if (originFilter) {
            clients = clients.filter(c => {
                if (!c.origin) return false;
                const lower = c.origin.toLowerCase();
                if (originFilter === 'WhatsApp') {
                    return lower.includes('whatsapp') || lower.includes('wpp');
                }
                if (originFilter === 'Página Web') {
                    return lower.includes('página') || lower.includes('pagina') || lower.includes('web');
                }
                if (originFilter === 'Otro') {
                    return !lower.includes('whatsapp') && !lower.includes('wpp') &&
                           !lower.includes('página') && !lower.includes('pagina') && !lower.includes('web');
                }
                return true;
            });
        }

        this.renderGrid(clients);
    },

    renderGrid(clients) {
        const container = document.getElementById('clientsGrid');
        if (!container) return;

        if (clients.length === 0) {
            container.innerHTML = `
                <div style="grid-column: 1 / -1; text-align: center; padding: 3rem; color: var(--text-muted);">
                    <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1" style="margin-bottom: 1rem; opacity: 0.5;">
                        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                        <circle cx="9" cy="7" r="4"></circle>
                    </svg>
                    <p>No se encontraron clientes</p>
                    <button class="btn btn-primary" style="margin-top: 1rem;" onclick="ClientsModule.openClientModal()">
                        Registrar Cliente
                    </button>
                </div>
            `;
            return;
        }

        container.innerHTML = clients.map(client => {
            const cityClass = (client.city || '').toLowerCase();
            const originBadge = this.getOriginBadge(client.origin);
            return `
                <div class="client-card">
                    <div class="client-header">
                        <div class="client-name">${Utils.escapeHtml(client.fullName)}</div>
                        <div style="display: flex; gap: 0.35rem; align-items: center; flex-wrap: wrap;">
                            ${originBadge}
                            <span class="city-badge ${cityClass}">${Utils.escapeHtml(client.city)}</span>
                        </div>
                    </div>
                    <div class="client-info-row">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path>
                        </svg>
                        <span>${Utils.escapeHtml(client.phone)}</span>
                    </div>
                    <div class="client-info-row">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
                            <circle cx="12" cy="10" r="3"></circle>
                        </svg>
                        <span>${Utils.escapeHtml(client.address)}</span>
                    </div>
                    ${client.reference ? `
                        <div class="client-info-row">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <circle cx="12" cy="12" r="10"></circle>
                                <line x1="12" y1="16" x2="12" y2="12"></line>
                                <line x1="12" y1="8" x2="12.01" y2="8"></line>
                            </svg>
                            <span>${Utils.escapeHtml(client.reference)}</span>
                        </div>
                    ` : ''}
                    <div class="client-actions">
                        <button class="btn btn-secondary btn-sm" onclick="ClientsModule.editClient('${client.id}')">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                            </svg>
                            Editar
                        </button>
                        <button class="btn btn-primary btn-sm" onclick="GuidesModule.createGuideForClient('${client.id}')">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                                <polyline points="14 2 14 8 20 8"></polyline>
                            </svg>
                            Crear Guía
                        </button>
                    </div>
                </div>
            `;
        }).join('');
    },

    async openClientModal(clientId = null) {
        const modal = document.getElementById('modalClient');
        const form = document.getElementById('formClient');
        const title = document.getElementById('modalClientTitle');
        const customGroup = document.getElementById('clientOriginCustomGroup');
        const customInput = document.getElementById('clientOriginCustom');
        const originSelect = document.getElementById('clientOrigin');

        form.reset();
        document.getElementById('clientId').value = '';
        if (customGroup) customGroup.style.display = 'none';
        if (customInput) {
            customInput.required = false;
            customInput.value = '';
        }

        if (clientId) {
            const client = await Database.getClient(clientId);
            if (client) {
                title.textContent = 'Editar Cliente';
                document.getElementById('clientId').value = client.id;
                document.getElementById('clientName').value = client.fullName;
                document.getElementById('clientPhone').value = client.phone;
                document.getElementById('clientCity').value = client.city;
                document.getElementById('clientAddress').value = client.address;
                document.getElementById('clientReference').value = client.reference || '';

                // Restore origin selection
                const origin = client.origin || Database.extractOriginFromNotes(client.notes);
                if (origin) {
                    const lower = origin.toLowerCase();
                    if (lower.includes('whatsapp') || lower.includes('wpp')) {
                        originSelect.value = 'WhatsApp';
                        if (customGroup) customGroup.style.display = 'none';
                        if (customInput) customInput.required = false;
                    } else if (lower.includes('página') || lower.includes('pagina') || lower.includes('web')) {
                        originSelect.value = 'Página Web';
                        if (customGroup) customGroup.style.display = 'none';
                        if (customInput) customInput.required = false;
                    } else {
                        originSelect.value = 'Otro';
                        if (customGroup) customGroup.style.display = 'block';
                        if (customInput) {
                            customInput.required = true;
                            customInput.value = origin.replace(/^Otro\s*[-:]\s*/i, '').trim();
                        }
                    }
                } else {
                    originSelect.value = '';
                }
            }
        } else {
            title.textContent = 'Nuevo Cliente';
            if (originSelect) originSelect.value = '';
        }

        Utils.openModal('modalClient');
    },

    editClient(clientId) {
        this.openClientModal(clientId);
    },

    async saveClient() {
        const originSelect = document.getElementById('clientOrigin');
        const originVal = originSelect?.value || '';

        if (!originVal) {
            Utils.showToast('Por favor selecciona el origen del cliente (WhatsApp, Página Web u Otro)', 'warning');
            originSelect?.focus();
            return;
        }

        let originFinal = originVal;
        if (originVal === 'Otro') {
            const customVal = document.getElementById('clientOriginCustom')?.value.trim() || '';
            if (!customVal) {
                Utils.showToast('Por favor especifica de dónde llegó el cliente', 'warning');
                document.getElementById('clientOriginCustom')?.focus();
                return;
            }
            originFinal = `Otro - ${customVal}`;
        }

        const clientId = document.getElementById('clientId').value || null;
        let existingNotes = '';
        if (clientId) {
            const existingClient = await Database.getClient(clientId);
            if (existingClient && existingClient.notes) {
                existingNotes = existingClient.notes.replace(/\[Origen:\s*[^\]]+\]\s*/i, '').trim();
            }
        }

        const tag = `[Origen: ${originFinal}]`;
        const finalNotes = existingNotes ? `${tag} ${existingNotes}` : tag;

        const client = {
            id: clientId,
            fullName: document.getElementById('clientName').value.trim(),
            phone: document.getElementById('clientPhone').value.trim(),
            city: document.getElementById('clientCity').value,
            address: document.getElementById('clientAddress').value.trim(),
            reference: document.getElementById('clientReference').value.trim(),
            origin: originFinal,
            notes: finalNotes
        };

        try {
            await Database.saveClient(client);
            Utils.closeModal('modalClient');
            Utils.showToast(client.id ? 'Cliente actualizado correctamente' : 'Cliente registrado correctamente', 'success');
            await this.render();
            App.updateDashboard();
        } catch (error) {
            console.error('Error saving client:', error);
            Utils.showToast('Error al guardar el cliente: ' + (error.message || 'Verifique los datos'), 'error');
        }
    }
};

// Make module available globally
window.ClientsModule = ClientsModule;
