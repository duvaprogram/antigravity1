// Campaigns Module - Campaign Name Generator
const CampaignsModule = {
    // Country codes mapping
    countries: {
        'ECU': 'Ecuador',
        'VEN': 'Venezuela',
        'COL': 'Colombia'
    },

    // Campaign types
    types: ['ABO', 'CBO'],

    // Month abbreviations in Spanish
    monthNames: {
        0: 'ENE', 1: 'FEB', 2: 'MAR', 3: 'ABR', 4: 'MAY', 5: 'JUN',
        6: 'JUL', 7: 'AGO', 8: 'SEP', 9: 'OCT', 10: 'NOV', 11: 'DIC'
    },

    // Store generated campaigns
    generatedCampaigns: [],

    // Track if already initialized
    initialized: false,

    // Products list
    products: [],

    // Initialize the module
    async init() {
        // Prevent multiple initializations
        if (this.initialized) {
            return;
        }
        this.initialized = true;

        await this.loadProducts();
        this.bindEvents();
        this.setDefaultDate();
        this.loadSavedCampaigns();
    },

    // Load products from database
    async loadProducts() {
        try {
            this.products = await Database.getProducts();
            this.populateProductSelect();
        } catch (error) {
            console.error('Error loading products:', error);
            this.products = [];
        }
    },

    // Populate the product select dropdown
    populateProductSelect() {
        const select = document.getElementById('campaignProduct');
        if (!select) return;

        // Clear existing options except the first one
        select.innerHTML = '<option value="">Seleccione un producto...</option>';

        // Add active products only
        const activeProducts = this.products.filter(p => p.active !== false);

        activeProducts.forEach(product => {
            const option = document.createElement('option');
            option.value = product.name;
            option.textContent = `${product.name} (${product.sku || 'Sin SKU'})`;
            select.appendChild(option);
        });
    },

    // Bind form events
    bindEvents() {
        const form = document.getElementById('campaignForm');
        if (form) {
            // Remove existing listeners to prevent duplicates
            form.removeEventListener('submit', this.handleFormSubmit);
            this.handleFormSubmit = (e) => {
                e.preventDefault();
                this.generateCampaignName();
            };
            form.addEventListener('submit', this.handleFormSubmit);
        }

        // Real-time preview
        const inputs = ['campaignCountry', 'campaignType', 'campaignDate', 'campaignProduct', 'campaignAdSets', 'campaignAds'];
        inputs.forEach(id => {
            const el = document.getElementById(id);
            if (el) {
                // Remove existing listeners
                el.removeEventListener('input', this.updatePreviewHandler);
                el.removeEventListener('change', this.updatePreviewHandler);

                this.updatePreviewHandler = () => this.updatePreview();
                el.addEventListener('input', this.updatePreviewHandler);
                el.addEventListener('change', this.updatePreviewHandler);
            }
        });
    },

    // Set default date to today
    setDefaultDate() {
        const dateInput = document.getElementById('campaignDate');
        if (dateInput) {
            const today = new Date();
            dateInput.value = today.toISOString().split('T')[0];
            this.updatePreview();
        }
    },

    // Format date to DD-MES-YYYY
    formatDate(dateString) {
        const date = new Date(dateString + 'T00:00:00');
        const day = String(date.getDate()).padStart(2, '0');
        const month = this.monthNames[date.getMonth()];
        const year = date.getFullYear();
        return `${day}-${month}-${year}`;
    },

    // Update the preview in real-time
    updatePreview() {
        const country = document.getElementById('campaignCountry')?.value || '';
        const type = document.getElementById('campaignType')?.value || '';
        const date = document.getElementById('campaignDate')?.value || '';
        const product = document.getElementById('campaignProduct')?.value || '';
        const adSets = document.getElementById('campaignAdSets')?.value || '';
        const ads = document.getElementById('campaignAds')?.value || '';

        const previewEl = document.getElementById('campaignPreview');
        const previewTextEl = document.getElementById('campaignPreviewText');
        const adInfoEl = document.getElementById('campaignAdInfo');

        if (!previewEl || !previewTextEl) return;

        if (country && type && date && product.trim()) {
            const formattedDate = this.formatDate(date);
            const formattedProduct = product.toUpperCase().trim().replace(/\s+/g, '-');
            const campaignName = `${country}-${type}-${formattedDate}-${formattedProduct}`;

            previewTextEl.textContent = campaignName;
            previewEl.style.display = 'block';
            previewEl.classList.add('preview-active');

            // Show ad info if provided
            if (adInfoEl) {
                if (adSets || ads) {
                    adInfoEl.innerHTML = `
                        <div style="margin-top: 0.5rem; font-size: 0.85rem; color: var(--text-secondary);">
                            ${adSets ? `<span>📊 ${adSets} Conjunto(s) de Anuncios</span>` : ''}
                            ${adSets && ads ? ' · ' : ''}
                            ${ads ? `<span>📢 ${ads} Anuncio(s)</span>` : ''}
                        </div>
                    `;
                } else {
                    adInfoEl.innerHTML = '';
                }
            }
        } else {
            previewEl.style.display = 'none';
            previewEl.classList.remove('preview-active');
            if (adInfoEl) adInfoEl.innerHTML = '';
        }
    },

    // Generate the campaign name
    generateCampaignName() {
        const country = document.getElementById('campaignCountry').value;
        const type = document.getElementById('campaignType').value;
        const date = document.getElementById('campaignDate').value;
        const product = document.getElementById('campaignProduct').value.trim();
        const adSets = parseInt(document.getElementById('campaignAdSets').value) || 0;
        const ads = parseInt(document.getElementById('campaignAds').value) || 0;

        if (!country || !type || !date || !product) {
            Utils.showNotification('Por favor complete todos los campos obligatorios', 'error');
            return;
        }

        const formattedDate = this.formatDate(date);
        const formattedProduct = product.toUpperCase().replace(/\s+/g, '-');
        const campaignName = `${country}-${type}-${formattedDate}-${formattedProduct}`;

        // Add to history
        this.addToHistory(campaignName, {
            country,
            type,
            date: formattedDate,
            product: formattedProduct,
            adSets,
            ads,
            createdAt: new Date().toISOString()
        });

        // Show result
        this.showResult(campaignName, adSets, ads);

        // Reset form for next entry (keep country, type and date)
        document.getElementById('campaignProduct').value = '';
        document.getElementById('campaignAdSets').value = '';
        document.getElementById('campaignAds').value = '';
        this.updatePreview();
    },

    // Show the generated result
    showResult(campaignName, adSets, ads) {
        const resultEl = document.getElementById('campaignResult');
        const resultTextEl = document.getElementById('campaignResultText');
        const resultAdInfoEl = document.getElementById('campaignResultAdInfo');

        if (resultEl && resultTextEl) {
            resultTextEl.textContent = campaignName;

            // Show ad info in result
            if (resultAdInfoEl) {
                if (adSets > 0 || ads > 0) {
                    resultAdInfoEl.innerHTML = `
                        <div style="display: flex; gap: 1rem; justify-content: center; margin-top: 0.75rem;">
                            ${adSets > 0 ? `
                                <div style="background: var(--primary-light); padding: 0.5rem 1rem; border-radius: var(--radius-md);">
                                    <span style="font-size: 1.25rem; font-weight: 700; color: var(--primary);">${adSets}</span>
                                    <span style="font-size: 0.75rem; color: var(--text-secondary); display: block;">Conjuntos</span>
                                </div>
                            ` : ''}
                            ${ads > 0 ? `
                                <div style="background: rgba(139, 92, 246, 0.1); padding: 0.5rem 1rem; border-radius: var(--radius-md);">
                                    <span style="font-size: 1.25rem; font-weight: 700; color: #8b5cf6;">${ads}</span>
                                    <span style="font-size: 0.75rem; color: var(--text-secondary); display: block;">Anuncios</span>
                                </div>
                            ` : ''}
                        </div>
                    `;
                } else {
                    resultAdInfoEl.innerHTML = '';
                }
            }

            resultEl.style.display = 'block';
            resultEl.classList.add('result-active');

            // Animate entrance
            resultEl.style.animation = 'none';
            resultEl.offsetHeight; // Trigger reflow
            resultEl.style.animation = 'slideIn 0.3s ease-out';
        }

        Utils.showNotification('¡Nombre de campaña generado!', 'success');
    },

    // Copy to clipboard
    copyToClipboard() {
        const resultText = document.getElementById('campaignResultText')?.textContent;
        if (resultText) {
            navigator.clipboard.writeText(resultText).then(() => {
                Utils.showNotification('¡Copiado al portapapeles!', 'success');
            }).catch(err => {
                // Fallback for older browsers
                const textArea = document.createElement('textarea');
                textArea.value = resultText;
                document.body.appendChild(textArea);
                textArea.select();
                document.execCommand('copy');
                document.body.removeChild(textArea);
                Utils.showNotification('¡Copiado al portapapeles!', 'success');
            });
        }
    },

    // Add campaign to history
    addToHistory(campaignName, details) {
        const campaign = {
            id: Date.now(),
            name: campaignName,
            ...details
        };

        this.generatedCampaigns.unshift(campaign);

        // Keep only last 50 campaigns
        if (this.generatedCampaigns.length > 50) {
            this.generatedCampaigns = this.generatedCampaigns.slice(0, 50);
        }

        this.saveCampaigns();
        this.renderHistory();
    },

    // Save campaigns to localStorage
    saveCampaigns() {
        localStorage.setItem('generatedCampaigns', JSON.stringify(this.generatedCampaigns));
    },

    // Load saved campaigns
    loadSavedCampaigns() {
        const saved = localStorage.getItem('generatedCampaigns');
        if (saved) {
            try {
                this.generatedCampaigns = JSON.parse(saved);
                this.renderHistory();
            } catch (e) {
                console.error('Error loading campaigns:', e);
                this.generatedCampaigns = [];
            }
        }
    },

    // Render history table
    renderHistory() {
        const tbody = document.getElementById('campaignsHistoryTable');
        if (!tbody) return;

        if (this.generatedCampaigns.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="7" style="text-align: center; color: var(--text-muted); padding: 2rem;">
                        No hay campañas generadas aún
                    </td>
                </tr>`;
            return;
        }

        tbody.innerHTML = this.generatedCampaigns.slice(0, 20).map(campaign => {
            const date = new Date(campaign.createdAt);
            const formattedDate = date.toLocaleDateString('es-ES', {
                day: '2-digit',
                month: 'short',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
            });

            const adSetsDisplay = campaign.adSets > 0 ? campaign.adSets : '-';
            const adsDisplay = campaign.ads > 0 ? campaign.ads : '-';

            return `
                <tr>
                    <td style="font-family: monospace; font-weight: 600; color: var(--primary);">${campaign.name}</td>
                    <td>${this.countries[campaign.country] || campaign.country}</td>
                    <td><span class="badge badge-${campaign.type === 'ABO' ? 'primary' : 'secondary'}">${campaign.type}</span></td>
                    <td>${campaign.date}</td>
                    <td style="text-align: center;">${adSetsDisplay}</td>
                    <td style="text-align: center;">${adsDisplay}</td>
                    <td style="font-size: 0.8rem; color: var(--text-muted);">${formattedDate}</td>
                    <td>
                        <div style="display: flex; gap: 0.25rem;">
                            <button class="btn btn-icon btn-sm" onclick="CampaignsModule.copyCampaign('${campaign.name}')" title="Copiar">
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                    <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                                    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                                </svg>
                            </button>
                            <button class="btn btn-icon btn-sm btn-danger-light" onclick="CampaignsModule.deleteCampaign(${campaign.id})" title="Eliminar">
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                    <polyline points="3 6 5 6 21 6"></polyline>
                                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                                </svg>
                            </button>
                        </div>
                    </td>
                </tr>`;
        }).join('');
    },

    // Copy a campaign from history
    copyCampaign(campaignName) {
        navigator.clipboard.writeText(campaignName).then(() => {
            Utils.showNotification('¡Copiado al portapapeles!', 'success');
        }).catch(err => {
            const textArea = document.createElement('textarea');
            textArea.value = campaignName;
            document.body.appendChild(textArea);
            textArea.select();
            document.execCommand('copy');
            document.body.removeChild(textArea);
            Utils.showNotification('¡Copiado al portapapeles!', 'success');
        });
    },

    // Delete a campaign from history
    deleteCampaign(campaignId) {
        const index = this.generatedCampaigns.findIndex(c => c.id === campaignId);
        if (index > -1) {
            this.generatedCampaigns.splice(index, 1);
            this.saveCampaigns();
            this.renderHistory();
            Utils.showNotification('Campaña eliminada', 'info');
        }
    },

    // Clear history
    clearHistory() {
        if (confirm('¿Está seguro de que desea limpiar todo el historial de campañas?')) {
            this.generatedCampaigns = [];
            this.saveCampaigns();
            this.renderHistory();
            document.getElementById('campaignResult').style.display = 'none';
            Utils.showNotification('Historial limpiado', 'info');
        }
    },

    // Reset form
    resetForm() {
        document.getElementById('campaignForm').reset();
        this.setDefaultDate();
        document.getElementById('campaignResult').style.display = 'none';
        this.updatePreview();
    },

    // Refresh products list
    async refreshProducts() {
        await this.loadProducts();
        Utils.showNotification('Lista de productos actualizada', 'success');
    }
};

// Make available globally
window.CampaignsModule = CampaignsModule;
