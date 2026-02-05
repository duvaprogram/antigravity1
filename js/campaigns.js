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

    // Used codes to ensure uniqueness
    usedCodes: new Set(),

    // Letters for generating codes (excluding confusing ones like O, I, L)
    codeLetters: 'ABCDEFGHJKMNPQRSTUVWXYZ',

    // Initialize the module
    async init() {
        // Prevent multiple initializations
        if (this.initialized) {
            return;
        }
        this.initialized = true;

        await this.loadProducts();
        this.loadUsedCodes();
        this.loadPerformanceData();
        this.bindEvents();
        this.setDefaultDate();
        this.loadSavedCampaigns();
        this.renderPerformanceTable();
    },

    // Load used codes from localStorage
    loadUsedCodes() {
        const saved = localStorage.getItem('usedCampaignCodes');
        if (saved) {
            try {
                this.usedCodes = new Set(JSON.parse(saved));
            } catch (e) {
                this.usedCodes = new Set();
            }
        }
    },

    // Save used codes to localStorage
    saveUsedCodes() {
        localStorage.setItem('usedCampaignCodes', JSON.stringify([...this.usedCodes]));
    },

    // Generate a unique campaign code (2 letters + 2 numbers, e.g., XY01)
    generateCampaignCode() {
        let code;
        let attempts = 0;
        const maxAttempts = 1000;

        do {
            // Generate 2 random letters
            const letter1 = this.codeLetters[Math.floor(Math.random() * this.codeLetters.length)];
            const letter2 = this.codeLetters[Math.floor(Math.random() * this.codeLetters.length)];

            // Generate 2 random numbers (00-99)
            const numbers = String(Math.floor(Math.random() * 100)).padStart(2, '0');

            code = `${letter1}${letter2}${numbers}`;
            attempts++;
        } while (this.usedCodes.has(code) && attempts < maxAttempts);

        // If we couldn't find a unique code, add timestamp suffix
        if (this.usedCodes.has(code)) {
            code = code + String(Date.now()).slice(-2);
        }

        this.usedCodes.add(code);
        this.saveUsedCodes();
        return code;
    },

    // Generate ad codes based on campaign code (no dashes, unique)
    generateAdCodes(campaignCode, numAds) {
        const adCodes = [];
        for (let i = 1; i <= numAds; i++) {
            const adCode = `${campaignCode}A${i}`;
            adCodes.push(adCode);
            this.usedCodes.add(adCode);
        }
        this.saveUsedCodes();
        return adCodes;
    },

    // Generate ad set codes based on campaign code (no dashes, unique)
    generateAdSetCodes(campaignCode, numAdSets) {
        const adSetCodes = [];
        for (let i = 1; i <= numAdSets; i++) {
            const setCode = `${campaignCode}S${i}`;
            adSetCodes.push(setCode);
            this.usedCodes.add(setCode);
        }
        this.saveUsedCodes();
        return adSetCodes;
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

            previewTextEl.innerHTML = `
                <div style="font-size: 0.75rem; color: var(--text-muted); margin-bottom: 0.25rem;">
                    Al generar se asignará un código único como: <strong style="color: var(--primary);">XY01</strong>
                </div>
                ${campaignName}
            `;
            previewEl.style.display = 'block';
            previewEl.classList.add('preview-active');

            // Show ad info if provided
            if (adInfoEl) {
                if (adSets || ads) {
                    const adSetsNum = parseInt(adSets) || 0;
                    const adsNum = parseInt(ads) || 0;

                    let infoText = `<div style="margin-top: 0.75rem; padding-top: 0.75rem; border-top: 1px dashed var(--border);">`;
                    infoText += `<div style="margin-bottom: 0.5rem; font-size: 0.85rem; color: var(--text-secondary);">`;

                    if (adSetsNum > 0) {
                        infoText += `<span>📊 ${adSetsNum} Conjunto(s) → Códigos: XY01S1, XY01S2...</span>`;
                    }
                    if (adSetsNum > 0 && adsNum > 0) {
                        infoText += ` · `;
                    }
                    if (adsNum > 0) {
                        infoText += `<span>📢 ${adsNum} Anuncio(s) → Códigos: XY01A1, XY01A2...</span>`;
                    }

                    infoText += `</div></div>`;
                    adInfoEl.innerHTML = infoText;
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
        const campaignCode = this.generateCampaignCode();
        const campaignName = `${country}-${type}-${formattedDate}-${formattedProduct}`;

        // Generate ad and ad set codes (no dashes, unique)
        const adSetCodes = this.generateAdSetCodes(campaignCode, adSets);
        const adCodes = this.generateAdCodes(campaignCode, ads);

        // Add to history
        this.addToHistory(campaignName, {
            country,
            type,
            date: formattedDate,
            product: formattedProduct,
            code: campaignCode,
            adSets,
            ads,
            adSetCodes,
            adCodes,
            createdAt: new Date().toISOString()
        });

        // Show result
        this.showResult(campaignName, campaignCode, adSets, ads, adSetCodes, adCodes);

        // Reset form for next entry (keep country, type and date)
        document.getElementById('campaignProduct').value = '';
        document.getElementById('campaignAdSets').value = '';
        document.getElementById('campaignAds').value = '';
        this.updatePreview();
    },

    // Show the generated result
    showResult(campaignName, campaignCode, adSets, ads, adSetCodes, adCodes) {
        const resultEl = document.getElementById('campaignResult');
        const resultTextEl = document.getElementById('campaignResultText');
        const resultAdInfoEl = document.getElementById('campaignResultAdInfo');
        const resultCodesEl = document.getElementById('campaignResultCodes');

        if (resultEl && resultTextEl) {
            resultTextEl.innerHTML = `
                <div style="margin-bottom: 1rem;">
                    <span style="font-size: 0.85rem; color: var(--text-muted);">Código Único de Campaña:</span>
                    <div style="background: linear-gradient(135deg, var(--primary), #8b5cf6); color: white; 
                                padding: 0.75rem 1.5rem; border-radius: var(--radius-md); display: inline-block;
                                font-size: 2rem; font-weight: 700; letter-spacing: 2px; margin-top: 0.5rem;
                                cursor: pointer;" onclick="CampaignsModule.copyCode('${campaignCode}')" title="Clic para copiar">
                        ${campaignCode}
                    </div>
                </div>
                <div style="font-family: monospace; font-size: 1.1rem; color: var(--text-secondary);">${campaignName}</div>
            `;

            // Show ad info in result
            if (resultAdInfoEl) {
                if (adSets > 0 || ads > 0) {
                    resultAdInfoEl.innerHTML = `
                        <div style="display: flex; gap: 1rem; justify-content: center; margin-top: 1rem;">
                            ${adSets > 0 ? `
                                <div style="background: var(--primary-light); padding: 0.75rem 1.5rem; border-radius: var(--radius-md);">
                                    <span style="font-size: 1.5rem; font-weight: 700; color: var(--primary);">${adSets}</span>
                                    <span style="font-size: 0.75rem; color: var(--text-secondary); display: block;">Conjuntos</span>
                                </div>
                            ` : ''}
                            ${ads > 0 ? `
                                <div style="background: rgba(139, 92, 246, 0.1); padding: 0.75rem 1.5rem; border-radius: var(--radius-md);">
                                    <span style="font-size: 1.5rem; font-weight: 700; color: #8b5cf6;">${ads}</span>
                                    <span style="font-size: 0.75rem; color: var(--text-secondary); display: block;">Anuncios</span>
                                </div>
                            ` : ''}
                        </div>
                    `;
                } else {
                    resultAdInfoEl.innerHTML = '';
                }
            }

            // Show codes list
            if (resultCodesEl) {
                let codesHtml = '';

                if (adSetCodes.length > 0) {
                    codesHtml += `
                        <div style="margin-top: 1.25rem; padding: 1rem; background: var(--surface-hover); border-radius: var(--radius-md); border-left: 4px solid var(--primary);">
                            <div style="font-weight: 600; color: var(--primary); margin-bottom: 0.75rem; font-size: 0.9rem;">
                                📊 Códigos de Conjuntos de Anuncios
                            </div>
                            <div style="display: flex; flex-wrap: wrap; gap: 0.5rem;">
                                ${adSetCodes.map(code => `
                                    <span onclick="CampaignsModule.copyCode('${code}')" 
                                          style="font-family: monospace; padding: 0.5rem 0.75rem; background: var(--primary-light); 
                                                 color: var(--primary); border-radius: var(--radius-sm); cursor: pointer; 
                                                 font-size: 0.95rem; font-weight: 600; transition: all 0.2s;"
                                          onmouseover="this.style.background='var(--primary)'; this.style.color='white';"
                                          onmouseout="this.style.background='var(--primary-light)'; this.style.color='var(--primary)';"
                                          title="Clic para copiar">
                                        ${code}
                                    </span>
                                `).join('')}
                            </div>
                        </div>
                    `;
                }

                if (adCodes.length > 0) {
                    codesHtml += `
                        <div style="margin-top: 0.75rem; padding: 1rem; background: var(--surface-hover); border-radius: var(--radius-md); border-left: 4px solid #8b5cf6;">
                            <div style="font-weight: 600; color: #8b5cf6; margin-bottom: 0.75rem; font-size: 0.9rem;">
                                📢 Códigos de Anuncios
                            </div>
                            <div style="display: flex; flex-wrap: wrap; gap: 0.5rem;">
                                ${adCodes.map(code => `
                                    <span onclick="CampaignsModule.copyCode('${code}')" 
                                          style="font-family: monospace; padding: 0.5rem 0.75rem; background: rgba(139, 92, 246, 0.1); 
                                                 color: #8b5cf6; border-radius: var(--radius-sm); cursor: pointer; 
                                                 font-size: 0.95rem; font-weight: 600; transition: all 0.2s;"
                                          onmouseover="this.style.background='#8b5cf6'; this.style.color='white';"
                                          onmouseout="this.style.background='rgba(139, 92, 246, 0.1)'; this.style.color='#8b5cf6';"
                                          title="Clic para copiar">
                                        ${code}
                                    </span>
                                `).join('')}
                            </div>
                        </div>
                    `;
                }

                resultCodesEl.innerHTML = codesHtml;
            }

            resultEl.style.display = 'block';
            resultEl.classList.add('result-active');

            // Animate entrance
            resultEl.style.animation = 'none';
            resultEl.offsetHeight; // Trigger reflow
            resultEl.style.animation = 'slideIn 0.3s ease-out';
        }

        Utils.showNotification(`¡Campaña generada! Código: ${campaignCode}`, 'success');
    },

    // Copy single code to clipboard
    copyCode(code) {
        navigator.clipboard.writeText(code).then(() => {
            Utils.showNotification(`Código ${code} copiado`, 'success');
        }).catch(err => {
            const textArea = document.createElement('textarea');
            textArea.value = code;
            document.body.appendChild(textArea);
            textArea.select();
            document.execCommand('copy');
            document.body.removeChild(textArea);
            Utils.showNotification(`Código ${code} copiado`, 'success');
        });
    },

    // Copy to clipboard (campaign name)
    copyToClipboard() {
        const resultTextEl = document.getElementById('campaignResultText');
        if (resultTextEl) {
            // Get just the campaign name (the monospace div)
            const campaignNameEl = resultTextEl.querySelector('div:last-child');
            const campaignName = campaignNameEl?.textContent || '';

            navigator.clipboard.writeText(campaignName.trim()).then(() => {
                Utils.showNotification('¡Nombre copiado al portapapeles!', 'success');
            }).catch(err => {
                const textArea = document.createElement('textarea');
                textArea.value = campaignName.trim();
                document.body.appendChild(textArea);
                textArea.select();
                document.execCommand('copy');
                document.body.removeChild(textArea);
                Utils.showNotification('¡Nombre copiado al portapapeles!', 'success');
            });
        }
    },

    // Copy all codes for a campaign
    copyAllCodes(campaignId) {
        const campaign = this.generatedCampaigns.find(c => c.id === campaignId);
        if (!campaign) return;

        let allCodes = `CAMPAÑA: ${campaign.code}\nNombre: ${campaign.name}\n`;

        if (campaign.adSetCodes && campaign.adSetCodes.length > 0) {
            allCodes += `\nCONJUNTOS DE ANUNCIOS (${campaign.adSetCodes.length}):\n${campaign.adSetCodes.join('\n')}`;
        }

        if (campaign.adCodes && campaign.adCodes.length > 0) {
            allCodes += `\n\nANUNCIOS (${campaign.adCodes.length}):\n${campaign.adCodes.join('\n')}`;
        }

        navigator.clipboard.writeText(allCodes).then(() => {
            Utils.showNotification('¡Todos los códigos copiados!', 'success');
        }).catch(err => {
            const textArea = document.createElement('textarea');
            textArea.value = allCodes;
            document.body.appendChild(textArea);
            textArea.select();
            document.execCommand('copy');
            document.body.removeChild(textArea);
            Utils.showNotification('¡Todos los códigos copiados!', 'success');
        });
    },

    // Add campaign to history
    addToHistory(campaignName, details) {
        const campaign = {
            id: Date.now(),
            name: campaignName,
            ...details
        };

        this.generatedCampaigns.unshift(campaign);

        // Keep only last 100 campaigns
        if (this.generatedCampaigns.length > 100) {
            this.generatedCampaigns = this.generatedCampaigns.slice(0, 100);
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
                    <td colspan="9" style="text-align: center; color: var(--text-muted); padding: 2rem;">
                        No hay campañas generadas aún
                    </td>
                </tr>`;
            return;
        }

        tbody.innerHTML = this.generatedCampaigns.slice(0, 30).map(campaign => {
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
            const codeDisplay = campaign.code || '-';

            return `
                <tr>
                    <td>
                        <span onclick="CampaignsModule.copyCode('${codeDisplay}')" 
                              style="background: linear-gradient(135deg, var(--primary), #8b5cf6); color: white; 
                                     padding: 0.35rem 0.75rem; border-radius: var(--radius-sm); font-weight: 700;
                                     cursor: pointer; font-family: monospace; letter-spacing: 1px;"
                              title="Clic para copiar">
                            ${codeDisplay}
                        </span>
                    </td>
                    <td style="font-family: monospace; font-size: 0.8rem; max-width: 200px; overflow: hidden; text-overflow: ellipsis;">${campaign.name}</td>
                    <td>${this.countries[campaign.country] || campaign.country}</td>
                    <td><span class="badge badge-${campaign.type === 'ABO' ? 'primary' : 'secondary'}">${campaign.type}</span></td>
                    <td style="font-size: 0.85rem;">${campaign.date}</td>
                    <td style="text-align: center; font-weight: 600;">${adSetsDisplay}</td>
                    <td style="text-align: center; font-weight: 600;">${adsDisplay}</td>
                    <td style="font-size: 0.75rem; color: var(--text-muted);">${formattedDate}</td>
                    <td>
                        <div style="display: flex; gap: 0.25rem;">
                            <button class="btn btn-icon btn-sm" onclick="CampaignsModule.copyAllCodes(${campaign.id})" title="Copiar todos los códigos">
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                    <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                                    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                                </svg>
                            </button>
                            <button class="btn btn-icon btn-sm" onclick="CampaignsModule.viewCampaignDetails(${campaign.id})" title="Ver detalles">
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                                    <circle cx="12" cy="12" r="3"></circle>
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

    // View campaign details in a modal/popup
    viewCampaignDetails(campaignId) {
        const campaign = this.generatedCampaigns.find(c => c.id === campaignId);
        if (!campaign) return;

        let detailsHtml = `
            <div style="padding: 1.5rem;">
                <div style="text-align: center; margin-bottom: 1.5rem;">
                    <div style="font-size: 0.85rem; color: var(--text-muted); margin-bottom: 0.5rem;">Código de Campaña</div>
                    <div onclick="CampaignsModule.copyCode('${campaign.code}')"
                         style="background: linear-gradient(135deg, var(--primary), #8b5cf6); color: white; 
                                padding: 1rem 2rem; border-radius: var(--radius-md); display: inline-block;
                                font-size: 2.5rem; font-weight: 700; letter-spacing: 3px; cursor: pointer;"
                         title="Clic para copiar">
                        ${campaign.code}
                    </div>
                </div>
                
                <div style="background: var(--surface-hover); padding: 1rem; border-radius: var(--radius-md); margin-bottom: 1rem; text-align: center;">
                    <div style="font-family: monospace; font-size: 1rem; font-weight: 600; color: var(--text-secondary); word-break: break-all;">
                        ${campaign.name}
                    </div>
                </div>
                
                <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 0.75rem; margin-bottom: 1.25rem;">
                    <div style="padding: 0.75rem; background: var(--surface-hover); border-radius: var(--radius-md);">
                        <div style="font-size: 0.7rem; color: var(--text-muted); text-transform: uppercase;">País</div>
                        <div style="font-weight: 600;">${this.countries[campaign.country] || campaign.country}</div>
                    </div>
                    <div style="padding: 0.75rem; background: var(--surface-hover); border-radius: var(--radius-md);">
                        <div style="font-size: 0.7rem; color: var(--text-muted); text-transform: uppercase;">Tipo</div>
                        <div style="font-weight: 600;">${campaign.type}</div>
                    </div>
                    <div style="padding: 0.75rem; background: var(--surface-hover); border-radius: var(--radius-md);">
                        <div style="font-size: 0.7rem; color: var(--text-muted); text-transform: uppercase;">Fecha</div>
                        <div style="font-weight: 600;">${campaign.date}</div>
                    </div>
                    <div style="padding: 0.75rem; background: var(--surface-hover); border-radius: var(--radius-md);">
                        <div style="font-size: 0.7rem; color: var(--text-muted); text-transform: uppercase;">Producto</div>
                        <div style="font-weight: 600; font-size: 0.9rem;">${campaign.product}</div>
                    </div>
                </div>
        `;

        if (campaign.adSetCodes && campaign.adSetCodes.length > 0) {
            detailsHtml += `
                <div style="margin-bottom: 1rem; padding: 1rem; background: var(--surface-hover); border-radius: var(--radius-md); border-left: 4px solid var(--primary);">
                    <div style="font-weight: 600; color: var(--primary); margin-bottom: 0.75rem;">
                        📊 Códigos de Conjuntos (${campaign.adSetCodes.length})
                    </div>
                    <div style="display: flex; flex-wrap: wrap; gap: 0.5rem;">
                        ${campaign.adSetCodes.map(code => `
                            <span onclick="CampaignsModule.copyCode('${code}')" 
                                  style="font-family: monospace; padding: 0.5rem 0.75rem; background: var(--primary-light); 
                                         color: var(--primary); border-radius: var(--radius-sm); cursor: pointer;
                                         font-weight: 600;"
                                  title="Clic para copiar">
                                ${code}
                            </span>
                        `).join('')}
                    </div>
                </div>
            `;
        }

        if (campaign.adCodes && campaign.adCodes.length > 0) {
            detailsHtml += `
                <div style="margin-bottom: 1rem; padding: 1rem; background: var(--surface-hover); border-radius: var(--radius-md); border-left: 4px solid #8b5cf6;">
                    <div style="font-weight: 600; color: #8b5cf6; margin-bottom: 0.75rem;">
                        📢 Códigos de Anuncios (${campaign.adCodes.length})
                    </div>
                    <div style="display: flex; flex-wrap: wrap; gap: 0.5rem;">
                        ${campaign.adCodes.map(code => `
                            <span onclick="CampaignsModule.copyCode('${code}')" 
                                  style="font-family: monospace; padding: 0.5rem 0.75rem; background: rgba(139, 92, 246, 0.1); 
                                         color: #8b5cf6; border-radius: var(--radius-sm); cursor: pointer;
                                         font-weight: 600;"
                                  title="Clic para copiar">
                                ${code}
                            </span>
                        `).join('')}
                    </div>
                </div>
            `;
        }

        detailsHtml += `
                <div style="margin-top: 1.5rem; display: flex; gap: 0.5rem; justify-content: center;">
                    <button class="btn btn-primary" onclick="CampaignsModule.copyAllCodes(${campaign.id})">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                        </svg>
                        Copiar Todo
                    </button>
                    <button class="btn btn-secondary" onclick="CampaignsModule.closeDetailsModal()">Cerrar</button>
                </div>
            </div>
        `;

        // Create or update modal
        let modal = document.getElementById('campaignDetailsModal');
        if (!modal) {
            modal = document.createElement('div');
            modal.id = 'campaignDetailsModal';
            modal.className = 'modal';
            modal.innerHTML = `<div class="modal-content" style="max-width: 550px;"></div>`;
            document.body.appendChild(modal);

            // Close on backdrop click
            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    this.closeDetailsModal();
                }
            });
        }

        modal.querySelector('.modal-content').innerHTML = detailsHtml;
        modal.classList.add('active');
        document.body.style.overflow = 'hidden';
    },

    // Close details modal
    closeDetailsModal() {
        const modal = document.getElementById('campaignDetailsModal');
        if (modal) {
            modal.classList.remove('active');
            document.body.style.overflow = '';
        }
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
            const campaign = this.generatedCampaigns[index];

            // Remove codes from used codes
            if (campaign.code) this.usedCodes.delete(campaign.code);
            if (campaign.adSetCodes) campaign.adSetCodes.forEach(c => this.usedCodes.delete(c));
            if (campaign.adCodes) campaign.adCodes.forEach(c => this.usedCodes.delete(c));
            this.saveUsedCodes();

            this.generatedCampaigns.splice(index, 1);
            this.saveCampaigns();
            this.renderHistory();
            Utils.showNotification('Campaña eliminada', 'info');
        }
    },

    // Clear history
    clearHistory() {
        if (confirm('¿Está seguro de que desea limpiar todo el historial de campañas? Los códigos serán liberados para reutilización.')) {
            // Clear all used codes
            this.usedCodes.clear();
            this.saveUsedCodes();

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
    },

    // ============================================
    // REPORT UPLOAD FUNCTIONALITY
    // ============================================

    // Store pending report data
    pendingReportData: null,

    // Store campaign performance data
    performanceData: [],

    // Handle report file upload
    handleReportUpload(input) {
        const file = input.files[0];
        if (!file) return;

        const statusEl = document.getElementById('reportUploadStatus');
        const previewEl = document.getElementById('reportPreview');

        // Show loading status
        if (statusEl) {
            statusEl.style.display = 'block';
            statusEl.innerHTML = `
                <div style="display: flex; align-items: center; gap: 0.5rem; padding: 1rem; background: var(--primary-light); border-radius: var(--radius-md);">
                    <div class="spinner-small"></div>
                    <span>Procesando archivo: <strong>${file.name}</strong></span>
                </div>
            `;
        }

        const reader = new FileReader();

        reader.onload = (e) => {
            try {
                const data = new Uint8Array(e.target.result);
                const workbook = XLSX.read(data, { type: 'array' });

                // Get first sheet
                const sheetName = workbook.SheetNames[0];
                const sheet = workbook.Sheets[sheetName];

                // Convert to JSON
                const jsonData = XLSX.utils.sheet_to_json(sheet, { header: 1 });

                if (jsonData.length < 2) {
                    throw new Error('El archivo no contiene datos suficientes');
                }

                // Process the data
                this.processReportData(jsonData, file.name);

            } catch (error) {
                console.error('Error processing file:', error);
                if (statusEl) {
                    statusEl.innerHTML = `
                        <div style="display: flex; align-items: center; gap: 0.5rem; padding: 1rem; background: rgba(239, 68, 68, 0.1); border-radius: var(--radius-md); color: #ef4444;">
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <circle cx="12" cy="12" r="10"></circle>
                                <line x1="15" y1="9" x2="9" y2="15"></line>
                                <line x1="9" y1="9" x2="15" y2="15"></line>
                            </svg>
                            <span>Error al procesar el archivo: ${error.message}</span>
                        </div>
                    `;
                }
            }
        };

        reader.readAsArrayBuffer(file);

        // Clear input for future uploads
        input.value = '';
    },

    // Process report data and show preview
    processReportData(jsonData, fileName) {
        const headers = jsonData[0];
        const rows = jsonData.slice(1).filter(row => row.length > 0 && row[0]);

        // Map columns - try to identify them automatically
        const columnMap = this.identifyColumns(headers);

        if (columnMap.campaignName === null) {
            throw new Error('No se encontró la columna de nombre de campaña');
        }

        // Process each row and extract campaign codes
        const processedData = rows.map(row => {
            const campaignName = row[columnMap.campaignName] || '';
            const code = this.extractCampaignCode(campaignName);

            return {
                originalName: campaignName,
                code: code,
                spent: this.parseNumber(row[columnMap.spent]),
                purchases: this.parseNumber(row[columnMap.purchases]),
                cpc: this.parseNumber(row[columnMap.cpc]),
                cpm: this.parseNumber(row[columnMap.cpm]),
                costPerPurchase: this.parseNumber(row[columnMap.costPerPurchase]),
                startDate: row[columnMap.startDate] || '',
                endDate: row[columnMap.endDate] || '',
                matched: false
            };
        });

        // Check which codes match existing campaigns
        processedData.forEach(item => {
            if (item.code) {
                const matchedCampaign = this.generatedCampaigns.find(c => c.code === item.code);
                item.matched = !!matchedCampaign;
                if (matchedCampaign) {
                    item.campaignId = matchedCampaign.id;
                }
            }
        });

        // Store pending data
        this.pendingReportData = processedData;

        // Show preview
        this.showReportPreview(headers, processedData);
    },

    // Identify columns in the report
    identifyColumns(headers) {
        const map = {
            campaignName: null,
            spent: null,
            purchases: null,
            cpc: null,
            cpm: null,
            costPerPurchase: null,
            startDate: null,
            endDate: null
        };

        console.log('Headers found:', headers);

        headers.forEach((header, index) => {
            const h = (header || '').toString().toLowerCase().trim();

            // Campaign name detection - expanded patterns
            if (map.campaignName === null) {
                if (h.includes('nombre') && (h.includes('campaña') || h.includes('campana'))) {
                    map.campaignName = index;
                } else if (h === 'nombre de la campaña' || h === 'nombre de la campana') {
                    map.campaignName = index;
                } else if (h.includes('campaign name') || h === 'campaign') {
                    map.campaignName = index;
                } else if (h === 'nombre' || h === 'name' || h === 'campaña' || h === 'campana') {
                    map.campaignName = index;
                } else if (h.includes('ad name') || h.includes('nombre del anuncio')) {
                    map.campaignName = index;
                }
            }

            // Spent/Amount detection
            if (h.includes('importe gastado') || h.includes('amount spent') || h.includes('spent') ||
                h.includes('gastado') || h.includes('gasto') || h.includes('monto')) {
                map.spent = index;
            }

            // Purchases/Results detection
            if (h === 'compras' || h === 'purchases' || h === 'conversiones' ||
                h === 'resultados' || h === 'results' || h.includes('purchase')) {
                map.purchases = index;
            }

            // CPC detection
            if (h.includes('cpc') || h.includes('coste por clic') || h.includes('cost per click') ||
                h.includes('costo por clic')) {
                map.cpc = index;
            }

            // CPM detection
            if (h.includes('cpm') || h.includes('coste por 1000') || h.includes('costo por 1000') ||
                h.includes('cost per 1,000') || h.includes('cost per 1000')) {
                map.cpm = index;
            }

            // Cost per purchase detection
            if (h.includes('coste por compra') || h.includes('cost per purchase') ||
                h.includes('costo por compra') || h.includes('coste por resultado') ||
                h.includes('cost per result') || h.includes('costo por resultado')) {
                map.costPerPurchase = index;
            }

            // Date detection
            if (h.includes('inicio') || h.includes('start') || h.includes('fecha inicio')) {
                map.startDate = index;
            }
            if (h.includes('fin') || h.includes('end') || h.includes('fecha fin')) {
                map.endDate = index;
            }
        });

        // If campaign name not found, use first column as fallback
        if (map.campaignName === null && headers.length > 0) {
            console.log('Campaign name column not detected, using first column as fallback');
            map.campaignName = 0;
        }

        console.log('Column mapping:', map);
        return map;
    },

    // Extract campaign code from campaign name (last 4 characters that match pattern)
    extractCampaignCode(campaignName) {
        if (!campaignName) return null;

        const name = campaignName.toString().trim();

        // Try to find a code pattern at the end (2 letters + 2 numbers)
        const codePattern = /([A-Z]{2}\d{2})$/i;
        const match = name.match(codePattern);

        if (match) {
            return match[1].toUpperCase();
        }

        // Try to find anywhere in the name
        const anywherePattern = /\b([A-Z]{2}\d{2})\b/gi;
        const matches = [...name.matchAll(anywherePattern)];

        if (matches.length > 0) {
            // Return the last match
            return matches[matches.length - 1][1].toUpperCase();
        }

        // Last resort: get last 4 characters if they look like a code
        const lastFour = name.slice(-4);
        if (/^[A-Z]{2}\d{2}$/i.test(lastFour)) {
            return lastFour.toUpperCase();
        }

        return null;
    },

    // Parse number from various formats
    parseNumber(value) {
        if (value === null || value === undefined || value === '') return 0;

        // If already a number
        if (typeof value === 'number') return value;

        // Remove currency symbols, spaces, and handle comma as decimal separator
        let str = value.toString()
            .replace(/[^\d.,\-]/g, '')
            .trim();

        // Handle European format (1.234,56 -> 1234.56)
        if (str.includes(',') && str.includes('.')) {
            if (str.lastIndexOf(',') > str.lastIndexOf('.')) {
                // European: 1.234,56
                str = str.replace(/\./g, '').replace(',', '.');
            } else {
                // US: 1,234.56
                str = str.replace(/,/g, '');
            }
        } else if (str.includes(',')) {
            // Could be European decimal or US thousands
            const parts = str.split(',');
            if (parts.length === 2 && parts[1].length <= 2) {
                // Likely European decimal
                str = str.replace(',', '.');
            } else {
                // Likely US thousands
                str = str.replace(/,/g, '');
            }
        }

        const num = parseFloat(str);
        return isNaN(num) ? 0 : num;
    },

    // Show report preview
    showReportPreview(headers, data) {
        const statusEl = document.getElementById('reportUploadStatus');
        const previewEl = document.getElementById('reportPreview');
        const headEl = document.getElementById('reportPreviewHead');
        const bodyEl = document.getElementById('reportPreviewBody');

        if (!previewEl || !headEl || !bodyEl) return;

        const matchedCount = data.filter(d => d.matched).length;
        const totalCount = data.length;

        // Update status
        if (statusEl) {
            statusEl.innerHTML = `
                <div style="display: flex; align-items: center; gap: 0.5rem; padding: 1rem; background: ${matchedCount > 0 ? 'rgba(16, 185, 129, 0.1)' : 'rgba(245, 158, 11, 0.1)'}; border-radius: var(--radius-md); color: ${matchedCount > 0 ? '#10b981' : '#f59e0b'};">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        ${matchedCount > 0 ? '<path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline>' : '<circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line>'}
                    </svg>
                    <span><strong>${matchedCount}</strong> de <strong>${totalCount}</strong> campañas coinciden con códigos existentes</span>
                </div>
            `;
            statusEl.style.display = 'block';
        }

        // Build preview table header
        headEl.innerHTML = `
            <tr>
                <th style="width: 80px;">Estado</th>
                <th style="width: 80px;">Código</th>
                <th>Nombre Campaña</th>
                <th style="text-align: right;">Gastado</th>
                <th style="text-align: center;">Compras</th>
                <th style="text-align: right;">CPC</th>
                <th style="text-align: right;">CPM</th>
                <th style="text-align: right;">C/Compra</th>
            </tr>
        `;

        // Build preview table body
        bodyEl.innerHTML = data.map(item => `
            <tr style="${item.matched ? '' : 'opacity: 0.6;'}">
                <td>
                    ${item.matched ?
                `<span style="color: #10b981; font-weight: 600;">✓ Match</span>` :
                `<span style="color: #f59e0b;">Sin match</span>`}
                </td>
                <td>
                    ${item.code ?
                `<span style="background: ${item.matched ? 'linear-gradient(135deg, var(--primary), #8b5cf6)' : 'var(--surface-hover)'}; 
                                color: ${item.matched ? 'white' : 'var(--text-muted)'}; 
                                padding: 0.25rem 0.5rem; border-radius: var(--radius-sm); font-weight: 600; font-family: monospace;">
                            ${item.code}
                        </span>` :
                '<span style="color: var(--text-muted);">-</span>'}
                </td>
                <td style="font-size: 0.8rem; max-width: 200px; overflow: hidden; text-overflow: ellipsis;" title="${item.originalName}">
                    ${item.originalName}
                </td>
                <td style="text-align: right; font-family: monospace;">$${this.formatCurrency(item.spent)}</td>
                <td style="text-align: center; font-weight: 600;">${item.purchases || '-'}</td>
                <td style="text-align: right; font-family: monospace;">${item.cpc ? '$' + this.formatCurrency(item.cpc) : '-'}</td>
                <td style="text-align: right; font-family: monospace;">${item.cpm ? '$' + this.formatCurrency(item.cpm) : '-'}</td>
                <td style="text-align: right; font-family: monospace;">${item.costPerPurchase ? '$' + this.formatCurrency(item.costPerPurchase) : '-'}</td>
            </tr>
        `).join('');

        previewEl.style.display = 'block';
    },

    // Format currency
    formatCurrency(value) {
        if (!value && value !== 0) return '0';
        return new Intl.NumberFormat('es-CO', {
            minimumFractionDigits: 0,
            maximumFractionDigits: 2
        }).format(value);
    },

    // Confirm and save report upload
    confirmReportUpload() {
        if (!this.pendingReportData || this.pendingReportData.length === 0) {
            Utils.showNotification('No hay datos para procesar', 'error');
            return;
        }

        // Filter only matched data
        const matchedData = this.pendingReportData.filter(d => d.matched);

        if (matchedData.length === 0) {
            Utils.showNotification('No hay campañas que coincidan. Los códigos deben estar al final del nombre de la campaña.', 'warning');
            return;
        }

        // Load existing performance data
        this.loadPerformanceData();

        // Add or update performance data
        matchedData.forEach(item => {
            const existingIndex = this.performanceData.findIndex(p => p.code === item.code);

            const performanceEntry = {
                code: item.code,
                campaignId: item.campaignId,
                originalName: item.originalName,
                spent: item.spent,
                purchases: item.purchases,
                cpc: item.cpc,
                cpm: item.cpm,
                costPerPurchase: item.costPerPurchase,
                startDate: item.startDate,
                endDate: item.endDate,
                updatedAt: new Date().toISOString()
            };

            if (existingIndex > -1) {
                // Update existing
                this.performanceData[existingIndex] = performanceEntry;
            } else {
                // Add new
                this.performanceData.push(performanceEntry);
            }
        });

        // Save performance data
        this.savePerformanceData();

        // Clear pending data and hide preview
        this.cancelReportUpload();

        // Render performance table
        this.renderPerformanceTable();

        Utils.showNotification(`¡${matchedData.length} campaña(s) actualizadas con datos de rendimiento!`, 'success');
    },

    // Cancel report upload
    cancelReportUpload() {
        this.pendingReportData = null;

        const statusEl = document.getElementById('reportUploadStatus');
        const previewEl = document.getElementById('reportPreview');

        if (statusEl) statusEl.style.display = 'none';
        if (previewEl) previewEl.style.display = 'none';
    },

    // Load performance data from localStorage
    loadPerformanceData() {
        const saved = localStorage.getItem('campaignPerformanceData');
        if (saved) {
            try {
                this.performanceData = JSON.parse(saved);
            } catch (e) {
                this.performanceData = [];
            }
        }
    },

    // Save performance data to localStorage
    savePerformanceData() {
        localStorage.setItem('campaignPerformanceData', JSON.stringify(this.performanceData));
    },

    // Render performance table
    renderPerformanceTable() {
        const tbody = document.getElementById('campaignPerformanceTable');
        if (!tbody) return;

        this.loadPerformanceData();

        if (this.performanceData.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="8" style="text-align: center; color: var(--text-muted); padding: 2rem;">
                        No hay datos de rendimiento. Sube un reporte para ver el rendimiento.
                    </td>
                </tr>
            `;
            return;
        }

        // Calculate totals
        const totals = this.performanceData.reduce((acc, item) => {
            acc.spent += item.spent || 0;
            acc.purchases += item.purchases || 0;
            return acc;
        }, { spent: 0, purchases: 0 });

        tbody.innerHTML = this.performanceData.map(item => {
            const campaign = this.generatedCampaigns.find(c => c.code === item.code);
            const campaignName = campaign?.name || item.originalName;

            return `
                <tr>
                    <td>
                        <span onclick="CampaignsModule.copyCode('${item.code}')" 
                              style="background: linear-gradient(135deg, var(--primary), #8b5cf6); color: white; 
                                     padding: 0.35rem 0.75rem; border-radius: var(--radius-sm); font-weight: 700;
                                     cursor: pointer; font-family: monospace; letter-spacing: 1px;"
                              title="Clic para copiar">
                            ${item.code}
                        </span>
                    </td>
                    <td style="font-size: 0.8rem; max-width: 180px; overflow: hidden; text-overflow: ellipsis;" title="${campaignName}">
                        ${campaignName}
                    </td>
                    <td style="text-align: right; font-family: monospace; font-weight: 600;">
                        $${this.formatCurrency(item.spent)}
                    </td>
                    <td style="text-align: center; font-weight: 700; color: ${item.purchases > 0 ? '#10b981' : 'var(--text-muted)'};">
                        ${item.purchases || '-'}
                    </td>
                    <td style="text-align: right; font-family: monospace;">
                        ${item.cpc ? '$' + this.formatCurrency(item.cpc) : '-'}
                    </td>
                    <td style="text-align: right; font-family: monospace;">
                        ${item.cpm ? '$' + this.formatCurrency(item.cpm) : '-'}
                    </td>
                    <td style="text-align: right; font-family: monospace; font-weight: 600; color: ${item.costPerPurchase ? '#f59e0b' : 'var(--text-muted)'};">
                        ${item.costPerPurchase ? '$' + this.formatCurrency(item.costPerPurchase) : '-'}
                    </td>
                    <td style="font-size: 0.75rem; color: var(--text-muted);">
                        ${item.startDate || '-'} - ${item.endDate || '-'}
                    </td>
                </tr>
            `;
        }).join('') + `
            <tr style="background: var(--surface-hover); font-weight: 700;">
                <td colspan="2" style="text-align: right;">TOTALES:</td>
                <td style="text-align: right; font-family: monospace; color: var(--primary);">$${this.formatCurrency(totals.spent)}</td>
                <td style="text-align: center; color: #10b981;">${totals.purchases}</td>
                <td colspan="4"></td>
            </tr>
        `;
    },

    // Clear performance data
    clearPerformanceData() {
        if (confirm('¿Está seguro de que desea limpiar todos los datos de rendimiento?')) {
            this.performanceData = [];
            this.savePerformanceData();
            this.renderPerformanceTable();
            Utils.showNotification('Datos de rendimiento eliminados', 'info');
        }
    }
};

// Make available globally
window.CampaignsModule = CampaignsModule;
