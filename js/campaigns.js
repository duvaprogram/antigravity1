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

    // Initialize the module
    init() {
        this.bindEvents();
        this.setDefaultDate();
        this.loadSavedCampaigns();
    },

    // Bind form events
    bindEvents() {
        const form = document.getElementById('campaignForm');
        if (form) {
            form.addEventListener('submit', (e) => {
                e.preventDefault();
                this.generateCampaignName();
            });
        }

        // Real-time preview
        const inputs = ['campaignCountry', 'campaignType', 'campaignDate', 'campaignProduct'];
        inputs.forEach(id => {
            const el = document.getElementById(id);
            if (el) {
                el.addEventListener('input', () => this.updatePreview());
                el.addEventListener('change', () => this.updatePreview());
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

        const previewEl = document.getElementById('campaignPreview');
        const previewTextEl = document.getElementById('campaignPreviewText');

        if (!previewEl || !previewTextEl) return;

        if (country && type && date && product.trim()) {
            const formattedDate = this.formatDate(date);
            const formattedProduct = product.toUpperCase().trim().replace(/\s+/g, '-');
            const campaignName = `${country}-${type}-${formattedDate}-${formattedProduct}`;

            previewTextEl.textContent = campaignName;
            previewEl.style.display = 'block';
            previewEl.classList.add('preview-active');
        } else {
            previewEl.style.display = 'none';
            previewEl.classList.remove('preview-active');
        }
    },

    // Generate the campaign name
    generateCampaignName() {
        const country = document.getElementById('campaignCountry').value;
        const type = document.getElementById('campaignType').value;
        const date = document.getElementById('campaignDate').value;
        const product = document.getElementById('campaignProduct').value.trim();

        if (!country || !type || !date || !product) {
            Utils.showNotification('Por favor complete todos los campos', 'error');
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
            createdAt: new Date().toISOString()
        });

        // Show result
        this.showResult(campaignName);

        // Clear product field for next entry
        document.getElementById('campaignProduct').value = '';
        this.updatePreview();
    },

    // Show the generated result
    showResult(campaignName) {
        const resultEl = document.getElementById('campaignResult');
        const resultTextEl = document.getElementById('campaignResultText');

        if (resultEl && resultTextEl) {
            resultTextEl.textContent = campaignName;
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
                    <td colspan="5" style="text-align: center; color: var(--text-muted); padding: 2rem;">
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

            return `
                <tr>
                    <td style="font-family: monospace; font-weight: 600; color: var(--primary);">${campaign.name}</td>
                    <td>${this.countries[campaign.country] || campaign.country}</td>
                    <td><span class="badge badge-${campaign.type === 'ABO' ? 'primary' : 'secondary'}">${campaign.type}</span></td>
                    <td>${campaign.date}</td>
                    <td style="font-size: 0.8rem; color: var(--text-muted);">${formattedDate}</td>
                    <td>
                        <button class="btn btn-icon btn-sm" onclick="CampaignsModule.copyCampaign('${campaign.name}')" title="Copiar">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                            </svg>
                        </button>
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

    // Clear history
    clearHistory() {
        if (confirm('¿Está seguro de que desea limpiar el historial de campañas?')) {
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
    }
};

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    // Will be initialized by app.js when section is shown
});
