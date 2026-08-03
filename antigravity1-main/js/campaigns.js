// Campaigns Module - Campaign Name Generator, Meta Ad IDs Import & Quick Sales Registration
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

    // Store imported ads with IDs and metrics
    campaignAds: [],

    // Store quick sales registered by Ad ID
    campaignSales: [],

    // Store campaign performance data (consolidated)
    performanceData: [],

    // Store pending report data
    pendingReportData: null,

    // Current active tab ('generator', 'ads-performance', 'quick-sales', 'sales-history')
    activeTab: 'generator',

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
        if (this.initialized) {
            return;
        }
        this.initialized = true;

        await this.loadProducts();
        this.loadUsedCodes();
        await this.loadAllDataFromDb();
        this.bindEvents();
        this.setDefaultDate();
        this.renderAll();
    },

    // Load all data from Supabase / localStorage
    async loadAllDataFromDb() {
        try {
            // 1. Load Campaigns
            if (window.Database && window.Database.getCampaigns) {
                try {
                    const dbCampaigns = await window.Database.getCampaigns();
                    if (dbCampaigns && dbCampaigns.length > 0) {
                        this.generatedCampaigns = dbCampaigns;
                    } else {
                        const saved = localStorage.getItem('generatedCampaigns');
                        this.generatedCampaigns = saved ? JSON.parse(saved) : [];
                    }
                } catch (e) {
                    const saved = localStorage.getItem('generatedCampaigns');
                    this.generatedCampaigns = saved ? JSON.parse(saved) : [];
                }
            } else {
                const saved = localStorage.getItem('generatedCampaigns');
                this.generatedCampaigns = saved ? JSON.parse(saved) : [];
            }

            // Rebuild used codes
            this.generatedCampaigns.forEach(c => {
                if (c.code) this.usedCodes.add(c.code);
                if (c.adSetCodes) c.adSetCodes.forEach(code => this.usedCodes.add(code));
                if (c.adCodes) c.adCodes.forEach(code => this.usedCodes.add(code));
            });

            // 2. Load Campaign Ads
            if (window.Database && window.Database.getCampaignAds) {
                try {
                    const dbAds = await window.Database.getCampaignAds();
                    if (dbAds && dbAds.length > 0) {
                        this.campaignAds = dbAds;
                    } else {
                        const savedAds = localStorage.getItem('campaignAdsData');
                        this.campaignAds = savedAds ? JSON.parse(savedAds) : [];
                    }
                } catch (e) {
                    const savedAds = localStorage.getItem('campaignAdsData');
                    this.campaignAds = savedAds ? JSON.parse(savedAds) : [];
                }
            } else {
                const savedAds = localStorage.getItem('campaignAdsData');
                this.campaignAds = savedAds ? JSON.parse(savedAds) : [];
            }

            // 3. Load Campaign Sales
            if (window.Database && window.Database.getCampaignSales) {
                try {
                    const dbSales = await window.Database.getCampaignSales();
                    if (dbSales && dbSales.length > 0) {
                        this.campaignSales = dbSales;
                    } else {
                        const savedSales = localStorage.getItem('campaignSalesData');
                        this.campaignSales = savedSales ? JSON.parse(savedSales) : [];
                    }
                } catch (e) {
                    const savedSales = localStorage.getItem('campaignSalesData');
                    this.campaignSales = savedSales ? JSON.parse(savedSales) : [];
                }
            } else {
                const savedSales = localStorage.getItem('campaignSalesData');
                this.campaignSales = savedSales ? JSON.parse(savedSales) : [];
            }

            // 4. Load Campaign Performance
            this.loadPerformanceData();

            this.calculateAdMetrics();
            this.renderAll();
        } catch (error) {
            console.error('Error loading campaigns data from DB:', error);
        }
    },

    // Render all sub-sections
    renderAll() {
        this.renderHistory();
        this.renderAdsTable();
        this.renderPerformanceTable();
        this.renderSalesHistoryTable();
        this.renderSalesKPIs();
    },

    // Switch between tabs
    switchTab(tabId) {
        this.activeTab = tabId;

        // Update tab buttons
        const tabBtns = {
            'generator': 'tabBtnCampaignGenerator',
            'ads-performance': 'tabBtnCampaignAds',
            'quick-sales': 'tabBtnCampaignSales',
            'sales-history': 'tabBtnCampaignHistory'
        };

        Object.keys(tabBtns).forEach(key => {
            const btn = document.getElementById(tabBtns[key]);
            if (btn) {
                if (key === tabId) {
                    btn.classList.add('active');
                } else {
                    btn.classList.remove('active');
                }
            }
        });

        // Update tab panes
        const panes = {
            'generator': 'tabContentCampaignGenerator',
            'ads-performance': 'tabContentCampaignAds',
            'quick-sales': 'tabContentCampaignSales',
            'sales-history': 'tabContentCampaignHistory'
        };

        Object.keys(panes).forEach(key => {
            const pane = document.getElementById(panes[key]);
            if (pane) {
                if (key === tabId) {
                    pane.style.display = 'block';
                } else {
                    pane.style.display = 'none';
                }
            }
        });

        // Re-render data for the active tab
        if (tabId === 'ads-performance') {
            this.renderAdsTable();
            this.renderPerformanceTable();
        } else if (tabId === 'quick-sales') {
            this.renderSalesKPIs();
        } else if (tabId === 'sales-history') {
            this.renderSalesHistoryTable();
            this.renderSalesKPIs();
        }
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
            const letter1 = this.codeLetters[Math.floor(Math.random() * this.codeLetters.length)];
            const letter2 = this.codeLetters[Math.floor(Math.random() * this.codeLetters.length)];
            const numbers = String(Math.floor(Math.random() * 100)).padStart(2, '0');
            code = `${letter1}${letter2}${numbers}`;
            attempts++;
        } while (this.usedCodes.has(code) && attempts < maxAttempts);

        if (this.usedCodes.has(code)) {
            code = code + String(Date.now()).slice(-2);
        }

        this.usedCodes.add(code);
        this.saveUsedCodes();
        return code;
    },

    // Generate ad codes based on campaign code
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

    // Generate ad set codes based on campaign code
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
            if (window.Database && window.Database.getProducts) {
                this.products = await Database.getProducts();
            }
        } catch (error) {
            console.error('Error loading products:', error);
            this.products = [];
        }
    },

    // Generate the campaign name
    generateCampaignName() {
        const country = document.getElementById('campaignCountry').value;
        const type = document.getElementById('campaignType').value;
        const objective = document.getElementById('campaignObjective').value;
        const date = document.getElementById('campaignDate').value;
        const product = document.getElementById('campaignProduct').value.trim();
        const adSets = parseInt(document.getElementById('campaignAdSets').value) || 0;
        const ads = parseInt(document.getElementById('campaignAds').value) || 0;

        if (!country || !type || !objective || !date || !product) {
            Utils.showNotification('Por favor complete todos los campos obligatorios', 'error');
            return;
        }

        const formattedDate = this.formatDate(date);
        const formattedProduct = product.toUpperCase().replace(/\s+/g, '-');
        const campaignCode = this.generateCampaignCode();

        // Format: PAIS-TIPO-OBJETIVO-FECHA-PRODUCTO-CODIGO
        const campaignName = `${country}-${type}-${objective}-${formattedDate}-${formattedProduct}-${campaignCode}`;

        // Generate ad and ad set codes
        const adSetCodes = this.generateAdSetCodes(campaignCode, adSets);
        const adCodes = this.generateAdCodes(campaignCode, ads);

        // Add to history
        this.addToHistory(campaignName, {
            country,
            type,
            objective,
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

        // Reset form inputs
        document.getElementById('campaignProduct').value = '';
        document.getElementById('campaignProductSearch').value = '';
        document.getElementById('campaignAdSets').value = '';
        document.getElementById('campaignAds').value = '';
        this.updatePreview();
    },

    // Bind form and input events
    bindEvents() {
        const form = document.getElementById('campaignForm');
        if (form) {
            form.removeEventListener('submit', this.handleFormSubmit);
            this.handleFormSubmit = (e) => {
                e.preventDefault();
                this.generateCampaignName();
            };
            form.addEventListener('submit', this.handleFormSubmit);
        }

        // Quick Sales Form
        const quickSalesForm = document.getElementById('quickSaleForm');
        if (quickSalesForm) {
            quickSalesForm.removeEventListener('submit', this.handleQuickSaleFormSubmit);
            this.handleQuickSaleFormSubmit = (e) => {
                e.preventDefault();
                this.registerQuickSale();
            };
            quickSalesForm.addEventListener('submit', this.handleQuickSaleFormSubmit);
        }

        // Real-time preview interactions
        const inputs = ['campaignCountry', 'campaignType', 'campaignObjective', 'campaignDate', 'campaignProduct', 'campaignAdSets', 'campaignAds'];
        inputs.forEach(id => {
            const el = document.getElementById(id);
            if (el) {
                el.removeEventListener('input', this.updatePreviewHandler);
                el.removeEventListener('change', this.updatePreviewHandler);
                this.updatePreviewHandler = () => this.updatePreview();
                el.addEventListener('input', this.updatePreviewHandler);
                el.addEventListener('change', this.updatePreviewHandler);
            }
        });

        // Product Autocomplete for Campaign Generator
        const productSearchInput = document.getElementById('campaignProductSearch');
        if (productSearchInput) {
            productSearchInput.addEventListener('input', Utils.debounce(() => {
                this.searchProducts(productSearchInput.value);
            }, 200));

            productSearchInput.addEventListener('focus', () => {
                if (productSearchInput.value.length >= 1) {
                    this.searchProducts(productSearchInput.value);
                }
            });

            productSearchInput.addEventListener('keydown', (e) => {
                this.handleAutocompleteKeyboard(e, 'campaignProductSuggestions');
            });
        }

        // Ad ID Autocomplete for Quick Sales
        const quickSaleAdIdInput = document.getElementById('quickSaleAdId');
        if (quickSaleAdIdInput) {
            quickSaleAdIdInput.addEventListener('input', Utils.debounce(() => {
                this.searchAdsForQuickSale(quickSaleAdIdInput.value);
            }, 150));

            quickSaleAdIdInput.addEventListener('focus', () => {
                this.searchAdsForQuickSale(quickSaleAdIdInput.value);
            });
        }

        // Ads Table Search Input
        const searchAdsInput = document.getElementById('searchAdsInput');
        if (searchAdsInput) {
            searchAdsInput.addEventListener('input', Utils.debounce(() => {
                this.renderAdsTable(searchAdsInput.value);
            }, 200));
        }

        // Sales History Search Input
        const searchSalesInput = document.getElementById('searchSalesInput');
        if (searchSalesInput) {
            searchSalesInput.addEventListener('input', Utils.debounce(() => {
                this.renderSalesHistoryTable(searchSalesInput.value);
            }, 200));
        }

        // Close autocompletes when clicking outside
        document.addEventListener('click', (e) => {
            if (!e.target.closest('.autocomplete-container') && !e.target.closest('#quickSaleAdIdContainer')) {
                document.querySelectorAll('.autocomplete-suggestions, .ad-search-dropdown').forEach(el => {
                    el.style.display = 'none';
                    el.classList.remove('active');
                });
            }
        });
    },

    // Handle keyboard navigation in autocomplete
    handleAutocompleteKeyboard(e, suggestionsId) {
        const suggestions = document.getElementById(suggestionsId);
        if (!suggestions) return;
        const items = suggestions.querySelectorAll('.autocomplete-item:not(.disabled)');
        const activeItem = suggestions.querySelector('.autocomplete-item.active');
        let currentIndex = Array.from(items).indexOf(activeItem);

        switch (e.key) {
            case 'ArrowDown':
                e.preventDefault();
                if (currentIndex < items.length - 1) {
                    items[currentIndex]?.classList.remove('active');
                    items[currentIndex + 1]?.classList.add('active');
                    items[currentIndex + 1]?.scrollIntoView({ block: 'nearest' });
                } else if (currentIndex === -1 && items.length > 0) {
                    items[0]?.classList.add('active');
                }
                break;
            case 'ArrowUp':
                e.preventDefault();
                if (currentIndex > 0) {
                    items[currentIndex]?.classList.remove('active');
                    items[currentIndex - 1]?.classList.add('active');
                    items[currentIndex - 1]?.scrollIntoView({ block: 'nearest' });
                }
                break;
            case 'Enter':
                e.preventDefault();
                if (activeItem) {
                    activeItem.click();
                }
                break;
            case 'Escape':
                suggestions.classList.remove('active');
                break;
        }
    },

    // Search products for autocomplete
    searchProducts(query) {
        const suggestionsEl = document.getElementById('campaignProductSuggestions');
        if (!suggestionsEl) return;

        if (query.length < 1) {
            suggestionsEl.classList.remove('active');
            return;
        }

        const queryLower = query.toLowerCase();
        const activeProducts = this.products.filter(p => p.active !== false);

        const filtered = activeProducts.filter(product =>
            product.name.toLowerCase().includes(queryLower) ||
            (product.sku && product.sku.toLowerCase().includes(queryLower))
        ).slice(0, 10);

        if (filtered.length === 0) {
            suggestionsEl.innerHTML = '<div class="autocomplete-no-results" style="padding: 0.5rem; color: var(--text-muted);">No se encontraron productos</div>';
        } else {
            suggestionsEl.innerHTML = filtered.map(product => `
                <div class="autocomplete-item" data-id="${product.id}" data-name="${product.name}" data-sku="${product.sku || ''}">
                    <div class="item-main" style="font-weight: 600;">${this.highlightMatch(product.name, query)}</div>
                    <div class="item-secondary">
                        ${product.sku ? `<span style="color: var(--text-muted); font-size: 0.75rem;">SKU: ${product.sku}</span>` : ''}
                    </div>
                </div>
            `).join('');

            suggestionsEl.querySelectorAll('.autocomplete-item').forEach(item => {
                item.addEventListener('click', () => {
                    this.selectProduct(item.dataset.id, item.dataset.name, item.dataset.sku);
                });
            });
        }

        suggestionsEl.classList.add('active');
    },

    // Select a product from autocomplete
    selectProduct(productId, productName, productSku) {
        const prodInput = document.getElementById('campaignProduct');
        const prodSearch = document.getElementById('campaignProductSearch');
        if (prodInput) prodInput.value = productName;
        if (prodSearch) prodSearch.value = productName;
        const sugg = document.getElementById('campaignProductSuggestions');
        if (sugg) sugg.classList.remove('active');
        this.updatePreview();
    },

    // Highlight matching text
    highlightMatch(text, query) {
        if (!query) return text;
        const regex = new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
        return text.replace(regex, '<span class="autocomplete-highlight" style="background: rgba(99, 102, 241, 0.2); color: #818cf8; font-weight: 700;">$1</span>');
    },

    // Set default date to today
    setDefaultDate() {
        const dateInput = document.getElementById('campaignDate');
        if (dateInput) {
            const today = new Date();
            dateInput.value = today.toISOString().split('T')[0];
            this.updatePreview();
        }
        const quickSaleDateInput = document.getElementById('quickSaleDate');
        if (quickSaleDateInput && !quickSaleDateInput.value) {
            quickSaleDateInput.value = new Date().toISOString().split('T')[0];
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
        const objective = document.getElementById('campaignObjective')?.value || '';
        const date = document.getElementById('campaignDate')?.value || '';
        const product = document.getElementById('campaignProduct')?.value || '';
        const adSets = document.getElementById('campaignAdSets')?.value || '';
        const ads = document.getElementById('campaignAds')?.value || '';

        const previewEl = document.getElementById('campaignPreview');
        const previewTextEl = document.getElementById('campaignPreviewText');
        const adInfoEl = document.getElementById('campaignAdInfo');

        if (!previewEl || !previewTextEl) return;

        if (country && type && objective && date && product.trim()) {
            const formattedDate = this.formatDate(date);
            const formattedProduct = product.toUpperCase().trim().replace(/\s+/g, '-');
            const campaignName = `${country}-${type}-${objective}-${formattedDate}-${formattedProduct}-XY01`;

            previewTextEl.innerHTML = `
                <div style="font-size: 0.75rem; color: var(--text-muted); margin-bottom: 0.25rem;">
                    Previsualización (El código <strong>XY01</strong> es generado al final):
                </div>
                ${campaignName}
            `;
            previewEl.style.display = 'block';
            previewEl.classList.add('preview-active');

            if (adInfoEl) {
                if (adSets || ads) {
                    const adSetsNum = parseInt(adSets) || 0;
                    const adsNum = parseInt(ads) || 0;

                    let infoText = `<div style="margin-top: 0.75rem; padding-top: 0.75rem; border-top: 1px dashed var(--border);">`;
                    infoText += `<div style="margin-bottom: 0.5rem; font-size: 0.85rem; color: var(--text-secondary);">`;

                    if (adSetsNum > 0) {
                        infoText += `<span>📊 ${adSetsNum} Conjunto(s) → Códigos: ...XY01S1, ...XY01S2</span>`;
                    }
                    if (adSetsNum > 0 && adsNum > 0) {
                        infoText += ` · `;
                    }
                    if (adsNum > 0) {
                        infoText += `<span>📢 ${adsNum} Anuncio(s) → Códigos: ...XY01A1, ...XY01A2</span>`;
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
        }

        Utils.showNotification(`¡Campaña generada! Código: ${campaignCode}`, 'success');
    },

    // Copy single code to clipboard
    copyCode(code) {
        if (!code) return;
        navigator.clipboard.writeText(String(code)).then(() => {
            Utils.showNotification(`Código ${code} copiado`, 'success');
        }).catch(err => {
            const textArea = document.createElement('textarea');
            textArea.value = String(code);
            document.body.appendChild(textArea);
            textArea.select();
            document.execCommand('copy');
            document.body.removeChild(textArea);
            Utils.showNotification(`Código ${code} copiado`, 'success');
        });
    },

    // Copy campaign name
    copyToClipboard() {
        const resultTextEl = document.getElementById('campaignResultText');
        if (resultTextEl) {
            const campaignNameEl = resultTextEl.querySelector('div:last-child');
            const campaignName = campaignNameEl?.textContent || '';
            this.copyCode(campaignName.trim());
        }
    },

    // Copy all codes for a campaign
    copyAllCodes(campaignId) {
        const campaign = this.generatedCampaigns.find(c => String(c.id) === String(campaignId));
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
            this.copyCode(allCodes);
        });
    },

    // Add campaign to history
    async addToHistory(campaignName, details) {
        const campaign = {
            id: Date.now(),
            name: campaignName,
            ...details
        };

        this.generatedCampaigns.unshift(campaign);
        if (this.generatedCampaigns.length > 150) {
            this.generatedCampaigns = this.generatedCampaigns.slice(0, 150);
        }

        this.saveCampaigns();
        if (window.Database && window.Database.saveCampaign) {
            try { await window.Database.saveCampaign(campaign); } catch(e){}
        }
        this.renderHistory();
    },

    // Save campaigns to localStorage
    saveCampaigns() {
        localStorage.setItem('generatedCampaigns', JSON.stringify(this.generatedCampaigns));
    },

    // Render history table
    renderHistory() {
        const tbody = document.getElementById('campaignsHistoryTable');
        if (!tbody) return;

        if (this.generatedCampaigns.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="10" style="text-align: center; color: var(--text-muted); padding: 2rem;">
                        No hay campañas generadas aún
                    </td>
                </tr>`;
            return;
        }

        tbody.innerHTML = this.generatedCampaigns.slice(0, 40).map(campaign => {
            const date = new Date(campaign.createdAt || Date.now());
            const formattedDate = date.toLocaleDateString('es-ES', {
                day: '2-digit',
                month: 'short',
                year: 'numeric'
            });

            const adSetsDisplay = campaign.adSets > 0 ? campaign.adSets : '-';
            const adsDisplay = campaign.ads > 0 ? campaign.ads : '-';
            const codeDisplay = campaign.code || '-';
            const isActive = campaign.active !== false;

            return `
                <tr style="${!isActive ? 'opacity: 0.75; background: rgba(0,0,0,0.02);' : ''}">
                    <td>
                        <span onclick="CampaignsModule.copyCode('${codeDisplay}')" 
                              style="background: linear-gradient(135deg, var(--primary), #8b5cf6); color: white; 
                                     padding: 0.35rem 0.75rem; border-radius: var(--radius-sm); font-weight: 700;
                                     cursor: pointer; font-family: monospace; letter-spacing: 1px;"
                              title="Clic para copiar">
                            ${codeDisplay}
                        </span>
                    </td>
                    <td style="font-family: monospace; font-size: 0.8rem; max-width: 190px; overflow: hidden; text-overflow: ellipsis;" title="${campaign.name}">
                        ${campaign.name}
                    </td>
                    <td>${this.countries[campaign.country] || campaign.country || '-'}</td>
                    <td><span class="badge badge-${campaign.type === 'ABO' ? 'primary' : 'secondary'}">${campaign.type || 'ABO'}</span></td>
                    <td style="font-size: 0.85rem;">${campaign.date || '-'}</td>
                    <td style="text-align: center; font-weight: 600;">${adSetsDisplay}</td>
                    <td style="text-align: center; font-weight: 600;">${adsDisplay}</td>
                    <td>
                        <div style="display: flex; align-items: center; gap: 0.35rem;">
                            <label class="switch" title="Clic para Activar / Desactivar">
                                <input type="checkbox" ${isActive ? 'checked' : ''} onchange="CampaignsModule.toggleCampaignStatus('${campaign.id}', this.checked)">
                                <span class="slider"></span>
                            </label>
                            <span style="font-size: 0.75rem; font-weight: 600; color: ${isActive ? '#10b981' : 'var(--text-muted)'};">
                                ${isActive ? 'Activa' : 'Inactiva'}
                            </span>
                        </div>
                    </td>
                    <td style="font-size: 0.75rem; color: var(--text-muted);">${formattedDate}</td>
                    <td>
                        <div style="display: flex; gap: 0.25rem;">
                            <button class="btn btn-icon btn-sm" onclick="CampaignsModule.openAdDetailsModal('${campaign.id}')" title="Anuncios, Post IDs y Compras">
                                📢
                            </button>
                            <button class="btn btn-icon btn-sm" onclick="CampaignsModule.openEditCampaignModal('${campaign.id}')" title="Editar Campaña">
                                ✏️
                            </button>
                            <button class="btn btn-icon btn-sm" onclick="CampaignsModule.copyAllCodes('${campaign.id}')" title="Copiar todos los códigos">
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                    <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                                    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                                </svg>
                            </button>
                            <button class="btn btn-icon btn-sm" onclick="CampaignsModule.viewCampaignDetails('${campaign.id}')" title="Ver detalles">
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                                    <circle cx="12" cy="12" r="3"></circle>
                                </svg>
                            </button>
                            <button class="btn btn-icon btn-sm btn-danger-light" onclick="CampaignsModule.deleteCampaign('${campaign.id}')" title="Eliminar">
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

    // Toggle active / inactive status of a campaign
    toggleCampaignStatus(campaignId, active) {
        const campaign = this.generatedCampaigns.find(c => String(c.id) === String(campaignId));
        if (campaign) {
            campaign.active = active;
            this.saveCampaigns();
            if (window.Database && window.Database.saveCampaign) {
                try { window.Database.saveCampaign(campaign); } catch(e){}
            }
            this.renderHistory();
            Utils.showNotification(`Campaña ${campaign.code || ''} ${active ? 'activada 🟢' : 'desactivada 🔴'}`, active ? 'success' : 'info');
        }
    },

    // Delete campaign
    deleteCampaign(campaignId) {
        if (!confirm('¿Está seguro de eliminar esta campaña?')) return;
        const index = this.generatedCampaigns.findIndex(c => String(c.id) === String(campaignId));
        if (index > -1) {
            const campaign = this.generatedCampaigns[index];
            if (campaign.code) this.usedCodes.delete(campaign.code);
            if (campaign.adSetCodes) campaign.adSetCodes.forEach(c => this.usedCodes.delete(c));
            if (campaign.adCodes) campaign.adCodes.forEach(c => this.usedCodes.delete(c));
            this.saveUsedCodes();

            this.generatedCampaigns.splice(index, 1);
            this.saveCampaigns();
            if (window.Database && window.Database.deleteCampaign) {
                try { window.Database.deleteCampaign(campaignId); } catch(e){}
            }
            this.renderHistory();
            Utils.showNotification('Campaña eliminada', 'info');
        }
    },

    // View campaign details modal
    viewCampaignDetails(campaignId) {
        const campaign = this.generatedCampaigns.find(c => String(c.id) === String(campaignId));
        if (!campaign) return;

        this.ensureAdDetails(campaign);

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

        detailsHtml += `
                <div style="margin-top: 1.5rem; display: flex; flex-wrap: wrap; gap: 0.5rem; justify-content: center;">
                    <button class="btn btn-secondary" onclick="CampaignsModule.openEditCampaignModal('${campaign.id}')">
                        ✏️ Editar Campaña
                    </button>
                    <button class="btn btn-success" onclick="CampaignsModule.openAdDetailsModal('${campaign.id}')">
                        📢 Post IDs y Compras
                    </button>
                    <button class="btn btn-primary" onclick="CampaignsModule.copyAllCodes('${campaign.id}')">
                        📋 Copiar Todo
                    </button>
                    <button class="btn btn-secondary" onclick="CampaignsModule.closeDetailsModal()">Cerrar</button>
                </div>
            </div>
        `;

        let modal = document.getElementById('campaignDetailsModal');
        if (!modal) {
            modal = document.createElement('div');
            modal.id = 'campaignDetailsModal';
            modal.className = 'modal';
            modal.innerHTML = `<div class="modal-content" style="max-width: 580px;"></div>`;
            document.body.appendChild(modal);

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

    // Close any modal by ID
    closeModalId(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.classList.remove('active');
            document.body.style.overflow = '';
        }
    },

    // Ensure adDetails array exists
    ensureAdDetails(campaign) {
        if (!campaign.adDetails) campaign.adDetails = [];
        const existingMap = new Map(campaign.adDetails.map(a => [a.code, a]));

        const updatedAdDetails = (campaign.adCodes || []).map(code => {
            const existing = existingMap.get(code);
            return {
                code: code,
                postId: existing?.postId || '',
                purchases: existing?.purchases || 0,
                spent: existing?.spent || 0
            };
        });

        campaign.adDetails = updatedAdDetails;
    },

    // Open edit campaign modal
    openEditCampaignModal(campaignId) {
        const campaign = this.generatedCampaigns.find(c => String(c.id) === String(campaignId));
        if (!campaign) {
            Utils.showNotification('Campaña no encontrada', 'error');
            return;
        }

        const dateVal = this.parseDateInputFormat(campaign.date);
        const isActive = campaign.active !== false;

        let modal = document.getElementById('modalEditCampaign');
        if (!modal) {
            modal = document.createElement('div');
            modal.id = 'modalEditCampaign';
            modal.className = 'modal';
            document.body.appendChild(modal);

            modal.addEventListener('click', (e) => {
                if (e.target === modal) this.closeModalId('modalEditCampaign');
            });
        }

        modal.innerHTML = `
            <div class="modal-content" style="max-width: 650px;">
                <div class="modal-header">
                    <h2>✏️ Editar Campaña (${campaign.code || ''})</h2>
                    <button class="modal-close" onclick="CampaignsModule.closeModalId('modalEditCampaign')">&times;</button>
                </div>
                <div class="modal-body" style="padding: 1.5rem 0;">
                    <form id="editCampaignForm" onsubmit="CampaignsModule.handleEditCampaignSubmit(event)">
                        <input type="hidden" id="editCampaignId" value="${campaign.id}">
                        <div class="form-grid" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1rem;">
                            <div class="form-group">
                                <label for="editCampaignCountry">País *</label>
                                <select id="editCampaignCountry" class="form-control" required>
                                    <option value="ECU" ${campaign.country === 'ECU' ? 'selected' : ''}>🇪🇨 Ecuador (ECU)</option>
                                    <option value="VEN" ${campaign.country === 'VEN' ? 'selected' : ''}>🇻🇪 Venezuela (VEN)</option>
                                    <option value="COL" ${campaign.country === 'COL' ? 'selected' : ''}>🇨🇴 Colombia (COL)</option>
                                </select>
                            </div>
                            <div class="form-group">
                                <label for="editCampaignType">Tipo *</label>
                                <select id="editCampaignType" class="form-control" required>
                                    <option value="ABO" ${campaign.type === 'ABO' ? 'selected' : ''}>ABO</option>
                                    <option value="CBO" ${campaign.type === 'CBO' ? 'selected' : ''}>CBO</option>
                                </select>
                            </div>
                            <div class="form-group">
                                <label for="editCampaignObjective">Objetivo *</label>
                                <select id="editCampaignObjective" class="form-control" required>
                                    <option value="MENSAJES" ${campaign.objective === 'MENSAJES' ? 'selected' : ''}>Mensajes</option>
                                    <option value="COMPRAS" ${campaign.objective === 'COMPRAS' ? 'selected' : ''}>Compras</option>
                                </select>
                            </div>
                            <div class="form-group">
                                <label for="editCampaignDate">Fecha *</label>
                                <input type="date" id="editCampaignDate" class="form-control" value="${dateVal}" required>
                            </div>
                            <div class="form-group">
                                <label for="editCampaignProduct">Producto *</label>
                                <input type="text" id="editCampaignProduct" class="form-control" value="${campaign.product || ''}" placeholder="Nombre del producto" required>
                            </div>
                            <div class="form-group">
                                <label for="editCampaignAdSets">Conjuntos de Anuncios</label>
                                <input type="number" id="editCampaignAdSets" class="form-control" value="${campaign.adSets || 0}" min="0" max="100">
                            </div>
                            <div class="form-group">
                                <label for="editCampaignAds">Anuncios</label>
                                <input type="number" id="editCampaignAds" class="form-control" value="${campaign.ads || 0}" min="0" max="100">
                            </div>
                            <div class="form-group">
                                <label>Estado de Campaña</label>
                                <div style="padding-top: 0.5rem; display: flex; align-items: center;">
                                    <label class="switch">
                                        <input type="checkbox" id="editCampaignActive" ${isActive ? 'checked' : ''}>
                                        <span class="slider"></span>
                                        <span class="switch-label" style="margin-left: 6px; font-weight: 600;">Activa</span>
                                    </label>
                                </div>
                            </div>
                        </div>
                        <div style="margin-top: 1.5rem; display: flex; justify-content: flex-end; gap: 0.5rem;">
                            <button type="button" class="btn btn-secondary" onclick="CampaignsModule.closeModalId('modalEditCampaign')">Cancelar</button>
                            <button type="submit" class="btn btn-primary">Guardar Cambios</button>
                        </div>
                    </form>
                </div>
            </div>
        `;

        this.closeDetailsModal();
        modal.classList.add('active');
        document.body.style.overflow = 'hidden';
    },

    // Parse date format
    parseDateInputFormat(dateStr) {
        if (!dateStr) return '';
        if (dateStr.includes('-')) {
            const parts = dateStr.split('-');
            if (parts.length === 3) {
                if (parts[0].length === 4) return dateStr;
                const monthIndex = Object.values(this.monthNames).indexOf(parts[1]);
                if (monthIndex > -1) {
                    const day = parts[0].padStart(2, '0');
                    const month = String(monthIndex + 1).padStart(2, '0');
                    const year = parts[2];
                    return `${year}-${month}-${day}`;
                }
            }
        }
        return dateStr;
    },

    // Submit edit campaign form
    handleEditCampaignSubmit(e) {
        e.preventDefault();
        const id = document.getElementById('editCampaignId').value;
        const campaign = this.generatedCampaigns.find(c => String(c.id) === String(id));
        if (!campaign) {
            Utils.showNotification('Campaña no encontrada', 'error');
            return;
        }

        const country = document.getElementById('editCampaignCountry').value;
        const type = document.getElementById('editCampaignType').value;
        const objective = document.getElementById('editCampaignObjective').value;
        const dateStr = document.getElementById('editCampaignDate').value;
        const product = document.getElementById('editCampaignProduct').value.trim();
        const adSets = parseInt(document.getElementById('editCampaignAdSets').value) || 0;
        const ads = parseInt(document.getElementById('editCampaignAds').value) || 0;
        const activeCheck = document.getElementById('editCampaignActive');
        if (activeCheck) campaign.active = activeCheck.checked;

        const formattedDate = this.formatDate(dateStr);
        const formattedProduct = product.toUpperCase().replace(/\s+/g, '-');
        const campaignCode = campaign.code || this.generateCampaignCode();

        campaign.country = country;
        campaign.type = type;
        campaign.objective = objective;
        campaign.date = formattedDate;
        campaign.product = formattedProduct;
        campaign.name = `${country}-${type}-${objective}-${formattedDate}-${formattedProduct}-${campaignCode}`;

        if (campaign.adSets !== adSets) {
            campaign.adSets = adSets;
            campaign.adSetCodes = this.generateAdSetCodes(campaignCode, adSets);
        }
        if (campaign.ads !== ads) {
            campaign.ads = ads;
            campaign.adCodes = this.generateAdCodes(campaignCode, ads);
        }

        this.ensureAdDetails(campaign);
        this.saveCampaigns();

        if (window.Database && window.Database.saveCampaign) {
            try { window.Database.saveCampaign(campaign); } catch(e){}
        }

        this.closeModalId('modalEditCampaign');
        this.renderHistory();
        Utils.showNotification('¡Campaña actualizada con éxito!', 'success');
    },

    // Open modal to manage Ads, Post IDs and Purchases
    openAdDetailsModal(campaignId) {
        const campaign = this.generatedCampaigns.find(c => String(c.id) === String(campaignId));
        if (!campaign) {
            Utils.showNotification('Campaña no encontrada', 'error');
            return;
        }

        this.ensureAdDetails(campaign);
        this.currentEditingCampaignId = campaign.id;

        let modal = document.getElementById('modalEditAdDetails');
        if (!modal) {
            modal = document.createElement('div');
            modal.id = 'modalEditAdDetails';
            modal.className = 'modal modal-large';
            document.body.appendChild(modal);

            modal.addEventListener('click', (e) => {
                if (e.target === modal) this.closeModalId('modalEditAdDetails');
            });
        }

        const adRowsHtml = (!campaign.adDetails || campaign.adDetails.length === 0) ? `
            <tr>
                <td colspan="4" style="text-align: center; color: var(--text-muted); padding: 1.5rem;">
                    Esta campaña no tiene anuncios individuales asignados. Edita la campaña para aumentar el número de anuncios.
                </td>
            </tr>
        ` : campaign.adDetails.map(ad => `
            <tr>
                <td>
                    <span onclick="CampaignsModule.copyCode('${ad.code}')" 
                          style="font-family: monospace; padding: 0.35rem 0.6rem; background: rgba(139, 92, 246, 0.1); 
                                 color: #8b5cf6; border-radius: var(--radius-sm); font-weight: 700; cursor: pointer;"
                          title="Clic para copiar código">
                        ${ad.code}
                    </span>
                </td>
                <td>
                    <div style="display: flex; gap: 0.35rem; align-items: center;">
                        <input type="text" class="form-control form-control-sm ad-post-id-field" data-code="${ad.code}" 
                               value="${ad.postId || ''}" placeholder="Ej: 1202058493821034" style="font-family: monospace;">
                        ${ad.postId ? `
                            <button type="button" class="btn btn-icon btn-sm" onclick="CampaignsModule.copyCode('${ad.postId}')" title="Copiar Post ID">
                                📋
                            </button>
                        ` : ''}
                    </div>
                </td>
                <td>
                    <input type="number" class="form-control form-control-sm ad-purchases-field" data-code="${ad.code}" 
                           value="${ad.purchases || 0}" min="0" style="text-align: center; font-weight: 700; color: #10b981;">
                </td>
                <td>
                    <input type="number" class="form-control form-control-sm ad-spent-field" data-code="${ad.code}" 
                           value="${ad.spent || 0}" step="0.01" min="0" style="text-align: right; font-family: monospace;">
                </td>
            </tr>
        `).join('');

        modal.innerHTML = `
            <div class="modal-content" style="max-width: 800px;">
                <div class="modal-header">
                    <h2>📢 Anuncios, Post IDs y Compras</h2>
                    <button class="modal-close" onclick="CampaignsModule.closeModalId('modalEditAdDetails')">&times;</button>
                </div>
                <div class="modal-body" style="padding: 1rem 0;">
                    <div style="margin-bottom: 1rem; padding: 0.75rem; background: var(--surface-hover); border-radius: var(--radius-md);">
                        <div style="font-weight: 700; font-size: 1.1rem; color: var(--primary);">
                            Campaña: ${campaign.code || ''}
                        </div>
                        <div style="font-family: monospace; font-size: 0.85rem; color: var(--text-secondary); margin-top: 0.25rem; word-break: break-all;">
                            ${campaign.name || ''}
                        </div>
                    </div>
                    <div class="table-container" style="max-height: 400px; overflow-y: auto;">
                        <table class="table">
                            <thead>
                                <tr>
                                    <th>Código Anuncio</th>
                                    <th>Post ID / Identificador</th>
                                    <th style="width: 130px; text-align: center;">Compras</th>
                                    <th style="width: 140px; text-align: right;">Gasto (USD/COP)</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${adRowsHtml}
                            </tbody>
                        </table>
                    </div>
                </div>
                <div class="modal-footer" style="display: flex; justify-content: space-between; align-items: center; margin-top: 1rem;">
                    <span style="font-size: 0.8rem; color: var(--text-muted);">Los Post IDs y compras se guardarán en esta campaña.</span>
                    <div style="display: flex; gap: 0.5rem;">
                        <button type="button" class="btn btn-secondary" onclick="CampaignsModule.closeModalId('modalEditAdDetails')">Cancelar</button>
                        <button type="button" class="btn btn-success" onclick="CampaignsModule.saveAdDetailsFromModal()">Guardar Anuncios y Compras</button>
                    </div>
                </div>
            </div>
        `;

        this.closeDetailsModal();
        modal.classList.add('active');
        document.body.style.overflow = 'hidden';
    },

    // Save ad details from modal
    saveAdDetailsFromModal() {
        if (!this.currentEditingCampaignId) return;
        const campaign = this.generatedCampaigns.find(c => String(c.id) === String(this.currentEditingCampaignId));
        if (!campaign) return;

        this.ensureAdDetails(campaign);

        const postIdInputs = document.querySelectorAll('.ad-post-id-field');
        const purchasesInputs = document.querySelectorAll('.ad-purchases-field');
        const spentInputs = document.querySelectorAll('.ad-spent-field');

        let totalPurchases = 0;
        let totalSpent = 0;

        postIdInputs.forEach(input => {
            const code = input.dataset.code;
            const adObj = campaign.adDetails.find(a => a.code === code);
            if (adObj) adObj.postId = input.value.trim();
        });

        purchasesInputs.forEach(input => {
            const code = input.dataset.code;
            const adObj = campaign.adDetails.find(a => a.code === code);
            const val = parseInt(input.value) || 0;
            if (adObj) adObj.purchases = val;
            totalPurchases += val;
        });

        spentInputs.forEach(input => {
            const code = input.dataset.code;
            const adObj = campaign.adDetails.find(a => a.code === code);
            const val = parseFloat(input.value) || 0;
            if (adObj) adObj.spent = val;
            totalSpent += val;
        });

        this.saveCampaigns();
        if (window.Database && window.Database.saveCampaign) {
            try { window.Database.saveCampaign(campaign); } catch(e){}
        }

        this.closeModalId('modalEditAdDetails');
        this.renderHistory();
        Utils.showNotification('¡Post IDs y compras guardados exitosamente!', 'success');
    },

    // ============================================
    // REPORT UPLOAD & ADS PARSING (WITH AD IDS)
    // ============================================

    // Handle report file upload
    handleReportUpload(input) {
        const file = input.files[0];
        if (!file) return;

        const statusEl = document.getElementById('reportUploadStatus');
        if (statusEl) {
            statusEl.style.display = 'block';
            statusEl.innerHTML = `
                <div style="display: flex; align-items: center; gap: 0.5rem; padding: 1rem; background: var(--primary-light); border-radius: var(--radius-md);">
                    <div class="spinner-small"></div>
                    <span>Procesando archivo Excel: <strong>${file.name}</strong></span>
                </div>
            `;
        }

        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                if (typeof XLSX === 'undefined') {
                    throw new Error('La librería XLSX no está cargada en la página.');
                }

                const data = new Uint8Array(e.target.result);
                const workbook = XLSX.read(data, { type: 'array' });
                const sheetName = workbook.SheetNames[0];
                const sheet = workbook.Sheets[sheetName];
                const jsonData = XLSX.utils.sheet_to_json(sheet, { header: 1 });

                if (jsonData.length < 2) {
                    throw new Error('El archivo no contiene datos suficientes');
                }

                this.processReportData(jsonData, file.name);
            } catch (error) {
                console.error('Error processing Excel file:', error);
                if (statusEl) {
                    statusEl.innerHTML = `
                        <div style="display: flex; align-items: center; gap: 0.5rem; padding: 1rem; background: rgba(239, 68, 68, 0.1); border-radius: var(--radius-md); color: #ef4444;">
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <circle cx="12" cy="12" r="10"></circle>
                                <line x1="15" y1="9" x2="9" y2="15"></line>
                                <line x1="9" y1="9" x2="15" y2="15"></line>
                            </svg>
                            <span>Error al procesar archivo: ${error.message}</span>
                        </div>
                    `;
                }
            }
        };

        reader.readAsArrayBuffer(file);
        input.value = '';
    },

    // Identify columns with Meta Ads column name matching
    identifyColumns(headers) {
        const map = {
            adId: null,
            adName: null,
            adSetName: null,
            campaignName: null,
            spent: null,
            impressions: null,
            reach: null,
            conversations: null,
            currency: null,
            startDate: null,
            endDate: null
        };

        headers.forEach((header, index) => {
            if (header === null || header === undefined) return;
            const h = header.toString().toLowerCase().trim();

            // 1. Identificador del anuncio (Meta Ad ID)
            if (map.adId === null) {
                if (h.includes('identificador del anuncio') || h.includes('identificador de anuncio') || 
                    h.includes('id del anuncio') || h.includes('id de anuncio') || 
                    h === 'ad id' || h === 'ad_id' || h === 'identificador' || h === 'ad identifier') {
                    map.adId = index;
                }
            }

            // 2. Nombre del anuncio
            if (map.adName === null) {
                if ((h.includes('nombre') && (h.includes('anuncio') || h.includes('ad'))) && !h.includes('conjunto')) {
                    map.adName = index;
                } else if (h === 'ad name' || h === 'nombre del anuncio') {
                    map.adName = index;
                }
            }

            // 3. Nombre del conjunto de anuncios
            if (map.adSetName === null) {
                if (h.includes('conjunto') || h.includes('ad set') || h.includes('adset')) {
                    map.adSetName = index;
                }
            }

            // 4. Nombre de la campaña
            if (map.campaignName === null) {
                if ((h.includes('campaña') || h.includes('campana') || h.includes('campaign')) && !h.includes('conjunto') && !h.includes('anuncio')) {
                    map.campaignName = index;
                }
            }

            // 5. Gasto
            if (map.spent === null) {
                if (h.includes('importe gastado') || h.includes('amount spent') || h.includes('spent') ||
                    h.includes('gastado') || h.includes('gasto') || h.includes('monto')) {
                    map.spent = index;
                }
            }

            // 6. Impresiones
            if (map.impressions === null) {
                if (h.includes('impresiones') || h.includes('impressions')) {
                    map.impressions = index;
                }
            }

            // 7. Alcance
            if (map.reach === null) {
                if (h.includes('alcance') || h.includes('reach')) {
                    map.reach = index;
                }
            }

            // 8. Conversaciones / Compras / Resultados
            if (map.conversations === null) {
                if (h.includes('conversaciones') || h.includes('mensajes') || h.includes('compras') || 
                    h.includes('purchases') || h.includes('resultados') || h.includes('results') || h.includes('conversiones')) {
                    map.conversations = index;
                }
            }

            // 9. Divisa
            if (map.currency === null) {
                if (h.includes('divisa') || h.includes('currency') || h.includes('moneda')) {
                    map.currency = index;
                }
            }

            // 10. Fechas
            if (map.startDate === null && (h.includes('inicio') || h.includes('start'))) {
                map.startDate = index;
            }
            if (map.endDate === null && (h.includes('fin') || h.includes('end'))) {
                map.endDate = index;
            }
        });

        // Fallbacks
        if (map.campaignName === null && headers.length > 0) map.campaignName = 0;
        if (map.adName === null && headers.length > 2) map.adName = 2;

        return map;
    },

    // Process report data from Excel
    processReportData(jsonData, fileName) {
        const headers = jsonData[0];
        const rows = jsonData.slice(1).filter(row => row && row.length > 0);

        const columnMap = this.identifyColumns(headers);

        const parsedAds = [];
        const campaignsMap = new Map();

        rows.forEach((row, rowIndex) => {
            const rawCampaignName = (row[columnMap.campaignName] || '').toString().trim();
            const rawAdName = (columnMap.adName !== null ? (row[columnMap.adName] || '') : '').toString().trim();
            const rawAdSet = (columnMap.adSetName !== null ? (row[columnMap.adSetName] || '') : '').toString().trim();
            const rawAdId = (columnMap.adId !== null ? (row[columnMap.adId] || '') : '').toString().trim();

            // Skip total or summary row (empty campaign name or marked as Total)
            if (!rawCampaignName && !rawAdName && !rawAdId) return;
            if (rawCampaignName.toLowerCase().includes('total') || rawCampaignName.toLowerCase() === 'resultados') return;

            const spent = this.parseNumber(row[columnMap.spent]);
            const impressions = this.parseNumber(row[columnMap.impressions]);
            const reach = this.parseNumber(row[columnMap.reach]);
            const conversations = this.parseNumber(row[columnMap.conversations]);
            const currency = (columnMap.currency !== null && row[columnMap.currency]) ? row[columnMap.currency].toString().trim() : 'COP';
            const startDate = columnMap.startDate !== null ? (row[columnMap.startDate] || '') : '';
            const endDate = columnMap.endDate !== null ? (row[columnMap.endDate] || '') : '';

            // Extract campaign code from name
            const code = this.extractCampaignCode(rawCampaignName) || this.extractCampaignCode(rawAdName) || '';

            // Guess product and country
            let country = '';
            let product = '';
            if (rawCampaignName.includes('-')) {
                const parts = rawCampaignName.split('-');
                if (parts[0] && ['ECU', 'VEN', 'COL'].includes(parts[0].toUpperCase())) {
                    country = parts[0].toUpperCase();
                }
                if (parts.length >= 6) {
                    product = parts.slice(4, parts.length - 1).join('-');
                }
            }

            const adEntry = {
                id: rawAdId ? `ad_${rawAdId}` : `ad_${Date.now()}_${rowIndex}`,
                adId: rawAdId || (rawAdName ? `ad_${rawAdName}` : `ad_${Date.now()}_${rowIndex}`),
                adName: rawAdName || rawCampaignName,
                adSetName: rawAdSet,
                campaignName: rawCampaignName,
                campaignCode: code,
                country: country,
                product: product,
                spent: spent,
                impressions: impressions,
                reach: reach,
                conversations: conversations,
                currency: currency,
                startDate: startDate,
                endDate: endDate,
                matched: false
            };

            // Check match with existing campaigns
            if (code) {
                const matchedCampaign = this.generatedCampaigns.find(c => c.code === code);
                adEntry.matched = !!matchedCampaign;
                if (matchedCampaign) {
                    adEntry.campaignId = matchedCampaign.id;
                    if (!adEntry.product && matchedCampaign.product) adEntry.product = matchedCampaign.product;
                    if (!adEntry.country && matchedCampaign.country) adEntry.country = matchedCampaign.country;
                }
            }

            parsedAds.push(adEntry);

            // Consolidate Campaign metrics
            const campKey = code || rawCampaignName;
            if (!campaignsMap.has(campKey)) {
                campaignsMap.set(campKey, {
                    code: code,
                    originalName: rawCampaignName,
                    spent: 0,
                    purchases: 0,
                    impressions: 0,
                    reach: 0,
                    startDate: startDate,
                    endDate: endDate,
                    matched: adEntry.matched
                });
            }
            const cMetric = campaignsMap.get(campKey);
            cMetric.spent += spent;
            cMetric.purchases += conversations;
            cMetric.impressions += impressions;
            cMetric.reach += reach;
        });

        const consolidatedCampaigns = Array.from(campaignsMap.values()).map(c => ({
            ...c,
            costPerPurchase: c.purchases > 0 ? (c.spent / c.purchases) : 0,
            cpc: c.reach > 0 ? (c.spent / c.reach) : 0,
            cpm: c.impressions > 0 ? ((c.spent / c.impressions) * 1000) : 0
        }));

        this.pendingReportData = {
            ads: parsedAds,
            campaigns: consolidatedCampaigns,
            fileName: fileName
        };

        this.showReportPreview(this.pendingReportData);
    },

    // Show preview modal/box
    showReportPreview(pendingData) {
        const statusEl = document.getElementById('reportUploadStatus');
        const previewEl = document.getElementById('reportPreview');
        const headEl = document.getElementById('reportPreviewHead');
        const bodyEl = document.getElementById('reportPreviewBody');

        if (!previewEl || !headEl || !bodyEl) return;

        const ads = pendingData.ads || [];
        const totalSpent = ads.reduce((acc, a) => acc + (a.spent || 0), 0);
        const totalMsg = ads.reduce((acc, a) => acc + (a.conversations || 0), 0);

        if (statusEl) {
            statusEl.innerHTML = `
                <div style="display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 1rem; padding: 1rem; background: rgba(16, 185, 129, 0.1); border-radius: var(--radius-md); color: #10b981; border: 1px solid rgba(16, 185, 129, 0.25);">
                    <div style="display: flex; align-items: center; gap: 0.5rem;">
                        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
                            <polyline points="22 4 12 14.01 9 11.01"></polyline>
                        </svg>
                        <span>Se detectaron <strong>${ads.length} anuncios</strong> con sus identificadores de Meta.</span>
                    </div>
                    <div style="font-size: 0.9rem; font-weight: 700; font-family: monospace;">
                        Gasto Total: $${this.formatCurrency(totalSpent)} | Mensajes/Resultados: ${totalMsg}
                    </div>
                </div>
            `;
            statusEl.style.display = 'block';
        }

        headEl.innerHTML = `
            <tr>
                <th style="width: 140px;">ID del Anuncio</th>
                <th>Nombre Anuncio</th>
                <th>Conjunto</th>
                <th>Campaña</th>
                <th style="text-align: right;">Gasto (COP)</th>
                <th style="text-align: center;">Mensajes/Resultados</th>
                <th>Fechas</th>
            </tr>
        `;

        bodyEl.innerHTML = ads.map(ad => `
            <tr>
                <td>
                    <span class="ad-id-badge" onclick="CampaignsModule.copyCode('${ad.adId}')" title="Clic para copiar ID">
                        🆔 ${ad.adId || 'Sin ID'}
                    </span>
                </td>
                <td style="font-weight: 600; font-size: 0.85rem; max-width: 150px; overflow: hidden; text-overflow: ellipsis;" title="${ad.adName}">
                    ${ad.adName}
                </td>
                <td style="font-size: 0.8rem; color: var(--text-muted);">${ad.adSetName || '-'}</td>
                <td style="font-size: 0.8rem; max-width: 180px; overflow: hidden; text-overflow: ellipsis;" title="${ad.campaignName}">
                    ${ad.campaignCode ? `<span style="background: var(--primary-light); color: var(--primary); padding: 2px 6px; border-radius: 4px; font-weight: 700; font-family: monospace; margin-right: 4px;">${ad.campaignCode}</span>` : ''}
                    ${ad.campaignName}
                </td>
                <td style="text-align: right; font-family: monospace; font-weight: 700; color: #f43f5e;">
                    $${this.formatCurrency(ad.spent)}
                </td>
                <td style="text-align: center; font-weight: 700; color: #10b981;">
                    ${ad.conversations || '-'}
                </td>
                <td style="font-size: 0.75rem; color: var(--text-muted);">
                    ${ad.startDate || ''} - ${ad.endDate || ''}
                </td>
            </tr>
        `).join('');

        previewEl.style.display = 'block';
    },

    // Confirm report upload and save to DB
    async confirmReportUpload() {
        if (!this.pendingReportData || !this.pendingReportData.ads || this.pendingReportData.ads.length === 0) {
            Utils.showNotification('No hay datos para procesar', 'error');
            return;
        }

        const newAds = this.pendingReportData.ads;
        const newCampaigns = this.pendingReportData.campaigns;

        // 1. Merge Ads into this.campaignAds
        const adsMap = new Map(this.campaignAds.map(a => [String(a.adId || a.id), a]));
        newAds.forEach(ad => {
            const key = String(ad.adId || ad.id);
            adsMap.set(key, ad);
        });
        this.campaignAds = Array.from(adsMap.values());

        // 2. Merge Campaign Performance
        const perfMap = new Map(this.performanceData.map(p => [p.code || p.originalName, p]));
        newCampaigns.forEach(c => {
            const key = c.code || c.originalName;
            perfMap.set(key, c);
        });
        this.performanceData = Array.from(perfMap.values());

        // 3. Auto-create campaigns in generatedCampaigns if not already existing
        newCampaigns.forEach(c => {
            if (c.code && !this.generatedCampaigns.some(g => g.code === c.code)) {
                this.generatedCampaigns.push({
                    id: Date.now() + Math.floor(Math.random() * 1000),
                    name: c.originalName,
                    code: c.code,
                    country: c.originalName.startsWith('VEN') ? 'VEN' : (c.originalName.startsWith('ECU') ? 'ECU' : 'COL'),
                    type: c.originalName.includes('CBO') ? 'CBO' : 'ABO',
                    objective: c.originalName.includes('COMPRAS') ? 'COMPRAS' : 'MENSAJES',
                    date: c.startDate || new Date().toISOString().split('T')[0],
                    product: c.originalName,
                    adSets: 0,
                    ads: 0,
                    createdAt: new Date().toISOString()
                });
            }
        });

        // 4. Save to Database & localStorage
        this.saveCampaigns();
        this.savePerformanceData();

        if (window.Database) {
            if (window.Database.saveCampaignAds) {
                try { await window.Database.saveCampaignAds(this.campaignAds); } catch(e){}
            }
            if (window.Database.saveCampaign) {
                this.generatedCampaigns.forEach(c => {
                    try { window.Database.saveCampaign(c); } catch(e){}
                });
            }
        }
        localStorage.setItem('campaignAdsData', JSON.stringify(this.campaignAds));

        // 5. Clean up preview & recalculate
        this.cancelReportUpload();
        this.calculateAdMetrics();
        this.renderAll();

        Utils.showNotification(`¡${newAds.length} anuncio(s) importados con éxito con sus IDs y métricas!`, 'success');
    },

    // Cancel report upload
    cancelReportUpload() {
        this.pendingReportData = null;
        const statusEl = document.getElementById('reportUploadStatus');
        const previewEl = document.getElementById('reportPreview');
        if (statusEl) statusEl.style.display = 'none';
        if (previewEl) previewEl.style.display = 'none';
    },

    // Load performance data
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

    // Save performance data
    savePerformanceData() {
        localStorage.setItem('campaignPerformanceData', JSON.stringify(this.performanceData));
    },

    // Extract campaign code from name
    extractCampaignCode(campaignName) {
        if (!campaignName) return null;
        const name = campaignName.toString().trim();

        // 1. Look at the end of the name for 2 letters + 2 numbers (e.g., HN20)
        const codePattern = /([A-Z]{2}\d{2})$/i;
        const match = name.match(codePattern);
        if (match) return match[1].toUpperCase();

        // 2. Look anywhere for code
        const anywherePattern = /\b([A-Z]{2}\d{2})\b/gi;
        const matches = [...name.matchAll(anywherePattern)];
        if (matches.length > 0) return matches[matches.length - 1][1].toUpperCase();

        // 3. Fallback: last 4 chars
        const lastFour = name.slice(-4);
        if (/^[A-Z]{2}\d{2}$/i.test(lastFour)) return lastFour.toUpperCase();

        return null;
    },

    // Parse numeric values safely
    parseNumber(value) {
        if (value === null || value === undefined || value === '') return 0;
        if (typeof value === 'number') return value;

        let str = value.toString().replace(/[^\d.,\-]/g, '').trim();
        if (str.includes(',') && str.includes('.')) {
            if (str.lastIndexOf(',') > str.lastIndexOf('.')) {
                str = str.replace(/\./g, '').replace(',', '.');
            } else {
                str = str.replace(/,/g, '');
            }
        } else if (str.includes(',')) {
            const parts = str.split(',');
            if (parts.length === 2 && parts[1].length <= 2) {
                str = str.replace(',', '.');
            } else {
                str = str.replace(/,/g, '');
            }
        }

        const num = parseFloat(str);
        return isNaN(num) ? 0 : num;
    },

    // Format currency string
    formatCurrency(value) {
        if (!value && value !== 0) return '0';
        return new Intl.NumberFormat('es-CO', {
            minimumFractionDigits: 0,
            maximumFractionDigits: 2
        }).format(value);
    },

    // ============================================
    // ADS PERFORMANCE TABLE & METRICS CALCULATION
    // ============================================

    // Calculate ROAS, CPA, and sales counts per Ad
    calculateAdMetrics() {
        this.campaignAds.forEach(ad => {
            const adSales = this.campaignSales.filter(s => String(s.adId) === String(ad.adId) || (ad.adName && s.adName === ad.adName));
            const salesCount = adSales.reduce((acc, s) => acc + (Number(s.quantity) || 1), 0);
            const salesRevenue = adSales.reduce((acc, s) => acc + ((Number(s.price) || 0) * (Number(s.quantity) || 1)), 0);

            ad.salesCount = salesCount;
            ad.salesRevenue = salesRevenue;
            ad.roas = (ad.spent > 0) ? (salesRevenue / ad.spent) : (salesRevenue > 0 ? 99 : 0);
            ad.cpa = (salesCount > 0) ? (ad.spent / salesCount) : (ad.spent > 0 ? ad.spent : 0);
            ad.profit = salesRevenue - ad.spent;
        });
    },

    // Render Ads Performance Table
    renderAdsTable(filterQuery = '') {
        const tbody = document.getElementById('adsPerformanceTableBody');
        if (!tbody) return;

        this.calculateAdMetrics();

        let ads = [...this.campaignAds];
        if (filterQuery) {
            const q = filterQuery.toLowerCase().trim();
            ads = ads.filter(a =>
                (a.adId && a.adId.toLowerCase().includes(q)) ||
                (a.adName && a.adName.toLowerCase().includes(q)) ||
                (a.campaignName && a.campaignName.toLowerCase().includes(q)) ||
                (a.campaignCode && a.campaignCode.toLowerCase().includes(q)) ||
                (a.product && a.product.toLowerCase().includes(q))
            );
        }

        if (ads.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="10" style="text-align: center; color: var(--text-muted); padding: 2.5rem;">
                        ${filterQuery ? 'No se encontraron anuncios que coincidan con la búsqueda.' : 'No hay anuncios importados aún. Sube un archivo Excel para ver el desglose por ID de anuncio.'}
                    </td>
                </tr>
            `;
            return;
        }

        tbody.innerHTML = ads.map(ad => {
            const roasColor = ad.roas >= 2.0 ? '#10b981' : (ad.roas >= 1.0 ? '#f59e0b' : (ad.salesRevenue > 0 ? '#f43f5e' : 'var(--text-muted)'));
            const roasDisplay = ad.roas > 0 ? `${ad.roas.toFixed(2)}x` : '-';
            const cpaDisplay = ad.salesCount > 0 ? `$${this.formatCurrency(ad.cpa)}` : '-';

            return `
                <tr>
                    <td>
                        <span class="ad-id-badge" onclick="CampaignsModule.copyCode('${ad.adId}')" title="Clic para copiar ID">
                            🆔 ${ad.adId || 'Sin ID'}
                        </span>
                    </td>
                    <td style="font-weight: 600; font-size: 0.85rem; max-width: 140px; overflow: hidden; text-overflow: ellipsis;" title="${ad.adName}">
                        ${ad.adName}
                    </td>
                    <td style="font-size: 0.8rem; max-width: 180px; overflow: hidden; text-overflow: ellipsis;" title="${ad.campaignName}">
                        ${ad.campaignCode ? `<span style="background: linear-gradient(135deg, var(--primary), #8b5cf6); color: white; padding: 2px 6px; border-radius: 4px; font-weight: 700; font-family: monospace; font-size: 0.75rem; margin-right: 4px;">${ad.campaignCode}</span>` : ''}
                        ${ad.campaignName}
                    </td>
                    <td style="text-align: right; font-family: monospace; font-weight: 700; color: #f43f5e;">
                        $${this.formatCurrency(ad.spent)}
                    </td>
                    <td style="text-align: center; font-weight: 600; color: var(--text-secondary);">
                        ${ad.conversations || '-'}
                    </td>
                    <td style="text-align: center; font-weight: 700; color: ${ad.salesCount > 0 ? '#10b981' : 'var(--text-muted)'};">
                        ${ad.salesCount > 0 ? `🛒 ${ad.salesCount} uds` : '-'}
                    </td>
                    <td style="text-align: right; font-family: monospace; font-weight: 700; color: ${ad.salesRevenue > 0 ? '#10b981' : 'var(--text-muted)'};">
                        ${ad.salesRevenue > 0 ? '$' + this.formatCurrency(ad.salesRevenue) : '-'}
                    </td>
                    <td style="text-align: center; font-weight: 700; color: ${roasColor}; font-family: monospace;">
                        ${roasDisplay}
                    </td>
                    <td style="text-align: right; font-family: monospace; font-size: 0.85rem; color: var(--text-secondary);">
                        ${cpaDisplay}
                    </td>
                    <td>
                        <button type="button" class="btn btn-primary btn-sm" onclick="CampaignsModule.openQuickSaleModal('${ad.adId}')" style="display: flex; align-items: center; gap: 4px; font-size: 0.75rem; padding: 4px 8px;" title="Registrar venta para este anuncio">
                            <span>⚡</span> Venta
                        </button>
                    </td>
                </tr>
            `;
        }).join('');
    },

    // Render consolidated campaign performance table
    renderPerformanceTable() {
        const tbody = document.getElementById('campaignPerformanceTable');
        if (!tbody) return;

        if (this.performanceData.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="9" style="text-align: center; color: var(--text-muted); padding: 2rem;">
                        No hay datos de rendimiento. Sube un reporte para ver el rendimiento.
                    </td>
                </tr>
            `;
            return;
        }

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
                    <td>
                        <button class="btn btn-icon btn-sm" onclick="CampaignsModule.editPerformanceItem('${item.code}')" title="Editar compras / rendimiento">
                            ✏️
                        </button>
                    </td>
                </tr>
            `;
        }).join('') + `
            <tr style="background: var(--surface-hover); font-weight: 700;">
                <td colspan="2" style="text-align: right;">TOTALES:</td>
                <td style="text-align: right; font-family: monospace; color: var(--primary);">$${this.formatCurrency(totals.spent)}</td>
                <td style="text-align: center; color: #10b981;">${totals.purchases}</td>
                <td colspan="5"></td>
            </tr>
        `;
    },

    // ============================================
    // QUICK SALES REGISTRATION SYSTEM
    // ============================================

    // Search ads for autocomplete in Quick Sale
    searchAdsForQuickSale(query) {
        const dropdown = document.getElementById('quickSaleAdSuggestions');
        if (!dropdown) return;

        if (!query || query.length === 0) {
            dropdown.style.display = 'none';
            return;
        }

        const q = query.toLowerCase().trim();
        const matches = this.campaignAds.filter(a =>
            (a.adId && a.adId.toLowerCase().includes(q)) ||
            (a.adName && a.adName.toLowerCase().includes(q)) ||
            (a.campaignName && a.campaignName.toLowerCase().includes(q)) ||
            (a.campaignCode && a.campaignCode.toLowerCase().includes(q)) ||
            (a.product && a.product.toLowerCase().includes(q))
        ).slice(0, 8);

        if (matches.length === 0) {
            dropdown.innerHTML = '<div style="padding: 0.75rem; color: var(--text-muted); font-size: 0.85rem;">No se encontraron anuncios para "' + query + '"</div>';
            dropdown.style.display = 'block';
            return;
        }

        dropdown.innerHTML = matches.map(ad => `
            <div class="ad-search-item" onclick="CampaignsModule.selectAdForQuickSale('${ad.adId}')">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 2px;">
                    <span style="font-family: monospace; font-weight: 700; color: #8b5cf6;">🆔 ${ad.adId}</span>
                    <span style="font-size: 0.75rem; color: #f43f5e; font-family: monospace;">Gasto: $${this.formatCurrency(ad.spent)}</span>
                </div>
                <div style="font-size: 0.85rem; font-weight: 600; color: var(--text-primary);">${ad.adName}</div>
                <div style="font-size: 0.75rem; color: var(--text-muted); overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
                    ${ad.campaignCode ? `[${ad.campaignCode}] ` : ''}${ad.campaignName}
                </div>
            </div>
        `).join('');

        dropdown.style.display = 'block';
    },

    // Select an ad from autocomplete
    selectAdForQuickSale(adId) {
        const ad = this.campaignAds.find(a => String(a.adId) === String(adId));
        const inputAdId = document.getElementById('quickSaleAdId');
        const infoBox = document.getElementById('quickSaleSelectedAdInfo');
        const dropdown = document.getElementById('quickSaleAdSuggestions');

        if (inputAdId) inputAdId.value = adId;
        if (dropdown) dropdown.style.display = 'none';

        if (infoBox && ad) {
            infoBox.innerHTML = `
                <div style="display: flex; justify-content: space-between; align-items: center;">
                    <div>
                        <div style="font-weight: 700; color: var(--primary); font-size: 0.95rem;">
                            📢 ${ad.adName} ${ad.campaignCode ? `(${ad.campaignCode})` : ''}
                        </div>
                        <div style="font-size: 0.8rem; color: var(--text-secondary); margin-top: 2px;">
                            Campaña: ${ad.campaignName}
                        </div>
                    </div>
                    <div style="text-align: right;">
                        <span style="font-size: 0.75rem; color: var(--text-muted); display: block;">Gasto Publicitario</span>
                        <span style="font-weight: 700; color: #f43f5e; font-family: monospace;">$${this.formatCurrency(ad.spent)}</span>
                    </div>
                </div>
            `;
            infoBox.style.display = 'block';
        }
    },

    // Open Quick Sale Modal directly from any table row
    openQuickSaleModal(prefillAdId = '') {
        const ad = this.campaignAds.find(a => String(a.adId) === String(prefillAdId));

        let modal = document.getElementById('modalQuickSale');
        if (!modal) {
            modal = document.createElement('div');
            modal.id = 'modalQuickSale';
            modal.className = 'modal';
            document.body.appendChild(modal);

            modal.addEventListener('click', (e) => {
                if (e.target === modal) this.closeModalId('modalQuickSale');
            });
        }

        const today = new Date().toISOString().split('T')[0];

        modal.innerHTML = `
            <div class="modal-content" style="max-width: 550px;">
                <div class="modal-header">
                    <h2>⚡ Registro Rápido de Venta</h2>
                    <button class="modal-close" onclick="CampaignsModule.closeModalId('modalQuickSale')">&times;</button>
                </div>
                <div class="modal-body" style="padding: 1.5rem 0;">
                    <form id="modalQuickSaleForm" onsubmit="CampaignsModule.handleModalQuickSaleSubmit(event)">
                        ${ad ? `
                            <div class="selected-ad-info-box" style="margin-bottom: 1.25rem;">
                                <div style="display: flex; justify-content: space-between; align-items: center;">
                                    <div>
                                        <span class="ad-id-badge">🆔 ${ad.adId}</span>
                                        <div style="font-weight: 700; color: var(--text-primary); margin-top: 4px;">${ad.adName}</div>
                                        <div style="font-size: 0.75rem; color: var(--text-muted);">${ad.campaignName}</div>
                                    </div>
                                    <div style="text-align: right;">
                                        <div style="font-size: 0.75rem; color: var(--text-muted);">Gasto Anuncio</div>
                                        <div style="font-family: monospace; font-weight: 700; color: #f43f5e;">$${this.formatCurrency(ad.spent)}</div>
                                    </div>
                                </div>
                            </div>
                        ` : ''}

                        <div class="form-group" style="margin-bottom: 1rem;">
                            <label for="modalSaleAdId">ID del Anuncio *</label>
                            <input type="text" id="modalSaleAdId" class="form-control" value="${prefillAdId}" placeholder="Pega el ID del Anuncio..." required style="font-family: monospace; font-weight: 600;">
                        </div>

                        <div style="display: grid; grid-template-columns: 2fr 1fr; gap: 1rem; margin-bottom: 1rem;">
                            <div class="form-group">
                                <label for="modalSalePrice">Precio de Venta ($) *</label>
                                <input type="number" id="modalSalePrice" class="form-control" placeholder="Ej: 150000" required step="any" min="1" autofocus style="font-size: 1.1rem; font-weight: 700; font-family: monospace;">
                            </div>
                            <div class="form-group">
                                <label for="modalSaleQuantity">Cantidad</label>
                                <input type="number" id="modalSaleQuantity" class="form-control" value="1" min="1" required style="font-weight: 700; text-align: center;">
                            </div>
                        </div>

                        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin-bottom: 1rem;">
                            <div class="form-group">
                                <label for="modalSaleOrderNumber">N° Guía / Pedido (Opcional)</label>
                                <input type="text" id="modalSaleOrderNumber" class="form-control" placeholder="Ej: GUIA-98231">
                            </div>
                            <div class="form-group">
                                <label for="modalSaleCustomer">Nombre Cliente (Opcional)</label>
                                <input type="text" id="modalSaleCustomer" class="form-control" placeholder="Nombre del cliente">
                            </div>
                        </div>

                        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin-bottom: 1.5rem;">
                            <div class="form-group">
                                <label for="modalSaleCity">Ciudad / País</label>
                                <input type="text" id="modalSaleCity" class="form-control" placeholder="Ej: Bogotá / Caracas">
                            </div>
                            <div class="form-group">
                                <label for="modalSaleDate">Fecha de Venta *</label>
                                <input type="date" id="modalSaleDate" class="form-control" value="${today}" required>
                            </div>
                        </div>

                        <div style="display: flex; justify-content: flex-end; gap: 0.5rem;">
                            <button type="button" class="btn btn-secondary" onclick="CampaignsModule.closeModalId('modalQuickSale')">Cancelar</button>
                            <button type="submit" class="btn btn-success" style="font-weight: 700; padding: 0.6rem 1.5rem;">
                                💾 Registrar Venta
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        `;

        modal.classList.add('active');
        document.body.style.overflow = 'hidden';

        setTimeout(() => {
            const priceInput = document.getElementById('modalSalePrice');
            if (priceInput) priceInput.focus();
        }, 150);
    },

    // Handle modal quick sale submit
    async handleModalQuickSaleSubmit(e) {
        e.preventDefault();
        const adId = document.getElementById('modalSaleAdId').value.trim();
        const price = parseFloat(document.getElementById('modalSalePrice').value) || 0;
        const quantity = parseInt(document.getElementById('modalSaleQuantity').value) || 1;
        const orderNumber = document.getElementById('modalSaleOrderNumber').value.trim();
        const customerName = document.getElementById('modalSaleCustomer').value.trim();
        const city = document.getElementById('modalSaleCity').value.trim();
        const date = document.getElementById('modalSaleDate').value;

        if (!adId || price <= 0) {
            Utils.showNotification('Por favor ingresa un ID de anuncio y un precio válido', 'error');
            return;
        }

        await this.saveNewSaleRecord({
            adId,
            price,
            quantity,
            orderNumber,
            customerName,
            city,
            date
        });

        this.closeModalId('modalQuickSale');
    },

    // Register sale from the main quick sales tab form
    async registerQuickSale() {
        const adIdInput = document.getElementById('quickSaleAdId');
        const priceInput = document.getElementById('quickSalePrice');
        const qtyInput = document.getElementById('quickSaleQuantity');
        const orderInput = document.getElementById('quickSaleOrderNumber');
        const customerInput = document.getElementById('quickSaleCustomerName');
        const cityInput = document.getElementById('quickSaleCity');
        const dateInput = document.getElementById('quickSaleDate');
        const notesInput = document.getElementById('quickSaleNotes');

        const adId = adIdInput ? adIdInput.value.trim() : '';
        const price = priceInput ? (parseFloat(priceInput.value) || 0) : 0;
        const quantity = qtyInput ? (parseInt(qtyInput.value) || 1) : 1;
        const orderNumber = orderInput ? orderInput.value.trim() : '';
        const customerName = customerInput ? customerInput.value.trim() : '';
        const city = cityInput ? cityInput.value.trim() : '';
        const date = dateInput ? dateInput.value : new Date().toISOString().split('T')[0];
        const notes = notesInput ? notesInput.value.trim() : '';

        if (!adId || price <= 0) {
            Utils.showNotification('Por favor ingrese el ID del Anuncio y el Precio de la Venta', 'error');
            return;
        }

        await this.saveNewSaleRecord({
            adId,
            price,
            quantity,
            orderNumber,
            customerName,
            city,
            date,
            notes
        });

        // Reset form
        if (priceInput) priceInput.value = '';
        if (orderInput) orderInput.value = '';
        if (customerInput) customerInput.value = '';
        if (notesInput) notesInput.value = '';
        if (qtyInput) qtyInput.value = '1';
    },

    // Core helper to persist new sale record
    async saveNewSaleRecord(saleData) {
        const matchedAd = this.campaignAds.find(a => String(a.adId) === String(saleData.adId));

        const saleRecord = {
            id: `sale_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
            adId: saleData.adId,
            adName: matchedAd ? matchedAd.adName : (saleData.adName || 'Anuncio ' + saleData.adId),
            campaignCode: matchedAd ? matchedAd.campaignCode : '',
            campaignName: matchedAd ? matchedAd.campaignName : '',
            product: matchedAd ? matchedAd.product : '',
            price: Number(saleData.price) || 0,
            quantity: Number(saleData.quantity) || 1,
            orderNumber: saleData.orderNumber || '',
            customerName: saleData.customerName || '',
            city: saleData.city || (matchedAd ? matchedAd.country : ''),
            date: saleData.date || new Date().toISOString().split('T')[0],
            notes: saleData.notes || '',
            createdAt: new Date().toISOString()
        };

        this.campaignSales.unshift(saleRecord);

        // Save to Database and localStorage
        if (window.Database && window.Database.saveCampaignSale) {
            try { await window.Database.saveCampaignSale(saleRecord); } catch(e){}
        }
        localStorage.setItem('campaignSalesData', JSON.stringify(this.campaignSales));

        this.calculateAdMetrics();
        this.renderAll();

        const totalRevenue = saleRecord.price * saleRecord.quantity;
        Utils.showNotification(`✅ ¡Venta de $${this.formatCurrency(totalRevenue)} registrada para el anuncio ${saleRecord.adId}!`, 'success');
    },

    // Delete a sale record
    async deleteSale(saleId) {
        if (!confirm('¿Está seguro de eliminar este registro de venta?')) return;

        const index = this.campaignSales.findIndex(s => String(s.id) === String(saleId));
        if (index > -1) {
            this.campaignSales.splice(index, 1);

            if (window.Database && window.Database.deleteCampaignSale) {
                try { await window.Database.deleteCampaignSale(saleId); } catch(e){}
            }
            localStorage.setItem('campaignSalesData', JSON.stringify(this.campaignSales));

            this.calculateAdMetrics();
            this.renderAll();
            Utils.showNotification('Registro de venta eliminado', 'info');
        }
    },

    // Render Sales KPIs Cards
    renderSalesKPIs() {
        const kpiSpentEl = document.getElementById('kpiTotalAdSpent');
        const kpiRevenueEl = document.getElementById('kpiTotalSalesRevenue');
        const kpiRoasEl = document.getElementById('kpiGlobalRoas');
        const kpiCpaEl = document.getElementById('kpiGlobalCpa');

        const totalSpent = this.campaignAds.reduce((acc, a) => acc + (Number(a.spent) || 0), 0);
        const totalSalesCount = this.campaignSales.reduce((acc, s) => acc + (Number(s.quantity) || 1), 0);
        const totalSalesRevenue = this.campaignSales.reduce((acc, s) => acc + ((Number(s.price) || 0) * (Number(s.quantity) || 1)), 0);

        const globalRoas = totalSpent > 0 ? (totalSalesRevenue / totalSpent) : (totalSalesRevenue > 0 ? 99 : 0);
        const globalCpa = totalSalesCount > 0 ? (totalSpent / totalSalesCount) : 0;

        if (kpiSpentEl) kpiSpentEl.textContent = `$${this.formatCurrency(totalSpent)}`;
        if (kpiRevenueEl) kpiRevenueEl.textContent = `$${this.formatCurrency(totalSalesRevenue)} (${totalSalesCount} uds)`;
        if (kpiRoasEl) kpiRoasEl.textContent = globalRoas > 0 ? `${globalRoas.toFixed(2)}x` : '-';
        if (kpiCpaEl) kpiCpaEl.textContent = globalCpa > 0 ? `$${this.formatCurrency(globalCpa)}` : '-';
    },

    // Render Sales History Table
    renderSalesHistoryTable(filterQuery = '') {
        const tbody = document.getElementById('campaignSalesHistoryBody');
        if (!tbody) return;

        let sales = [...this.campaignSales];
        if (filterQuery) {
            const q = filterQuery.toLowerCase().trim();
            sales = sales.filter(s =>
                (s.adId && s.adId.toLowerCase().includes(q)) ||
                (s.adName && s.adName.toLowerCase().includes(q)) ||
                (s.campaignName && s.campaignName.toLowerCase().includes(q)) ||
                (s.orderNumber && s.orderNumber.toLowerCase().includes(q)) ||
                (s.customerName && s.customerName.toLowerCase().includes(q)) ||
                (s.city && s.city.toLowerCase().includes(q)) ||
                (s.date && s.date.includes(q))
            );
        }

        if (sales.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="10" style="text-align: center; color: var(--text-muted); padding: 2.5rem;">
                        ${filterQuery ? 'No se encontraron ventas para esta búsqueda.' : 'No hay ventas registradas todavía. Usa el formulario de Registro Rápido para ingresar ventas.'}
                    </td>
                </tr>
            `;
            return;
        }

        tbody.innerHTML = sales.map(sale => {
            const total = (Number(sale.price) || 0) * (Number(sale.quantity) || 1);

            return `
                <tr>
                    <td style="font-size: 0.85rem; font-weight: 600;">${sale.date || '-'}</td>
                    <td>
                        <span class="ad-id-badge" onclick="CampaignsModule.copyCode('${sale.adId}')" title="Clic para copiar ID">
                            🆔 ${sale.adId}
                        </span>
                    </td>
                    <td style="font-size: 0.85rem; font-weight: 600; max-width: 140px; overflow: hidden; text-overflow: ellipsis;" title="${sale.adName}">
                        ${sale.adName || '-'}
                    </td>
                    <td style="font-size: 0.8rem; max-width: 160px; overflow: hidden; text-overflow: ellipsis;" title="${sale.campaignName}">
                        ${sale.campaignCode ? `<span style="background: var(--primary-light); color: var(--primary); padding: 2px 5px; border-radius: 4px; font-weight: 700; font-family: monospace; font-size: 0.75rem;">${sale.campaignCode}</span> ` : ''}
                        ${sale.campaignName || '-'}
                    </td>
                    <td style="text-align: right; font-family: monospace; font-weight: 700; color: #10b981;">
                        $${this.formatCurrency(sale.price)}
                    </td>
                    <td style="text-align: center; font-weight: 700;">
                        ${sale.quantity || 1}
                    </td>
                    <td style="text-align: right; font-family: monospace; font-weight: 700; color: #10b981;">
                        $${this.formatCurrency(total)}
                    </td>
                    <td style="font-size: 0.85rem;">
                        ${sale.orderNumber ? `<span style="font-family: monospace; background: var(--surface-hover); padding: 2px 6px; border-radius: 4px;">${sale.orderNumber}</span>` : '-'}
                        ${sale.customerName ? `<div style="font-size: 0.75rem; color: var(--text-muted);">${sale.customerName}</div>` : ''}
                    </td>
                    <td style="font-size: 0.85rem; color: var(--text-secondary);">${sale.city || '-'}</td>
                    <td>
                        <button type="button" class="btn btn-icon btn-sm btn-danger-light" onclick="CampaignsModule.deleteSale('${sale.id}')" title="Eliminar venta">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <polyline points="3 6 5 6 21 6"></polyline>
                                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                            </svg>
                        </button>
                    </td>
                </tr>
            `;
        }).join('');
    },

    // Export Sales History to CSV
    exportSalesToCsv() {
        if (this.campaignSales.length === 0) {
            Utils.showNotification('No hay ventas para exportar', 'warning');
            return;
        }

        const headers = ['ID Registro', 'Fecha', 'ID Anuncio', 'Nombre Anuncio', 'Código Campaña', 'Nombre Campaña', 'Precio Unitario', 'Cantidad', 'Total Venta', 'N° Guía/Pedido', 'Cliente', 'Ciudad', 'Notas'];
        const rows = this.campaignSales.map(s => [
            s.id,
            s.date,
            s.adId,
            `"${(s.adName || '').replace(/"/g, '""')}"`,
            s.campaignCode || '',
            `"${(s.campaignName || '').replace(/"/g, '""')}"`,
            s.price,
            s.quantity,
            (s.price * s.quantity),
            `"${(s.orderNumber || '').replace(/"/g, '""')}"`,
            `"${(s.customerName || '').replace(/"/g, '""')}"`,
            `"${(s.city || '').replace(/"/g, '""')}"`,
            `"${(s.notes || '').replace(/"/g, '""')}"`
        ]);

        const csvContent = '\uFEFF' + [headers.join(','), ...rows.map(r => r.join(','))].join('\r\n');
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        const dateStr = new Date().toISOString().split('T')[0];
        a.href = url;
        a.download = `ventas_por_anuncio_${dateStr}.csv`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        Utils.showNotification('¡Archivo CSV de ventas descargado con éxito!', 'success');
    },

    // Edit performance item directly
    editPerformanceItem(code) {
        const campaign = this.generatedCampaigns.find(c => c.code === code);
        if (campaign) {
            this.openAdDetailsModal(campaign.id);
            return;
        }

        const item = this.performanceData.find(p => p.code === code);
        if (!item) return;

        const newPurchasesStr = prompt(`Editar compras para ${code}:`, item.purchases || 0);
        if (newPurchasesStr === null) return;
        const newPurchases = parseInt(newPurchasesStr) || 0;

        const newSpentStr = prompt(`Editar gasto total para ${code}:`, item.spent || 0);
        if (newSpentStr === null) return;
        const newSpent = parseFloat(newSpentStr) || 0;

        item.purchases = newPurchases;
        item.spent = newSpent;
        if (newSpent && newPurchases) {
            item.costPerPurchase = newSpent / newPurchases;
        }

        this.savePerformanceData();
        this.renderPerformanceTable();
        Utils.showNotification('Rendimiento actualizado', 'success');
    },

    // Clear performance data
    clearPerformanceData() {
        if (confirm('¿Está seguro de que desea limpiar todos los datos de rendimiento de campañas?')) {
            this.performanceData = [];
            this.savePerformanceData();
            this.renderPerformanceTable();
            Utils.showNotification('Datos de rendimiento eliminados', 'info');
        }
    },

    // Clear ads data
    clearAdsData() {
        if (confirm('¿Está seguro de que desea eliminar todos los anuncios importados?')) {
            this.campaignAds = [];
            localStorage.setItem('campaignAdsData', JSON.stringify([]));
            this.renderAdsTable();
            this.renderSalesKPIs();
            Utils.showNotification('Anuncios importados eliminados', 'info');
        }
    },

    // Clear history
    clearHistory() {
        if (confirm('¿Está seguro de que desea limpiar todo el historial de campañas? Los códigos serán liberados para reutilización.')) {
            this.usedCodes.clear();
            this.saveUsedCodes();
            this.generatedCampaigns = [];
            this.saveCampaigns();
            this.renderHistory();
            document.getElementById('campaignResult').style.display = 'none';
            Utils.showNotification('Historial limpiado', 'info');
        }
    },

    // Export backup JSON file
    exportBackup() {
        const backupData = {
            version: '2.0',
            exportedAt: new Date().toISOString(),
            generatedCampaigns: this.generatedCampaigns,
            campaignAds: this.campaignAds,
            campaignSales: this.campaignSales,
            usedCodes: Array.from(this.usedCodes),
            performanceData: this.performanceData || []
        };

        const jsonStr = JSON.stringify(backupData, null, 2);
        const blob = new Blob([jsonStr], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        const dateStr = new Date().toISOString().split('T')[0];
        a.href = url;
        a.download = `campanas_anuncios_ventas_backup_${dateStr}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        Utils.showNotification('¡Copia de seguridad exportada en archivo JSON!', 'success');
    },

    // Trigger file picker for import
    triggerImportBackup() {
        const input = document.getElementById('campaignBackupInput');
        if (input) input.click();
    },

    // Import backup file
    importBackupFile(inputEl) {
        const file = inputEl.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const data = JSON.parse(e.target.result);
                this.applyBackupData(data);
                inputEl.value = '';
                Utils.showNotification('¡Copia de seguridad importada con éxito!', 'success');
            } catch (err) {
                console.error('Error al importar backup:', err);
                Utils.showNotification('El archivo no tiene un formato de backup JSON válido', 'error');
            }
        };
        reader.readAsText(file);
    },

    // Copy all campaign data to clipboard as JSON text
    copyBackupToClipboard() {
        const backupData = {
            version: '2.0',
            exportedAt: new Date().toISOString(),
            generatedCampaigns: this.generatedCampaigns,
            campaignAds: this.campaignAds,
            campaignSales: this.campaignSales,
            usedCodes: Array.from(this.usedCodes),
            performanceData: this.performanceData || []
        };

        const jsonStr = JSON.stringify(backupData);
        navigator.clipboard.writeText(jsonStr).then(() => {
            Utils.showNotification('¡Datos de campañas, anuncios y ventas copiados al portapapeles!', 'success');
        }).catch(() => {
            const textArea = document.createElement('textarea');
            textArea.value = jsonStr;
            document.body.appendChild(textArea);
            textArea.select();
            document.execCommand('copy');
            document.body.removeChild(textArea);
            Utils.showNotification('¡Datos copiados al portapapeles! Haz clic en "Pegar / Cargar" en el otro navegador', 'success');
        });
    },

    // Show paste modal
    pasteBackupModal() {
        const textEl = document.getElementById('campaignBackupText');
        if (textEl) textEl.value = '';
        Utils.openModal('modalCampaignBackup');
    },

    // Process pasted JSON backup
    processPasteBackup() {
        const textEl = document.getElementById('campaignBackupText');
        const content = textEl ? textEl.value.trim() : '';

        if (!content) {
            Utils.showNotification('Por favor pega el contenido de la copia de seguridad', 'warning');
            return;
        }

        try {
            const data = JSON.parse(content);
            this.applyBackupData(data);
            Utils.closeModal('modalCampaignBackup');
            if (textEl) textEl.value = '';
            Utils.showNotification('¡Campañas, anuncios y ventas restaurados exitosamente!', 'success');
        } catch (err) {
            console.error('Error procesando texto de backup:', err);
            Utils.showNotification('El texto pegado no es un JSON de backup válido', 'error');
        }
    },

    // Apply backup data
    applyBackupData(data) {
        if (!data || (typeof data !== 'object')) {
            throw new Error('Formato inválido');
        }

        let campaigns = data.generatedCampaigns || (Array.isArray(data) ? data : []);
        let ads = data.campaignAds || [];
        let sales = data.campaignSales || [];
        let codes = data.usedCodes || [];
        let performance = data.performanceData || [];

        const existingIds = new Set(this.generatedCampaigns.map(c => c.id));
        campaigns.forEach(c => {
            if (!existingIds.has(c.id)) {
                this.generatedCampaigns.push(c);
            }
        });

        if (ads.length > 0) {
            const adsMap = new Map(this.campaignAds.map(a => [String(a.adId || a.id), a]));
            ads.forEach(a => adsMap.set(String(a.adId || a.id), a));
            this.campaignAds = Array.from(adsMap.values());
            localStorage.setItem('campaignAdsData', JSON.stringify(this.campaignAds));
        }

        if (sales.length > 0) {
            const salesMap = new Map(this.campaignSales.map(s => [s.id, s]));
            sales.forEach(s => salesMap.set(s.id, s));
            this.campaignSales = Array.from(salesMap.values());
            localStorage.setItem('campaignSalesData', JSON.stringify(this.campaignSales));
        }

        if (performance.length > 0) {
            const perfMap = new Map(this.performanceData.map(p => [p.code, p]));
            performance.forEach(p => {
                if (p.code) perfMap.set(p.code, p);
            });
            this.performanceData = Array.from(perfMap.values());
            this.savePerformanceData();
        }

        codes.forEach(code => this.usedCodes.add(code));

        this.saveCampaigns();
        this.saveUsedCodes();

        if (window.Database) {
            if (window.Database.saveCampaignAds) {
                try { window.Database.saveCampaignAds(this.campaignAds); } catch(e){}
            }
            if (window.Database.saveCampaign) {
                this.generatedCampaigns.forEach(c => {
                    try { window.Database.saveCampaign(c); } catch(e){}
                });
            }
        }

        this.calculateAdMetrics();
        this.renderAll();
    }
};

// Make available globally
window.CampaignsModule = CampaignsModule;
