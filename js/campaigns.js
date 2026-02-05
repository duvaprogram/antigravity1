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
        this.bindEvents();
        this.setDefaultDate();
        this.loadSavedCampaigns();
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
    }
};

// Make available globally
window.CampaignsModule = CampaignsModule;
