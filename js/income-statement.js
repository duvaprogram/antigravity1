// ========================================
// Income Statement Module (Estado de Resultados)
// ========================================

const IncomeStatementModule = {
    // Data stores
    guides: [],
    guideItems: [],
    adExpenses: [],
    operationalExpenses: [],
    externalSales: [],
    freights: [],
    products: [],
    productMappings: {},
    visualMergedGroups: [],
    visualMergedGroupsCountry: [],
    isModuleInitialized: false,

    // Current filters
    filters: {
        country: '',
        countries: [],
        products: [],
        dateFrom: null,
        dateTo: null
    },
    countryMultiSelect: null,
    productMultiSelect: null,
    visualMergedGroups: [],

    // Filtros locales para la tabla de Otras Plataformas
    extSalesFilters: {
        country: '',
        product: '',
        search: ''
    },

    // Monthly Exchange Rates (TRM Colombia COP -> USD)
    monthlyRates: {},
    selectedRatesYear: '2026',
    exchangeRatesExpanded: true,
    defaultMonthlyRates: {
        '2025': {
            '01': 4300, '02': 4250, '03': 4200, '04': 4150, '05': 4100, '06': 4100,
            '07': 4050, '08': 4050, '09': 4100, '10': 4150, '11': 4200, '12': 4250
        },
        '2026': {
            '01': 4200, '02': 4150, '03': 4180, '04': 4100, '05': 4120, '06': 4080,
            '07': 4050, '08': 4020, '09': 4100, '10': 4150, '11': 4150, '12': 4200
        },
        '2027': {
            '01': 4200, '02': 4200, '03': 4200, '04': 4200, '05': 4200, '06': 4200,
            '07': 4200, '08': 4200, '09': 4200, '10': 4200, '11': 4200, '12': 4200
        }
    },

    // FB Import state
    fbImportData: null,
    fbImportBatchId: null,

    initialized: false,

    async init() {
        if (this.initialized) return;
        this.initialized = true;
        this.initMultiSelects();
        this.initExchangeRates();
        this.bindEvents();
        this.setDefaultFilters();
    },

    initExchangeRates() {
        try {
            const saved = localStorage.getItem('is_monthly_exchange_rates');
            if (saved) {
                this.monthlyRates = JSON.parse(saved);
            }
        } catch (e) {
            console.warn('Error loading is_monthly_exchange_rates:', e);
            this.monthlyRates = {};
        }

        // Merge defaults for missing years
        ['2025', '2026', '2027'].forEach(yr => {
            if (!this.monthlyRates[yr]) {
                this.monthlyRates[yr] = { ...this.defaultMonthlyRates[yr] };
            } else {
                this.monthlyRates[yr] = { ...this.defaultMonthlyRates[yr], ...this.monthlyRates[yr] };
            }
        });

        // Inicializar dropdown con el mes actual o mes del filtro
        this.populateRateMonthDropdown();
    },

    populateRateMonthDropdown(targetYm) {
        const select = document.getElementById('isRateMonthSelect');
        if (!select) return;

        const monthNames = [
            'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
            'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
        ];

        // Determinar qué YYYY-MM seleccionar
        let activeYm = targetYm;
        if (!activeYm) {
            if (this.filters.dateFrom) {
                activeYm = this.filters.dateFrom.substring(0, 7);
            } else {
                const now = new Date();
                activeYm = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
            }
        }

        const years = ['2026', '2025', '2027'];
        let optionsHtml = '';

        years.forEach(yr => {
            const yearRates = this.monthlyRates[yr] || this.defaultMonthlyRates[yr] || {};
            optionsHtml += `<optgroup label="Año ${yr}">`;
            for (let i = 1; i <= 12; i++) {
                const moStr = String(i).padStart(2, '0');
                const ym = `${yr}-${moStr}`;
                const rate = yearRates[moStr] || 4100;
                const rateFormatted = Number(rate).toLocaleString('es-CO');
                const isSel = ym === activeYm ? 'selected' : '';
                optionsHtml += `<option value="${ym}" ${isSel}>${monthNames[i - 1]} ${yr} (TRM: $${rateFormatted})</option>`;
            }
            optionsHtml += `</optgroup>`;
        });

        select.innerHTML = optionsHtml;
        this.onRateMonthSelectChange(select.value);
    },

    onRateMonthSelectChange(ym) {
        if (!ym) return;
        const parts = ym.split('-');
        const yr = parts[0];
        const mo = parts[1];
        const yearRates = this.monthlyRates[yr] || this.defaultMonthlyRates[yr] || {};
        const rate = yearRates[mo] || 4100;

        const input = document.getElementById('isSingleTrmInput');
        if (input) {
            input.value = rate;
        }

        const badge = document.getElementById('isExchangeRateActiveBadge');
        if (badge) {
            badge.textContent = `TRM: $${Number(rate).toLocaleString('es-CO')} COP`;
        }
    },

    saveSingleMonthRate() {
        const select = document.getElementById('isRateMonthSelect');
        const input = document.getElementById('isSingleTrmInput');
        if (!select || !input) return;

        const ym = select.value;
        if (!ym) return;
        const [yr, mo] = ym.split('-');
        const val = parseFloat(input.value);

        if (isNaN(val) || val <= 0) {
            Utils.showToast('Por favor ingrese un valor de TRM válido', 'warning');
            return;
        }

        if (!this.monthlyRates[yr]) this.monthlyRates[yr] = {};
        this.monthlyRates[yr][mo] = Math.round(val);

        try {
            localStorage.setItem('is_monthly_exchange_rates', JSON.stringify(this.monthlyRates));
            const selectedText = select.options[select.selectedIndex]?.text.split(' (')[0] || `${mo}/${yr}`;
            Utils.showToast(`TRM guardada para ${selectedText}: $${Math.round(val).toLocaleString('es-CO')} COP`, 'success');
        } catch (e) {
            console.warn('Error guardando en localStorage:', e);
            Utils.showToast('Error al guardar tasa', 'error');
        }

        this.populateRateMonthDropdown(ym);
        this.updateExchangeRateNotice();
        this.render();
    },

    openAllRatesModal() {
        const select = document.getElementById('isRateMonthSelect');
        let currentYear = '2026';
        if (select && select.value) {
            currentYear = select.value.split('-')[0];
        }
        const modalYearSelect = document.getElementById('isModalRateYear');
        if (modalYearSelect) modalYearSelect.value = currentYear;

        this.renderModalRatesGrid(currentYear);
        const modal = document.getElementById('modalAllExchangeRates');
        if (modal) modal.classList.add('active');
    },

    closeAllRatesModal() {
        const modal = document.getElementById('modalAllExchangeRates');
        if (modal) modal.classList.remove('active');
    },

    onModalYearChange(year) {
        this.renderModalRatesGrid(year);
    },

    renderModalRatesGrid(year) {
        const grid = document.getElementById('isModalRatesGrid');
        if (!grid) return;

        const yr = year || '2026';
        const yearRates = this.monthlyRates[yr] || this.defaultMonthlyRates[yr] || {};

        const months = [
            { num: '01', name: 'Enero' },
            { num: '02', name: 'Febrero' },
            { num: '03', name: 'Marzo' },
            { num: '04', name: 'Abril' },
            { num: '05', name: 'Mayo' },
            { num: '06', name: 'Junio' },
            { num: '07', name: 'Julio' },
            { num: '08', name: 'Agosto' },
            { num: '09', name: 'Septiembre' },
            { num: '10', name: 'Octubre' },
            { num: '11', name: 'Noviembre' },
            { num: '12', name: 'Diciembre' }
        ];

        let activeMonthStr = '';
        if (this.filters.dateFrom) {
            const fYear = this.filters.dateFrom.substring(0, 4);
            const fMonth = this.filters.dateFrom.substring(5, 7);
            if (fYear === yr) activeMonthStr = fMonth;
        }

        grid.innerHTML = months.map(m => {
            const val = yearRates[m.num] || 4100;
            const isActive = activeMonthStr === m.num;
            return `
                <div style="background: ${isActive ? 'rgba(99, 102, 241, 0.12)' : 'var(--surface-hover)'}; border: 1px solid ${isActive ? '#6366f1' : 'var(--border)'}; border-radius: var(--radius-md); padding: 0.6rem 0.75rem; transition: all 0.2s;">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.35rem;">
                        <span style="font-size: 0.8rem; font-weight: ${isActive ? '700' : '600'}; color: ${isActive ? '#818cf8' : 'var(--text-primary)'};">
                            ${m.name}
                        </span>
                        ${isActive ? '<span style="font-size: 0.65rem; background: #6366f1; color: white; padding: 1px 5px; border-radius: 4px; font-weight: 600;">Filtro</span>' : ''}
                    </div>
                    <div style="display: flex; align-items: center; gap: 0.35rem; background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius-sm); padding: 0.25rem 0.5rem;">
                        <span style="font-size: 0.75rem; color: var(--text-muted); font-weight: 600;">$</span>
                        <input type="number" 
                               id="isModalTrm_${yr}_${m.num}" 
                               data-year="${yr}" 
                               data-month="${m.num}" 
                               class="is-modal-trm-input" 
                               value="${val}" 
                               min="100" 
                               step="10" 
                               style="background: transparent; color: var(--text-primary); border: none; outline: none; font-size: 0.85rem; font-weight: 600; width: 100%; text-align: right;"
                               placeholder="4100">
                        <span style="font-size: 0.7rem; color: var(--text-muted);">COP</span>
                    </div>
                </div>
            `;
        }).join('');
    },

    saveAllModalRates() {
        const modalYearSelect = document.getElementById('isModalRateYear');
        const yr = modalYearSelect ? modalYearSelect.value : '2026';
        if (!this.monthlyRates[yr]) this.monthlyRates[yr] = {};

        const inputs = document.querySelectorAll(`.is-modal-trm-input[data-year="${yr}"]`);
        inputs.forEach(inp => {
            const m = inp.dataset.month;
            const val = parseFloat(inp.value);
            if (m && !isNaN(val) && val > 0) {
                this.monthlyRates[yr][m] = Math.round(val);
            }
        });

        try {
            localStorage.setItem('is_monthly_exchange_rates', JSON.stringify(this.monthlyRates));
            Utils.showToast(`Todas las tasas de ${yr} se han guardado exitosamente`, 'success');
        } catch (e) {
            console.warn('Error guardando en localStorage:', e);
            Utils.showToast('Error al guardar tasas', 'error');
        }

        this.closeAllRatesModal();

        const currentSelectVal = document.getElementById('isRateMonthSelect')?.value;
        const targetYm = (currentSelectVal && currentSelectVal.startsWith(yr)) ? currentSelectVal : `${yr}-01`;
        this.populateRateMonthDropdown(targetYm);
        this.updateExchangeRateNotice();
        this.render();
    },

    resetModalRates() {
        const modalYearSelect = document.getElementById('isModalRateYear');
        const yr = modalYearSelect ? modalYearSelect.value : '2026';
        if (!confirm(`¿Restablecer las tasas del año ${yr} a los valores promedio por defecto?`)) return;

        this.monthlyRates[yr] = { ...this.defaultMonthlyRates[yr] };
        try {
            localStorage.setItem('is_monthly_exchange_rates', JSON.stringify(this.monthlyRates));
            Utils.showToast(`Tasas del año ${yr} restablecidas a valores por defecto`, 'info');
        } catch (e) {}

        this.renderModalRatesGrid(yr);
        this.populateRateMonthDropdown();
        this.updateExchangeRateNotice();
        this.render();
    },

    renderExchangeRatesGrid() {
        // Compatibilidad hacia atrás si se invoca
        this.updateExchangeRateNotice();
    },

    getExchangeRateForDate(dateStr) {
        if (!dateStr) return 4100;
        const cleanStr = String(dateStr).trim();
        const year = cleanStr.substring(0, 4);
        const month = cleanStr.substring(5, 7);

        if (this.monthlyRates[year] && this.monthlyRates[year][month]) {
            return parseFloat(this.monthlyRates[year][month]) || 4100;
        }

        if (this.defaultMonthlyRates[year] && this.defaultMonthlyRates[year][month]) {
            return parseFloat(this.defaultMonthlyRates[year][month]) || 4100;
        }

        return 4100;
    },

    isColombiaOrder(guide) {
        if (!guide) return false;
        if (guide.country === 'Colombia') return true;
        if ((guide.currency || '').toUpperCase() === 'COP') return true;
        const country = this.getCountryFromCity(guide.cities);
        if (country === 'Colombia') return true;
        
        // Also inspect city name if available
        const cityName = (guide.cities?.name || guide.city || '').toLowerCase();
        const colombiaCities = [
            'medellin', 'medellín', 'bogota', 'bogotá', 'cali', 'barranquilla',
            'bucaramanga', 'cartagena', 'pereira', 'manizales', 'cucuta', 'cúcuta',
            'santa marta', 'ibague', 'ibagué', 'pasto', 'monteria', 'montería',
            'neiva', 'villavicencio', 'armenia', 'valledupar', 'soledad', 'bello',
            'itagui', 'itaguí', 'envigado', 'sandona', 'sandoná', 'dosquebradas',
            'floridablanca', 'rionegro', 'popayan', 'popayán', 'palmira'
        ];
        return colombiaCities.some(c => cityName.includes(c));
    },

    getGuideRevenueUSD(guide) {
        if (this.isExcludedFromSales(guide)) return 0;
        const rawAmount = parseFloat(guide.amount_usd || guide.total_amount || guide.revenue || 0);
        if (this.isColombiaOrder(guide)) {
            // If amount_usd is populated, positive and < 1000 while total_amount is > 1000, it's already USD
            if (guide.amount_usd && parseFloat(guide.amount_usd) > 0 && parseFloat(guide.amount_usd) < 1000 && parseFloat(guide.total_amount || 0) > 1000) {
                return parseFloat(guide.amount_usd);
            }
            const rate = this.getExchangeRateForDate(guide.created_at || guide.date || guide.sale_date);
            return rawAmount / rate;
        }
        return rawAmount;
    },

    getGuideShippingCostUSD(guide) {
        const rawShipping = parseFloat(guide.shipping_cost || 0);
        if (this.isColombiaOrder(guide)) {
            // Typical shipping in Colombia is 10,000 - 30,000 COP
            const rate = this.getExchangeRateForDate(guide.created_at || guide.date || guide.sale_date);
            return rawShipping / rate;
        }
        return rawShipping;
    },

    updateExchangeRateNotice() {
        const noticeEl = document.getElementById('isExchangeRateImpactText');
        const summaryEl = document.getElementById('isExchangeRateAppliedSummary');
        if (!noticeEl) return;

        const badgeEl = document.getElementById('isExchangeRateActiveBadge');

        const colombiaGuides = (this.guides || []).filter(g => {
            if (this.isCancelado(g)) return false;
            if (!this.isColombiaOrder(g)) return false;
            const gDate = g.created_at ? g.created_at.split('T')[0] : (g.date || '');
            if (this.filters.dateFrom && gDate < this.filters.dateFrom) return false;
            if (this.filters.dateTo && gDate > this.filters.dateTo) return false;
            return true;
        });

        if (colombiaGuides.length === 0) {
            noticeEl.innerHTML = 'No hay pedidos de Colombia en el período seleccionado. Las tasas configuradas se aplicarán automáticamente a cada venta según su mes.';
            if (summaryEl) summaryEl.textContent = '';
            if (badgeEl) {
                const defaultRate = this.getExchangeRateForDate(this.filters.dateFrom || new Date().toISOString().split('T')[0]);
                badgeEl.textContent = `TRM: $${Number(defaultRate).toLocaleString('es-CO')} COP/USD`;
            }
            return;
        }

        let totalCop = 0;
        let totalUsd = 0;
        colombiaGuides.forEach(g => {
            if (!this.isExcludedFromSales(g)) {
                totalCop += parseFloat(g.total_amount || 0);
                totalUsd += this.getGuideRevenueUSD(g);
            }
        });

        const effectiveRate = totalUsd > 0 ? (totalCop / totalUsd).toFixed(0) : '4,100';
        noticeEl.innerHTML = `Ventas del período en Colombia: <strong>COP $${Math.round(totalCop).toLocaleString('es-CO')}</strong> convertidas a <strong>${Utils.formatCurrency(totalUsd)}</strong> (${colombiaGuides.length} guías).`;
        if (summaryEl) {
            summaryEl.textContent = `TRM Promedio Ponderada: ~$${Number(effectiveRate).toLocaleString('es-CO')} COP/USD`;
        }
        if (badgeEl) {
            badgeEl.textContent = `TRM: ~$${Number(effectiveRate).toLocaleString('es-CO')} COP/USD`;
        }
    },

    initMultiSelects() {
        // Country multi-select with checkboxes
        const countryContainer = document.getElementById('isCountryMultiSelect');
        if (countryContainer) {
            this.countryMultiSelect = new MultiSelectDropdown({
                container: countryContainer,
                placeholder: 'Seleccionar país...',
                allSelectedText: 'Todos los países',
                noneSelectedText: 'Ningún país seleccionado',
                searchable: false,
                items: [
                    { value: 'Ecuador', label: '🇪🇨 Ecuador' },
                    { value: 'Venezuela', label: '🇻🇪 Venezuela' },
                    { value: 'Colombia', label: '🇨🇴 Colombia' }
                ],
                defaultAll: true,
                onChange: (selected) => {
                    this.filters.countries = selected;
                    this.filters.country = selected.length === 1 ? selected[0] : '';
                    this.applyFilters();
                }
            });
            this.filters.countries = this.countryMultiSelect.getSelected();
        }

        // Product multi-select with live search and checkboxes
        const productContainer = document.getElementById('isProductMultiSelect');
        if (productContainer) {
            this.productMultiSelect = new MultiSelectDropdown({
                container: productContainer,
                placeholder: 'Seleccionar productos...',
                allSelectedText: 'Todos los productos',
                noneSelectedText: 'Ningún producto seleccionado',
                searchable: true,
                searchPlaceholder: 'Buscar producto (ej: San Benito)...',
                items: [],
                defaultAll: true,
                onChange: (selected) => {
                    this.filters.products = selected;
                    this.applyFilters();
                }
            });
        }
    },

    bindEvents() {
        // Filter events
        const countrySelect = document.getElementById('isCountryFilter');
        const dateFrom = document.getElementById('isDateFrom');
        const dateTo = document.getElementById('isDateTo');

        if (countrySelect) countrySelect.addEventListener('change', () => this.applyFilters());
        if (dateFrom) dateFrom.addEventListener('change', () => this.applyFilters());
        if (dateTo) dateTo.addEventListener('change', () => this.applyFilters());

        // FB Import
        const fbFileInput = document.getElementById('fbReportFile');
        if (fbFileInput) {
            fbFileInput.addEventListener('change', (e) => this.handleFBFileUpload(e));
        }

        // Operational expense form
        const opExpForm = document.getElementById('formOperationalExpense');
        if (opExpForm) {
            opExpForm.addEventListener('submit', (e) => {
                e.preventDefault();
                this.saveOperationalExpense();
            });
        }

        // Ad expense form (Manual)
        const adExpForm = document.getElementById('formAdExpense');
        if (adExpForm) {
            adExpForm.addEventListener('submit', (e) => {
                e.preventDefault();
                this.saveAdExpense();
            });
        }

        // External Sale form
        const extSaleForm = document.getElementById('formExternalSale');
        if (extSaleForm) {
            extSaleForm.addEventListener('submit', (e) => {
                e.preventDefault();
                this.saveExternalSale();
            });
        }
        // Link Campaigns form
        const linkCampForm = document.getElementById('formLinkCampaigns');
        if (linkCampForm) {
            linkCampForm.addEventListener('submit', (e) => {
                e.preventDefault();
                this.submitLinkCampaigns();
            });
        }
        
        // Group References form
        const groupRefForm = document.getElementById('formGroupReferences');
        if (groupRefForm) {
            groupRefForm.addEventListener('submit', (e) => {
                e.preventDefault();
                this.submitGroupReferences();
            });
        }

        // Load mappings
        try {
            this.productMappings = JSON.parse(localStorage.getItem('is_product_mappings')) || {};
        } catch(e) {
            this.productMappings = {};
        }

        try {
            this.visualMergedGroupsCountry = JSON.parse(localStorage.getItem('is_visual_merged_groups_country')) || [];
        } catch(e) {
            this.visualMergedGroupsCountry = [];
        }

        // Import External Sales Excel Button
        const btnImportExt = document.getElementById('btnImportExternalSales');
        const inputImportExt = document.getElementById('inputImportExternalSales');
        if (btnImportExt && inputImportExt) {
            btnImportExt.addEventListener('click', () => inputImportExt.click());
            inputImportExt.addEventListener('change', (e) => this.handleExternalSalesFileUpload(e));
        }
    },

    setDefaultFilters() {
        const now = new Date();
        const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        const lastDayOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);

        const fromEl = document.getElementById('isDateFrom');
        const toEl = document.getElementById('isDateTo');

        if (fromEl) fromEl.value = firstDayOfMonth.toISOString().split('T')[0];
        if (toEl) toEl.value = lastDayOfMonth.toISOString().split('T')[0];

        this.filters.dateFrom = firstDayOfMonth.toISOString().split('T')[0];
        this.filters.dateTo = lastDayOfMonth.toISOString().split('T')[0];

        // Sincronizar dropdown de TRM con mes inicial
        const currentYm = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
        const rateSelect = document.getElementById('isRateMonthSelect');
        if (rateSelect) {
            rateSelect.value = currentYm;
            this.onRateMonthSelectChange(currentYm);
        }
    },

    applyFilters() {
        if (this.countryMultiSelect) {
            this.filters.countries = this.countryMultiSelect.getSelected();
            this.filters.country = this.filters.countries.length === 1 ? this.filters.countries[0] : '';
        } else {
            this.filters.country = document.getElementById('isCountryFilter')?.value || '';
        }

        if (this.productMultiSelect) {
            this.filters.products = this.productMultiSelect.getSelected();
        }

        this.filters.dateFrom = document.getElementById('isDateFrom')?.value || null;
        this.filters.dateTo = document.getElementById('isDateTo')?.value || null;

        // Sincronizar dropdown de TRM si se seleccionó una fecha válida
        if (this.filters.dateFrom) {
            const ym = this.filters.dateFrom.substring(0, 7);
            const rateSelect = document.getElementById('isRateMonthSelect');
            if (rateSelect && rateSelect.querySelector(`option[value="${ym}"]`)) {
                rateSelect.value = ym;
                this.onRateMonthSelectChange(ym);
            }
        }

        this.render();
    },

    clearFilters() {
        this.filters.dateFrom = null;
        this.filters.dateTo = null;
        const fromEl = document.getElementById('isDateFrom');
        const toEl = document.getElementById('isDateTo');
        if (fromEl) fromEl.value = '';
        if (toEl) toEl.value = '';

        if (this.countryMultiSelect) {
            this.countryMultiSelect.selectAll(false);
            this.filters.countries = this.countryMultiSelect.getSelected();
            this.filters.country = '';
        }
        if (this.productMultiSelect) {
            this.productMultiSelect.selectAll(false);
            this.filters.products = this.productMultiSelect.getSelected();
        }

        document.querySelectorAll('#section-income-statement .month-tag').forEach(el => el.classList.remove('active'));
        this.render();
    },

    async render() {
        try {
            await this.loadAllData();
            this.renderExchangeRatesGrid();
            this.updateExchangeRateNotice();
            this.renderSummaryCards();
            this.renderSalesTable();
            this.renderConsolidatedSalesTable();
            this.renderAdExpensesTable();
            this.renderOperationalExpensesTable();
            this.renderExternalSalesTable();
            this.renderProductProfitTable();
            this.renderPLStatement();
        } catch (error) {
            console.error('Error rendering Income Statement:', error);
            Utils.showToast('Error al cargar el estado de resultados', 'error');
        }
    },

    renderConsolidatedSalesTable() {
        const container = document.getElementById('isConsolidatedSalesTableBody');
        if (!container) return;

        const data = this.getSalesByCountry();
        container.innerHTML = data.map(item => `
            <tr>
                <td>${item.country}</td>
                <td>${item.orderCount}</td>
                <td>${item.unitsSold}</td>
                <td>${Utils.formatCurrency(item.totalRevenue)}</td>
                <td>${Utils.formatCurrency(item.totalCost)}</td>
                <td>${Utils.formatCurrency(item.totalShipping)}</td>
                <td>${Utils.formatCurrency(item.totalRevenue - item.totalCost - item.totalShipping)}</td>
            </tr>
        `).join('');
    },

    async loadAllData() {
        try {
            // Load guides with items (all dispatched guides for accurate freight & sales attribution)
            const { data: guides, error: guidesError } = await supabaseClient
                .from('guides')
                .select(`
                    *,
                    cities!guides_city_id_fkey(name, country),
                    guide_statuses!guides_status_id_fkey(name),
                    guide_items(*, products!guide_items_product_id_fkey(name, cost, price, sku))
                `);

            if (guidesError) throw guidesError;
            this.guides = guides || [];

            // Load ad expenses
            const { data: adExpenses, error: adError } = await supabaseClient
                .from('ad_expenses')
                .select('*')
                .order('date_start', { ascending: false });

            if (adError) throw adError;
            this.adExpenses = adExpenses || [];

            // Load operational expenses
            const { data: opExpenses, error: opError } = await supabaseClient
                .from('operational_expenses')
                .select('*')
                .order('expense_date', { ascending: false });

            if (opError) throw opError;
            this.operationalExpenses = opExpenses || [];

            // Load external sales (Supabase + LocalStorage Hybrid with Deduplication & Pagination)
            let supabaseExtSales = [];
            try {
                let from = 0;
                const pageSize = 1000;
                let hasMore = true;
                while (hasMore) {
                    const { data: extSales, error: extError } = await supabaseClient
                        .from('external_sales')
                        .select('*')
                        .order('sale_date', { ascending: false })
                        .range(from, from + pageSize - 1);

                    if (extError || !extSales || extSales.length === 0) {
                        hasMore = false;
                    } else {
                        supabaseExtSales.push(...extSales);
                        if (extSales.length < pageSize) {
                            hasMore = false;
                        } else {
                            from += pageSize;
                        }
                    }
                }
            } catch (e) {
                console.warn('Alerta al cargar external_sales de Supabase:', e);
            }

            const localExtSales = this.loadExternalSalesFromLocal();
            // Normalizar registros locales heredados de Julio para Ecuador -> "Ecuador Hoko"
            const normalizedLocal = (localExtSales || []).map(s => {
                if ((s.sale_date || '').startsWith('2026-07') && s.country === 'Ecuador') {
                    return { ...s, country: 'Ecuador Hoko' };
                }
                return s;
            });
            const combinedExtSales = [...supabaseExtSales, ...normalizedLocal];

            this.externalSales = this.deduplicateExternalSales(combinedExtSales);
            this.saveExternalSalesToLocal();

            // Load freights
            try {
                const { data: freightsData, error: freightsError } = await supabaseClient
                    .from('freights')
                    .select('*')
                    .order('date', { ascending: false });

                if (!freightsError) {
                    this.freights = freightsData || [];
                }
            } catch (e) {
                console.log('Freights table not available:', e);
                this.freights = [];
            }

            // Populate product multi-select list
            this.populateProductFilter();

        } catch (error) {
            console.error('Error loading data:', error);
        }
    },

    populateProductFilter() {
        if (!this.productMultiSelect) return;
        const productNames = new Set();
        (this.guides || []).forEach(g => {
            const items = g.guide_items || g.products || g.items || [];
            items.forEach(i => {
                const prod = i.products || i;
                const rawName = prod.name || i.name || i.product_name;
                const name = (this.productMappings && this.productMappings[rawName]) || rawName;
                if (name) productNames.add(name.trim());
            });
        });
        (this.externalSales || []).forEach(s => {
            const rawName = s.product_name || s.description;
            const name = (this.productMappings && this.productMappings[rawName]) || rawName;
            if (name) productNames.add(name.trim());
        });

        const items = Array.from(productNames)
            .filter(Boolean)
            .sort((a, b) => a.localeCompare(b))
            .map(name => ({
                value: name,
                label: name
            }));

        this.productMultiSelect.setItems(items, true);
        this.filters.products = this.productMultiSelect.getSelected();
    },

    isDevolucion(g) {
        if (!g) return false;
        const st = (g.status || g.status_name || g.guide_statuses?.name || '').toLowerCase().trim();
        const obs = (g.observations || '').toLowerCase();
        return st.includes('devol') || st.includes('devuelt') || obs.includes('devolución') || obs.includes('devolucion') || obs.includes('devuelto');
    },

    isCancelado(g) {
        if (!g) return false;
        const st = (g.status || g.status_name || g.guide_statuses?.name || '').toLowerCase().trim();
        const obs = (g.observations || '').toLowerCase();
        return st.includes('cancel') || st.includes('anulad') || obs.includes('cancelad') || obs.includes('anulad');
    },

    isExcludedFromSales(g) {
        return this.isDevolucion(g) || this.isCancelado(g);
    },

    async getDeliveredStatusIds() {
        const { data } = await supabaseClient
            .from('guide_statuses')
            .select('id')
            .in('name', ['Entregado', 'Pagado']);
        return (data || []).map(s => s.id);
    },

    // ========================================
    // FILTERING
    // ========================================
    getCountryFromCity(cityData) {
        if (!cityData) return 'Desconocido';
        const city = (cityData.name || '').trim().toLowerCase();
        const country = (cityData.country || '').trim().toLowerCase();

        // Colombia detection
        const colombiaCities = [
            'medellin', 'medellín', 'bogota', 'bogotá', 'cali', 'barranquilla',
            'bucaramanga', 'cartagena', 'pereira', 'manizales', 'cucuta', 'cúcuta',
            'santa marta', 'ibague', 'ibagué', 'pasto', 'monteria', 'montería',
            'neiva', 'villavicencio', 'armenia', 'valledupar', 'soledad', 'bello',
            'itagui', 'itaguí', 'envigado', 'sandona', 'sandoná', 'dosquebradas',
            'floridablanca', 'rionegro', 'popayan', 'popayán', 'palmira'
        ];
        if (colombiaCities.some(c => city.includes(c)) || country.includes('colombia')) {
            return 'Colombia';
        }

        // Ecuador detection
        const ecuadorCities = [
            'quito', 'guayaquil', 'cuenca', 'machala', 'ambato', 'manta',
            'portoviejo', 'santo domingo', 'loja', 'duran', 'durán', 'ibarra',
            'quevedo', 'riobamba', 'tulcan', 'tulcán', 'milagro'
        ];
        if (ecuadorCities.some(c => city.includes(c)) || country.includes('ecuador')) {
            return 'Ecuador';
        }

        // Venezuela detection
        const venezuelaCities = [
            'caracas', 'maracaibo', 'valencia', 'barquisimeto', 'maracay',
            'ciudad guayana', 'san cristobal', 'san cristóbal', 'barinas',
            'maturin', 'maturín', 'cumana', 'cumaná', 'merida', 'mérida'
        ];
        if (venezuelaCities.some(c => city.includes(c)) || country.includes('venezuela')) {
            return 'Venezuela';
        }

        return cityData.country || 'Desconocido';
    },

    matchesCountryFilter(country) {
        if (!country) return true;
        if (this._ignoreCountryFilter) return true;
        if (this.countryMultiSelect && !this.countryMultiSelect.isAllSelected()) {
            const selectedCountries = this.filters.countries || [];
            if (selectedCountries.length > 0) {
                return selectedCountries.some(sel => {
                    const s = sel.toLowerCase().trim();
                    const c = country.toLowerCase().trim();
                    return c.includes(s) || s.includes(c);
                });
            }
            return false;
        }
        if (this.filters.country) {
            const s = this.filters.country.toLowerCase().trim();
            const c = country.toLowerCase().trim();
            return c.includes(s) || s.includes(c);
        }
        return true;
    },

    matchesProductFilter(nameOrNames) {
        if (!this.productMultiSelect || this.productMultiSelect.isAllSelected()) {
            return true;
        }
        const selected = this.filters.products || [];
        if (selected.length === 0) return false;
        const selectedSet = new Set(selected.map(p => p.toLowerCase().trim()));

        const names = Array.isArray(nameOrNames) ? nameOrNames : [nameOrNames];
        return names.some(n => {
            if (!n) return false;
            const clean = n.toLowerCase().trim();
            const mapped = ((this.productMappings && this.productMappings[n]) || n).toLowerCase().trim();
            return selectedSet.has(clean) || selectedSet.has(mapped);
        });
    },

    filterByDateAndCountry(items, dateField = 'created_at', getCountry = null) {
        return items.filter(item => {
            let dateVal = item[dateField];
            if (!dateVal) return false;
            const itemDate = new Date(dateVal).toISOString().split('T')[0];

            if (this.filters.dateFrom && itemDate < this.filters.dateFrom) return false;
            if (this.filters.dateTo && itemDate > this.filters.dateTo) return false;

            if (getCountry) {
                const country = getCountry(item);
                if (!this.matchesCountryFilter(country)) return false;
            }

            return true;
        });
    },

    // ========================================
    // SALES DATA
    // ========================================
    getFilteredSales() {
        let sales = this.filterByDateAndCountry(
            this.guides,
            'created_at',
            (guide) => this.getCountryFromCity(guide.cities)
        );

        if (this.productMultiSelect && !this.productMultiSelect.isAllSelected()) {
            sales = sales.filter(g => {
                const items = g.guide_items || g.products || g.items || [];
                return items.some(item => {
                    const prod = item.products || item;
                    const rawName = prod.name || item.name || '';
                    return this.matchesProductFilter(rawName);
                });
            });
        }

        return sales;
    },

    getSalesByCountry() {
        const sales = this.getFilteredSales();
        const byCountry = {};

        sales.forEach(guide => {
            if (this.isCancelado(guide)) return;

            const baseCountry = this.getCountryFromCity(guide.cities);
            const country = `${baseCountry} Domi`;
            if (!byCountry[country]) {
                byCountry[country] = {
                    country,
                    baseCountry,
                    platform: 'Domi',
                    isExternal: false,
                    totalRevenue: 0,
                    totalRevenueCOP: 0,
                    totalCost: 0,
                    totalShipping: 0,
                    totalShippingCOP: 0,
                    orderCount: 0,
                    deliveredOrders: 0,
                    returnedOrders: 0,
                    shippedOrders: 0,
                    unitsSold: 0,
                    deliveredUnits: 0,
                    returnedUnits: 0
                };
            }

            const isExcluded = this.isExcludedFromSales(guide);

            // Flete se genera siempre que el pedido fue despachado (incluyendo Devolución)
            const shippingUSD = this.getGuideShippingCostUSD(guide);
            byCountry[country].totalShipping += shippingUSD;
            if (shippingUSD > 0) byCountry[country].shippedOrders++;
            if (this.isColombiaOrder(guide)) {
                byCountry[country].totalShippingCOP = (byCountry[country].totalShippingCOP || 0) + parseFloat(guide.shipping_cost || 0);
            }

            // Count units for this guide
            let guideUnits = 0;
            if (guide.guide_items) {
                guide.guide_items.forEach(item => {
                    guideUnits += parseInt(item.quantity || 0);
                });
            }

            if (isExcluded) {
                byCountry[country].returnedOrders++;
                byCountry[country].returnedUnits += guideUnits;
            } else {
                // Solo pedidos entregados/efectivos suman ventas y costo de producto
                const revUSD = this.getGuideRevenueUSD(guide);
                byCountry[country].totalRevenue += revUSD;
                if (this.isColombiaOrder(guide)) {
                    byCountry[country].totalRevenueCOP = (byCountry[country].totalRevenueCOP || 0) + parseFloat(guide.total_amount || 0);
                }
                byCountry[country].orderCount++;
                byCountry[country].deliveredOrders++;
                byCountry[country].deliveredUnits += guideUnits;

                if (guide.guide_items) {
                    guide.guide_items.forEach(item => {
                        const prod = item.products || item;
                        const rawName = prod.name || item.name || '';
                        if (!this.matchesProductFilter(rawName)) return;

                        const qty = parseInt(item.quantity || 0);
                        const rawCost = parseFloat(item.products?.cost || 0);
                        const cost = window.ProductsModule ? window.ProductsModule.getRealCost(item.products || {}) : rawCost * 40000;
                        byCountry[country].totalCost += qty * cost;
                        byCountry[country].unitsSold += qty;
                    });
                }
            }
        });

        // 2. Process External Sales (Other Platforms like Ecuador Hoko)
        const externalSales = this.getFilteredExternalSales();
        externalSales.forEach(s => {
            let countryName = (s.country || 'Otros').trim();
            // Normalizar si quedó como solo Ecuador a Ecuador Hoko para Julio
            if (countryName.toLowerCase() === 'ecuador') {
                countryName = 'Ecuador Hoko';
            }

            let baseCountry = 'Otros';
            const cLower = countryName.toLowerCase();
            if (cLower.includes('ecuador')) baseCountry = 'Ecuador';
            else if (cLower.includes('colombia')) baseCountry = 'Colombia';
            else if (cLower.includes('venezuela')) baseCountry = 'Venezuela';
            else if (cLower.includes('chile')) baseCountry = 'Chile';
            else if (cLower.includes('panama') || cLower.includes('panamá')) baseCountry = 'Panamá';
            else baseCountry = countryName;

            if (!byCountry[countryName]) {
                byCountry[countryName] = {
                    country: countryName,
                    baseCountry: baseCountry,
                    platform: countryName.replace(baseCountry, '').trim() || 'Otras',
                    isExternal: true,
                    totalRevenue: 0,
                    totalRevenueCOP: 0,
                    totalCost: 0,
                    totalShipping: 0,
                    totalShippingCOP: 0,
                    orderCount: 0,
                    deliveredOrders: 0,
                    returnedOrders: 0,
                    shippedOrders: 0,
                    unitsSold: 0,
                    deliveredUnits: 0,
                    returnedUnits: 0
                };
            }

            const del = parseInt(s.delivered || 0);
            const ret = parseInt(s.returned || 0);
            const orders = (del + ret > 0) ? (del + ret) : (del > 0 ? del : 1);
            const units = parseInt(s.units || del || orders);
            const deliveredUnits = parseInt(s.delivered_units || del || 0);
            const returnedUnits = parseInt(s.returned_units || ret || 0);

            byCountry[countryName].orderCount += orders;
            byCountry[countryName].deliveredOrders += del;
            byCountry[countryName].returnedOrders += ret;
            byCountry[countryName].deliveredUnits += deliveredUnits;
            byCountry[countryName].returnedUnits += returnedUnits;
            byCountry[countryName].shippedOrders += orders;
            byCountry[countryName].unitsSold += units;
            byCountry[countryName].totalRevenue += parseFloat(s.revenue || 0);
            byCountry[countryName].totalCost += parseFloat(s.product_cost || 0);
            byCountry[countryName].totalShipping += parseFloat(s.shipping_cost || 0) + parseFloat(s.return_shipping_cost || 0);
        });

        return Object.values(byCountry);
    },

    // ========================================
    // FREIGHT COSTS DATA
    // ========================================
    getFreightDestinationCountry(route) {
        if (!route) return null;
        const r = route.toLowerCase();
        if (r.includes('cúcuta') || r.includes('cucuta') || r.includes('san antonio') || r.includes('tachira') || r.includes('táchira') || r.includes('caracas') || r.includes('valencia') || r.includes('maracay') || r.includes('maracaibo') || r.includes('barquisimeto')) {
            return 'Venezuela';
        }
        if (r.includes('tulcán') || r.includes('tulcan') || r.includes('ipiales') || r.includes('quito') || r.includes('guayaquil') || r.includes('cuenca') || r.includes('ambato') || r.includes('manta') || r.includes('machala') || r.includes('santo domingo') || r.includes('loja')) {
            return 'Ecuador';
        }
        if (r.includes('ecuador')) return 'Ecuador';
        if (r.includes('venezuela')) return 'Venezuela';
        if (r.includes('colombia')) return 'Colombia';
        return null;
    },

    getFilteredFreights() {
        return this.freights.filter(f => {
            if (!f.date) return false;
            const freightDate = f.date;

            if (this.filters.dateFrom && freightDate < this.filters.dateFrom) return false;
            if (this.filters.dateTo && freightDate > this.filters.dateTo) return false;

            if (this.countryMultiSelect && !this.countryMultiSelect.isAllSelected()) {
                const selectedCountries = this.filters.countries || [];
                const destCountry = this.getFreightDestinationCountry(f.route);
                if (!selectedCountries.includes(destCountry)) return false;
            } else if (this.filters.country) {
                const destCountry = this.getFreightDestinationCountry(f.route);
                if (destCountry !== this.filters.country) return false;
            }

            return true;
        });
    },

    getFreightsByCountry() {
        const freights = this.getFilteredFreights();
        const byCountry = {};

        freights.forEach(f => {
            const country = this.getFreightDestinationCountry(f.route);
            if (!country) return;

            if (!byCountry[country]) {
                byCountry[country] = { country, totalFreight: 0, count: 0 };
            }

            byCountry[country].totalFreight += parseFloat(f.amount || 0);
            byCountry[country].count++;
        });

        return byCountry;
    },

    // ========================================
    // AD EXPENSES DATA
    // ========================================
    getFilteredAdExpenses() {
        return this.filterByDateAndCountry(
            this.adExpenses,
            'date_start',
            (expense) => expense.country
        );
    },

    getAdExpensesByCountry() {
        const expenses = this.getFilteredAdExpenses();
        const byCountry = {};

        expenses.forEach(exp => {
            const country = exp.country;
            if (!byCountry[country]) {
                byCountry[country] = {
                    country,
                    totalSpent: 0,
                    totalImpressions: 0,
                    totalClicks: 0,
                    totalPurchases: 0,
                    campaignCount: new Set()
                };
            }

            byCountry[country].totalSpent += parseFloat(exp.amount_spent || 0);
            byCountry[country].totalImpressions += parseInt(exp.impressions || 0);
            byCountry[country].totalClicks += parseInt(exp.clicks || 0);
            byCountry[country].totalPurchases += parseInt(exp.purchases || 0);
            if (exp.campaign_name) byCountry[country].campaignCount.add(exp.campaign_name);
        });

        // Convert Sets to counts
        Object.values(byCountry).forEach(c => {
            c.campaignCount = c.campaignCount.size;
        });

        return Object.values(byCountry);
    },

    // ========================================
    // OPERATIONAL EXPENSES DATA
    // ========================================
    getFilteredOperationalExpenses() {
        // Los gastos "Global_Expense" solo deben respetar el filtro de FECHA,
        // nunca el de país (se distribuyen proporcionalmente entre países después,
        // según las ventas de los países que el filtro de país sí deje pasar).
        // Si aplicáramos el filtro de país aquí, un gasto global desaparecería
        // al filtrar por un país específico, causando que la utilidad de cada
        // país individual salga inflada respecto a la vista consolidada.
        const globalExpenses = this.filterByDateAndCountry(
            this.operationalExpenses.filter(e => e.country === 'Global_Expense' || (e.country && e.country.toLowerCase() === 'global')),
            'expense_date',
            null
        );

        const localExpenses = this.filterByDateAndCountry(
            this.operationalExpenses.filter(e => e.country !== 'Global_Expense' && !(e.country && e.country.toLowerCase() === 'global')),
            'expense_date',
            (expense) => expense.country
        );

        return [...localExpenses, ...globalExpenses];
    },

    getFilteredOpExpenses() {
        return this.getFilteredOperationalExpenses();
    },

    getOpExpensesByCountry() {
        const expenses = this.getFilteredOperationalExpenses();
        const byCountry = {};

        const initEntry = (country) => {
            if (!byCountry[country]) {
                byCountry[country] = { country, total: 0, localExpenses: 0, distributedGlobalExpenses: 0, byCategory: {} };
            }
            return byCountry[country];
        };

        // Separar gastos locales y globales
        const localExpenses = [];
        const globalExpenses = [];

        expenses.forEach(exp => {
            if (exp.country && (exp.country.toLowerCase() === 'global' || exp.country === 'Global_Expense')) {
                globalExpenses.push(exp);
            } else {
                localExpenses.push(exp);
            }
        });

        // Los % de reparto (tanto de gastos globales como locales por país base)
        // deben calcularse sobre las ventas REALES de TODOS los países/plataformas
        // (solo respetando fecha/producto), nunca sobre el subconjunto que deja
        // pasar el filtro de país activo. De lo contrario, al filtrar un solo país
        // este terminaría absorbiendo el 100% de cualquier gasto (inflando sus
        // costos muy por encima de lo que le corresponde según su peso real).
        // NOTA: no basta con vaciar this.filters.countries — el selector visual
        // (countryMultiSelect) mantiene su propio estado interno de selección, y
        // matchesCountryFilter() lo consulta directamente. Por eso usamos una
        // bandera explícita que matchesCountryFilter() respeta antes que nada.
        let allSalesData;
        try {
            this._ignoreCountryFilter = true;
            allSalesData = this.getSalesByCountry();
        } finally {
            this._ignoreCountryFilter = false;
        }

        // Solo agregamos al resultado las filas de venta (país/plataforma) que el
        // filtro de país actual deja ver
        const visibleCountries = new Set(this.getSalesByCountry().map(s => s.country));

        // --- Gastos GLOBALES: se distribuyen entre TODAS las filas de venta
        // (país + plataforma, ej. "Colombia Domi", "Colombia Hoko") según su % de
        // participación sobre el total general de ventas.
        const totalRevenueAll = allSalesData.reduce((s, c) => s + c.totalRevenue, 0);
        globalExpenses.forEach(gexp => {
            const globalAmount = parseFloat(gexp.amount || 0);
            const category = gexp.category || 'Gasto Global';

            allSalesData.forEach(sale => {
                if (!visibleCountries.has(sale.country)) return;
                if (totalRevenueAll <= 0) return;

                const sharePercentage = sale.totalRevenue / totalRevenueAll;
                const distributedAmount = globalAmount * sharePercentage;

                const entry = initEntry(sale.country);
                entry.total += distributedAmount;
                entry.distributedGlobalExpenses += distributedAmount;
                entry.byCategory[category] = (entry.byCategory[category] || 0) + distributedAmount;
            });
        });

        // --- Gastos LOCALES: se registran a nivel de país BASE (Ecuador,
        // Venezuela, Colombia), pero las ventas pueden tener varias plataformas
        // bajo ese mismo país (ej. "Colombia Domi" y "Colombia Hoko"). Por eso
        // el gasto se reparte entre las filas de venta de ESE país base, según
        // su % de participación dentro de ese país (no se le asigna el 100% a
        // cada plataforma, para no duplicar el gasto).
        localExpenses.forEach(exp => {
            const expCountry = (exp.country || '').trim();
            const amount = parseFloat(exp.amount || 0);
            const category = exp.category || 'Otro';
            const expCountryLower = expCountry.toLowerCase();

            const matchingSales = allSalesData.filter(s =>
                (s.baseCountry && s.baseCountry.toLowerCase() === expCountryLower) ||
                (s.country && s.country.toLowerCase() === expCountryLower)
            );

            if (matchingSales.length === 0) {
                // No hay ventas registradas para ese país en el período: mantener
                // el gasto visible bajo su propio nombre para no perderlo del total.
                if (visibleCountries.size === 0 || visibleCountries.has(expCountry)) {
                    const entry = initEntry(expCountry);
                    entry.total += amount;
                    entry.localExpenses += amount;
                    entry.byCategory[category] = (entry.byCategory[category] || 0) + amount;
                }
                return;
            }

            const totalMatchingRevenue = matchingSales.reduce((s, c) => s + c.totalRevenue, 0);

            matchingSales.forEach(sale => {
                if (!visibleCountries.has(sale.country)) return;

                const share = totalMatchingRevenue > 0
                    ? (sale.totalRevenue / totalMatchingRevenue)
                    : (1 / matchingSales.length);
                const distributedAmount = amount * share;

                const entry = initEntry(sale.country);
                entry.total += distributedAmount;
                entry.localExpenses += distributedAmount;
                entry.byCategory[category] = (entry.byCategory[category] || 0) + distributedAmount;
            });
        });

        return Object.values(byCountry);
    },

    // ========================================
    // RENDERING
    // ========================================
    renderSummaryCards() {
        const salesData = this.getSalesByCountry();
        const adExpData = this.getAdExpensesByCountry();
        const opExpData = this.getOpExpensesByCountry();

        const totalRevenue = salesData.reduce((s, c) => s + c.totalRevenue, 0);
        const totalCOGS = salesData.reduce((s, c) => s + c.totalCost, 0);
        const totalShipping = salesData.reduce((s, c) => s + c.totalShipping, 0);
        const totalAdSpend = adExpData.reduce((s, c) => s + c.totalSpent, 0);
        const totalOpExp = opExpData.reduce((s, c) => s + c.total, 0);
        const grossProfit = totalRevenue - totalCOGS - totalShipping;
        const netProfit = grossProfit - totalAdSpend - totalOpExp;
        const totalOrders = salesData.reduce((s, c) => s + c.orderCount, 0);

        // Update the cards
        this.setCardValue('isRevenue', this.formatCurrency(totalRevenue));
        this.setCardValue('isCOGS', this.formatCurrency(totalCOGS));
        this.setCardValue('isGrossProfit', this.formatCurrency(grossProfit), grossProfit >= 0 ? 'var(--success)' : 'var(--danger)');
        this.setCardValue('isAdSpend', this.formatCurrency(totalAdSpend));
        this.setCardValue('isOpExpenses', this.formatCurrency(totalOpExp));
        this.setCardValue('isNetProfit', this.formatCurrency(netProfit), netProfit >= 0 ? 'var(--success)' : 'var(--danger)');
        this.setCardValue('isOrders', totalOrders.toString());

        // Margin percentages
        const grossMargin = totalRevenue > 0 ? ((grossProfit / totalRevenue) * 100).toFixed(1) : '0.0';
        const netMargin = totalRevenue > 0 ? ((netProfit / totalRevenue) * 100).toFixed(1) : '0.0';
        this.setCardSubValue('isGrossMarginPct', `${grossMargin}% margen`);
        this.setCardSubValue('isNetMarginPct', `${netMargin}% margen`);
        this.setCardSubValue('isROAS', totalAdSpend > 0 ? `ROAS: ${(totalRevenue / totalAdSpend).toFixed(2)}x` : 'Sin datos');
    },

    setCardValue(id, value, color = null) {
        const el = document.getElementById(id);
        if (el) {
            el.textContent = value;
            if (color) el.style.color = color;
        }
    },

    setCardSubValue(id, value) {
        const el = document.getElementById(id);
        if (el) el.textContent = value;
    },

    renderSalesTable() {
        const tbody = document.getElementById('isSalesTable');
        if (!tbody) return;

        const salesData = this.getSalesByCountry();
        const freightsByCountry = this.getFreightsByCountry();
        const opExpData = this.getOpExpensesByCountry();
        const opExpByCountry = {};
        opExpData.forEach(exp => {
            opExpByCountry[exp.country] = exp;
        });

        if (salesData.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="12" style="text-align: center; color: var(--text-muted); padding: 2rem;">
                        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1" style="margin-bottom: 0.5rem; opacity: 0.3;">
                            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                            <polyline points="14 2 14 8 20 8"></polyline>
                        </svg>
                        <br>No hay ventas en el período seleccionado
                    </td>
                </tr>`;
            return;
        }

        const totalRow = {
            totalRevenue: 0, totalCost: 0, totalShipping: 0, totalFreight: 0, totalOpExp: 0, orderCount: 0, unitsSold: 0
        };

        // Calcular total de ventas primero para los porcentajes
        let totalSalesRevenue = 0;
        salesData.forEach(row => {
            totalSalesRevenue += row.totalRevenue;
        });

        tbody.innerHTML = salesData.map(row => {
            const baseCountry = row.baseCountry || row.country.replace(' Domi', '');
            const countryFreight = row.isExternal ? 0 : (freightsByCountry[row.country]?.totalFreight || freightsByCountry[baseCountry]?.totalFreight || 0);
            const countryOpExp = opExpByCountry[row.country]?.total || 0;

            totalRow.totalRevenue += row.totalRevenue;
            totalRow.totalCost += row.totalCost;
            totalRow.totalShipping += row.totalShipping;
            totalRow.totalFreight += countryFreight;
            totalRow.totalOpExp += countryOpExp;
            totalRow.orderCount += row.orderCount;
            totalRow.unitsSold += row.unitsSold;

            const grossProfitBeforeOpEx = row.totalRevenue - row.totalCost - row.totalShipping - countryFreight;
            const grossProfit = grossProfitBeforeOpEx - countryOpExp;
            const margin = row.totalRevenue > 0 ? ((grossProfit / row.totalRevenue) * 100).toFixed(1) : '0.0';

            // Porcentajes sobre las ventas del mercado
            const marketSharePct = totalSalesRevenue > 0 ? ((row.totalRevenue / totalSalesRevenue) * 100).toFixed(1) : '0.0';
            const costPct = row.totalRevenue > 0 ? ((row.totalCost / row.totalRevenue) * 100).toFixed(1) : '0.0';
            const shippingPct = row.totalRevenue > 0 ? ((row.totalShipping / row.totalRevenue) * 100).toFixed(1) : '0.0';

            // Subtitle for Colombia to show original COP amount & average rate
            let revenueSubtitle = '';
            let shippingSubtitle = '';
            if (baseCountry === 'Colombia' && row.totalRevenueCOP > 0) {
                const avgRate = (row.totalRevenueCOP / (row.totalRevenue || 1)).toFixed(0);
                revenueSubtitle = `<div style="font-size: 0.72rem; color: var(--text-muted); font-weight: 500;" title="Monto original en Pesos Colombianos y tasa aplicada">≈ COP $${Math.round(row.totalRevenueCOP).toLocaleString('es-CO')} <span style="font-size: 0.66rem; opacity: 0.85;">(TRM ~$${Number(avgRate).toLocaleString('es-CO')})</span></div>`;
            }
            if (baseCountry === 'Colombia' && row.totalShippingCOP > 0) {
                shippingSubtitle = `<div style="font-size: 0.7rem; color: var(--text-muted); font-weight: 500;" title="Flete en Pesos Colombianos">≈ COP $${Math.round(row.totalShippingCOP).toLocaleString('es-CO')}</div>`;
            }

            return `
                <tr>
                    <td>
                        <div style="display: flex; align-items: center; gap: 0.5rem;">
                            <span class="country-flag">${this.getCountryFlag(row.country)}</span>
                            <strong>${row.country}</strong>
                        </div>
                    </td>
                    <td style="text-align: right; font-weight: 600;">${row.orderCount.toLocaleString('es-CO')}</td>
                    <td style="text-align: right;">${row.unitsSold.toLocaleString('es-CO')}</td>
                    <td style="text-align: right; font-weight: 600; color: var(--success);">
                        <div>${this.formatCurrency(row.totalRevenue)}</div>
                        ${revenueSubtitle}
                    </td>
                    <td style="text-align: center; font-weight: 600; color: var(--primary);">
                        <div style="font-size: 1rem; font-variant-numeric: tabular-nums;">${marketSharePct}%</div>
                        <div style="font-size: 0.65rem; color: var(--text-muted); font-weight: 500;">del total</div>
                    </td>
                    <td style="text-align: right; color: var(--danger);">
                        <div>${this.formatCurrency(row.totalCost)}</div>
                        <div style="font-size: 0.72rem; opacity: 0.8; font-weight: 500;">${costPct}%</div>
                    </td>
                    <td style="text-align: right; color: var(--danger);">
                        <div>${this.formatCurrency(row.totalShipping)}</div>
                        <div style="font-size: 0.72rem; opacity: 0.8; font-weight: 500;">${shippingPct}%</div>
                        ${shippingSubtitle}
                    </td>
                    <td style="text-align: right; color: var(--warning);">${this.formatCurrency(countryFreight)}</td>
                    <td style="text-align: right; color: var(--danger);" title="Gastos operativos distribuidos según % de ventas">
                        <div>${this.formatCurrency(countryOpExp)}</div>
                    </td>
                    <td style="text-align: right; font-weight: 600; color: ${grossProfit >= 0 ? 'var(--success)' : 'var(--danger)'};">
                        ${this.formatCurrency(grossProfit)}
                    </td>
                    <td style="text-align: center;">
                        <span class="is-margin-badge ${parseFloat(margin) >= 30 ? 'good' : parseFloat(margin) >= 15 ? 'warning' : 'bad'}">${margin}%</span>
                    </td>
                    <td style="text-align: center;">
                        <button class="btn btn-icon btn-sm is-detail-btn" onclick="IncomeStatementModule.showOrdersDetail('${row.country}')" title="Ver detalle de ${row.country}">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                <circle cx="11" cy="11" r="8"></circle>
                                <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                            </svg>
                        </button>
                    </td>
                </tr>`;
        }).join('');

        // Total row
        const totalGross = totalRow.totalRevenue - totalRow.totalCost - totalRow.totalShipping - totalRow.totalFreight - totalRow.totalOpExp;
        const totalMargin = totalRow.totalRevenue > 0 ? ((totalGross / totalRow.totalRevenue) * 100).toFixed(1) : '0.0';
        const totalCostPct = totalRow.totalRevenue > 0 ? ((totalRow.totalCost / totalRow.totalRevenue) * 100).toFixed(1) : '0.0';
        const totalShippingPct = totalRow.totalRevenue > 0 ? ((totalRow.totalShipping / totalRow.totalRevenue) * 100).toFixed(1) : '0.0';

        tbody.innerHTML += `
            <tr class="is-total-row">
                <td><strong>TOTAL</strong></td>
                <td style="text-align: right; font-weight: 700;">${totalRow.orderCount.toLocaleString('es-CO')}</td>
                <td style="text-align: right; font-weight: 700;">${totalRow.unitsSold.toLocaleString('es-CO')}</td>
                <td style="text-align: right; font-weight: 700; color: var(--success);">${this.formatCurrency(totalRow.totalRevenue)}</td>
                <td style="text-align: center; font-weight: 700; color: var(--primary); font-size: 1rem;">100%</td>
                <td style="text-align: right; font-weight: 700; color: var(--danger);">
                    <div>${this.formatCurrency(totalRow.totalCost)}</div>
                    <div style="font-size: 0.72rem; opacity: 0.9;">${totalCostPct}%</div>
                </td>
                <td style="text-align: right; font-weight: 700; color: var(--danger);">
                    <div>${this.formatCurrency(totalRow.totalShipping)}</div>
                    <div style="font-size: 0.72rem; opacity: 0.9;">${totalShippingPct}%</div>
                </td>
                <td style="text-align: right; font-weight: 700; color: var(--warning);">${this.formatCurrency(totalRow.totalFreight)}</td>
                <td style="text-align: right; font-weight: 700; color: var(--danger);">${this.formatCurrency(totalRow.totalOpExp)}</td>
                <td style="text-align: right; font-weight: 700; color: ${totalGross >= 0 ? 'var(--success)' : 'var(--danger)'};">${this.formatCurrency(totalGross)}</td>
                <td style="text-align: center;"><span class="is-margin-badge ${parseFloat(totalMargin) >= 30 ? 'good' : parseFloat(totalMargin) >= 15 ? 'warning' : 'bad'}">${totalMargin}%</span></td>
                <td></td>
            </tr>`;
    },

    renderConsolidatedSalesTable() {
        const tbody = document.getElementById('isConsolidatedSalesTable');
        if (!tbody) return;

        const sales = this.getFilteredSales();
        const freightsByCountry = this.getFreightsByCountry();
        const externalSales = this.getFilteredExternalSales();
        const allAdExpenses = this.getFilteredAdExpenses();

        let countryList = [];

        const dropiOrdersCount = {};
        sales.forEach(guide => {
            if (this.isCancelado(guide)) return;
            const country = this.getCountryFromCity(guide.cities);
            dropiOrdersCount[country] = (dropiOrdersCount[country] || 0) + 1;
        });

        // 1. Process Dropi Orders (Individually)
        sales.forEach(guide => {
            if (this.isCancelado(guide)) return;

            const country = this.getCountryFromCity(guide.cities);
            const id = `Dropi_${guide.id}`;
            const isExcluded = this.isExcludedFromSales(guide);
            const isDevol = this.isDevolucion(guide);
            
            let productNames = [];
            if (guide.guide_items && guide.guide_items.length > 0) {
                productNames = guide.guide_items.map(item => item.products?.name || 'Producto Desconocido');
            } else {
                productNames = ['Producto Desconocido'];
            }
            // Eliminar duplicados si el pedido tiene múltiples del mismo producto
            productNames = [...new Set(productNames)];
            
            const name = `${productNames.join(', ')} (${country})${isDevol ? ' [Devolución]' : ''}`;
            const count = dropiOrdersCount[country] || 1;
            const freightProportion = (freightsByCountry[country]?.totalFreight || 0) / count;
            
            let adSpend = 0;
            let manualAdSpend = false;
            let countryUnlinkedAdSpend = 0;

            allAdExpenses.forEach(exp => {
                if (exp.product_name === id) {
                    adSpend += parseFloat(exp.amount_spent || 0);
                    manualAdSpend = true;
                }
            });

            let totalCost = 0;
            let unitsSold = 0;
            if (!isExcluded && guide.guide_items) {
                guide.guide_items.forEach(item => {
                    const qty = parseInt(item.quantity || 0);
                    const rawCost = parseFloat(item.products?.cost || 0);
                    const cost = window.ProductsModule ? window.ProductsModule.getRealCost(item.products || {}) : rawCost * 40000;
                    totalCost += qty * cost;
                    unitsSold += qty;
                });
            }
            
            countryList.push({
                id: id,
                name: name,
                isDropi: true,
                country: country,
                orderCount: 1,
                totalDelivered: isExcluded ? 0 : 1,
                totalReturned: isDevol ? 1 : 0,
                deliveredUnits: isExcluded ? 0 : unitsSold,
                unitsSold: unitsSold,
                totalRevenue: isExcluded ? 0 : this.getGuideRevenueUSD(guide),
                totalCost: totalCost,
                totalShipping: this.getGuideShippingCostUSD(guide),
                returnShipping: 0,
                freight: freightProportion,
                adSpend: adSpend
            });
        });

        // 2. Process External Sales (Individually)
        externalSales.forEach(s => {
            const id = `Ext_${s.id}`;
            const name = s.description ? `${s.country} - ${s.description} (Excel)` : `${s.country} (Excel)`;
            
            let adSpend = 0;
            allAdExpenses.forEach(exp => {
                if (exp.product_name === id || (s.description && exp.product_name === s.description)) {
                    adSpend += parseFloat(exp.amount_spent || 0);
                }
            });
            
            const extDeliveredUnits = parseInt(s.delivered_units !== undefined && s.delivered_units !== null ? s.delivered_units : (s.delivered || 0));
            const extReturnedUnits = parseInt(s.returned_units !== undefined && s.returned_units !== null ? s.returned_units : (s.returned || 0));
            countryList.push({
                id: id,
                name: name,
                isDropi: false,
                country: s.country,
                orderCount: parseInt(s.delivered || 0) + parseInt(s.returned || 0),
                totalDelivered: parseInt(s.delivered || 0),
                totalReturned: parseInt(s.returned || 0),
                deliveredUnits: extDeliveredUnits,
                unitsSold: extDeliveredUnits + extReturnedUnits,
                totalRevenue: parseFloat(s.revenue || 0),
                totalCost: parseFloat(s.product_cost || 0),
                totalShipping: parseFloat(s.shipping_cost || 0),
                returnShipping: parseFloat(s.return_shipping_cost || 0),
                freight: 0,
                adSpend: adSpend,
                extId: s.id
            });
        });

        // Apply Visual Groups for Countries
        (this.visualMergedGroupsCountry || []).forEach((group, index) => {
            const mergedItem = {
                id: `Group_${index}`,
                name: group.name,
                orderCount: 0, totalDelivered: 0, totalReturned: 0, deliveredUnits: 0, unitsSold: 0, totalRevenue: 0, totalCost: 0, totalShipping: 0, returnShipping: 0, freight: 0, adSpend: 0,
                isVisualGroup: true,
                groupId: index
            };
            
            let groupDirectAdSpend = 0;
            allAdExpenses.forEach(exp => {
                if (exp.product_name === mergedItem.id) {
                    groupDirectAdSpend += parseFloat(exp.amount_spent || 0);
                }
            });
            mergedItem.adSpend += groupDirectAdSpend;
            
            let foundAny = false;
            countryList = countryList.filter(c => {
                if (group.items.includes(c.id)) {
                    mergedItem.orderCount += c.orderCount;
                    mergedItem.totalDelivered += c.totalDelivered;
                    mergedItem.totalReturned += c.totalReturned;
                    mergedItem.deliveredUnits += (c.deliveredUnits || 0);
                    mergedItem.unitsSold += c.unitsSold;
                    mergedItem.totalRevenue += c.totalRevenue;
                    mergedItem.totalCost += c.totalCost;
                    mergedItem.totalShipping += c.totalShipping;
                    mergedItem.returnShipping += c.returnShipping;
                    mergedItem.freight += c.freight;
                    mergedItem.adSpend += c.adSpend;
                    foundAny = true;
                    return false;
                }
                return true;
            });
            
            if (foundAny) {
                countryList.push(mergedItem);
            }
        });

        // Sort by revenue
        countryList.sort((a, b) => b.totalRevenue - a.totalRevenue);

        if (countryList.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="12" style="text-align: center; color: var(--text-muted); padding: 2rem;">
                        No hay datos en el período seleccionado.
                    </td>
                </tr>`;
            return;
        }

        let totalRow = {
            orderCount: 0, totalDelivered: 0, totalReturned: 0, deliveredUnits: 0, unitsSold: 0, totalRevenue: 0,
            totalCost: 0, totalShipping: 0, returnShipping: 0, totalFreight: 0, totalAdSpend: 0
        };

        tbody.innerHTML = countryList.map(row => {
            totalRow.orderCount += row.orderCount;
            totalRow.totalDelivered += row.totalDelivered;
            totalRow.totalReturned += row.totalReturned;
            totalRow.deliveredUnits += (row.deliveredUnits || 0);
            totalRow.unitsSold += row.unitsSold;
            totalRow.totalRevenue += row.totalRevenue;
            totalRow.totalCost += row.totalCost;
            totalRow.totalShipping += row.totalShipping;
            totalRow.returnShipping += row.returnShipping;
            totalRow.totalFreight += row.freight;
            totalRow.totalAdSpend += row.adSpend;
            
            const gross = row.totalRevenue - row.totalCost - row.totalShipping - row.returnShipping - row.freight - row.adSpend;
            const margin = row.totalRevenue > 0 ? ((gross / row.totalRevenue) * 100).toFixed(1) : '0.0';
            const returnRate = (row.totalDelivered + row.totalReturned) > 0 ? ((row.totalReturned / (row.totalDelivered + row.totalReturned)) * 100).toFixed(1) : '0.0';
            
            const costPct = row.totalRevenue > 0 ? ((row.totalCost / row.totalRevenue) * 100).toFixed(1) : '0.0';
            const shippingPct = row.totalRevenue > 0 ? ((row.totalShipping / row.totalRevenue) * 100).toFixed(1) : '0.0';
            const returnShippingPct = row.totalRevenue > 0 ? ((row.returnShipping / row.totalRevenue) * 100).toFixed(1) : '0.0';
            const adPct = row.totalRevenue > 0 ? ((row.adSpend / row.totalRevenue) * 100).toFixed(1) : '0.0';

            const escapedId = row.id.replace(/"/g, '&quot;');
            
            let actionHtml = `<div style="display: flex; align-items: center; justify-content: flex-end; gap: 0.5rem;">
                <button class="btn btn-icon btn-sm" style="color: #8b5cf6; background: rgba(139, 92, 246, 0.1); border: none; margin-right: 2px;" onclick="IncomeStatementModule.openLinkCampaignsForProduct('${escapedId}')" title="Vincular Campañas">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path>
                        <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path>
                    </svg>
                </button>
                <button class="btn btn-icon btn-sm is-detail-btn" onclick="IncomeStatementModule.showCountryDetail('${escapedId}', ${row.isVisualGroup ? 'true' : 'false'}, ${row.groupId !== undefined ? row.groupId : 'null'})" title="Ver detalle de ${row.name}">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <circle cx="11" cy="11" r="8"></circle>
                        <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                    </svg>
                </button>`;

            if (row.isVisualGroup) {
                actionHtml += `<button class="btn btn-icon btn-sm" style="color: #f59e0b; background: rgba(245, 158, 11, 0.1); border: none;" onclick="IncomeStatementModule.editVisualGroupNameCountry(${row.groupId})" title="Editar nombre del grupo">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                    </svg>
                </button>`;
                actionHtml += `
                <button class="btn btn-icon btn-sm btn-danger-light" onclick="IncomeStatementModule.ungroupVisualGroupCountry(${row.groupId})" title="Desagrupar">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <line x1="18" y1="6" x2="6" y2="18"></line>
                        <line x1="6" y1="6" x2="18" y2="18"></line>
                    </svg>
                </button>`;
            }
            actionHtml += `</div>`;

            let nameHtml = `<strong>${row.name}</strong>`;
            if (row.isVisualGroup) {
                nameHtml = `<div style="display:flex; align-items:center; gap:0.5rem;">
                                <strong>${row.name}</strong>
                                <span style="font-size: 0.65rem; background: rgba(16, 185, 129, 0.15); color: #10b981; padding: 2px 6px; border-radius: 12px; font-weight: 600;">Grupo</span>
                            </div>`;
            }

            return `
                <tr>
                    <td style="text-align: center;">
                        ${!row.isVisualGroup ? `<input type="checkbox" class="unified-country-checkbox" value="${escapedId}" onchange="IncomeStatementModule.updateSelectedUnifiedCountriesCount()">` : ''}
                    </td>
                    <td>
                        <div style="display: flex; align-items: center; gap: 0.5rem;">
                            ${row.country && !row.isVisualGroup ? `<span class="country-flag">${this.getCountryFlag(row.country)}</span>` : ''}
                            ${nameHtml}
                        </div>
                    </td>
                    <td style="text-align: right; font-weight: 600;">${row.orderCount}</td>
                    <td style="text-align: right; font-weight: 600; color: var(--success);">${row.totalDelivered || 0}</td>
                    <td style="text-align: right; font-weight: 600; color: var(--danger);">${row.totalReturned || 0}</td>
                    <td style="text-align: right; font-weight: 600; color: var(--success);">${row.deliveredUnits || 0}</td>
                    <td style="text-align: center;">
                        <span class="badge" style="background: rgba(244, 63, 94, 0.1); color: #f43f5e; font-weight: 600;">${returnRate}%</span>
                    </td>
                    <td style="text-align: right;">${row.unitsSold || '-'}</td>
                    <td style="text-align: right; font-weight: 600; color: var(--success);">${this.formatCurrency(row.totalRevenue)}</td>
                    <td style="text-align: right; color: var(--danger);">
                        <div>${this.formatCurrency(row.totalCost)}</div>
                        <div style="font-size: 0.72rem; opacity: 0.8; font-weight: 500;">${costPct}%</div>
                    </td>
                    <td style="text-align: right; color: var(--danger);">
                        <div>${this.formatCurrency(row.totalShipping + row.freight)}</div>
                        <div style="font-size: 0.72rem; opacity: 0.8; font-weight: 500;">${shippingPct}%</div>
                    </td>
                    <td style="text-align: right; color: var(--danger);">
                        <div>${this.formatCurrency(row.returnShipping)}</div>
                        <div style="font-size: 0.72rem; opacity: 0.8; font-weight: 500;">${returnShippingPct}%</div>
                    </td>
                    <td style="text-align: right; color: var(--danger);">
                        <div>${this.formatCurrency(row.adSpend)}</div>
                        <div style="font-size: 0.72rem; opacity: 0.8; font-weight: 500;">${adPct}%</div>
                    </td>
                    <td style="text-align: right; font-weight: 600; color: ${gross >= 0 ? 'var(--success)' : 'var(--danger)'};">
                        ${this.formatCurrency(gross)}
                    </td>
                    <td style="text-align: center;">
                        <span class="is-margin-badge ${parseFloat(margin) >= 30 ? 'good' : parseFloat(margin) >= 15 ? 'warning' : 'bad'}">${margin}%</span>
                    </td>
                    <td style="text-align: center;">
                        ${actionHtml}
                    </td>
                </tr>`;
        }).join('');

        // 3. Add Totals Row
        const totalGross = totalRow.totalRevenue - totalRow.totalCost - totalRow.totalShipping - totalRow.returnShipping - totalRow.totalFreight - totalRow.totalAdSpend;
        const totalMargin = totalRow.totalRevenue > 0 ? ((totalGross / totalRow.totalRevenue) * 100).toFixed(1) : '0.0';
        const totalReturnRate = (totalRow.totalDelivered + totalRow.totalReturned) > 0 ? ((totalRow.totalReturned / (totalRow.totalDelivered + totalRow.totalReturned)) * 100).toFixed(1) : '0.0';

        tbody.innerHTML += `
            <tr class="is-total-row">
                <td></td>
                <td style="font-weight: 600;">TOTAL GENERAL</td>
                <td style="text-align: right; font-weight: 600;">${totalRow.orderCount}</td>
                <td style="text-align: right; font-weight: 600; color: var(--success);">${totalRow.totalDelivered}</td>
                <td style="text-align: right; font-weight: 600; color: var(--danger);">${totalRow.totalReturned}</td>
                <td style="text-align: right; font-weight: 600; color: var(--success);">${totalRow.deliveredUnits}</td>
                <td style="text-align: center;">
                    <span class="badge" style="background: rgba(244, 63, 94, 0.15); color: #f43f5e; font-weight: 600;">${totalReturnRate}%</span>
                </td>
                <td style="text-align: right; font-weight: 600;">${totalRow.unitsSold}</td>
                <td style="text-align: right; font-weight: 700; color: var(--success);">${this.formatCurrency(totalRow.totalRevenue)}</td>
                <td style="text-align: right; font-weight: 600; color: var(--danger);">${this.formatCurrency(totalRow.totalCost)}</td>
                <td style="text-align: right; font-weight: 600; color: var(--danger);">${this.formatCurrency(totalRow.totalShipping + totalRow.totalFreight)}</td>
                <td style="text-align: right; font-weight: 600; color: var(--danger);">${this.formatCurrency(totalRow.returnShipping)}</td>
                <td style="text-align: right; font-weight: 600; color: var(--danger);">${this.formatCurrency(totalRow.totalAdSpend)}</td>
                <td style="text-align: right; font-weight: 700; color: ${totalGross >= 0 ? 'var(--success)' : 'var(--danger)'};">${this.formatCurrency(totalGross)}</td>
                <td style="text-align: center; font-weight: 700;">${totalMargin}%</td>
                <td></td>
            </tr>`;
    },

    renderAdExpensesTable() {
        const tbody = document.getElementById('isAdExpensesTable');
        // Comenzar con TODOS los gastos para que los filtros locales puedan sobrescribir los globales
        let expenses = this.adExpenses;

        // Obtain specific filters for ads and global filters as fallbacks
        const adCountry = document.getElementById('adFilterCountry')?.value || '';
        const adDateFrom = document.getElementById('adFilterDateFrom')?.value || '';
        const adDateTo = document.getElementById('adFilterDateTo')?.value || '';
        const adSearch = (document.getElementById('adFilterSearch')?.value || '').toLowerCase().trim();

        // 1. Filtrar por Pais (Local override de Global)
        if (adCountry) {
            expenses = expenses.filter(e => e.country === adCountry);
        } else {
            expenses = expenses.filter(e => this.matchesCountryFilter(e.country));
        }

        // 2. Filtrar por Fecha (Local override de Global)
        const filterDateFrom = adDateFrom || this.filters.dateFrom;
        const filterDateTo = adDateTo || this.filters.dateTo;

        if (filterDateFrom) {
            expenses = expenses.filter(e => {
                if (!e.date_start) return false;
                const itemDate = new Date(e.date_start).toISOString().split('T')[0];
                return itemDate >= filterDateFrom;
            });
        }
        if (filterDateTo) {
            expenses = expenses.filter(e => {
                if (!e.date_start) return false;
                const itemDate = new Date(e.date_start).toISOString().split('T')[0];
                return itemDate <= filterDateTo;
            });
        }

        // 3. Search
        if (adSearch) {
            expenses = expenses.filter(e =>
                (e.campaign_name || '').toLowerCase().includes(adSearch) ||
                (e.ad_set_name || '').toLowerCase().includes(adSearch) ||
                (e.ad_name || '').toLowerCase().includes(adSearch)
            );
        }

        // Update filter summary
        const summaryEl = document.getElementById('adFilterSummary');
        if (summaryEl) {
            const totalSpent = expenses.reduce((s, e) => s + parseFloat(e.amount_spent || 0), 0);
            const totalAll = this.getFilteredAdExpenses().length;
            if (expenses.length !== totalAll) {
                summaryEl.innerHTML = `Mostrando <strong>${expenses.length}</strong> de ${totalAll} registros · Gasto filtrado: <strong style="color:var(--danger)">$${totalSpent.toFixed(2)}</strong>`;
            } else {
                summaryEl.innerHTML = `${expenses.length} registros · Gasto total: <strong style="color:var(--danger)">$${totalSpent.toFixed(2)}</strong>`;
            }
        }

        if (expenses.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="13" style="text-align: center; color: var(--text-muted); padding: 2rem;">
                        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1" style="margin-bottom: 0.5rem; opacity: 0.3;">
                            <circle cx="12" cy="12" r="10"></circle>
                            <path d="M8 12h8"></path>
                        </svg>
                        <br>No hay gastos publicitarios. Importa un reporte para comenzar.
                    </td>
                </tr>`;
            return;
        }

        tbody.innerHTML = expenses.map(exp => {
            const costPerPurchase = exp.purchases > 0 ? (exp.amount_spent / exp.purchases) : 0;
            const ctr = exp.impressions > 0 ? ((exp.clicks / exp.impressions) * 100) : 0;
            const sourceIcon = exp.source === 'TikTok' ? '🎵' : '🔵';
            const sourceName = exp.source || 'Facebook';

            let productCell = '';
            if (exp.product_name) {
                productCell = `
                    <div class="product-linked-badge">
                        <span title="${exp.product_name}">${exp.product_name}</span>
                        <button onclick="IncomeStatementModule.unlinkProductFromAdExpense('${exp.id}')" title="Desvincular">✕</button>
                    </div>`;
            } else {
                productCell = `
                    <div class="predictive-search-container" id="adProdSearchContainer_${exp.id}">
                        <input type="text" class="predictive-search-input" placeholder="🔍 Vincular producto..." 
                            onfocus="IncomeStatementModule.showProductPredictiveList('${exp.id}', this.value)" 
                            oninput="IncomeStatementModule.showProductPredictiveList('${exp.id}', this.value)">
                        <div class="predictive-search-results" id="adProdSearchResults_${exp.id}" style="display:none;"></div>
                    </div>`;
            }

            return `
                <tr>
                    <td style="text-align: center;">
                        <input type="checkbox" class="ad-expense-checkbox" value="${exp.id}" onchange="IncomeStatementModule.updateSelectedAdExpensesCount()" style="cursor: pointer;">
                    </td>
                    <td>
                        <span class="country-flag">${this.getCountryFlag(exp.country)}</span>
                        ${exp.country}
                    </td>
                    <td>
                        <div style="display: flex; align-items: center; gap: 0.25rem;">
                            <span title="${sourceName}">${sourceIcon}</span>
                            <span style="font-size: 0.8rem; color: var(--text-muted);">${sourceName}</span>
                        </div>
                    </td>
                    <td style="font-size: 0.8rem; max-width: 180px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${exp.campaign_name || ''}">${exp.campaign_name || '-'}</td>
                    <td>${productCell}</td>
                    <td style="text-align: right; font-weight: 600; color: var(--danger);">$${parseFloat(exp.amount_spent).toFixed(2)}</td>
                    <td style="text-align: right;">${(exp.impressions || 0).toLocaleString()}</td>
                    <td style="text-align: right;">${exp.clicks || 0}</td>
                    <td style="text-align: center;">${ctr.toFixed(2)}%</td>
                    <td style="text-align: center; font-weight: 600;">${exp.purchases || 0}</td>
                    <td style="text-align: right;">
                        ${exp.purchases > 0 ? `$${costPerPurchase.toFixed(2)}` : '-'}
                    </td>
                    <td style="font-size: 0.8rem; color: var(--text-muted);">${this.formatDate(exp.date_start)}</td>
                    <td style="white-space: nowrap;">
                        <button class="btn btn-icon btn-sm" style="color: var(--primary); background: rgba(59, 130, 246, 0.1); border: none; margin-right: 4px;" onclick="IncomeStatementModule.editAdExpense('${exp.id}')" title="Editar">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                <path d="M12 20h9"></path>
                                <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path>
                            </svg>
                        </button>
                        <button class="btn btn-icon btn-sm btn-danger-light" onclick="IncomeStatementModule.deleteAdExpense('${exp.id}')" title="Eliminar">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <polyline points="3 6 5 6 21 6"></polyline>
                                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                            </svg>
                        </button>
                    </td>
                </tr>`;
        }).join('');
    },

    // Predictive Search for Ad Expense Product Linking
    async linkProductToAdExpense(adExpenseId, productId, productName) {
        const exp = this.adExpenses.find(e => e.id === adExpenseId);
        if (exp) {
            exp.product_id = productId;
            exp.product_name = productName;
        }
        try {
            await supabaseClient.from('ad_expenses').update({ product_id: productId, product_name: productName }).eq('id', adExpenseId);
            Utils.showToast('Producto vinculado a la campaña', 'success');
        } catch (err) {
            console.warn('Nota: Guardado localmente el producto vinculado en la campaña.');
        }
        this.renderAdExpensesTable();
        this.renderProductProfitTable();
    },

    async unlinkProductFromAdExpense(adExpenseId) {
        const exp = this.adExpenses.find(e => e.id === adExpenseId);
        if (exp) {
            exp.product_id = null;
            exp.product_name = null;
        }
        try {
            await supabaseClient.from('ad_expenses').update({ product_id: null, product_name: null }).eq('id', adExpenseId);
            Utils.showToast('Producto desvinculado', 'info');
        } catch (err) {
            console.warn('Producto desvinculado localmente');
        }
        this.renderAdExpensesTable();
        this.renderProductProfitTable();
    },

    async showProductPredictiveList(adExpenseId, query) {
        const resultsEl = document.getElementById(`adProdSearchResults_${adExpenseId}`);
        if (!resultsEl) return;

        let products = Database.products || [];
        if (products.length === 0 && typeof Database.getProducts === 'function') {
            products = await Database.getProducts();
        }

        const q = (query || '').toLowerCase().trim();
        const filtered = products.filter(p => 
            (p.name || '').toLowerCase().includes(q) || 
            (p.sku || p.code || '').toLowerCase().includes(q)
        ).slice(0, 8);

        if (filtered.length === 0) {
            resultsEl.innerHTML = `<div style="padding: 0.5rem; font-size:0.75rem; color:var(--text-muted); text-align:center;">Sin coincidencias</div>`;
        } else {
            resultsEl.innerHTML = filtered.map(p => {
                const escapedName = (p.name || '').replace(/'/g, "\\'");
                return `
                    <div class="predictive-search-item" onclick="IncomeStatementModule.linkProductToAdExpense('${adExpenseId}', '${p.id}', '${escapedName}')">
                        <span style="font-weight:500;">${p.name}</span>
                        <span class="predictive-search-sku">${p.sku || p.code || ''}</span>
                    </div>`;
            }).join('');
        }
        resultsEl.style.display = 'block';
    },

    closeProductPredictiveList(adExpenseId) {
        const resultsEl = document.getElementById(`adProdSearchResults_${adExpenseId}`);
        if (resultsEl) resultsEl.style.display = 'none';
    },

    renderOperationalExpensesTable() {
        const tbody = document.getElementById('isOpExpensesTable');
        if (!tbody) return;

        const expenses = this.getFilteredOperationalExpenses();

        // Update KPIs
        let totalSum = 0;
        let totalOrders = 0;
        
        // Sum expenses
        expenses.forEach(exp => {
            totalSum += parseFloat(exp.amount || 0);
        });
        
        // Get total delivered orders for the current filter
        const dropiSales = this.getFilteredSales();
        const extSales = this.getFilteredExternalSales();
        const extDelivered = extSales.reduce((sum, s) => sum + parseInt(s.delivered || 0), 0);
        totalOrders = dropiSales.length + extDelivered;
        
        // Calculate indirect cost
        const indirectCost = totalOrders > 0 ? (totalSum / totalOrders) : 0;
        
        // Update DOM
        const elSum = document.getElementById('opExpensesTotalSum');
        const elOrders = document.getElementById('opExpensesTotalOrders');
        const elIndirect = document.getElementById('opExpensesIndirectCost');
        
        if (elSum) elSum.textContent = this.formatCurrency(totalSum);
        if (elOrders) elOrders.textContent = totalOrders;
        if (elIndirect) elIndirect.textContent = this.formatCurrency(indirectCost);

        if (expenses.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="7" style="text-align: center; color: var(--text-muted); padding: 2rem;">
                        No hay gastos operativos registrados en este período.
                    </td>
                </tr>`;
            return;
        }

        tbody.innerHTML = expenses.map(exp => {
            return `
                <tr>
                    <td>
                        <span class="country-flag">${this.getCountryFlag(exp.country)}</span>
                        ${exp.country}
                    </td>
                    <td><span class="is-category-badge">${exp.category}</span></td>
                    <td style="max-width: 200px; overflow: hidden; text-overflow: ellipsis;">${exp.description}</td>
                    <td style="text-align: right; font-weight: 600; color: var(--danger);">${this.formatCurrency(exp.amount)}</td>
                    <td style="font-size: 0.85rem;">${this.formatDate(exp.expense_date)}</td>
                    <td style="font-size: 0.8rem; color: var(--text-muted);">${exp.payment_method || '-'}</td>
                    <td style="white-space: nowrap; text-align: right;">
                        <button class="btn btn-icon btn-sm" style="color: var(--primary); background: rgba(59, 130, 246, 0.1); border: none; margin-right: 4px;" onclick="IncomeStatementModule.editOperationalExpense('${exp.id}')" title="Editar gasto">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                <path d="M12 20h9"></path>
                                <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path>
                            </svg>
                        </button>
                        <button class="btn btn-icon btn-sm" style="color: var(--primary); background: rgba(59, 130, 246, 0.1); border: none; margin-right: 4px;" onclick="IncomeStatementModule.duplicateOperationalExpense('${exp.id}')" title="Duplicar gasto">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                            </svg>
                        </button>
                        <button class="btn btn-icon btn-sm btn-danger-light" onclick="IncomeStatementModule.deleteOperationalExpense('${exp.id}')" title="Eliminar">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <polyline points="3 6 5 6 21 6"></polyline>
                                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                            </svg>
                        </button>
                    </td>
                </tr>`;
        }).join('');
    },

    // ========================================
    // EXTERNAL SALES
    // ========================================
    getFilteredExternalSales() {
        let sales = this.filterByDateAndCountry(
            this.externalSales,
            'sale_date',
            (sale) => sale.country === 'Todos' ? null : sale.country
        );

        if (this.productMultiSelect && !this.productMultiSelect.isAllSelected()) {
            sales = sales.filter(s => {
                const rawName = s.product_name || s.description || '';
                return this.matchesProductFilter(rawName);
            });
        }

        return sales;
    },

    getExternalSalesSummary() {
        const sales = this.getFilteredExternalSales();
        let totalRevenue = 0, totalCost = 0, totalShipping = 0, totalReturnShipping = 0, totalDelivered = 0, totalUnits = 0;
        sales.forEach(s => {
            totalRevenue += parseFloat(s.revenue || 0);
            totalCost += parseFloat(s.product_cost || 0);
            totalShipping += parseFloat(s.shipping_cost || 0);
            totalReturnShipping += parseFloat(s.return_shipping_cost || 0);
            const del = parseInt(s.delivered || 0);
            const ret = parseInt(s.returned || 0);
            totalDelivered += del;
            totalUnits += parseInt(s.units || (del + ret) || 0);
        });
        return { totalRevenue, totalCost, totalShipping, totalReturnShipping, totalDelivered, totalUnits };
    },

    isExternalSalesExpanded: false,

    toggleExpandExternalSales() {
        this.isExternalSalesExpanded = !this.isExternalSalesExpanded;
        this.renderExternalSalesTable();
    },

    toggleSelectAllExternalSales(checked) {
        const checkboxes = document.querySelectorAll('.ext-sale-checkbox');
        checkboxes.forEach(cb => cb.checked = checked);
        this.updateSelectedExtSalesCount();
    },

    updateSelectedExtSalesCount() {
        const checked = document.querySelectorAll('.ext-sale-checkbox:checked').length;
        // Update delete selected button
        const btnDeleteSelected = document.getElementById('btnDeleteSelectedExtSales');
        const countSpan = document.getElementById('selectedExtSalesCount');
        if (countSpan) countSpan.textContent = checked;
        if (btnDeleteSelected) btnDeleteSelected.style.display = checked > 0 ? 'inline-flex' : 'none';
        // Update group toolbar visibility and button
        const groupToolbar = document.getElementById('extSalesGroupToolbar');
        const groupBtn = document.getElementById('btnGroupExtSales');
        const groupCount = document.getElementById('groupExtSalesCount');
        if (groupToolbar) groupToolbar.style.display = checked > 0 ? 'flex' : 'none';
        if (groupCount) groupCount.textContent = checked;
        if (groupBtn) groupBtn.disabled = (checked < 2);
    },

    getRecordFingerprint(item) {
        if (!item) return '';
        const desc = String(item.description || item.product_name || '').trim().toLowerCase();
        const date = String(item.sale_date || '').split('T')[0];
        const rev = parseFloat(item.revenue || 0).toFixed(2);
        const cost = parseFloat(item.product_cost || 0).toFixed(2);
        const ship = parseFloat(item.shipping_cost || 0).toFixed(2);
        const del = parseInt(item.delivered || 0);
        const ret = parseInt(item.returned || 0);
        return `${desc}|${date}|${rev}|${cost}|${ship}|${del}|${ret}`;
    },

    deduplicateExternalSales(salesList) {
        const seen = new Set();
        const result = [];
        for (const item of (salesList || [])) {
            if (!item) continue;
            const fp = this.getRecordFingerprint(item);
            if (!seen.has(fp)) {
                seen.add(fp);
                result.push(item);
            }
        }
        return result;
    },

    async deleteSelectedExternalSales() {
        const checked = Array.from(document.querySelectorAll('.ext-sale-checkbox:checked')).map(cb => String(cb.value));
        if (checked.length === 0) return;

        if (!confirm(`¿Estás seguro de eliminar los ${checked.length} registros seleccionados?`)) return;

        Utils.showToast(`Eliminando ${checked.length} registros...`, 'info');

        // Remove from memory immediately
        this.externalSales = this.externalSales.filter(s => !checked.includes(String(s.id)));
        this.saveExternalSalesToLocal();

        // Delete from Supabase in background with batching (chunks of 50 to prevent URL length limits)
        try {
            for (let i = 0; i < checked.length; i += 50) {
                const batch = checked.slice(i, i + 50);
                await supabaseClient.from('external_sales').delete().in('id', batch);
            }
        } catch (err) {
            console.warn('Alerta al eliminar en Supabase:', err);
        }

        Utils.showToast(`Se eliminaron ${checked.length} registros`, 'success');

        this.renderReportsManagerModal();
        this.renderSummaryCards();
        this.renderSalesTable();
        this.renderConsolidatedSalesTable();
        this.renderAdExpensesTable();
        this.renderOperationalExpensesTable();
        this.renderExternalSalesTable();
        this.renderProductProfitTable();
        this.renderPLStatement();
    },

    async deleteAllExternalSales() {
        const count = (this.externalSales || []).length;
        if (count === 0) {
            Utils.showToast('No hay registros de ventas externas para vaciar.', 'warning');
            return;
        }

        if (!confirm(`⚠️ ¿Estás seguro de ELIMINAR TODOS los ${count} registros de ventas externas? Esta acción no se puede deshacer.`)) return;

        Utils.showToast('Vaciando todos los registros...', 'info');

        const idsToDelete = this.externalSales.map(s => String(s.id));

        // 1. Clear memory & localStorage immediately
        this.externalSales = [];
        this.saveExternalSalesToLocal();
        this.isExternalSalesExpanded = false;

        // 2. Clear Supabase safely using neq or batching to prevent HTTP 400 URL length limit
        try {
            const { error } = await supabaseClient.from('external_sales').delete().neq('id', '00000000-0000-0000-0000-000000000000');
            if (error) {
                for (let i = 0; i < idsToDelete.length; i += 50) {
                    const chunk = idsToDelete.slice(i, i + 50);
                    await supabaseClient.from('external_sales').delete().in('id', chunk);
                }
            }
        } catch (err) {
            console.warn('Alerta al vaciar en Supabase:', err);
            try {
                for (let i = 0; i < idsToDelete.length; i += 50) {
                    const chunk = idsToDelete.slice(i, i + 50);
                    await supabaseClient.from('external_sales').delete().in('id', chunk);
                }
            } catch (e2) {
                console.warn('Error en fallback chunked delete:', e2);
            }
        }

        Utils.showToast(`Se eliminaron todos los registros (${count})`, 'success');

        this.renderReportsManagerModal();
        this.renderSummaryCards();
        this.renderSalesTable();
        this.renderConsolidatedSalesTable();
        this.renderAdExpensesTable();
        this.renderOperationalExpensesTable();
        this.renderExternalSalesTable();
        this.renderProductProfitTable();
        this.renderPLStatement();
    },    // --- UTILIDAD ESCAPE HTML ---
    escapeHtml(str) {
        if (!str) return '';
        if (typeof Utils !== 'undefined' && typeof Utils.escapeHtml === 'function') {
            return Utils.escapeHtml(str);
        }
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    },

    generateUUID() {
        if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
            try {
                return crypto.randomUUID();
            } catch (e) {}
        }
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
            const r = Math.random() * 16 | 0;
            const v = c === 'x' ? r : (r & 0x3 | 0x8);
            return v.toString(16);
        });
    },

    // --- GESTOR DE REPORTES SUBIDOS ---
    openReportsManagerModal() {
        const modal = document.getElementById('modalReportsManager');
        if (!modal) return;
        this.renderReportsManagerModal();
        modal.classList.add('active');
        modal.style.setProperty('display', 'flex', 'important');
        modal.style.zIndex = '10005';
        document.body.style.overflow = 'hidden';
    },

    closeReportsManagerModal() {
        const modal = document.getElementById('modalReportsManager');
        if (!modal) return;
        modal.classList.remove('active');
        modal.style.display = 'none';
        document.body.style.overflow = '';
    },

    renderReportsManagerModal() {
        const listEl = document.getElementById('reportsManagerList');
        if (!listEl) return;

        const sales = this.externalSales || [];
        if (sales.length === 0) {
            listEl.innerHTML = `
                <div style="text-align: center; padding: 2rem 1rem; background: rgba(255,255,255,0.02); border: 1px dashed var(--border); border-radius: var(--radius-md);">
                    <div style="font-size: 2rem; margin-bottom: 0.5rem;">📭</div>
                    <div style="font-weight: 500; color: var(--text-muted);">No hay reportes subidos actualmente</div>
                    <div style="font-size: 0.8rem; color: var(--text-muted); margin-top: 0.25rem;">Los reportes que subas (ej: Ecuador Hoko, Ecuador Domi, Colombia Domi, Venezuela Domi) aparecerán aquí.</div>
                </div>`;
            return;
        }

        // Group sales by country/report name
        const groups = {};
        sales.forEach(s => {
            const name = s.country || 'Sin Nombre';
            if (!groups[name]) {
                groups[name] = {
                    name: name,
                    count: 0,
                    totalRevenue: 0,
                    minDate: s.sale_date,
                    maxDate: s.sale_date
                };
            }
            groups[name].count++;
            groups[name].totalRevenue += parseFloat(s.revenue || 0);
            if (s.sale_date && s.sale_date < groups[name].minDate) groups[name].minDate = s.sale_date;
            if (s.sale_date && s.sale_date > groups[name].maxDate) groups[name].maxDate = s.sale_date;
        });

        const reportNames = Object.keys(groups).sort();

        listEl.innerHTML = reportNames.map(name => {
            const r = groups[name];
            const flag = this.getCountryFlag(name);
            const dateRange = (r.minDate && r.maxDate)
                ? (r.minDate === r.maxDate ? r.minDate : `${r.minDate} al ${r.maxDate}`)
                : 'Sin fecha';
            const escapedName = this.escapeHtml(name).replace(/'/g, "\\'");

            return `
                <div style="display: flex; align-items: center; justify-content: space-between; padding: 0.85rem 1rem; background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius-md); gap: 1rem;">
                    <div style="display: flex; align-items: center; gap: 0.75rem; flex: 1; min-width: 0;">
                        <span style="font-size: 1.5rem; line-height: 1;">${flag}</span>
                        <div style="min-width: 0; flex: 1;">
                            <div style="font-weight: 600; font-size: 0.95rem; color: var(--text-primary); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
                                ${this.escapeHtml(name)}
                            </div>
                            <div style="font-size: 0.8rem; color: var(--text-muted); display: flex; gap: 0.75rem; flex-wrap: wrap; margin-top: 0.2rem;">
                                <span>📄 <strong>${r.count}</strong> registros</span>
                                <span>💵 Total: <strong style="color: var(--success);">$${r.totalRevenue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong></span>
                                <span>📅 ${dateRange}</span>
                            </div>
                        </div>
                    </div>
                    <button type="button" class="btn btn-sm btn-danger-light" style="white-space: nowrap; font-size: 0.8rem; padding: 0.4rem 0.75rem;" onclick="IncomeStatementModule.deleteReportByName('${escapedName}')">
                        🗑️ Eliminar Reporte
                    </button>
                </div>`;
        }).join('');
    },

    async deleteReportByName(reportName) {
        const recordsToDelete = (this.externalSales || []).filter(s => s.country === reportName);
        const count = recordsToDelete.length;
        if (count === 0) {
            Utils.showToast(`No se encontraron registros para el reporte "${reportName}"`, 'warning');
            return;
        }

        if (!confirm(`⚠️ ¿Estás seguro de ELIMINAR todo el reporte "${reportName}"?\nSe eliminarán permanentemente los ${count} registros asociados.`)) {
            return;
        }

        Utils.showToast(`Eliminando reporte "${reportName}" (${count} registros)...`, 'info');

        // 1. Delete from memory immediately
        this.externalSales = (this.externalSales || []).filter(s => s.country !== reportName);
        this.saveExternalSalesToLocal();

        // 2. Delete from Supabase cleanly by country/report name
        try {
            const { error } = await supabaseClient
                .from('external_sales')
                .delete()
                .eq('country', reportName);
            if (error) console.warn('Alerta Supabase al eliminar reporte por país:', error);
        } catch (err) {
            console.warn('Error al eliminar reporte de Supabase:', err);
        }

        Utils.showToast(`Se eliminó el reporte "${reportName}" (${count} registros)`, 'success');

        // Re-render modal list and report UI
        this.renderReportsManagerModal();
        this.renderSummaryCards();
        this.renderSalesTable();
        this.renderConsolidatedSalesTable();
        this.renderAdExpensesTable();
        this.renderOperationalExpensesTable();
        this.renderExternalSalesTable();
        this.renderProductProfitTable();
        this.renderPLStatement();
    },

    // --- CONVERSIÓN DE MONEDA (COP -> USD CON TRM) PARA REPORTES EXTERNOS ---
    onExtCurrencyChange() {
        const sel = document.getElementById('extImportCurrency');
        const trmBox = document.getElementById('extTrmInputContainer');
        const info = document.getElementById('extConversionInfo');
        const isCop = sel && sel.value === 'COP';
        if (trmBox) trmBox.style.display = isCop ? 'inline-flex' : 'none';
        if (info) info.style.display = isCop ? 'block' : 'none';
    },

    onModalPreviewCurrencyChange() {
        const curr = document.getElementById('modalPreviewCurrency')?.value;
        const isCop = curr === 'COP';
        const box = document.getElementById('modalPreviewTrmBox');
        const badge = document.getElementById('modalPreviewTrmBadge');
        if (box) box.style.display = isCop ? 'inline-flex' : 'none';
        if (badge) badge.style.display = isCop ? 'block' : 'none';
        this.onModalPreviewTrmChange();
    },

    onModalPreviewTrmChange() {
        if (!this.pendingImportRecords || this.pendingImportRecords.length === 0) return;
        const curr = document.getElementById('modalPreviewCurrency')?.value || 'USD';
        const isCop = curr === 'COP';
        let trm = parseFloat(document.getElementById('modalPreviewTrmRate')?.value) || 4100;
        if (trm <= 0) trm = 4100;
        const divisor = isCop ? trm : 1;

        this.pendingImportRecords.forEach(r => {
            const rawRev = r.raw_revenue !== undefined ? r.raw_revenue : r.revenue;
            const rawCost = r.raw_product_cost !== undefined ? r.raw_product_cost : r.product_cost;
            const rawShip = r.raw_shipping_cost !== undefined ? r.raw_shipping_cost : r.shipping_cost;
            const rawRetShip = r.raw_return_shipping_cost !== undefined ? r.raw_return_shipping_cost : r.return_shipping_cost;

            r.revenue = rawRev / divisor;
            r.product_cost = rawCost / divisor;
            r.shipping_cost = rawShip / divisor;
            r.return_shipping_cost = rawRetShip / divisor;
        });

        this.pendingImportRecords.currency = curr;
        this.pendingImportRecords.trmRate = trm;

        // Re-render summary cards & table
        let totalRev = 0, totalCost = 0, totalShip = 0, totalReturnShip = 0, deliveredCount = 0, returnedCount = 0;
        this.pendingImportRecords.forEach(r => {
            totalRev += (r.revenue || 0);
            totalCost += (r.product_cost || 0);
            totalShip += (r.shipping_cost || 0);
            totalReturnShip += (r.return_shipping_cost || 0);
            deliveredCount += (r.delivered || 0);
            returnedCount += (r.returned || 0);
        });

        const cardsEl = document.getElementById('importPreviewSummaryCards');
        if (cardsEl) {
            const currencySubtitle = isCop ? `<div style="font-size: 0.72rem; opacity: 0.85; margin-top: 2px; color: var(--primary);">Convertido a TRM: ${Math.round(trm).toLocaleString('es-CO')} COP</div>` : '';
            cardsEl.innerHTML = `
                <div style="background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius-md); padding: 0.85rem 1rem;">
                    <div style="font-size: 0.75rem; color: var(--text-muted); text-transform: uppercase;">Total Facturado (USD)</div>
                    <div style="font-size: 1.4rem; font-weight: 700; color: var(--success);">${totalRev.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                    ${currencySubtitle}
                </div>
                <div style="background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius-md); padding: 0.85rem 1rem;">
                    <div style="font-size: 0.75rem; color: var(--text-muted); text-transform: uppercase;">Fletes Totales (USD)</div>
                    <div style="font-size: 1.4rem; font-weight: 700; color: var(--primary);">${(totalShip + totalReturnShip).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                    <div style="font-size: 0.72rem; color: var(--text-muted); margin-top: 2px;">Entrega: ${totalShip.toFixed(2)} | Dev: ${totalReturnShip.toFixed(2)}</div>
                </div>
                <div style="background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius-md); padding: 0.85rem 1rem;">
                    <div style="font-size: 0.75rem; color: var(--text-muted); text-transform: uppercase;">Efectividad de Entrega</div>
                    <div style="font-size: 1.4rem; font-weight: 700; color: var(--text);">${((deliveredCount / (deliveredCount + returnedCount || 1)) * 100).toFixed(1)}%</div>
                    <div style="font-size: 0.72rem; color: var(--text-muted); margin-top: 2px;">${deliveredCount} entregados | ${returnedCount} devueltos</div>
                </div>`;
        }

        this.renderImportPreviewTable(this.pendingImportRecords);
    },

    // --- PLEGADO / DESPLEGADO DE SECCIONES (CARDS) ---
    toggleCardCollapse(headerEl) {
        const card = headerEl.closest('.card');
        if (!card) return;
        const body = card.querySelector('.card-body');
        const footer = card.querySelector('.card-footer');
        const badge = headerEl.querySelector('.card-toggle-badge');
        
        if (!body) return;
        const isHidden = window.getComputedStyle(body).display === 'none';
        if (isHidden) {
            body.style.display = 'block';
            if (footer) footer.style.display = 'block';
            if (badge) badge.innerHTML = '🔼 Plegar';
        } else {
            body.style.display = 'none';
            if (footer) footer.style.display = 'none';
            if (badge) badge.innerHTML = '🔽 Desplegar';
        }
    },

    expandAllCards() {
        const container = document.getElementById('section-income-statement');
        if (!container) return;
        const cards = container.querySelectorAll('.card');
        cards.forEach(card => {
            const body = card.querySelector('.card-body');
            const footer = card.querySelector('.card-footer');
            const badge = card.querySelector('.card-toggle-badge');
            if (body) body.style.display = 'block';
            if (footer) footer.style.display = 'block';
            if (badge) badge.innerHTML = '🔼 Plegar';
        });
    },

    collapseAllCards() {
        const container = document.getElementById('section-income-statement');
        if (!container) return;
        const cards = container.querySelectorAll('.card');
        cards.forEach(card => {
            const body = card.querySelector('.card-body');
            const footer = card.querySelector('.card-footer');
            const badge = card.querySelector('.card-toggle-badge');
            if (body) body.style.display = 'none';
            if (footer) footer.style.display = 'none';
            if (badge) badge.innerHTML = '🔽 Desplegar';
        });
    },

    async manualGroupExternalSales() {
        const checkedBoxes = document.querySelectorAll('.ext-sale-checkbox:checked');
        if (checkedBoxes.length < 2) {
            Utils.showToast('Selecciona al menos 2 registros para agrupar.', 'warning');
            return;
        }

        const idsToMerge = Array.from(checkedBoxes).map(cb => cb.value);
        const recordsToMerge = this.externalSales.filter(s => idsToMerge.includes(String(s.id)));

        if (recordsToMerge.length < 2) return;

        const mergedNames = [...new Set(recordsToMerge.map(r => r.description))];
        const defaultName = mergedNames.length <= 3 ? mergedNames.join(' + ') : `${mergedNames[0]} (+${mergedNames.length - 1} más)`;
        
        const groupName = prompt('Nombre del grupo fusionado:', defaultName);
        if (!groupName) return;

        // Create the merged record
        const merged = {
            id: this.generateUUID(),
            country: recordsToMerge[0].country,
            sale_date: recordsToMerge[0].sale_date,
            description: groupName.trim(),
            revenue: 0,
            product_cost: 0,
            shipping_cost: 0,
            return_shipping_cost: 0,
            delivered: 0,
            returned: 0,
            delivered_units: 0,
            returned_units: 0
        };

        for (const src of recordsToMerge) {
            merged.revenue += (parseFloat(src.revenue) || 0);
            merged.product_cost += (parseFloat(src.product_cost) || 0);
            merged.shipping_cost += (parseFloat(src.shipping_cost) || 0);
            merged.return_shipping_cost += (parseFloat(src.return_shipping_cost) || 0);
            merged.delivered += (parseInt(src.delivered) || 0);
            merged.returned += (parseInt(src.returned) || 0);
            merged.delivered_units += parseInt(src.delivered_units !== undefined && src.delivered_units !== null ? src.delivered_units : (src.delivered || 0));
            merged.returned_units += parseInt(src.returned_units !== undefined && src.returned_units !== null ? src.returned_units : (src.returned || 0));
        }

        // Show loading toast
        Utils.showToast('Agrupando registros...', 'info');

        // Update memory immediately: remove the old ones, add the merged one
        this.externalSales = this.externalSales.filter(s => !idsToMerge.includes(String(s.id)));
        this.externalSales.unshift(merged);
        this.saveExternalSalesToLocal();

        // Update UI immediately
        const selectAllCb = document.getElementById('selectAllExtSales');
        if (selectAllCb) selectAllCb.checked = false;
        this.renderExternalSalesTable();
        this.renderSummaryCards();
        this.renderProductProfitTable();
        this.renderPLStatement();
        this.updateSelectedExtSalesCount();

        // Update Supabase in background
        try {
            // Delete old records
            await supabaseClient.from('external_sales').delete().in('id', idsToMerge);
            // Insert new merged record
            await supabaseClient.from('external_sales').insert(merged);
            Utils.showToast(`Se agruparon ${recordsToMerge.length} registros en "${merged.description}"`, 'success');
        } catch (e) {
            console.warn('Error syncing group to Supabase', e);
        }
    },

    getFilteredExternalSalesForTable() {
        let sales = this.getFilteredExternalSales();

        // 1. Filtro local de País / Reporte
        if (this.extSalesFilters.country) {
            const cFilter = this.extSalesFilters.country.trim().toLowerCase();
            sales = sales.filter(s => (s.country || '').trim().toLowerCase() === cFilter);
        }

        // 2. Filtro local de Producto / Referencia
        if (this.extSalesFilters.product) {
            const pFilter = this.extSalesFilters.product.trim().toLowerCase();
            sales = sales.filter(s => {
                const prod = (s.description || s.product_name || '').trim().toLowerCase();
                return prod === pFilter;
            });
        }

        // 3. Buscador de texto
        if (this.extSalesFilters.search) {
            const q = this.extSalesFilters.search.trim().toLowerCase();
            sales = sales.filter(s => {
                const desc = (s.description || s.product_name || '').toLowerCase();
                const country = (s.country || '').toLowerCase();
                const date = (s.sale_date || '').toLowerCase();
                return desc.includes(q) || country.includes(q) || date.includes(q);
            });
        }

        return sales;
    },

    applyExternalSalesLocalFilters() {
        this.extSalesFilters.country = document.getElementById('extFilterCountry')?.value || '';
        this.extSalesFilters.product = document.getElementById('extFilterProduct')?.value || '';
        this.extSalesFilters.search = document.getElementById('extFilterSearch')?.value || '';
        this.renderExternalSalesTable();
    },

    clearExternalSalesLocalFilters() {
        this.extSalesFilters = { country: '', product: '', search: '' };
        const cEl = document.getElementById('extFilterCountry');
        const pEl = document.getElementById('extFilterProduct');
        const sEl = document.getElementById('extFilterSearch');
        if (cEl) cEl.value = '';
        if (pEl) pEl.value = '';
        if (sEl) sEl.value = '';
        this.renderExternalSalesTable();
    },

    populateExternalSalesFilterDropdowns() {
        const countrySelect = document.getElementById('extFilterCountry');
        const productSelect = document.getElementById('extFilterProduct');
        if (!countrySelect && !productSelect) return;

        const allSales = this.externalSales || [];

        if (countrySelect) {
            const currentVal = (this.extSalesFilters.country || '').toLowerCase();
            const uniqueCountries = [...new Set(allSales.map(s => (s.country || '').trim()).filter(Boolean))].sort();
            
            let optionsHtml = '<option value="">🌎 Todos los Reportes / Países</option>';
            uniqueCountries.forEach(c => {
                const flag = this.getCountryFlag(c);
                const isSel = c.toLowerCase() === currentVal ? 'selected' : '';
                optionsHtml += `<option value="${this.escapeHtml(c)}" ${isSel}>${flag} ${this.escapeHtml(c)}</option>`;
            });
            countrySelect.innerHTML = optionsHtml;
        }

        if (productSelect) {
            const currentVal = (this.extSalesFilters.product || '').toLowerCase();
            const uniqueProducts = [...new Set(allSales.map(s => (s.description || s.product_name || '').trim()).filter(Boolean))].sort();

            let optionsHtml = '<option value="">📦 Todos los Productos</option>';
            uniqueProducts.forEach(p => {
                const isSel = p.toLowerCase() === currentVal ? 'selected' : '';
                optionsHtml += `<option value="${this.escapeHtml(p)}" ${isSel}>${this.escapeHtml(p)}</option>`;
            });
            productSelect.innerHTML = optionsHtml;
        }
    },

    renderExternalSalesTable() {
        const tbody = document.getElementById('isExternalSalesTable');
        const expandContainer = document.getElementById('extSalesExpandContainer');
        const btnDeleteAll = document.getElementById('btnDeleteAllExtSales');
        const btnDeleteSelected = document.getElementById('btnDeleteSelectedExtSales');

        if (!tbody) return;

        // Synchronize local filter dropdown options if needed
        this.populateExternalSalesFilterDropdowns();

        let tfoot = document.getElementById('isExternalSalesTableFoot');
        if (!tfoot) {
            const table = tbody.closest('table');
            if (table) {
                tfoot = document.createElement('tfoot');
                tfoot.id = 'isExternalSalesTableFoot';
                table.appendChild(tfoot);
            }
        }

        const baseSales = this.getFilteredExternalSales();
        const sales = this.getFilteredExternalSalesForTable();
        const hasLocalFilters = !!(this.extSalesFilters.country || this.extSalesFilters.product || this.extSalesFilters.search);

        if (btnDeleteAll) {
            btnDeleteAll.style.display = baseSales.length > 0 ? 'inline-flex' : 'none';
        }
        if (btnDeleteSelected) {
            btnDeleteSelected.style.display = 'none';
        }
        const selectAllCb = document.getElementById('selectAllExtSales');
        if (selectAllCb) selectAllCb.checked = false;

        if (sales.length === 0) {
            if (hasLocalFilters) {
                tbody.innerHTML = `
                    <tr>
                        <td colspan="14" style="text-align: center; color: var(--text-muted); padding: 2.5rem 1rem;">
                            <div style="font-size: 1.5rem; margin-bottom: 0.4rem;">🔍</div>
                            <div style="font-weight: 600; font-size: 0.95rem; color: var(--text-primary); margin-bottom: 0.25rem;">No se encontraron registros con los filtros seleccionados</div>
                            <div style="font-size: 0.82rem; color: var(--text-muted); margin-bottom: 0.75rem;">Prueba cambiando el país, producto o término de búsqueda.</div>
                            <button type="button" class="btn btn-secondary btn-sm" onclick="IncomeStatementModule.clearExternalSalesLocalFilters()" style="background: rgba(255,255,255,0.08); border: 1px solid var(--border);">
                                🔄 Limpiar Filtros Locales
                            </button>
                        </td>
                    </tr>`;
            } else {
                tbody.innerHTML = `
                    <tr>
                        <td colspan="14" style="text-align: center; color: var(--text-muted); padding: 2rem;">
                            No hay ventas manuales o importadas registradas en este período.
                        </td>
                    </tr>`;
            }
            if (tfoot) tfoot.innerHTML = '';
            if (expandContainer) expandContainer.innerHTML = '';
            return;
        }

        const filteredAdExpenses = this.getFilteredAdExpenses();

        // Calculate Totals for ALL filtered sales
        let totalRevenue = 0;
        let totalProductCost = 0;
        let totalShippingCost = 0;
        let totalReturnShippingCost = 0;
        let totalAdSpend = 0;
        let totalDelivered = 0;
        let totalReturned = 0;
        let totalDeliveredUnits = 0;

        sales.forEach(sale => {
            totalRevenue += parseFloat(sale.revenue || 0);
            totalProductCost += parseFloat(sale.product_cost || 0);
            totalShippingCost += parseFloat(sale.shipping_cost || 0);
            totalReturnShippingCost += parseFloat(sale.return_shipping_cost || 0);
            totalDelivered += parseInt(sale.delivered || 0);
            totalReturned += parseInt(sale.returned || 0);
            totalDeliveredUnits += parseInt(sale.delivered_units !== undefined && sale.delivered_units !== null ? sale.delivered_units : sale.delivered || 0);

            if (sale.description) {
                const adSpend = filteredAdExpenses
                    .filter(exp => exp.product_name === sale.description)
                    .reduce((sum, exp) => sum + parseFloat(exp.amount_spent || 0), 0);
                totalAdSpend += adSpend;
            }
        });

        const totalOrders = totalDelivered + totalReturned;
        const overallReturnRate = totalOrders > 0 ? ((totalReturned / totalOrders) * 100).toFixed(1) : '0.0';

        const limit = 5;
        const visibleSales = this.isExternalSalesExpanded ? sales : sales.slice(0, limit);

        tbody.innerHTML = visibleSales.map(sale => {
            const delivered = sale.delivered || 0;
            const returned = sale.returned || 0;
            const orders = delivered + returned;
            const returnRate = orders > 0 ? ((returned / orders) * 100).toFixed(1) : '0.0';
            
            // Sum Ad Spend linked to this sale
            let adSpend = 0;
            if (sale.description) {
                adSpend = filteredAdExpenses
                    .filter(exp => exp.product_name === sale.description)
                    .reduce((sum, exp) => sum + parseFloat(exp.amount_spent || 0), 0);
            }

            return `
                <tr>
                    <td style="text-align: center;">
                        <input type="checkbox" class="ext-sale-checkbox" value="${sale.id}" onchange="IncomeStatementModule.updateSelectedExtSalesCount()" style="cursor: pointer;">
                    </td>
                    <td>
                        <span class="country-flag">${this.getCountryFlag(sale.country === 'Todos' ? sale.country : sale.country)}</span>
                        ${sale.country}
                    </td>
                    <td style="max-width: 220px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${sale.description || ''}">${sale.description || '-'}</td>
                    <td style="text-align: right; font-weight: 600; color: var(--success);">${this.formatCurrency(sale.revenue)}</td>
                    <td style="text-align: right; color: var(--danger);">${this.formatCurrency(sale.product_cost)}</td>
                    <td style="text-align: right; color: var(--primary);">${this.formatCurrency(sale.shipping_cost)}</td>
                    <td style="text-align: right; color: var(--danger);">${this.formatCurrency(sale.return_shipping_cost || 0)}</td>
                    <td style="text-align: right; color: var(--warning);">${this.formatCurrency(adSpend)}</td>
                    <td style="text-align: right;">${delivered}</td>
                    <td style="text-align: right;">${returned}</td>
                    <td style="text-align: right; font-weight: 600; color: var(--success);">${sale.delivered_units !== undefined && sale.delivered_units !== null ? sale.delivered_units : delivered}</td>
                    <td style="text-align: center;">${returnRate}%</td>
                    <td style="font-size: 0.85rem;">${this.formatDate(sale.sale_date)}</td>
                    <td style="white-space: nowrap;">
                        <button class="btn btn-icon btn-sm" style="color: #8b5cf6; background: rgba(139, 92, 246, 0.1); border: none; margin-right: 4px;" onclick="IncomeStatementModule.openLinkCampaignsModal('${sale.id}')" title="Vincular Campañas">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path>
                                <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path>
                            </svg>
                        </button>
                        <button class="btn btn-icon btn-sm" style="color: var(--primary); background: rgba(59, 130, 246, 0.1); border: none; margin-right: 4px;" onclick="IncomeStatementModule.editExternalSale('${sale.id}')" title="Editar">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                <path d="M12 20h9"></path>
                                <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path>
                            </svg>
                        </button>
                        <button class="btn btn-icon btn-sm btn-danger-light" onclick="IncomeStatementModule.deleteExternalSale('${sale.id}')" title="Eliminar">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <polyline points="3 6 5 6 21 6"></polyline>
                                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                            </svg>
                        </button>
                    </td>
                </tr>`;
        }).join('');

        // Render Summary Totals Row in tfoot
        const totalsLabel = hasLocalFilters ? `TOTALES (${sales.length} registros filtrados):` : `TOTALES (${sales.length} registros):`;
        if (tfoot) {
            tfoot.innerHTML = `
                <tr style="background: rgba(14, 165, 233, 0.12); font-weight: 700; border-top: 2px solid var(--border); border-bottom: 2px solid var(--border);">
                    <td colspan="3" style="text-align: left; padding: 0.85rem 1rem; font-size: 0.88rem; color: var(--text);">
                        <span style="display: flex; align-items: center; gap: 0.4rem;">
                            <span style="font-size: 1.15rem;">📊</span>
                            <span style="font-weight: 800; letter-spacing: 0.3px;">${totalsLabel}</span>
                        </span>
                    </td>
                    <td style="text-align: right; font-weight: 800; color: var(--success); font-size: 0.92rem; white-space: nowrap;">
                        ${this.formatCurrency(totalRevenue)}
                    </td>
                    <td style="text-align: right; font-weight: 800; color: var(--danger); font-size: 0.92rem; white-space: nowrap;">
                        ${this.formatCurrency(totalProductCost)}
                    </td>
                    <td style="text-align: right; font-weight: 800; color: var(--primary); font-size: 0.92rem; white-space: nowrap;">
                        ${this.formatCurrency(totalShippingCost)}
                    </td>
                    <td style="text-align: right; font-weight: 800; color: var(--danger); font-size: 0.92rem; white-space: nowrap;">
                        ${this.formatCurrency(totalReturnShippingCost)}
                    </td>
                    <td style="text-align: right; font-weight: 800; color: var(--warning); font-size: 0.92rem; white-space: nowrap;">
                        ${this.formatCurrency(totalAdSpend)}
                    </td>
                    <td style="text-align: right; font-weight: 800; font-size: 0.92rem;">
                        ${totalDelivered}
                    </td>
                    <td style="text-align: right; font-weight: 800; font-size: 0.92rem;">
                        ${totalReturned}
                    </td>
                    <td style="text-align: right; font-weight: 800; font-size: 0.92rem; color: var(--success);">
                        ${totalDeliveredUnits}
                    </td>
                    <td style="text-align: center; font-weight: 800; font-size: 0.92rem; color: ${parseFloat(overallReturnRate) > 25 ? 'var(--danger)' : 'var(--text)'};">
                        ${overallReturnRate}%
                    </td>
                    <td colspan="2"></td>
                </tr>`;
        }

        const filterBadge = hasLocalFilters ? `<span style="background: rgba(99, 102, 241, 0.15); color: #818cf8; padding: 2px 7px; border-radius: 4px; font-weight: 600; font-size: 0.75rem; margin-left: 0.4rem;">Filtros activos (${sales.length} de ${baseSales.length})</span>` : '';

        if (expandContainer) {
            if (sales.length > limit) {
                expandContainer.innerHTML = `
                    <div style="display: flex; align-items: center; gap: 0.5rem;">
                        <span style="font-size: 0.82rem; color: var(--text-muted);">
                            Mostrando ${visibleSales.length} de ${sales.length} registros cargados
                        </span>
                        ${filterBadge}
                    </div>
                    <button type="button" class="btn btn-secondary btn-sm" onclick="IncomeStatementModule.toggleExpandExternalSales()" style="background: rgba(255,255,255,0.06); border: 1px solid var(--border); font-size: 0.82rem;">
                        ${this.isExternalSalesExpanded ? '🔼 Plegar Lista (Ver menos)' : '🔽 Desglosar Todos (' + sales.length + ' registros)'}
                    </button>`;
            } else {
                expandContainer.innerHTML = `
                    <div style="display: flex; align-items: center; gap: 0.5rem;">
                        <span style="font-size: 0.82rem; color: var(--text-muted);">${sales.length} registros en total</span>
                        ${filterBadge}
                    </div>`;
            }
        }
    },

    openExternalSalesModal() {
        const form = document.getElementById('formExternalSale');
        if (form) form.reset();
        document.getElementById('extSaleId').value = '';
        document.getElementById('extSaleDate').value = new Date().toISOString().split('T')[0];
        document.getElementById('extSaleDelivered').value = '0';
        document.getElementById('extSaleReturned').value = '0';
        const delUnitsEl = document.getElementById('extSaleDeliveredUnits');
        if (delUnitsEl) delUnitsEl.value = '0';
        const retUnitsEl = document.getElementById('extSaleReturnedUnits');
        if (retUnitsEl) retUnitsEl.value = '0';
        document.getElementById('modalExternalSale').classList.add('active');
    },

    editExternalSale(id) {
        const sale = this.externalSales.find(s => s.id === id);
        if (!sale) return;

        document.getElementById('extSaleId').value = sale.id;
        document.getElementById('extSaleCountry').value = sale.country || 'Todos';
        document.getElementById('extSaleDate').value = sale.sale_date ? sale.sale_date.split('T')[0] : '';
        document.getElementById('extSaleDescription').value = sale.description || '';
        document.getElementById('extSaleRevenue').value = sale.revenue || 0;
        document.getElementById('extSaleProductCost').value = sale.product_cost || 0;
        document.getElementById('extSaleShippingCost').value = sale.shipping_cost || 0;
        const returnShipEl = document.getElementById('extSaleReturnShippingCost');
        if (returnShipEl) returnShipEl.value = sale.return_shipping_cost || 0;
        document.getElementById('extSaleDelivered').value = sale.delivered || 0;
        document.getElementById('extSaleReturned').value = sale.returned || 0;
        const delUnitsEl = document.getElementById('extSaleDeliveredUnits');
        if (delUnitsEl) delUnitsEl.value = sale.delivered_units || sale.delivered || 0;
        const retUnitsEl = document.getElementById('extSaleReturnedUnits');
        if (retUnitsEl) retUnitsEl.value = sale.returned_units || sale.returned || 0;

        const modal = document.getElementById('modalExternalSale');
        if (modal) modal.classList.add('active');
    },

    saveExternalSalesToLocal() {
        try {
            localStorage.setItem('external_sales', JSON.stringify(this.externalSales || []));
        } catch (e) {
            console.warn('Error en localStorage:', e);
        }
    },

    loadExternalSalesFromLocal() {
        try {
            const saved = localStorage.getItem('external_sales');
            return saved ? JSON.parse(saved) : [];
        } catch (e) {
            return [];
        }
    },

    async saveExternalSale() {
        const id = document.getElementById('extSaleId')?.value;
        const data = {
            country: document.getElementById('extSaleCountry').value,
            sale_date: document.getElementById('extSaleDate').value,
            description: document.getElementById('extSaleDescription').value,
            revenue: parseFloat(document.getElementById('extSaleRevenue').value) || 0,
            product_cost: parseFloat(document.getElementById('extSaleProductCost').value) || 0,
            shipping_cost: parseFloat(document.getElementById('extSaleShippingCost').value) || 0,
            return_shipping_cost: parseFloat(document.getElementById('extSaleReturnShippingCost') ? document.getElementById('extSaleReturnShippingCost').value : 0) || 0,
            delivered: parseInt(document.getElementById('extSaleDelivered').value) || 0,
            returned: parseInt(document.getElementById('extSaleReturned').value) || 0,
            delivered_units: parseInt(document.getElementById('extSaleDeliveredUnits')?.value) || parseInt(document.getElementById('extSaleDelivered').value) || 0,
            returned_units: parseInt(document.getElementById('extSaleReturnedUnits')?.value) || parseInt(document.getElementById('extSaleReturned').value) || 0
        };

        if (id) {
            const idx = this.externalSales.findIndex(s => s.id === id);
            if (idx !== -1) {
                this.externalSales[idx] = { ...this.externalSales[idx], ...data };
            }
            try {
                await supabaseClient.from('external_sales').update(data).eq('id', id);
            } catch (e) {}
        } else {
            const newItem = {
                id: 'ext_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
                ...data
            };
            this.externalSales.unshift(newItem);
            try {
                await supabaseClient.from('external_sales').insert(data);
            } catch (e) {}
        }

        this.saveExternalSalesToLocal();
        Utils.showToast('Venta externa guardada', 'success');
        document.getElementById('modalExternalSale').classList.remove('active');
        await this.render();
    },

    async deleteExternalSale(id) {
        if (!confirm('¿Eliminar esta venta manual?')) return;
        this.externalSales = this.externalSales.filter(s => s.id !== id);
        this.saveExternalSalesToLocal();
        try {
            await supabaseClient.from('external_sales').delete().eq('id', id);
        } catch (e) {}
        Utils.showToast('Venta eliminada', 'success');
        this.renderReportsManagerModal();
        await this.render();
    },

    openLinkCampaignsForProduct(productName) {
        document.getElementById('linkCampaignsSaleId').value = '';
        document.getElementById('linkCampaignsSaleName').value = productName;
        document.getElementById('linkCampaignsProductName').innerText = productName;
        
        const searchInput = document.getElementById('linkCampaignsSearch');
        if (searchInput) searchInput.value = '';
        
        const uniqueCampaigns = {};
        const filteredExpenses = this.getFilteredAdExpenses();
        filteredExpenses.forEach(exp => {
            const campName = exp.campaign_name || 'Sin Nombre de Campaña';
            if (!uniqueCampaigns[campName]) {
                uniqueCampaigns[campName] = {
                    name: campName,
                    linkedTo: exp.product_name
                };
            }
        });
        
        const listEl = document.getElementById('linkCampaignsList');
        if (Object.keys(uniqueCampaigns).length === 0) {
            listEl.innerHTML = '<div style="color:var(--text-muted); font-size:0.9rem;">No hay campañas publicitarias registradas en este período.</div>';
        } else {
            const campaignsArray = Object.values(uniqueCampaigns).sort((a, b) => a.name.localeCompare(b.name));
            listEl.innerHTML = campaignsArray.map(camp => {
                const isLinkedToThis = (camp.linkedTo === productName) && productName;
                const isLinkedToOther = camp.linkedTo && camp.linkedTo !== productName;
                
                let extraText = '';
                if (isLinkedToOther) {
                    extraText = `<span style="font-size: 0.75rem; color: var(--text-muted); margin-left: 0.5rem;">(Vinculada a: ${camp.linkedTo})</span>`;
                }
                
                return `
                    <label class="link-campaign-item" style="display: flex; align-items: center; gap: 0.5rem; padding: 0.5rem; background: rgba(255,255,255,0.03); border-radius: 4px; cursor: pointer;">
                        <input type="checkbox" name="link_campaigns" value="${camp.name.replace(/"/g, '&quot;')}" ${isLinkedToThis ? 'checked' : ''}>
                        <span class="link-campaign-name" style="font-size: 0.9rem; flex: 1;">${camp.name}</span>
                        ${extraText}
                    </label>
                `;
            }).join('');
        }
        
        document.getElementById('modalLinkCampaigns').classList.add('active');
    },

    openLinkCampaignsModal(saleId) {
        const sale = this.externalSales.find(s => s.id === saleId);
        if (!sale) return;
        this.openLinkCampaignsForProduct(sale.description || '');
    },

    filterLinkCampaigns() {
        const query = document.getElementById('linkCampaignsSearch').value.toLowerCase();
        const items = document.querySelectorAll('.link-campaign-item');
        items.forEach(item => {
            const nameEl = item.querySelector('.link-campaign-name');
            if (nameEl) {
                const name = nameEl.innerText.toLowerCase();
                if (name.includes(query)) {
                    item.style.display = 'flex';
                } else {
                    item.style.display = 'none';
                }
            }
        });
    },

    async submitLinkCampaigns() {
        const saleName = document.getElementById('linkCampaignsSaleName').value;
        if (!saleName) {
            Utils.showToast('La venta debe tener una descripción/nombre para poder vincular campañas', 'error');
            return;
        }
        
        const checkboxes = document.querySelectorAll('#linkCampaignsList input[type="checkbox"]');
        const selectedCampaigns = [];
        const unselectedCampaigns = [];
        
        checkboxes.forEach(cb => {
            if (cb.checked) selectedCampaigns.push(cb.value);
            else unselectedCampaigns.push(cb.value);
        });
        
        let recordsUpdated = 0;
        
        document.getElementById('modalLinkCampaigns').classList.remove('active');
        this.showImportLoadingOverlay('Vinculando Campañas...', 'Actualizando base de datos...');
        
        for (let exp of this.adExpenses) {
            const campName = exp.campaign_name || 'Sin Nombre de Campaña';
            
            if (selectedCampaigns.includes(campName)) {
                if (exp.product_name !== saleName) {
                    exp.product_name = saleName;
                    recordsUpdated++;
                    try {
                        const { error } = await supabaseClient.from('ad_expenses').update({ product_name: saleName }).eq('id', exp.id);
                        if (error) {
                            console.error('Supabase update error:', error);
                        }
                    } catch(e) {
                        console.error('Exception updating ad_expenses:', e);
                    }
                }
            } else if (unselectedCampaigns.includes(campName) && exp.product_name === saleName) {
                exp.product_name = null;
                recordsUpdated++;
                try {
                    const { error } = await supabaseClient.from('ad_expenses').update({ product_name: null }).eq('id', exp.id);
                    if (error) {
                        console.error('Supabase update error (Unlink):', error);
                    }
                } catch(e) {}
            }
        }
        
        this.hideImportLoadingOverlay();
        
        if (recordsUpdated > 0) {
            Utils.showToast(`Se actualizaron ${recordsUpdated} registros de campañas`, 'success');
            await this.render();
        } else {
            Utils.showToast('No hubo cambios en las vinculaciones', 'info');
        }
    },

    pendingImportRecords: [],

    showImportErrorModal(title, message, details = '') {
        const modalId = 'modalImportErrorAlert';
        let modal = document.getElementById(modalId);
        if (!modal) {
            modal = document.createElement('div');
            modal.id = modalId;
            modal.className = 'modal-backdrop';
            modal.style.zIndex = '99999';
            document.body.appendChild(modal);
        }
        modal.innerHTML = `
            <div class="modal" style="max-width: 520px; border-left: 5px solid var(--danger, #ef4444); background: var(--surface-card, #1e293b);">
                <div class="modal-header" style="background: rgba(239, 68, 68, 0.12); color: var(--danger, #ef4444); padding: 1.25rem;">
                    <h3 style="display:flex; align-items:center; gap:0.5rem; margin:0; font-size:1.1rem;">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <circle cx="12" cy="12" r="10"></circle>
                            <line x1="12" y1="8" x2="12" y2="12"></line>
                            <line x1="12" y1="16" x2="12.01" y2="16"></line>
                        </svg>
                        ${title}
                    </h3>
                    <button class="modal-close" onclick="document.getElementById('${modalId}').classList.remove('active')" style="color:var(--text);">&times;</button>
                </div>
                <div class="modal-body" style="padding: 1.5rem;">
                    <p style="font-size: 0.95rem; color: var(--text, #f8fafc); font-weight: 500; margin-bottom: 0.75rem; line-height: 1.5;">${message}</p>
                    ${details ? `<div style="font-size: 0.82rem; color: var(--text-muted, #94a3b8); background: var(--surface, #0f172a); padding: 0.85rem; border-radius: var(--radius-sm, 6px); font-family: monospace; max-height: 180px; overflow-y: auto; white-space: pre-wrap; border: 1px solid var(--border, rgba(255,255,255,0.1));">${details}</div>` : ''}
                </div>
                <div class="modal-footer" style="padding: 1rem 1.5rem; display:flex; justify-content:flex-end;">
                    <button type="button" class="btn btn-primary" onclick="document.getElementById('${modalId}').classList.remove('active')">Entendido</button>
                </div>
            </div>`;
        modal.classList.add('active');
    },


    parseExcelNumber(val) {
        if (val === null || val === undefined || val === '') return 0;
        if (typeof val === 'number') return isNaN(val) ? 0 : val;
        let str = String(val).trim().replace(/[\$€\s]/g, '');
        // Handle comma as decimal separator (e.g. "1.234,56" -> "1234.56")
        if (str.includes(',') && str.includes('.')) {
            str = str.replace(/\./g, '').replace(',', '.');
        } else if (str.includes(',') && !str.includes('.')) {
            str = str.replace(',', '.');
        }
        const cleaned = str.replace(/[^0-9.\-]/g, '');
        const num = parseFloat(cleaned);
        return isNaN(num) ? 0 : num;
    },

    showImportLoadingOverlay(title = 'Procesando Archivo Excel...', subtitle = 'Analizando registros y agrupando productos.') {
        const overlay = document.getElementById('importExcelLoadingOverlay');
        if (overlay) {
            const titleEl = document.getElementById('importLoadingTitle');
            const subEl = document.getElementById('importLoadingSubtitle');
            if (titleEl) titleEl.innerText = title;
            if (subEl) subEl.innerText = subtitle;
            this.updateImportProgress(0, 'Preparando lectura del archivo...');
            overlay.classList.add('active');
            overlay.style.display = 'flex';
        }
    },

    hideImportLoadingOverlay() {
        const overlay = document.getElementById('importExcelLoadingOverlay');
        if (overlay) {
            overlay.classList.remove('active');
            overlay.style.display = 'none';
        }
    },

    updateImportProgress(percent, detail) {
        const bar = document.getElementById('importProgressBar');
        const text = document.getElementById('importProgressText');
        const detailEl = document.getElementById('importProgressDetail');
        if (bar) bar.style.width = `${Math.min(percent, 100)}%`;
        if (text) text.textContent = `${Math.round(percent)}%`;
        if (detailEl && detail) detailEl.textContent = detail;
    },

    async handleExternalSalesFileUpload(e) {
        const file = e.target.files[0];
        if (!file) return;

        this.showImportLoadingOverlay(`Analizando ${file.name}...`, 'Leyendo filas de Excel y agrupando productos por referencia...');

        // Use requestAnimationFrame to ensure the overlay renders before heavy work
        await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));

        try {
            this.updateImportProgress(5, 'Leyendo archivo Excel...');
            await new Promise(r => setTimeout(r, 50));

            const data = await file.arrayBuffer();
            this.updateImportProgress(15, 'Decodificando hoja de cálculo...');
            await new Promise(r => setTimeout(r, 30));

            const workbook = XLSX.read(data, { type: 'array' });
            this.updateImportProgress(25, 'Identificando columnas y cabeceras...');
            await new Promise(r => setTimeout(r, 30));
            
            const sheetName = workbook.SheetNames[0];
            const sheet = workbook.Sheets[sheetName];
            const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });

            if (!rows || rows.length < 2) {
                this.hideImportLoadingOverlay();
                this.showImportErrorModal(
                    'Archivo sin Datos',
                    'El archivo seleccionado está vacío o no contiene filas con datos de ventas.',
                    `Hoja detectada: "${sheetName}" | Filas totales: ${rows ? rows.length : 0}`
                );
                e.target.value = '';
                return;
            }

            this.updateImportProgress(30, `${rows.length} filas encontradas. Identificando columnas...`);
            await new Promise(r => setTimeout(r, 30));

            let headerRowIndex = -1;
            for (let i = 0; i < Math.min(rows.length, 10); i++) {
                const r = rows[i] || [];
                const rStr = r.map(c => String(c || '').toLowerCase()).join(' ');
                if (rStr.includes('estado') || rStr.includes('recaudo') || rStr.includes('flete')) {
                    headerRowIndex = i;
                    break;
                }
            }

            let statusIdx = 2, productIdx = 12, stockIdx = 13, contentIdx = 15, quantityIdx = 14;
            let recaudoIdx = 25, costoIdx = 26, safeFleteEntregaIdx = 27, safeFleteDevIdx = 28;
            let dateIdx = 16;
            let startRowIndex = 0;

            if (headerRowIndex !== -1) {
                startRowIndex = headerRowIndex + 1;
                const headers = (rows[headerRowIndex] || []).map(c => String(c || '').trim().toLowerCase());
                const findColExact = (keywords, fallbackIdx) => {
                    let idx = headers.findIndex(h => keywords.some(k => h === k));
                    if (idx === -1) idx = headers.findIndex(h => keywords.some(k => h.includes(k)));
                    return idx !== -1 ? idx : fallbackIdx;
                };
                statusIdx = findColExact(['estado', 'estado guia', 'estado del pedido'], 2);
                productIdx = findColExact(['productos', 'producto', 'nombre producto', 'articulo'], 12);
                stockIdx = findColExact(['id de stocks', 'id del stock', 'stock id', 'sku', 'id stock'], 13);
                quantityIdx = findColExact(['cantidad', 'unidades', 'unidad', 'qty', 'cant'], 14);
                contentIdx = findColExact(['contenido', 'contenido del producto', 'detalle'], 15);
                recaudoIdx = findColExact(['total recaudo', 'recaudo', 'valor recaudo', 'monto recaudo'], 25);
                costoIdx = findColExact(['total dropshipping', 'costo del producto', 'costo producto', 'costo prod', 'costo'], 26);
                
                const fleteEntregaIdx = headers.findIndex(h => h.includes('flete') && !h.includes('devoluc'));
                const fleteDevIdx = headers.findIndex(h => h.includes('devoluc') || h.includes('flete por dev'));
                if (fleteEntregaIdx !== -1) safeFleteEntregaIdx = fleteEntregaIdx;
                if (fleteDevIdx !== -1) safeFleteDevIdx = fleteDevIdx;

                const dIdx = headers.findIndex(h => h.includes('fecha de creación') || h.includes('fecha creacion') || h.includes('fecha'));
                if (dIdx !== -1) dateIdx = dIdx;
            }

            // Currency & TRM Detection
            const fLower = (file.name || '').toLowerCase();
            let isCop = fLower.includes('colombia') || fLower.includes('col') || fLower.includes('cop') || fLower.includes('effi');
            const extCurrencyEl = document.getElementById('extImportCurrency');
            if (extCurrencyEl) {
                if (isCop) {
                    extCurrencyEl.value = 'COP';
                    this.onExtCurrencyChange();
                } else if (extCurrencyEl.value === 'COP') {
                    isCop = true;
                }
            }

            let trmRate = parseFloat(document.getElementById('extTrmRate')?.value) || 4100;
            if (trmRate <= 0) trmRate = 4100;

            this.updateImportProgress(35, 'Columnas identificadas. Cargando productos del catálogo...');
            await new Promise(r => setTimeout(r, 30));

            let productsList = Database.products || [];
            if (productsList.length === 0 && typeof Database.getProducts === 'function') {
                productsList = await Database.getProducts();
            }

            this.updateImportProgress(40, 'Procesando pedidos y agrupando por referencia...');
            await new Promise(r => setTimeout(r, 30));

            const productGroupMap = {};
            let totalScannedGuides = 0;
            let totalDeliveredGuides = 0;
            let totalReturnedGuides = 0;
            const totalDataRows = rows.length - startRowIndex;
            const progressStart = 40;
            const progressEnd = 90;

            for (let i = startRowIndex; i < rows.length; i++) {
                const row = rows[i];
                if (!row || row.length === 0) continue;

                // Update progress bar every 20 rows
                if ((i - startRowIndex) % 20 === 0) {
                    const pct = progressStart + ((i - startRowIndex) / totalDataRows) * (progressEnd - progressStart);
                    this.updateImportProgress(pct, `Procesando fila ${i - startRowIndex + 1} de ${totalDataRows}...`);
                    await new Promise(r => setTimeout(r, 0)); // yield to browser
                }

                const status = String(row[statusIdx] || '').trim();
                const rawProduct = String(row[productIdx] || '').trim();
                const stockId = String(row[stockIdx] || '').trim();
                const content = String(row[contentIdx] || '').trim();
                const col0 = String(row[0] || '').trim();

                if (!status && !rawProduct && !stockId && !content && (isNaN(parseInt(col0)) || col0 === '')) continue;
                if (status.toLowerCase() === 'estado' || rawProduct.toLowerCase() === 'producto') continue;

                totalScannedGuides++;

                const rawRecaudo = this.parseExcelNumber(row[recaudoIdx]);
                const rawCostoProd = this.parseExcelNumber(row[costoIdx]);
                const rawFleteEntrega = this.parseExcelNumber(row[safeFleteEntregaIdx]);
                const rawFleteDevolucion = this.parseExcelNumber(row[safeFleteDevIdx]);

                // Date detection
                let rowDate = '';
                if (dateIdx !== -1 && row[dateIdx]) {
                    const rawD = String(row[dateIdx]).trim();
                    if (/^\d{4}-\d{2}-\d{2}/.test(rawD)) {
                        rowDate = rawD.substring(0, 10);
                    } else if (/^\d{1,2}\/\d{1,2}\/\d{4}/.test(rawD)) {
                        const parts = rawD.split('/');
                        rowDate = `${parts[2]}-${String(parts[1]).padStart(2, '0')}-${String(parts[0]).padStart(2, '0')}`;
                    }
                }

                const statusLower = status.toLowerCase();
                const isReturned = statusLower.includes('devuelt') || statusLower.includes('devol') || statusLower.includes('cancel') || statusLower.includes('rechazad');

                if (isReturned) totalReturnedGuides++;
                else totalDeliveredGuides++;

                let matchedProduct = null;
                if (stockId) {
                    const cleanStock = stockId.split(' ')[0];
                    matchedProduct = productsList.find(p => String(p.sku || p.code || p.id).toLowerCase() === cleanStock.toLowerCase());
                }
                if (!matchedProduct && (rawProduct || content)) {
                    const searchStr = (rawProduct || content).toLowerCase();
                    matchedProduct = productsList.find(p => searchStr.includes((p.name || '').toLowerCase()) || (p.name || '').toLowerCase().includes(searchStr));
                }

                let finalProductName = matchedProduct ? matchedProduct.name : (rawProduct || content || (stockId ? `Ref: ${stockId}` : 'Producto Externo'));
                finalProductName = finalProductName.replace(/^[\d\s\t]+/, '').trim().replace(/\s+/g, ' ');
                if (!finalProductName) finalProductName = stockId || 'Producto Externo';

                const groupKey = finalProductName.toLowerCase();

                if (!productGroupMap[groupKey]) {
                    productGroupMap[groupKey] = {
                        country: isCop ? 'Colombia Hoko' : 'Ecuador Hoko',
                        sale_date: rowDate || this.filters.dateFrom || new Date().toISOString().split('T')[0],
                        description: finalProductName,
                        stock_id: stockId,
                        raw_revenue: 0,
                        raw_product_cost: 0,
                        raw_shipping_cost: 0,
                        raw_return_shipping_cost: 0,
                        revenue: 0,
                        product_cost: 0,
                        shipping_cost: 0,
                        return_shipping_cost: 0,
                        delivered: 0,
                        returned: 0,
                        deliveredUnits: 0,
                        returnedUnits: 0
                    };
                }

                const grp = productGroupMap[groupKey];
                if (rowDate && (!grp.sale_date || rowDate < grp.sale_date)) grp.sale_date = rowDate;

                const rawQty = this.parseExcelNumber(row[quantityIdx]);
                const rowUnits = rawQty > 0 ? Math.round(rawQty) : 1;

                if (isReturned) {
                    grp.returned += 1;
                    grp.returnedUnits += rowUnits;
                    grp.raw_return_shipping_cost += rawFleteDevolucion;
                } else {
                    grp.delivered += 1;
                    grp.deliveredUnits += rowUnits;
                    grp.raw_revenue += rawRecaudo;
                    grp.raw_product_cost += rawCostoProd;
                    grp.raw_shipping_cost += rawFleteEntrega;
                }
            }

            this.updateImportProgress(92, 'Finalizando agrupación y conversión...');
            await new Promise(r => setTimeout(r, 50));

            // Apply TRM conversion to USD
            const divisor = isCop ? trmRate : 1;
            Object.values(productGroupMap).forEach(grp => {
                grp.revenue = grp.raw_revenue / divisor;
                grp.product_cost = grp.raw_product_cost / divisor;
                grp.shipping_cost = grp.raw_shipping_cost / divisor;
                grp.return_shipping_cost = grp.raw_return_shipping_cost / divisor;
            });

            const recordsToInsert = Object.values(productGroupMap);

            if (recordsToInsert.length === 0) {
                this.hideImportLoadingOverlay();
                this.showImportErrorModal(
                    'No se Detectaron Registros de Ventas',
                    `Se escanearon ${totalScannedGuides} filas en la hoja "${sheetName}", pero ninguna contenía el formato válido de ventas.`,
                    `Causa: No se encontraron datos de ventas legibles.`
                );
                e.target.value = '';
                return;
            }

            recordsToInsert.totalScannedGuides = totalScannedGuides;
            recordsToInsert.totalDeliveredGuides = totalDeliveredGuides;
            recordsToInsert.totalReturnedGuides = totalReturnedGuides;
            recordsToInsert.currency = isCop ? 'COP' : 'USD';
            recordsToInsert.trmRate = trmRate;

            this.updateImportProgress(100, `¡Listo! ${recordsToInsert.length} referencias agrupadas.`);
            await new Promise(r => setTimeout(r, 400)); // brief pause to show 100%

            this.hideImportLoadingOverlay();
            this.pendingImportRecords = recordsToInsert;
            this.openImportPreviewModal(recordsToInsert, file.name);
            e.target.value = '';

        } catch (error) {
            console.error('Error reading Excel:', error);
            this.hideImportLoadingOverlay();
            this.showImportErrorModal(
                'Error al Leer el Archivo Excel',
                'Ocurrió una falla técnica inesperada al procesar la hoja de cálculo.',
                error.stack || error.message || String(error)
            );
            e.target.value = '';
        }
    },

    openImportPreviewModal(records, fileName) {
        const modal = document.getElementById('modalImportExcelPreview');
        if (!modal) { console.error('Modal modalImportExcelPreview not found'); return; }

        let totalRev = 0, totalCost = 0, totalShip = 0, totalReturnShip = 0, deliveredCount = 0, returnedCount = 0;
        records.forEach(r => {
            totalRev += (r.revenue || 0);
            totalCost += (r.product_cost || 0);
            totalShip += (r.shipping_cost || 0);
            totalReturnShip += (r.return_shipping_cost || 0);
            deliveredCount += (r.delivered || 0);
            returnedCount += (r.returned || 0);
        });

        // Setup Currency and TRM inside modal
        const modalCurr = document.getElementById('modalPreviewCurrency');
        const modalTrmBox = document.getElementById('modalPreviewTrmBox');
        const modalTrmInput = document.getElementById('modalPreviewTrmRate');
        const modalTrmBadge = document.getElementById('modalPreviewTrmBadge');

        const isCop = (records.currency === 'COP') || (fileName && (fileName.toLowerCase().includes('colombia') || fileName.toLowerCase().includes('cop')));
        if (modalCurr) {
            modalCurr.value = isCop ? 'COP' : 'USD';
        }
        if (modalTrmInput) {
            modalTrmInput.value = records.trmRate || parseFloat(document.getElementById('extTrmRate')?.value) || 4100;
        }
        if (modalTrmBox) modalTrmBox.style.display = isCop ? 'inline-flex' : 'none';
        if (modalTrmBadge) modalTrmBadge.style.display = isCop ? 'block' : 'none';

        const trmRate = parseFloat(modalTrmInput?.value) || 4100;
        const cardsEl = document.getElementById('importPreviewSummaryCards');
        if (cardsEl) {
            const currencySubtitle = isCop ? `<div style="font-size: 0.72rem; opacity: 0.85; margin-top: 2px; color: var(--primary);">Convertido a TRM: $${Math.round(trmRate).toLocaleString('es-CO')} COP</div>` : '';
            cardsEl.innerHTML = `
                <div style="background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius-md); padding: 0.85rem 1rem;">
                    <div style="font-size: 0.75rem; color: var(--text-muted); text-transform: uppercase;">Total Facturado (USD)</div>
                    <div style="font-size: 1.4rem; font-weight: 700; color: var(--success);">$${totalRev.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                    ${currencySubtitle}
                </div>
                <div style="background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius-md); padding: 0.85rem 1rem;">
                    <div style="font-size: 0.75rem; color: var(--text-muted); text-transform: uppercase;">Fletes Totales (USD)</div>
                    <div style="font-size: 1.4rem; font-weight: 700; color: var(--primary);">$${(totalShip + totalReturnShip).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                    <div style="font-size: 0.72rem; color: var(--text-muted); margin-top: 2px;">Entrega: $${totalShip.toFixed(2)} | Dev: $${totalReturnShip.toFixed(2)}</div>
                </div>
                <div style="background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius-md); padding: 0.85rem 1rem;">
                    <div style="font-size: 0.75rem; color: var(--text-muted); text-transform: uppercase;">Efectividad de Entrega</div>
                    <div style="font-size: 1.4rem; font-weight: 700; color: var(--text);">${((deliveredCount / (deliveredCount + returnedCount || 1)) * 100).toFixed(1)}%</div>
                    <div style="font-size: 0.72rem; color: var(--text-muted); margin-top: 2px;">${deliveredCount} entregados | ${returnedCount} devueltos</div>
                </div>`;
        }

        this.renderImportPreviewTable(records);

        const confirmBtn = document.getElementById('btnConfirmImportExcel');
        if (confirmBtn) confirmBtn.innerText = `Confirmar e Importar ${records.length} Referencias`;

        // Reset select all checkbox
        const selectAll = document.getElementById('importSelectAll');
        if (selectAll) selectAll.checked = false;
        this.updateManualGroupCount();

        // Suggest report custom name
        const nameInput = document.getElementById('importReportCustomName');
        if (nameInput) {
            let suggestedName = 'Ecuador Hoko';
            const fLower = (fileName || '').toLowerCase();
            if (fLower.includes('colombia') || fLower.includes('col')) {
                if (fLower.includes('hoko')) suggestedName = 'Colombia Hoko';
                else if (fLower.includes('domi')) suggestedName = 'Colombia Domi';
                else suggestedName = 'Colombia Effi';
            } else if (fLower.includes('venezuela') || fLower.includes('ven')) {
                suggestedName = 'Venezuela Hoko';
            } else if (fLower.includes('ecuador') || fLower.includes('ecu') || fLower.includes('hoko')) {
                if (fLower.includes('domi')) suggestedName = 'Ecuador Domi';
                else suggestedName = 'Ecuador Hoko';
            }
            nameInput.value = suggestedName;
            setTimeout(() => {
                try {
                    nameInput.focus();
                    nameInput.select();
                } catch(e) {}
            }, 100);
        }

        modal.style.display = 'flex';
        modal.style.opacity = '1';
        modal.style.visibility = 'visible';
        modal.style.zIndex = '999999';
        modal.classList.add('active');
    },

    renderImportPreviewTable(records) {
        const tableBody = document.getElementById('importPreviewTableBody');
        if (!tableBody) return;
        const isCop = records.currency === 'COP' || document.getElementById('modalPreviewCurrency')?.value === 'COP';

        tableBody.innerHTML = records.map((r, idx) => {
            const rawRevSubtitle = (isCop && r.raw_revenue) ? `<div style="font-size: 0.68rem; color: var(--text-muted);">COP $${Math.round(r.raw_revenue).toLocaleString('es-CO')}</div>` : '';
            const rawShipSubtitle = (isCop && r.raw_shipping_cost) ? `<div style="font-size: 0.68rem; color: var(--text-muted);">COP $${Math.round(r.raw_shipping_cost).toLocaleString('es-CO')}</div>` : '';

            return `
            <tr data-import-idx="${idx}" style="cursor: pointer;" onclick="IncomeStatementModule.toggleImportRowCheck(${idx}, event)">
                <td style="text-align: center;" onclick="event.stopPropagation();">
                    <input type="checkbox" class="import-row-check" data-idx="${idx}" onchange="IncomeStatementModule.updateManualGroupCount()" style="cursor: pointer;">
                </td>
                <td style="font-weight: 600; color: var(--text);">
                    ${r.description}
                    ${r.stock_id ? `<div style="font-size:0.7rem; color:var(--text-muted);">Ref: ${r.stock_id}</div>` : ''}
                </td>
                <td style="text-align: center; color: var(--success); font-weight: 600;">
                    ${r.delivered}
                    ${r.deliveredUnits !== undefined && r.deliveredUnits !== r.delivered ? `<div style="font-size: 0.68rem; color: var(--text-muted); font-weight: 500;">${r.deliveredUnits} unid.</div>` : ''}
                </td>
                <td style="text-align: center; color: var(--danger); font-weight: 600;">
                    ${r.returned}
                    ${r.returnedUnits !== undefined && r.returnedUnits !== r.returned ? `<div style="font-size: 0.68rem; color: var(--text-muted); font-weight: 500;">${r.returnedUnits} unid.</div>` : ''}
                </td>
                <td style="text-align: right; color: var(--success); font-weight: 600;">
                    $${(r.revenue || 0).toFixed(2)}
                    ${rawRevSubtitle}
                </td>
                <td style="text-align: right; color: var(--danger);">
                    $${(r.product_cost || 0).toFixed(2)}
                </td>
                <td style="text-align: right; color: var(--primary);">
                    $${(r.shipping_cost || 0).toFixed(2)}
                    ${rawShipSubtitle}
                </td>
                <td style="text-align: right; color: var(--danger);">
                    $${(r.return_shipping_cost || 0).toFixed(2)}
                </td>
            </tr>`;
        }).join('');
    },

    toggleImportRowCheck(idx, event) {
        if (event.target.tagName === 'INPUT') return;
        const cb = document.querySelector(`.import-row-check[data-idx="${idx}"]`);
        if (cb) {
            cb.checked = !cb.checked;
            this.updateManualGroupCount();
        }
    },

    toggleSelectAllImport(checked) {
        document.querySelectorAll('.import-row-check').forEach(cb => {
            cb.checked = checked;
        });
        this.updateManualGroupCount();
    },

    updateManualGroupCount() {
        const checked = document.querySelectorAll('.import-row-check:checked');
        const count = checked.length;
        const btn = document.getElementById('btnManualGroup');
        const badge = document.getElementById('manualGroupCount');
        if (badge) badge.innerText = count;
        if (btn) btn.disabled = count < 2;
    },

    manualGroupSelected() {
        const checkedBoxes = Array.from(document.querySelectorAll('.import-row-check:checked'));
        if (checkedBoxes.length < 2) return;

        const indices = checkedBoxes.map(cb => parseInt(cb.getAttribute('data-idx'))).sort((a, b) => a - b);
        const selectedRecords = indices.map(idx => this.pendingImportRecords[idx]);

        const defaultName = selectedRecords[0].description;
        const newName = prompt('Ingrese el nombre para la referencia unificada:', defaultName);
        if (!newName || !newName.trim()) return;

        const merged = {
            country: selectedRecords[0].country,
            sale_date: selectedRecords[0].sale_date,
            description: newName.trim(),
            stock_id: selectedRecords.map(r => r.stock_id).filter(Boolean).join(' | '),
            raw_revenue: 0,
            raw_product_cost: 0,
            raw_shipping_cost: 0,
            raw_return_shipping_cost: 0,
            revenue: 0,
            product_cost: 0,
            shipping_cost: 0,
            return_shipping_cost: 0,
            delivered: 0,
            returned: 0,
            deliveredUnits: 0,
            returnedUnits: 0
        };

        selectedRecords.forEach(src => {
            merged.raw_revenue += (src.raw_revenue || 0);
            merged.raw_product_cost += (src.raw_product_cost || 0);
            merged.raw_shipping_cost += (src.raw_shipping_cost || 0);
            merged.raw_return_shipping_cost += (src.raw_return_shipping_cost || 0);
            merged.revenue += (src.revenue || 0);
            merged.product_cost += (src.product_cost || 0);
            merged.shipping_cost += (src.shipping_cost || 0);
            merged.return_shipping_cost += (src.return_shipping_cost || 0);
            merged.delivered += (src.delivered || 0);
            merged.returned += (src.returned || 0);
            merged.deliveredUnits += (src.deliveredUnits || src.delivered || 0);
            merged.returnedUnits += (src.returnedUnits || src.returned || 0);
        });

        // Filter out merged items and insert merged record
        const remaining = this.pendingImportRecords.filter((_, idx) => !indices.includes(idx));
        remaining.unshift(merged);
        remaining.totalScannedGuides = this.pendingImportRecords.totalScannedGuides;
        remaining.currency = this.pendingImportRecords.currency;
        remaining.trmRate = this.pendingImportRecords.trmRate;

        this.pendingImportRecords = remaining;
        this.openImportPreviewModal(remaining, document.getElementById('importReportCustomName')?.value);
        Utils.showToast(`Se agruparon ${selectedRecords.length} referencias en "${newName.trim()}"`, 'success');
    },

    closeImportPreviewModal() {
        const modal = document.getElementById('modalImportExcelPreview');
        if (!modal) return;
        modal.classList.remove('active');
        modal.style.display = 'none';
        modal.style.opacity = '0';
        modal.style.visibility = 'hidden';
    },

    async confirmImportExternalSales() {
        if (!this.pendingImportRecords || this.pendingImportRecords.length === 0) {
            this.closeImportPreviewModal();
            return;
        }

        const nameInput = document.getElementById('importReportCustomName');
        let reportName = nameInput ? nameInput.value.trim() : '';
        if (!reportName) {
            reportName = prompt('¿Cómo deseas llamar a este reporte en el resumen de ventas? (Ej: Ecuador Hoko, Colombia Effi):', 'Ecuador Hoko');
            if (!reportName || !reportName.trim()) {
                Utils.showToast('Por favor escribe un nombre para identificar el reporte.', 'warning');
                return;
            }
        }
        reportName = reportName.trim();

        const recordsToSave = [...this.pendingImportRecords];
        this.closeImportPreviewModal();

        this.showImportLoadingOverlay('Guardando Registros...', `Guardando reporte "${reportName}" en almacenamiento local y en la nube...`);
        
        try {
            // Let overlay render
            await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));

            this.updateImportProgress(10, 'Generando identificadores únicos...');
            await new Promise(r => setTimeout(r, 50));

            // Create objects with valid UUIDs for memory and local storage
            const preparedRecords = recordsToSave.map(r => ({
                id: this.generateUUID(),
                country: reportName || r.country || 'Ecuador Hoko',
                sale_date: r.sale_date || this.filters.dateFrom || new Date().toISOString().split('T')[0],
                description: r.description || 'Producto Externo',
                revenue: parseFloat(r.revenue) || 0,
                product_cost: parseFloat(r.product_cost) || 0,
                shipping_cost: parseFloat(r.shipping_cost) || 0,
                return_shipping_cost: parseFloat(r.return_shipping_cost) || 0,
                delivered: parseInt(r.delivered) || 0,
                returned: parseInt(r.returned) || 0,
                delivered_units: parseInt(r.deliveredUnits) || parseInt(r.delivered) || 0,
                returned_units: parseInt(r.returnedUnits) || parseInt(r.returned) || 0
            }));

            this.updateImportProgress(30, 'Actualizando datos locales...');
            await new Promise(r => setTimeout(r, 50));

            // 1. Update in-memory externalSales with fingerprint deduplication
            this.externalSales = this.deduplicateExternalSales([...preparedRecords, ...this.externalSales]);

            // 2. Save to LocalStorage immediately
            this.saveExternalSalesToLocal();

            this.updateImportProgress(50, 'Actualizando tablas e indicadores en la interfaz...');
            await new Promise(r => setTimeout(r, 50));

            // 3. Render UI components immediately
            this.renderSummaryCards();
            this.renderSalesTable();
            this.renderConsolidatedSalesTable();
            this.renderAdExpensesTable();
            this.renderOperationalExpensesTable();
            this.renderExternalSalesTable();
            this.renderProductProfitTable();
            this.renderPLStatement();

            this.updateImportProgress(70, 'Sincronizando con la base de datos (Supabase)...');
            await new Promise(r => setTimeout(r, 50));

            // 4. Background sync with Supabase
            try {
                const supabasePayload = preparedRecords.map(r => ({
                    id: r.id,
                    country: r.country,
                    sale_date: r.sale_date,
                    description: r.description,
                    revenue: r.revenue,
                    product_cost: r.product_cost,
                    shipping_cost: r.shipping_cost,
                    return_shipping_cost: r.return_shipping_cost,
                    delivered: r.delivered,
                    returned: r.returned,
                    delivered_units: r.delivered_units,
                    returned_units: r.returned_units
                }));

                const batchSize = 50;
                const totalBatches = Math.ceil(supabasePayload.length / batchSize);
                
                for (let b = 0, i = 0; b < supabasePayload.length; b += batchSize, i++) {
                    const pct = 70 + (i / totalBatches) * 25;
                    this.updateImportProgress(pct, `Sincronizando lote ${i + 1} de ${totalBatches}...`);
                    
                    const batch = supabasePayload.slice(b, b + batchSize);
                    const { error } = await supabaseClient.from('external_sales').insert(batch);
                    if (error) {
                        const batchNoId = batch.map(({ id, ...rest }) => rest);
                        await supabaseClient.from('external_sales').insert(batchNoId);
                    }
                }
                
                this.updateImportProgress(100, `¡Importación completada! ${preparedRecords.length} registros guardados.`);
                await new Promise(r => setTimeout(r, 500));
                this.hideImportLoadingOverlay();
                Utils.showToast(`¡Importación completada! ${preparedRecords.length} registros guardados.`, 'success');
            } catch (dbErr) {
                console.warn('Nota: Guardado local activo. Supabase:', dbErr);
                this.hideImportLoadingOverlay();
                Utils.showToast(`Se guardaron ${preparedRecords.length} registros en almacenamiento local.`, 'success');
            }
        } catch (fatalErr) {
            console.error('Error fatal al guardar registros:', fatalErr);
            this.hideImportLoadingOverlay();
            this.showImportErrorModal(
                'Error al Guardar',
                'Ocurrió un error inesperado al guardar los registros.',
                fatalErr.message || String(fatalErr)
            );
        }
    },

    renderProductProfitTable() {
        const tbody = document.getElementById('isProductProfitTable');
        if (!tbody) return;

        const productMap = {};

        // 1. Process Guides (Orders)
        const filteredGuides = this.guides || [];
        filteredGuides.forEach(g => {
            if (this.isCancelado(g) || g.status === 'CANCELLED' || g.status === 'ANULADO') return;
            const gCountry = g.country || this.getCountryFromCity(g.cities);
            if (!this.matchesCountryFilter(gCountry)) return;
            const gDate = g.created_at ? g.created_at.split('T')[0] : (g.date || '');
            if (this.filters.dateFrom && gDate < this.filters.dateFrom) return;
            if (this.filters.dateTo && gDate > this.filters.dateTo) return;

            const isExcluded = this.isExcludedFromSales(g);
            const items = g.guide_items || g.products || g.items || [];
            const shippingUSD = this.getGuideShippingCostUSD(g);
            const shippingPerItem = items.length > 0 ? (shippingUSD / items.length) : 0;
            const totalRev = isExcluded ? 0 : this.getGuideRevenueUSD(g);
            const totalItemsCost = items.reduce((s, item) => {
                const prod = item.products || item;
                const unitCost = window.ProductsModule ? window.ProductsModule.getRealCost(prod) : parseFloat(prod.cost || 0) * 40000;
                return s + (unitCost * (item.quantity || 1));
            }, 0);

            items.forEach(item => {
                const prod = item.products || item;
                const rawName = prod.name || item.name || 'Producto Desconocido';
                const name = this.productMappings[rawName] || rawName;
                if (!this.matchesProductFilter([rawName, name])) return;

                const qty = parseInt(item.quantity || 1);
                const unitCost = window.ProductsModule ? window.ProductsModule.getRealCost(prod) : parseFloat(prod.cost || 0) * 40000;
                const realCost = isExcluded ? 0 : (unitCost * qty);
                const revProp = isExcluded ? 0 : (totalItemsCost > 0 ? (realCost / totalItemsCost) * totalRev : (totalRev / items.length));

                if (!productMap[name]) {
                    productMap[name] = {
                        name, orders: 0, deliveredOrders: 0, returnedOrders: 0, units: 0, revenue: 0, cost: 0, shipping: 0, freight: 0, adSpend: 0
                    };
                }
                if (!isExcluded) {
                    productMap[name].orders += 1;
                    const guideStatus = g.status || g.delivery_status || '';
                    if (guideStatus === 'ENTREGADO' || guideStatus === 'DELIVERED') {
                        productMap[name].deliveredOrders += 1;
                    } else if (guideStatus === 'RETURNED' || guideStatus === 'DEVUELTO') {
                        productMap[name].returnedOrders += 1;
                    }
                    productMap[name].units += qty;
                    productMap[name].revenue += revProp;
                    productMap[name].cost += realCost;
                }
                productMap[name].shipping += shippingPerItem;
            });
        });

        // 2. Process External Sales (Otras Plataformas)
        const extSales = this.getFilteredExternalSales();
        extSales.forEach(s => {
            const rawName = s.product_name || s.description || 'Venta Manual';
            const name = this.productMappings[rawName] || rawName;
            if (!this.matchesProductFilter([rawName, name])) return;

            if (!productMap[name]) {
                productMap[name] = {
                    name, orders: 0, deliveredOrders: 0, returnedOrders: 0, units: 0, revenue: 0, cost: 0, shipping: 0, freight: 0, adSpend: 0
                };
            }
            const delivered = parseInt(s.delivered || 0);
            const returned = parseInt(s.returned || 0);
            productMap[name].orders += (delivered + returned);
            productMap[name].deliveredOrders += delivered;
            productMap[name].returnedOrders += returned;
            productMap[name].revenue += parseFloat(s.revenue || 0);
            productMap[name].cost += parseFloat(s.product_cost || 0);
            productMap[name].shipping += (parseFloat(s.shipping_cost || 0) + parseFloat(s.return_shipping_cost || 0));
        });

        // 3. Process Ad Expenses per Product
        const adExpenses = this.getFilteredAdExpenses();
        adExpenses.forEach(exp => {
            const rawName = exp.product_name;
            if (!rawName) return;
            const name = this.productMappings[rawName] || rawName;
            if (!this.matchesProductFilter([rawName, name])) return;

            if (productMap[name]) {
                productMap[name].adSpend += parseFloat(exp.amount_spent || 0);
            } else {
                productMap[name] = {
                    name, orders: 0, units: 0, revenue: 0, cost: 0, shipping: 0, freight: 0, adSpend: parseFloat(exp.amount_spent || 0)
                };
            }
        });

        let productList = Object.values(productMap);

        // Apply Visual Groups
        (this.visualMergedGroups || []).forEach((group, index) => {
            const mergedProduct = {
                name: group.name, orders: 0, deliveredOrders: 0, returnedOrders: 0, units: 0, revenue: 0, cost: 0, shipping: 0, freight: 0, adSpend: 0,
                isVisualGroup: true,
                groupId: index
            };

            let foundAny = false;
            productList = productList.filter(p => {
                if (group.products.includes(p.name)) {
                    mergedProduct.orders += p.orders;
                    mergedProduct.deliveredOrders += (p.deliveredOrders || 0);
                    mergedProduct.returnedOrders += (p.returnedOrders || 0);
                    mergedProduct.units += p.units;
                    mergedProduct.revenue += p.revenue;
                    mergedProduct.cost += p.cost;
                    mergedProduct.shipping += p.shipping;
                    mergedProduct.freight += p.freight;
                    mergedProduct.adSpend += p.adSpend;
                    foundAny = true;
                    return false;
                }
                return true;
            });
            
            if (foundAny) {
                productList.push(mergedProduct);
            }
        });

        // Sort by revenue
        productList.sort((a, b) => b.revenue - a.revenue);

        if (productList.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="11" style="text-align: center; color: var(--text-muted); padding: 2rem;">
                        No hay datos de productos en el período seleccionado.
                    </td>
                </tr>`;
            return;
        }

        const totalRow = {
            orders: 0, deliveredOrders: 0, returnedOrders: 0, units: 0, revenue: 0, cost: 0, shipping: 0, adSpend: 0
        };

        tbody.innerHTML = productList.map(p => {
            const grossProfit = p.revenue - p.cost - p.shipping - p.freight - p.adSpend;
            const margin = p.revenue > 0 ? ((grossProfit / p.revenue) * 100).toFixed(1) : '0.0';
            const costPct = p.revenue > 0 ? ((p.cost / p.revenue) * 100).toFixed(1) : '0.0';
            const shippingPct = p.revenue > 0 ? ((p.shipping / p.revenue) * 100).toFixed(1) : '0.0';
            const adPct = p.revenue > 0 ? ((p.adSpend / p.revenue) * 100).toFixed(1) : '0.0';

            totalRow.orders += p.orders;
            totalRow.deliveredOrders += (p.deliveredOrders || 0);
            totalRow.returnedOrders += (p.returnedOrders || 0);
            totalRow.units += p.units;
            totalRow.revenue += p.revenue;
            totalRow.cost += p.cost;
            totalRow.shipping += p.shipping;
            totalRow.adSpend += p.adSpend;

            const escapedName = p.name.replace(/"/g, '&quot;');
            let actionHtml = `<div style="display: flex; align-items: center; justify-content: flex-end; gap: 0.5rem;">
                <button class="btn btn-icon btn-sm" style="color: #8b5cf6; background: rgba(139, 92, 246, 0.1); border: none;" onclick="IncomeStatementModule.openLinkCampaignsForProduct('${escapedName}')" title="Vincular Campañas">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path>
                        <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path>
                    </svg>
                </button>
                <button class="btn btn-icon btn-sm is-detail-btn" onclick="IncomeStatementModule.showProductOrdersDetail('${escapedName}', ${p.isVisualGroup ? 'true' : 'false'}, ${p.groupId !== undefined ? p.groupId : 'null'})" title="Ver detalle de pedidos de ${escapedName}">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <circle cx="11" cy="11" r="8"></circle>
                        <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                    </svg>
                </button>`;
                
            if (p.isVisualGroup) {
                actionHtml += `<button class="btn btn-icon btn-sm" style="color: #f59e0b; background: rgba(245, 158, 11, 0.1); border: none;" onclick="IncomeStatementModule.editVisualGroupName(${p.groupId})" title="Editar nombre del grupo">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                    </svg>
                </button>`;
                actionHtml += `<button class="btn btn-sm" style="background: rgba(239, 68, 68, 0.1); color: var(--danger); border: 1px solid rgba(239, 68, 68, 0.2); font-size: 0.75rem; padding: 0.25rem 0.5rem;" onclick="IncomeStatementModule.ungroupVisualGroup(${p.groupId})">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                    Desagrupar
                </button>`;
            }
            actionHtml += `</div>`;

            return `
                <tr ${p.isVisualGroup ? 'style="background: rgba(14, 165, 233, 0.05);"' : ''}>
                    <td style="text-align: center;">
                        ${!p.isVisualGroup ? `<input type="checkbox" class="unified-sale-checkbox" value="${escapedName}" onchange="IncomeStatementModule.updateSelectedUnifiedSalesCount()">` : ''}
                    </td>
                    <td>
                        <strong>${p.name}</strong>
                        ${p.isVisualGroup ? `<span style="margin-left: 0.5rem; font-size: 0.65rem; padding: 2px 6px; background: rgba(14, 165, 233, 0.15); color: #0ea5e9; border-radius: 12px; font-weight: 600; border: 1px solid rgba(14, 165, 233, 0.3);">Grupo Visual</span>` : ''}
                    </td>
                    <td style="text-align: right; font-weight: 600;">${p.orders}</td>
                    <td style="text-align: right; font-weight: 600; color: var(--success);">${p.deliveredOrders || 0}</td>
                    <td style="text-align: right;">${p.units || '-'}</td>
                    <td style="text-align: right; font-weight: 600; color: var(--success);">${this.formatCurrency(p.revenue)}</td>
                    <td style="text-align: right; color: var(--danger);">
                        <div>${this.formatCurrency(p.cost)}</div>
                        <div style="font-size: 0.72rem; opacity: 0.8;">${costPct}%</div>
                    </td>
                    <td style="text-align: right; color: var(--danger);">
                        <div>${this.formatCurrency(p.shipping)}</div>
                        <div style="font-size: 0.72rem; opacity: 0.8;">${shippingPct}%</div>
                    </td>
                    <td style="text-align: right; color: #ec4899; font-weight: 500;">
                        <div>${this.formatCurrency(p.adSpend)}</div>
                        <div style="font-size: 0.72rem; opacity: 0.85;">${adPct}%</div>
                    </td>
                    <td style="text-align: right; font-weight: 600; color: ${grossProfit >= 0 ? 'var(--success)' : 'var(--danger)'};">
                        ${this.formatCurrency(grossProfit)}
                    </td>
                    <td style="text-align: center;">
                        <span class="is-margin-badge ${parseFloat(margin) >= 30 ? 'good' : parseFloat(margin) >= 15 ? 'warning' : 'bad'}">${margin}%</span>
                    </td>
                    <td style="text-align: right;">${actionHtml}</td>
                </tr>`;
        }).join('');

        // Total row
        const totalGross = totalRow.revenue - totalRow.cost - totalRow.shipping - totalRow.adSpend;
        const totalMargin = totalRow.revenue > 0 ? ((totalGross / totalRow.revenue) * 100).toFixed(1) : '0.0';
        const totalCostPct = totalRow.revenue > 0 ? ((totalRow.cost / totalRow.revenue) * 100).toFixed(1) : '0.0';
        const totalShippingPct = totalRow.revenue > 0 ? ((totalRow.shipping / totalRow.revenue) * 100).toFixed(1) : '0.0';
        const totalAdPct = totalRow.revenue > 0 ? ((totalRow.adSpend / totalRow.revenue) * 100).toFixed(1) : '0.0';

        tbody.innerHTML += `
            <tr class="is-total-row">
                <td colspan="2"><strong>TOTAL PRODUCTOS</strong></td>
                <td style="text-align: right; font-weight: 700;">${totalRow.orders}</td>
                <td style="text-align: right; font-weight: 700; color: var(--success);">${totalRow.deliveredOrders}</td>
                <td style="text-align: right; font-weight: 700;">${totalRow.units}</td>
                <td style="text-align: right; font-weight: 700; color: var(--success);">${this.formatCurrency(totalRow.revenue)}</td>
                <td style="text-align: right; font-weight: 700; color: var(--danger);">
                    <div>${this.formatCurrency(totalRow.cost)}</div>
                    <div style="font-size: 0.72rem; opacity: 0.9;">${totalCostPct}%</div>
                </td>
                <td style="text-align: right; font-weight: 700; color: var(--danger);">
                    <div>${this.formatCurrency(totalRow.shipping)}</div>
                    <div style="font-size: 0.72rem; opacity: 0.9;">${totalShippingPct}%</div>
                </td>
                <td style="text-align: right; font-weight: 700; color: #ec4899;">
                    <div>${this.formatCurrency(totalRow.adSpend)}</div>
                    <div style="font-size: 0.72rem; opacity: 0.9;">${totalAdPct}%</div>
                </td>
                <td style="text-align: right; font-weight: 700; color: ${totalGross >= 0 ? 'var(--success)' : 'var(--danger)'};">${this.formatCurrency(totalGross)}</td>
                <td style="text-align: center;"><span class="is-margin-badge ${parseFloat(totalMargin) >= 30 ? 'good' : parseFloat(totalMargin) >= 15 ? 'warning' : 'bad'}">${totalMargin}%</span></td>
                <td></td>
            </tr>`;
            
        this.updateSelectedUnifiedSalesCount();
    },

    copyPLSummaryToClipboard() {
        const salesData = this.getSalesByCountry();
        const adExpData = this.getAdExpensesByCountry();
        const opExpData = this.getOpExpensesByCountry();

        const totalRevenue = salesData.reduce((s, c) => s + c.totalRevenue, 0);
        const totalCOGS = salesData.reduce((s, c) => s + c.totalCost, 0);
        const totalShipping = salesData.reduce((s, c) => s + c.totalShipping, 0);
        const grossProfit = totalRevenue - totalCOGS - totalShipping;
        const totalAdSpend = adExpData.reduce((s, c) => s + c.totalSpent, 0);
        const totalOpExp = opExpData.reduce((s, c) => s + c.total, 0);
        const totalExpenses = totalAdSpend + totalOpExp;
        const netProfit = grossProfit - totalExpenses;

        const grossMargin = totalRevenue > 0 ? ((grossProfit / totalRevenue) * 100).toFixed(1) : '0.0';
        const netMargin = totalRevenue > 0 ? ((netProfit / totalRevenue) * 100).toFixed(1) : '0.0';
        const pct = (val) => totalRevenue > 0 ? ((val / totalRevenue) * 100).toFixed(1) + '%' : '0.0%';
        const fmt = (v) => '$' + Number(v || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

        const dateRange = (this.filters.dateFrom && this.filters.dateTo)
            ? `Período: ${this.filters.dateFrom} al ${this.filters.dateTo}`
            : `Fecha: ${new Date().toISOString().split('T')[0]}`;

        let text = `📊 ESTADO DE RESULTADOS (P&L)\n${dateRange}\n`;
        text += `════════════════════════════════════\n`;
        text += `💵 Total Ventas: ${fmt(totalRevenue)} (100%)\n`;
        text += `📦 Costo Mercancía: -${fmt(totalCOGS)} (${pct(totalCOGS)})\n`;
        text += `🚚 Fletes (Envíos & Devs): -${fmt(totalShipping)} (${pct(totalShipping)})\n`;
        text += `────────────────────────────────────\n`;
        text += `✨ UTILIDAD BRUTA: ${fmt(grossProfit)} (${grossMargin}%)\n`;
        text += `────────────────────────────────────\n`;
        text += `📢 Inversión Publicitaria (Ads): -${fmt(totalAdSpend)} (${pct(totalAdSpend)})\n`;
        text += `👥 Gastos Operativos: -${fmt(totalOpExp)} (${pct(totalOpExp)})\n`;
        text += `────────────────────────────────────\n`;
        text += `🏆 UTILIDAD NETA: ${fmt(netProfit)} (${netMargin}%)\n`;
        text += `════════════════════════════════════\n`;

        if (navigator && navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(text).then(() => {
                Utils.showToast('¡Resumen financiero copiado al portapapeles!', 'success');
            }).catch(() => {
                Utils.showToast('No se pudo copiar el texto automáticamente.', 'warning');
            });
        } else {
            Utils.showToast('Portapapeles no soportado en este navegador.', 'info');
        }
    },

    renderPLStatement() {
        const container = document.getElementById('isPLStatement');
        if (!container) return;

        const salesData = this.getSalesByCountry();
        const adExpData = this.getAdExpensesByCountry();
        const opExpData = this.getOpExpensesByCountry();

        const totalRevenue = salesData.reduce((s, c) => s + c.totalRevenue, 0);
        const totalCOGS = salesData.reduce((s, c) => s + c.totalCost, 0);
        const totalShipping = salesData.reduce((s, c) => s + c.totalShipping, 0);
        const grossProfit = totalRevenue - totalCOGS - totalShipping;
        const totalAdSpend = adExpData.reduce((s, c) => s + c.totalSpent, 0);
        const totalOpExp = opExpData.reduce((s, c) => s + c.total, 0);
        const totalExpenses = totalAdSpend + totalOpExp;
        const netProfit = grossProfit - totalExpenses;
        const grossMargin = totalRevenue > 0 ? ((grossProfit / totalRevenue) * 100).toFixed(1) : '0.0';
        const netMargin = totalRevenue > 0 ? ((netProfit / totalRevenue) * 100).toFixed(1) : '0.0';

        const pct = (val) => totalRevenue > 0 ? ((val / totalRevenue) * 100).toFixed(1) + '%' : '0.0%';
        const pctNum = (val) => totalRevenue > 0 ? Math.min(100, Math.max(0, (val / totalRevenue) * 100)).toFixed(1) : 0;
        const fmt = (val) => '$' + Number(val || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

        const totalDelivered = salesData.reduce((s, c) => s + (c.deliveredOrders || 0), 0);
        const totalReturned = salesData.reduce((s, c) => s + (c.returnedOrders || 0), 0);
        const totalShipped = salesData.reduce((s, c) => s + (c.shippedOrders || 0), 0);
        const totalUnits = salesData.reduce((s, c) => s + (c.unitsSold || 0), 0);
        const totalOrders = totalDelivered + totalReturned;

        // AOV real: solo pedidos entregados (que sí generaron ingreso)
        const aov = totalDelivered > 0 ? (totalRevenue / totalDelivered) : 0;
        // Costo promedio de envío por pedido despachado (incluye devoluciones)
        const avgShippingCost = totalShipped > 0 ? (totalShipping / totalShipped) : 0;
        // Costo promedio de producto por unidad vendida
        const avgProductCost = totalUnits > 0 ? (totalCOGS / totalUnits) : 0;
        // Margen de contribución por pedido entregado
        const contributionPerOrder = totalDelivered > 0 ? (grossProfit / totalDelivered) : 0;
        // Utilidad neta por pedido entregado
        const netPerOrder = totalDelivered > 0 ? (netProfit / totalDelivered) : 0;
        // Tasa de devolución
        const returnRate = (totalDelivered + totalReturned) > 0
            ? ((totalReturned / (totalDelivered + totalReturned)) * 100).toFixed(1) + '%'
            : '0.0%';
        // Tasa de entrega efectiva
        const deliveryRate = (totalDelivered + totalReturned) > 0
            ? ((totalDelivered / (totalDelivered + totalReturned)) * 100).toFixed(1) + '%'
            : '0.0%';
        // ROAS, CAC y break-even
        const roas = totalAdSpend > 0 ? (totalRevenue / totalAdSpend).toFixed(2) + 'x' : 'N/A';
        const cac = totalDelivered > 0 ? (totalAdSpend / totalDelivered) : 0;
        const grossMarginRatio = totalRevenue > 0 ? (grossProfit / totalRevenue) : 0;
        const breakEvenRoas = grossMarginRatio > 0 ? (1 / grossMarginRatio).toFixed(2) + 'x' : 'N/A';
        const costRatio = totalRevenue > 0 ? (((totalCOGS + totalShipping + totalExpenses) / totalRevenue) * 100).toFixed(1) + '%' : '0.0%';

        // Helper to render mini progress bar and percentage
        const renderPctCell = (val, color, isBold = false) => {
            const pNum = pctNum(val);
            const pStr = pct(val);
            return `
                <div class="is-pl-pct-cell">
                    <div class="is-pl-pct-bar"><div style="width: ${pNum}%; background: ${color};"></div></div>
                    <span class="is-pl-pct-val ${isBold ? 'is-bold' : ''}" style="color: ${color};">${pStr}</span>
                </div>`;
        };

        // Operational expenses breakdown (usa los montos ya prorrateados por país,
        // no el monto crudo del gasto, para que un gasto global no aparezca al 100%
        // en la vista de un solo país)
        let opCategoriesHTML = '';
        const allCategories = {};
        opExpData.forEach(countryData => {
            Object.entries(countryData.byCategory || {}).forEach(([cat, amount]) => {
                allCategories[cat] = (allCategories[cat] || 0) + amount;
            });
        });

        for (const [cat, amount] of Object.entries(allCategories).sort((a, b) => b[1] - a[1])) {
            opCategoriesHTML += `
                <div class="is-pl-line is-pl-sub">
                    <div class="is-pl-concept is-pl-sub-concept">${cat}</div>
                    <div class="is-pl-amount is-neg">${fmt(amount)}</div>
                    <div class="is-pl-pct">${renderPctCell(amount, 'var(--danger)')}</div>
                </div>`;
        }

        const netClass = netProfit >= 0 ? 'is-profit' : 'is-loss';

        container.innerHTML = `
            <!-- Executive KPI Ribbon -->
            <div class="is-pl-ribbon">
                <div class="is-pl-kpi">
                    <div class="is-pl-kpi-label">Ventas Netas</div>
                    <div class="is-pl-kpi-value">${fmt(totalRevenue)}</div>
                    <div class="is-pl-kpi-sub">Base 100%</div>
                </div>
                <div class="is-pl-kpi is-accent-success">
                    <div class="is-pl-kpi-label">Margen Bruto</div>
                    <div class="is-pl-kpi-value is-success">${fmt(grossProfit)}</div>
                    <div class="is-pl-kpi-sub is-success">${grossMargin}% s/ventas</div>
                </div>
                <div class="is-pl-kpi is-accent-warning">
                    <div class="is-pl-kpi-label">Marketing & Ads</div>
                    <div class="is-pl-kpi-value is-warning">${fmt(totalAdSpend)}</div>
                    <div class="is-pl-kpi-sub">${pct(totalAdSpend)} s/ventas · ROAS ${roas}</div>
                </div>
                <div class="is-pl-kpi ${netClass}">
                    <div class="is-pl-kpi-label">Utilidad Neta</div>
                    <div class="is-pl-kpi-value ${netProfit >= 0 ? 'is-success' : 'is-danger'}">${fmt(netProfit)}</div>
                    <div class="is-pl-kpi-sub ${netProfit >= 0 ? 'is-success' : 'is-danger'}">${netMargin}% margen ${netProfit >= 0 ? '· rentable' : '· pérdida'}</div>
                </div>
            </div>

            <!-- Financial Statement Table -->
            <div class="is-pl-table-wrap">
                <div class="is-pl-table">
                    <div class="is-pl-thead">
                        <div>Concepto</div>
                        <div class="is-align-right">Monto (USD)</div>
                        <div class="is-align-right">% de Ventas</div>
                    </div>

                    <!-- INGRESOS -->
                    <div class="is-pl-section-title">Ingresos Operacionales</div>
                    <div class="is-pl-line">
                        <div class="is-pl-concept">Ventas Netas Realizadas</div>
                        <div class="is-pl-amount is-success">${fmt(totalRevenue)}</div>
                        <div class="is-pl-pct">${renderPctCell(totalRevenue, 'var(--success)', true)}</div>
                    </div>
                    <div class="is-pl-line is-pl-subtotal">
                        <div class="is-pl-concept">Total Ingresos</div>
                        <div class="is-pl-amount is-success">${fmt(totalRevenue)}</div>
                        <div class="is-pl-pct">${renderPctCell(totalRevenue, 'var(--success)', true)}</div>
                    </div>

                    <!-- COGS -->
                    <div class="is-pl-section-title">Costos Directos de Venta (COGS)</div>
                    <div class="is-pl-line">
                        <div class="is-pl-concept">Costo de Mercancía Vendida (Productos)</div>
                        <div class="is-pl-amount is-neg">${fmt(totalCOGS)}</div>
                        <div class="is-pl-pct">${renderPctCell(totalCOGS, 'var(--danger)')}</div>
                    </div>
                    <div class="is-pl-line">
                        <div class="is-pl-concept">Costo de Fletes (Envíos y Devoluciones)</div>
                        <div class="is-pl-amount is-neg">${fmt(totalShipping)}</div>
                        <div class="is-pl-pct">${renderPctCell(totalShipping, 'var(--danger)')}</div>
                    </div>
                    <div class="is-pl-line is-pl-subtotal is-highlight-success">
                        <div class="is-pl-concept">Utilidad Bruta</div>
                        <div class="is-pl-amount is-success">${fmt(grossProfit)}</div>
                        <div class="is-pl-pct">${renderPctCell(grossProfit, 'var(--success)', true)}</div>
                    </div>

                    <!-- OPEX -->
                    <div class="is-pl-section-title">Gastos Operativos (OPEX y Marketing)</div>
                    <div class="is-pl-line">
                        <div class="is-pl-concept">Inversión Publicitaria (Facebook / Ads)</div>
                        <div class="is-pl-amount is-warning">${fmt(totalAdSpend)}</div>
                        <div class="is-pl-pct">${renderPctCell(totalAdSpend, 'var(--warning)')}</div>
                    </div>
                    ${opCategoriesHTML}
                    <div class="is-pl-line is-pl-subtotal is-highlight-danger">
                        <div class="is-pl-concept">Total Gastos Operativos</div>
                        <div class="is-pl-amount is-neg">${fmt(totalExpenses)}</div>
                        <div class="is-pl-pct">${renderPctCell(totalExpenses, 'var(--danger)', true)}</div>
                    </div>

                    <!-- UTILIDAD NETA -->
                    <div class="is-pl-final ${netClass}">
                        <div class="is-pl-final-label">
                            <div class="is-pl-final-title">Utilidad Neta (Resultado Final)</div>
                            <div class="is-pl-final-sub">Ganancia líquida después de costos, fletes, publicidad y gastos operativos.</div>
                        </div>
                        <div class="is-pl-final-amount ${netProfit >= 0 ? 'is-success' : 'is-danger'}">${fmt(netProfit)}</div>
                        <div class="is-pl-final-margin">
                            <span class="is-pl-margin-chip ${netProfit >= 0 ? 'is-success' : 'is-danger'}">${netMargin}%</span>
                        </div>
                    </div>
                </div>
            </div>

            <!-- E-commerce KPI Footer (grouped by category) -->
            <div class="is-pl-footer-group">
                <div class="is-pl-footer-label">Operación</div>
                <div class="is-pl-footer">
                    <div class="is-pl-kpi-tile" title="Pedidos que fueron entregados y sí generaron ingresos.">
                        <div class="is-pl-kpi-tile-val is-success">${totalDelivered}</div>
                        <div class="is-pl-kpi-tile-lbl">Pedidos Entregados</div>
                    </div>
                    <div class="is-pl-kpi-tile" title="Pedidos rechazados o devueltos que sí generaron costo de flete.">
                        <div class="is-pl-kpi-tile-val is-danger">${totalReturned}</div>
                        <div class="is-pl-kpi-tile-lbl">Pedidos Devueltos</div>
                    </div>
                    <div class="is-pl-kpi-tile" title="Porcentaje de pedidos entregados con éxito sobre el total despachado.">
                        <div class="is-pl-kpi-tile-val is-success">${deliveryRate}</div>
                        <div class="is-pl-kpi-tile-lbl">Tasa de Entrega</div>
                    </div>
                    <div class="is-pl-kpi-tile" title="Porcentaje de pedidos devueltos sobre el total despachado. Mientras más bajo, mejor.">
                        <div class="is-pl-kpi-tile-val is-danger">${returnRate}</div>
                        <div class="is-pl-kpi-tile-lbl">Tasa de Devolución</div>
                    </div>
                    <div class="is-pl-kpi-tile" title="Unidades totales vendidas (solo pedidos entregados).">
                        <div class="is-pl-kpi-tile-val" style="color: var(--info);">${totalUnits}</div>
                        <div class="is-pl-kpi-tile-lbl">Unidades Vendidas</div>
                    </div>
                </div>
            </div>

            <div class="is-pl-footer-group">
                <div class="is-pl-footer-label">Ingreso &amp; Costo por Pedido</div>
                <div class="is-pl-footer">
                    <div class="is-pl-kpi-tile" title="Ticket promedio real: ingresos totales / pedidos entregados. Excluye devoluciones.">
                        <div class="is-pl-kpi-tile-val is-success">${fmt(aov)}</div>
                        <div class="is-pl-kpi-tile-lbl">Ticket Prom. Real (AOV)</div>
                    </div>
                    <div class="is-pl-kpi-tile" title="Costo promedio de flete por cada pedido despachado (incluye devoluciones).">
                        <div class="is-pl-kpi-tile-val is-warning">${fmt(avgShippingCost)}</div>
                        <div class="is-pl-kpi-tile-lbl">Costo Envío Prom.</div>
                    </div>
                    <div class="is-pl-kpi-tile" title="Costo de mercancía promedio por unidad vendida.">
                        <div class="is-pl-kpi-tile-val is-warning">${fmt(avgProductCost)}</div>
                        <div class="is-pl-kpi-tile-lbl">Costo Producto / Unidad</div>
                    </div>
                    <div class="is-pl-kpi-tile" title="Utilidad bruta promedio (después de COGS y fletes) por pedido entregado.">
                        <div class="is-pl-kpi-tile-val is-success">${fmt(contributionPerOrder)}</div>
                        <div class="is-pl-kpi-tile-lbl">Margen Bruto / Pedido</div>
                    </div>
                    <div class="is-pl-kpi-tile" title="Utilidad neta final por cada pedido entregado, después de TODOS los gastos.">
                        <div class="is-pl-kpi-tile-val ${netPerOrder >= 0 ? 'is-success' : 'is-danger'}">${fmt(netPerOrder)}</div>
                        <div class="is-pl-kpi-tile-lbl">Utilidad Neta / Pedido</div>
                    </div>
                </div>
            </div>

            <div class="is-pl-footer-group">
                <div class="is-pl-footer-label">Marketing &amp; Adquisición</div>
                <div class="is-pl-footer">
                    <div class="is-pl-kpi-tile" title="Compras registradas directamente desde Facebook Ads.">
                        <div class="is-pl-kpi-tile-val" style="color: var(--info);">${adExpData.reduce((s, c) => s + (c.totalPurchases || 0), 0)}</div>
                        <div class="is-pl-kpi-tile-lbl">Compras vía Ads</div>
                    </div>
                    <div class="is-pl-kpi-tile" title="Return On Ad Spend: ingresos / inversión publicitaria. Mayor es mejor.">
                        <div class="is-pl-kpi-tile-val is-warning">${roas}</div>
                        <div class="is-pl-kpi-tile-lbl">ROAS</div>
                    </div>
                    <div class="is-pl-kpi-tile" title="ROAS mínimo para no perder plata dado tu margen bruto. Si tu ROAS actual está por debajo de este número, estás perdiendo.">
                        <div class="is-pl-kpi-tile-val" style="color: var(--primary);">${breakEvenRoas}</div>
                        <div class="is-pl-kpi-tile-lbl">ROAS Break-Even</div>
                    </div>
                    <div class="is-pl-kpi-tile" title="Costo de Adquisición de Cliente: inversión publicitaria / pedidos entregados.">
                        <div class="is-pl-kpi-tile-val is-warning">${fmt(cac)}</div>
                        <div class="is-pl-kpi-tile-lbl">CAC (Costo x Pedido)</div>
                    </div>
                    <div class="is-pl-kpi-tile" title="Suma de COGS + fletes + gastos operativos como porcentaje de las ventas.">
                        <div class="is-pl-kpi-tile-val is-danger">${costRatio}</div>
                        <div class="is-pl-kpi-tile-lbl">Costos / Ventas</div>
                    </div>
                </div>
            </div>
        `;
    },

    // ========================================
    // FACEBOOK REPORT IMPORT - SMART PARSER
    // ========================================

    // Keyword dictionaries for smart column detection
    // Each target field has arrays of keywords. A column matches if it contains ALL keywords in any group.
    COLUMN_KEYWORDS: {
        amount_spent: [
            ['amount', 'spent'],
            ['importe', 'gastado'],
            ['monto', 'gastado'],
            ['gasto'],
            ['spend'],
            ['spent'],
            ['cost'],           // fallback for "Total Cost"
            ['costo total'],
        ],
        campaign_name: [
            ['campaign', 'name'],
            ['nombre', 'campaña'],
            ['nombre', 'campa'],
            ['campaign'],
            ['campaña'],
            ['campa'],
        ],
        ad_set_name: [
            ['ad', 'set', 'name'],
            ['adset', 'name'],
            ['conjunto', 'anuncio'],
            ['ad', 'set'],
            ['adset'],
        ],
        ad_name: [
            ['ad', 'name'],
            ['nombre', 'anuncio'],
        ],
        impressions: [
            ['impression'],
            ['impresion'],
        ],
        clicks: [
            ['link', 'click'],
            ['clic', 'enlace'],
            ['click'],
            ['clic'],
        ],
        reach: [
            ['reach'],
            ['alcance'],
        ],
        purchases: [
            ['purchase'],
            ['compra'],
            ['resultado'],
            ['result'],
            ['conversion'],
        ],
        cpc: [
            ['cpc'],
            ['cost', 'per', 'click'],
            ['costo', 'clic'],
        ],
        cpm: [
            ['cpm'],
            ['cost', 'per', '1,000'],
            ['cost', 'per', '1000'],
            ['costo', '1.000'],
        ],
        ctr: [
            ['ctr'],
            ['click', 'through'],
            ['tasa', 'clic'],
        ],
        cost_per_purchase: [
            ['cost', 'per', 'result'],
            ['cost', 'per', 'purchase'],
            ['costo', 'resultado'],
            ['costo', 'compra'],
            ['cost', 'result'],
        ],
        month: [
            ['mes'],
            ['month'],
            ['periodo'],
            ['period'],
        ],
        date_start: [
            ['reporting', 'start'],
            ['inicio', 'informe'],
            ['report', 'start'],
            ['date', 'start'],
            ['fecha', 'inicio'],
            ['day'],
            ['fecha'],
            ['date'],
        ],
        date_end: [
            ['reporting', 'end'],
            ['fin', 'informe'],
            ['report', 'end'],
            ['date', 'end'],
            ['fecha', 'fin'],
        ],
        frequency: [
            ['frequency'],
            ['frecuencia'],
        ],
    },

    /**
     * Show/hide TRM input based on currency selection
     */
    onCurrencyChange() {
        const currency = document.getElementById('fbImportCurrency')?.value || 'USD';
        const trmContainer = document.getElementById('trmInputContainer');
        const conversionInfo = document.getElementById('conversionInfo');
        if (currency === 'COP') {
            if (trmContainer) trmContainer.style.display = 'flex';
            if (conversionInfo) conversionInfo.style.display = 'block';
        } else {
            if (trmContainer) trmContainer.style.display = 'none';
            if (conversionInfo) conversionInfo.style.display = 'none';
        }
    },

    /**
     * Parse a month name/number into a date (first day of that month)
     * Supports: "Enero", "Febrero", "Jan", "January", "01", "1", "2024-01", "Enero 2024", etc.
     */
    parseMonthToDate(val, year) {
        if (!val) return null;
        const str = String(val).trim().toLowerCase();

        // Map of month names to numbers
        const monthMap = {
            'enero': 1, 'febrero': 2, 'marzo': 3, 'abril': 4, 'mayo': 5, 'junio': 6,
            'julio': 7, 'agosto': 8, 'septiembre': 9, 'octubre': 10, 'noviembre': 11, 'diciembre': 12,
            'ene': 1, 'feb': 2, 'mar': 3, 'abr': 4, 'may': 5, 'jun': 6,
            'jul': 7, 'ago': 8, 'sep': 9, 'oct': 10, 'nov': 11, 'dic': 12,
            'january': 1, 'february': 2, 'march': 3, 'april': 4, 'june': 6,
            'july': 7, 'august': 8, 'september': 9, 'october': 10, 'november': 11, 'december': 12,
            'jan': 1, 'feb': 2, 'mar': 3, 'apr': 4, 'may': 5, 'jun': 6,
            'jul': 7, 'aug': 8, 'sep': 9, 'oct': 10, 'nov': 11, 'dec': 12,
        };

        // Try "Enero 2024" or "January 2024" format
        const monthYearMatch = str.match(/^(\w+)\s+(\d{4})$/);
        if (monthYearMatch) {
            const monthNum = monthMap[monthYearMatch[1]];
            if (monthNum) {
                return `${monthYearMatch[2]}-${String(monthNum).padStart(2, '0')}-01`;
            }
        }

        // Try "2024-01" format
        const isoMonthMatch = str.match(/^(\d{4})-(\d{1,2})$/);
        if (isoMonthMatch) {
            return `${isoMonthMatch[1]}-${isoMonthMatch[2].padStart(2, '0')}-01`;
        }

        // Try "01/2024" or "1/2024" format  
        const slashMatch = str.match(/^(\d{1,2})[\/\-](\d{4})$/);
        if (slashMatch) {
            return `${slashMatch[2]}-${slashMatch[1].padStart(2, '0')}-01`;
        }

        // Try month name only (use provided year or current year)
        const useYear = year || new Date().getFullYear();
        const monthNum = monthMap[str];
        if (monthNum) {
            return `${useYear}-${String(monthNum).padStart(2, '0')}-01`;
        }

        // Try pure number (1-12)
        const num = parseInt(str);
        if (num >= 1 && num <= 12) {
            return `${useYear}-${String(num).padStart(2, '0')}-01`;
        }

        return null;
    },

    /**
     * Filter ad expenses table with dedicated ad filters
     */
    filterAdExpenses() {
        this.renderAdExpensesTable();
    },

    /**
     * Clear ad expense filters
     */
    clearAdFilters() {
        const country = document.getElementById('adFilterCountry');
        const dateFrom = document.getElementById('adFilterDateFrom');
        const dateTo = document.getElementById('adFilterDateTo');
        const search = document.getElementById('adFilterSearch');
        if (country) country.value = '';
        if (dateFrom) dateFrom.value = '';
        if (dateTo) dateTo.value = '';
        if (search) search.value = '';
        this.renderAdExpensesTable();
    },

    handleFBFileUpload(event) {
        const file = event.target.files[0];
        if (!file) return;

        const statusEl = document.getElementById('fbImportStatus');
        const previewEl = document.getElementById('fbImportPreview');

        statusEl.style.display = 'block';
        statusEl.innerHTML = `
            <div style="display: flex; align-items: center; gap: 0.5rem; color: var(--primary);">
                <div class="spinner-sm"></div>
                Procesando archivo: ${file.name}...
            </div>`;

        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                let data = new Uint8Array(e.target.result);

                // Remove BOM if present (UTF-8 BOM: EF BB BF)
                if (data[0] === 0xEF && data[1] === 0xBB && data[2] === 0xBF) {
                    data = data.slice(3);
                }

                const workbook = XLSX.read(data, { type: 'array', codepage: 65001 });
                const firstSheet = workbook.Sheets[workbook.SheetNames[0]];

                // Try raw=false first for proper type conversion
                let jsonData = XLSX.utils.sheet_to_json(firstSheet, { defval: '', raw: false });

                // If no data, try with raw=true
                if (jsonData.length === 0) {
                    jsonData = XLSX.utils.sheet_to_json(firstSheet, { defval: '' });
                }

                // If still empty, check if there are multiple sheets
                if (jsonData.length === 0 && workbook.SheetNames.length > 1) {
                    for (let i = 1; i < workbook.SheetNames.length; i++) {
                        const altSheet = workbook.Sheets[workbook.SheetNames[i]];
                        jsonData = XLSX.utils.sheet_to_json(altSheet, { defval: '', raw: false });
                        if (jsonData.length > 0) break;
                    }
                }

                if (jsonData.length === 0) {
                    statusEl.innerHTML = `<div style="color: var(--danger);">❌ El archivo no contiene datos. Asegúrate de exportar la tabla desde tu Administrador de Anuncios.</div>`;
                    return;
                }

                // Clean column names (remove BOM, hidden chars, extra whitespace)
                jsonData = this.cleanColumnNames(jsonData);

                console.log('📊 FB Import - Raw columns found:', Object.keys(jsonData[0]));
                console.log('📊 FB Import - Sample row:', jsonData[0]);

                // Parse Facebook columns with smart detection
                const parseResult = this.parseFBReport(jsonData);
                this.fbImportData = parseResult.data;
                this.fbImportBatchId = `fb_${Date.now()}`;

                if (this.fbImportData.length === 0) {
                    // Show diagnostic info
                    const cols = Object.keys(jsonData[0]).join(', ');
                    statusEl.innerHTML = `
                        <div style="padding: 1rem; background: rgba(239, 68, 68, 0.08); border: 1px solid rgba(239, 68, 68, 0.2); border-radius: var(--radius-md);">
                            <div style="font-weight: 600; color: var(--danger); margin-bottom: 0.5rem;">❌ No se pudieron identificar datos válidos</div>
                            <div style="font-size: 0.85rem; color: var(--text-secondary); margin-bottom: 0.75rem;">
                                Se encontraron <strong>${jsonData.length}</strong> filas pero ninguna tiene un monto de gasto válido.
                            </div>
                            <details style="cursor: pointer;">
                                <summary style="font-size: 0.8rem; color: var(--text-muted);">🔍 Diagnóstico: Columnas detectadas</summary>
                                <div style="margin-top: 0.5rem; font-size: 0.75rem; padding: 0.5rem; background: var(--surface); border-radius: var(--radius-sm); font-family: monospace; overflow-x: auto;">
                                    <div style="margin-bottom: 0.25rem;"><strong>Columnas del archivo:</strong></div>
                                    <div style="color: var(--text-muted); word-break: break-all;">${cols}</div>
                                    <div style="margin-top: 0.5rem;"><strong>Mapeo detectado:</strong></div>
                                    ${parseResult.diagnostics}
                                </div>
                            </details>
                        </div>`;
                    return;
                }

                // Show total + diagnostics
                const totalSpent = this.fbImportData.reduce((s, d) => s + d.amount_spent, 0);
                statusEl.innerHTML = `
                    <div style="padding: 0.75rem; background: rgba(34, 197, 94, 0.1); border-radius: var(--radius-md);">
                        <div style="display: flex; align-items: center; gap: 0.75rem;">
                            <span style="font-size: 1.5rem;">✅</span>
                            <div>
                                <div style="font-weight: 600; color: var(--success);">Archivo procesado correctamente</div>
                                <div style="font-size: 0.85rem; color: var(--text-muted);">
                                    ${this.fbImportData.length} registros encontrados · Gasto total: <strong style="color: var(--danger);">$${totalSpent.toFixed(2)}</strong>
                                </div>
                            </div>
                        </div>
                        <details style="margin-top: 0.5rem; cursor: pointer;">
                            <summary style="font-size: 0.75rem; color: var(--text-muted);">🔍 Ver columnas detectadas</summary>
                            <div style="margin-top: 0.25rem; font-size: 0.7rem; color: var(--text-muted); font-family: monospace;">
                                ${parseResult.diagnostics}
                            </div>
                        </details>
                    </div>`;

                // Render preview
                this.renderFBPreview(previewEl);

            } catch (err) {
                console.error('Error parsing FB file:', err);
                statusEl.innerHTML = `
                    <div style="padding: 1rem; background: rgba(239, 68, 68, 0.08); border: 1px solid rgba(239, 68, 68, 0.2); border-radius: var(--radius-md);">
                        <div style="font-weight: 600; color: var(--danger);">❌ Error al leer el archivo</div>
                        <div style="font-size: 0.85rem; color: var(--text-muted); margin-top: 0.25rem;">${err.message}</div>
                        <div style="font-size: 0.8rem; color: var(--text-muted); margin-top: 0.5rem;">
                            💡 <strong>Sugerencia:</strong> Exporta el archivo directamente desde tu Administrador de Anuncios 
                            usando la opción "Exportar datos de tabla" en formato CSV o XLSX.
                        </div>
                    </div>`;
            }
        };

        reader.readAsArrayBuffer(file);
    },

    /**
     * Clean column names: remove BOM, zero-width chars, normalize spaces, trim
     */
    cleanColumnNames(jsonData) {
        if (!jsonData || jsonData.length === 0) return jsonData;

        return jsonData.map(row => {
            const cleaned = {};
            for (const [key, value] of Object.entries(row)) {
                // Remove BOM, zero-width spaces, invisible chars, normalize whitespace
                const cleanKey = key
                    .replace(/[\uFEFF\u200B\u200C\u200D\u00A0]/g, '')  // BOM & zero-width
                    .replace(/\s+/g, ' ')                                // collapse whitespace
                    .trim();
                cleaned[cleanKey] = value;
            }
            return cleaned;
        });
    },

    /**
     * Smart column matching using keyword groups.
     * A column matches a field if it contains ALL keywords from any keyword group.
     * Uses priority ordering (first keyword group = highest priority).
     */
    smartMatchColumns(columns) {
        const mapping = {};
        const diagnostics = [];
        const usedColumns = new Set();

        // Priority order for matching (most specific first)
        const fieldPriority = [
            'cost_per_purchase', 'cpc', 'cpm', 'ctr',  // specific metrics first
            'amount_spent',                              // spending
            'campaign_name', 'ad_set_name', 'ad_name',  // names
            'impressions', 'clicks', 'reach', 'purchases', // performance
            'month',                                     // month (fallback for dates)
            'date_start', 'date_end',                    // dates
            'frequency',                                 // other
        ];

        for (const field of fieldPriority) {
            const keywordGroups = this.COLUMN_KEYWORDS[field];
            if (!keywordGroups) continue;

            let bestMatch = null;
            let bestPriority = Infinity;

            for (const col of columns) {
                if (usedColumns.has(col)) continue;
                const normalizedCol = col.toLowerCase()
                    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')  // remove accents
                    .replace(/[_\-]/g, ' ')
                    .trim();

                for (let groupIdx = 0; groupIdx < keywordGroups.length; groupIdx++) {
                    const keywords = keywordGroups[groupIdx];
                    const allMatch = keywords.every(kw => {
                        const normalizedKw = kw.toLowerCase()
                            .normalize('NFD').replace(/[\u0300-\u036f]/g, '');
                        return normalizedCol.includes(normalizedKw);
                    });

                    if (allMatch && groupIdx < bestPriority) {
                        bestMatch = col;
                        bestPriority = groupIdx;
                        break; // take first match in this group
                    }
                }
            }

            if (bestMatch) {
                mapping[bestMatch] = field;
                usedColumns.add(bestMatch);
                diagnostics.push(`✅ <span style="color:var(--success);">${field}</span> ← "${bestMatch}"`);
            } else {
                diagnostics.push(`⚠️ <span style="color:var(--warning);">${field}</span> ← no encontrado`);
            }
        }

        // Detect unmapped columns
        const unmapped = columns.filter(c => !usedColumns.has(c));
        if (unmapped.length > 0) {
            diagnostics.push(`<br>📋 Columnas no mapeadas: ${unmapped.map(c => `"${c}"`).join(', ')}`);
        }

        return { mapping, diagnostics: diagnostics.join('<br>') };
    },

    /**
     * Content-based column detection fallback.
     * Analyzes actual values to guess what a column contains.
     */
    detectColumnByContent(jsonData, columns, existingMapping) {
        const mappedFields = new Set(Object.values(existingMapping));
        const result = { ...existingMapping };

        // Only run for fields we haven't yet mapped
        const needsDetection = ['amount_spent', 'date_start', 'campaign_name', 'impressions', 'clicks', 'purchases'];
        const detectableFields = needsDetection.filter(f => !mappedFields.has(f));
        if (detectableFields.length === 0) return result;

        const unmappedColumns = columns.filter(c => !result[c]);
        const sampleRows = jsonData.slice(0, Math.min(20, jsonData.length));

        for (const col of unmappedColumns) {
            const values = sampleRows.map(r => r[col]).filter(v => v !== '' && v !== null && v !== undefined);
            if (values.length === 0) continue;

            // Detect amount_spent: numeric values with decimals, typically $XX.XX format
            if (!mappedFields.has('amount_spent') && detectableFields.includes('amount_spent')) {
                const numericCount = values.filter(v => {
                    const n = this.parseNumeric(v);
                    return n > 0 && n < 100000;
                }).length;
                const hasDecimalValues = values.some(v => String(v).match(/\d+[.,]\d{1,2}$/));
                const hasMoneySymbol = values.some(v => String(v).match(/[$€£]/));

                if ((hasDecimalValues || hasMoneySymbol) && numericCount > values.length * 0.7) {
                    result[col] = 'amount_spent';
                    mappedFields.add('amount_spent');
                    continue;
                }
            }

            // Detect date: looks like a date string
            if (!mappedFields.has('date_start') && detectableFields.includes('date_start')) {
                const dateCount = values.filter(v => this.parseDate(v) !== null).length;
                if (dateCount > values.length * 0.8) {
                    result[col] = 'date_start';
                    mappedFields.add('date_start');
                    continue;
                }
            }

            // Detect campaign_name: long text strings with mixed case
            if (!mappedFields.has('campaign_name') && detectableFields.includes('campaign_name')) {
                const avgLen = values.reduce((s, v) => s + String(v).length, 0) / values.length;
                const hasLetters = values.every(v => String(v).match(/[a-zA-Z]/));
                if (avgLen > 10 && hasLetters) {
                    result[col] = 'campaign_name';
                    mappedFields.add('campaign_name');
                    continue;
                }
            }

            // Detect impressions: large integers (thousands+)
            if (!mappedFields.has('impressions') && detectableFields.includes('impressions')) {
                const intValues = values.map(v => parseInt(String(v).replace(/[^0-9]/g, '')) || 0);
                const avg = intValues.reduce((s, v) => s + v, 0) / intValues.length;
                if (avg > 100 && intValues.every(v => v >= 0)) {
                    result[col] = 'impressions';
                    mappedFields.add('impressions');
                    continue;
                }
            }
        }

        return result;
    },

    parseFBReport(jsonData) {
        const results = [];
        const country = document.getElementById('fbImportCountry')?.value || 'Ecuador';
        const importPlatform = document.getElementById('fbImportPlatform')?.value || 'Facebook';

        // Get currency settings
        const importCurrency = document.getElementById('fbImportCurrency')?.value || 'USD';
        const trmRate = parseFloat(document.getElementById('fbTrmRate')?.value) || 4200;
        const needsConversion = importCurrency === 'COP' && trmRate > 0;

        if (jsonData.length === 0) return { data: results, diagnostics: 'Sin datos' };

        const columns = Object.keys(jsonData[0]);
        console.log('📊 FB Import - Columns:', columns);

        // Step 1: Smart keyword matching
        let { mapping, diagnostics } = this.smartMatchColumns(columns);

        // Step 2: Content-based fallback for unmapped critical fields
        const finalMapping = this.detectColumnByContent(jsonData, columns, mapping);

        // Update diagnostics if content detection added fields
        for (const [col, field] of Object.entries(finalMapping)) {
            if (!mapping[col]) {
                diagnostics += `<br>🔎 <span style="color:var(--info);">${field}</span> ← "${col}" (detección por contenido)`;
            }
        }

        // Check if we have a month column but no date column
        const hasMonthCol = Object.values(finalMapping).includes('month');
        const hasDateCol = Object.values(finalMapping).includes('date_start');

        if (hasMonthCol && !hasDateCol) {
            diagnostics += `<br>📅 Usando columna "Mes" como fecha de referencia`;
        }

        // Currency diagnostics
        if (needsConversion) {
            diagnostics += `<br>💱 Conversión: COP → USD (TRM: $${trmRate.toLocaleString()} COP = 1 USD)`;
        }

        console.log('📊 FB Import - Final mapping:', finalMapping);

        // Try to detect a year column or infer year
        let inferredYear = new Date().getFullYear();
        // Check if any row has a year-like value we can use
        const yearCol = columns.find(c => {
            const normalized = c.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
            return normalized === 'ano' || normalized === 'year' || normalized === 'año';
        });

        // Process rows
        let skippedNoAmount = 0;
        jsonData.forEach(row => {
            const mapped = {};
            for (const [origKey, mappedKey] of Object.entries(finalMapping)) {
                mapped[mappedKey] = row[origKey];
            }

            // Parse amount spent - THE most critical field
            let amountSpent = this.parseNumeric(mapped.amount_spent);
            if (amountSpent <= 0) {
                skippedNoAmount++;
                return;
            }

            // Apply currency conversion COP → USD
            if (needsConversion) {
                amountSpent = amountSpent / trmRate;
            }

            // Parse date - try date_start first, then month column
            let dateStart = this.parseDate(mapped.date_start);
            if (!dateStart && mapped.month) {
                // Use month column as date
                const rowYear = yearCol ? (parseInt(row[yearCol]) || inferredYear) : inferredYear;
                dateStart = this.parseMonthToDate(mapped.month, rowYear);
            }
            if (!dateStart) {
                dateStart = this.filters.dateFrom || new Date().toISOString().split('T')[0];
            }

            // Convert monetary metrics if needed
            let cpc = this.parseNumeric(mapped.cpc);
            let cpm = this.parseNumeric(mapped.cpm);
            let costPerPurchase = this.parseNumeric(mapped.cost_per_purchase);
            if (needsConversion) {
                cpc = cpc / trmRate;
                cpm = cpm / trmRate;
                costPerPurchase = costPerPurchase / trmRate;
            }

            // Auto-detect country based on campaign name
            let rowCountry = country;
            const campNameUpper = (this.cleanText(mapped.campaign_name) || '').toUpperCase();
            if (campNameUpper.includes('ECU')) rowCountry = 'Ecuador';
            else if (campNameUpper.includes('COL')) rowCountry = 'Colombia';
            else if (campNameUpper.includes('VEN')) rowCountry = 'Venezuela';

            results.push({
                country: rowCountry,
                campaign_name: this.cleanText(mapped.campaign_name) || null,
                ad_set_name: this.cleanText(mapped.ad_set_name) || null,
                ad_name: this.cleanText(mapped.ad_name) || null,
                amount_spent: amountSpent,
                currency: 'USD',
                impressions: this.parseInteger(mapped.impressions),
                clicks: this.parseInteger(mapped.clicks),
                reach: this.parseInteger(mapped.reach),
                purchases: this.parseInteger(mapped.purchases),
                cpc: cpc,
                cpm: cpm,
                ctr: this.parseNumeric(mapped.ctr),
                cost_per_purchase: costPerPurchase,
                date_start: dateStart,
                date_end: this.parseDate(mapped.date_end) || dateStart,
                source: importPlatform,
                import_batch_id: this.fbImportBatchId
            });
        });

        if (skippedNoAmount > 0) {
            diagnostics += `<br>⏭️ ${skippedNoAmount} filas omitidas (sin monto de gasto)`;
        }
        diagnostics += `<br>📈 ${results.length} registros procesados correctamente`;

        return { data: results, diagnostics };
    },

    /**
     * Clean text: remove hidden chars, normalize
     */
    cleanText(val) {
        if (val === null || val === undefined || val === '') return '';
        return String(val)
            .replace(/[\uFEFF\u200B\u200C\u200D]/g, '')
            .trim();
    },

    /**
     * Smart numeric parser. Handles:
     * - Currency symbols ($, €, £)
     * - Thousands separators (1,234.56 or 1.234,56)
     * - Percentage symbols
     * - Spaces as thousands separator (1 234,56)
     */
    parseNumeric(val) {
        if (val === null || val === undefined || val === '') return 0;
        if (typeof val === 'number') return val;

        let str = String(val).trim();

        // Remove currency symbols and spaces used as thousands sep
        str = str.replace(/[$€£\s]/g, '');
        // Remove percentage sign
        str = str.replace(/%/g, '');

        // Detect format: European (1.234,56) vs US (1,234.56)
        const lastComma = str.lastIndexOf(',');
        const lastDot = str.lastIndexOf('.');

        if (lastComma > lastDot) {
            // European format: dots are thousands, comma is decimal
            str = str.replace(/\./g, '').replace(',', '.');
        } else if (lastDot > lastComma) {
            // US format: commas are thousands, dot is decimal
            str = str.replace(/,/g, '');
        } else if (lastComma !== -1 && lastDot === -1) {
            // Only comma present - could be decimal or thousands
            const afterComma = str.slice(lastComma + 1);
            if (afterComma.length <= 2) {
                // Likely decimal: "12,99" -> 12.99
                str = str.replace(',', '.');
            } else {
                // Likely thousands: "1,234" -> 1234
                str = str.replace(',', '');
            }
        }

        return parseFloat(str) || 0;
    },

    /**
     * Parse integer values. Handles thousands separators and dot/comma formats.
     */
    parseInteger(val) {
        if (val === null || val === undefined || val === '') return 0;
        if (typeof val === 'number') return Math.round(val);
        // Remove all non-numeric chars except minus
        const cleaned = String(val).replace(/[^0-9\-]/g, '');
        return parseInt(cleaned) || 0;
    },

    /**
     * Smart date parser. Handles:
     * - Excel serial dates
     * - ISO format (2024-01-15)
     * - US format (01/15/2024, Jan 15, 2024)
     * - European format (15/01/2024)
     * - Facebook formats (2024-01-15, Jan 15 2024, etc.)
     * - Spanish dates (15 ene, 2024)
     */
    parseDate(val) {
        if (!val) return null;

        // Excel serial date
        if (typeof val === 'number') {
            try {
                const date = XLSX.SSF.parse_date_code(val);
                if (date) {
                    return `${date.y}-${String(date.m).padStart(2, '0')}-${String(date.d).padStart(2, '0')}`;
                }
            } catch (e) { /* ignore */ }
        }

        let str = String(val).trim();

        // ISO format: 2024-01-15 or 2024-01-15T00:00:00
        const isoMatch = str.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
        if (isoMatch) {
            const [, y, m, d] = isoMatch;
            return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
        }

        // Month name formats: "Jan 15, 2024", "January 15, 2024", "15 Jan 2024"
        const monthNames = {
            'jan': '01', 'feb': '02', 'mar': '03', 'apr': '04', 'may': '05', 'jun': '06',
            'jul': '07', 'aug': '08', 'sep': '09', 'oct': '10', 'nov': '11', 'dec': '12',
            'ene': '01', 'feb': '02', 'mar': '03', 'abr': '04', 'may': '05', 'jun': '06',
            'jul': '07', 'ago': '08', 'sep': '09', 'oct': '10', 'nov': '11', 'dic': '12',
            'january': '01', 'february': '02', 'march': '03', 'april': '04', 'june': '06',
            'july': '07', 'august': '08', 'september': '09', 'october': '10', 'november': '11', 'december': '12',
            'enero': '01', 'febrero': '02', 'marzo': '03', 'abril': '04', 'mayo': '05', 'junio': '06',
            'julio': '07', 'agosto': '08', 'septiembre': '09', 'octubre': '10', 'noviembre': '11', 'diciembre': '12',
        };

        // "Jan 15, 2024" or "January 15 2024"
        const monthFirstMatch = str.match(/^(\w+)\s+(\d{1,2})\s*,?\s*(\d{4})$/i);
        if (monthFirstMatch) {
            const monthStr = monthFirstMatch[1].toLowerCase().slice(0, 3);
            const month = monthNames[monthStr] || monthNames[monthFirstMatch[1].toLowerCase()];
            if (month) {
                return `${monthFirstMatch[3]}-${month}-${monthFirstMatch[2].padStart(2, '0')}`;
            }
        }

        // "15 Jan 2024" or "15-Jan-2024"
        const dayFirstMatch = str.match(/^(\d{1,2})\s*[\s\-\/]\s*(\w+)\s*[\s\-\/,]\s*(\d{4})$/i);
        if (dayFirstMatch) {
            const monthStr = dayFirstMatch[2].toLowerCase().slice(0, 3);
            const month = monthNames[monthStr] || monthNames[dayFirstMatch[2].toLowerCase()];
            if (month) {
                return `${dayFirstMatch[3]}-${month}-${dayFirstMatch[1].padStart(2, '0')}`;
            }
        }

        // Numeric formats with separators: DD/MM/YYYY, MM/DD/YYYY, YYYY/MM/DD
        const parts = str.split(/[\\/\-\.]/);
        if (parts.length === 3) {
            const nums = parts.map(p => parseInt(p.trim()));
            if (nums.every(n => !isNaN(n))) {
                // YYYY-MM-DD or YYYY/MM/DD
                if (nums[0] > 100) {
                    return `${nums[0]}-${String(nums[1]).padStart(2, '0')}-${String(nums[2]).padStart(2, '0')}`;
                }
                // DD/MM/YYYY (most Facebook exports in Spanish use this)
                if (nums[2] > 100) {
                    // Heuristic: if first number > 12, it's DD/MM/YYYY
                    if (nums[0] > 12) {
                        return `${nums[2]}-${String(nums[1]).padStart(2, '0')}-${String(nums[0]).padStart(2, '0')}`;
                    }
                    // If second number > 12, it's MM/DD/YYYY
                    if (nums[1] > 12) {
                        return `${nums[2]}-${String(nums[0]).padStart(2, '0')}-${String(nums[1]).padStart(2, '0')}`;
                    }
                    // Ambiguous: default to DD/MM/YYYY (more common in Spanish)
                    return `${nums[2]}-${String(nums[1]).padStart(2, '0')}-${String(nums[0]).padStart(2, '0')}`;
                }
            }
        }

        // Last resort: try JavaScript Date parser
        try {
            const d = new Date(str);
            if (!isNaN(d.getTime()) && d.getFullYear() > 2000 && d.getFullYear() < 2100) {
                return d.toISOString().split('T')[0];
            }
        } catch (e) { /* ignore */ }

        return null;
    },

    renderFBPreview(previewEl) {
        if (!previewEl || !this.fbImportData) return;
        previewEl.style.display = 'block';

        const preview = this.fbImportData.slice(0, 10);
        let html = `
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
                <h4 style="margin: 0;">Vista Previa (${preview.length} de ${this.fbImportData.length})</h4>
                <div style="display: flex; gap: 0.5rem;">
                    <button class="btn btn-success btn-sm" onclick="IncomeStatementModule.confirmFBImport()">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <polyline points="20 6 9 17 4 12"></polyline>
                        </svg>
                        Importar ${this.fbImportData.length} Registros
                    </button>
                    <button class="btn btn-secondary btn-sm" onclick="IncomeStatementModule.cancelFBImport()">Cancelar</button>
                </div>
            </div>
            <div class="table-container">
                <table class="table" style="font-size: 0.8rem;">
                    <thead>
                        <tr>
                            <th>País</th>
                            <th>Campaña</th>
                            <th style="text-align:right;">Gastado</th>
                            <th style="text-align:right;">Impresiones</th>
                            <th style="text-align:right;">Clicks</th>
                            <th style="text-align:center;">Compras</th>
                            <th>Fecha</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${preview.map(d => `
                            <tr>
                                <td>${d.country}</td>
                                <td style="max-width:180px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;" title="${d.campaign_name || ''}">${d.campaign_name || '-'}</td>
                                <td style="text-align:right; font-weight:600; color:var(--danger);">$${d.amount_spent.toFixed(2)}</td>
                                <td style="text-align:right;">${d.impressions.toLocaleString()}</td>
                                <td style="text-align:right;">${d.clicks}</td>
                                <td style="text-align:center;">${d.purchases}</td>
                                <td>${d.date_start}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>`;

        previewEl.innerHTML = html;
    },

    async confirmFBImport() {
        if (!this.fbImportData || this.fbImportData.length === 0) return;

        const statusEl = document.getElementById('fbImportStatus');

        // Show loading state
        if (statusEl) {
            statusEl.style.display = 'block';
            statusEl.innerHTML = `
                <div style="display: flex; align-items: center; gap: 0.5rem; color: var(--primary);">
                    <div class="spinner-sm"></div>
                    Importando ${this.fbImportData.length} registros a la base de datos...
                </div>`;
        }

        try {
            // Map data to exact table columns: ad_expenses
            const insertData = this.fbImportData.map(row => ({
                country: row.country || 'Ecuador',
                campaign_name: row.campaign_name || null,
                ad_set_name: row.ad_set_name || null,
                ad_name: row.ad_name || null,
                amount_spent: row.amount_spent || 0,
                currency: row.currency || 'USD',
                impressions: row.impressions || 0,
                clicks: row.clicks || 0,
                reach: row.reach || 0,
                purchases: row.purchases || 0,
                cpc: row.cpc || 0,
                cpm: row.cpm || 0,
                ctr: row.ctr || 0,
                cost_per_purchase: row.cost_per_purchase || 0,
                date_start: row.date_start,
                date_end: row.date_end || row.date_start,
                source: row.source || 'Facebook',
                import_batch_id: this.fbImportBatchId || null,
            }));

            // Insert in batches of 50
            const batchSize = 50;
            let insertedCount = 0;
            for (let i = 0; i < insertData.length; i += batchSize) {
                const batch = insertData.slice(i, i + batchSize);
                const { error } = await supabaseClient
                    .from('ad_expenses')
                    .insert(batch);
                if (error) throw error;
                insertedCount += batch.length;

                // Update progress
                if (statusEl && insertData.length > batchSize) {
                    statusEl.innerHTML = `
                        <div style="display: flex; align-items: center; gap: 0.5rem; color: var(--primary);">
                            <div class="spinner-sm"></div>
                            Importando... ${insertedCount}/${insertData.length} registros
                        </div>`;
                }
            }

            Utils.showToast(`✅ ${insertedCount} registros importados correctamente`, 'success');

            // Check if any inserted record is within the current global date filter
            const insertedInFilter = insertData.some(row => {
                const itemDate = new Date(row.date_start).toISOString().split('T')[0];
                if (this.filters.dateFrom && itemDate < this.filters.dateFrom) return false;
                if (this.filters.dateTo && itemDate > this.filters.dateTo) return false;
                if (!this.matchesCountryFilter(row.country)) return false;
                return true;
            });

            if (!insertedInFilter) {
                setTimeout(() => {
                    Utils.showToast('Nota: Los registros importados están fuera del rango o país actual del filtro general.', 'info');
                }, 1500);
            }

            this.cancelFBImport();
            this.render();
        } catch (error) {
            console.error('Error importing FB data:', error);
            if (statusEl) {
                statusEl.innerHTML = `
                    <div style="padding: 1rem; background: rgba(239, 68, 68, 0.08); border: 1px solid rgba(239, 68, 68, 0.2); border-radius: var(--radius-md);">
                        <div style="font-weight: 600; color: var(--danger);">❌ Error al importar</div>
                        <div style="font-size: 0.85rem; color: var(--text-muted); margin-top: 0.25rem;">${error.message}</div>
                    </div>`;
            }
            Utils.showToast('Error al importar: ' + error.message, 'error');
        }
    },

    cancelFBImport() {
        this.fbImportData = null;
        this.fbImportBatchId = null;
        const fileInput = document.getElementById('fbReportFile');
        if (fileInput) fileInput.value = '';
        const statusEl = document.getElementById('fbImportStatus');
        if (statusEl) { statusEl.style.display = 'none'; statusEl.innerHTML = ''; }
        const previewEl = document.getElementById('fbImportPreview');
        if (previewEl) { previewEl.style.display = 'none'; previewEl.innerHTML = ''; }
    },

    // ========================================
    // OPERATIONAL EXPENSES
    // ========================================
    showAddExpenseModal() {
        const modal = document.getElementById('modalOperationalExpense');
        if (modal) {
            document.getElementById('opExpenseId').value = '';
            document.getElementById('formOperationalExpense').reset();
            document.getElementById('opExpenseDate').value = new Date().toISOString().split('T')[0];
            modal.classList.add('active');
        }
    },

    editOperationalExpense(id) {
        const exp = this.operationalExpenses.find(e => e.id === id);
        if (!exp) return;

        document.getElementById('opExpenseId').value = exp.id;
        const countryValue = exp.country === 'Global_Expense' ? 'Global' : (exp.country || 'Ecuador');
        document.getElementById('opExpenseCountry').value = countryValue;
        document.getElementById('opExpenseCategory').value = exp.category || 'Envío';
        document.getElementById('opExpenseDescription').value = exp.description || '';
        document.getElementById('opExpenseAmount').value = exp.amount || 0;
        document.getElementById('opExpenseDate').value = exp.expense_date ? exp.expense_date.split('T')[0] : '';
        document.getElementById('opExpensePayMethod').value = exp.payment_method || 'Efectivo';
        
        const notesObj = document.getElementById('opExpenseNotes');
        if (notesObj) notesObj.value = exp.notes || '';

        const modal = document.getElementById('modalOperationalExpense');
        if (modal) modal.classList.add('active');
    },

    async saveOperationalExpense() {
        const id = document.getElementById('opExpenseId')?.value;
        const countryValue = document.getElementById('opExpenseCountry').value;
        const isGlobal = countryValue === 'Global';

        const data = {
            country: isGlobal ? 'Global_Expense' : countryValue,
            category: document.getElementById('opExpenseCategory').value,
            description: document.getElementById('opExpenseDescription').value,
            amount: parseFloat(document.getElementById('opExpenseAmount').value) || 0,
            expense_date: document.getElementById('opExpenseDate').value,
            payment_method: document.getElementById('opExpensePayMethod').value || 'Efectivo',
            notes: document.getElementById('opExpenseNotes')?.value || ''
        };

        console.log('Saving operational expense:', data);

        try {
            if (id) {
                const { error } = await supabaseClient
                    .from('operational_expenses')
                    .update(data)
                    .eq('id', id);
                if (error) {
                    console.error('Supabase error (update):', error);
                    throw error;
                }
            } else {
                const { error } = await supabaseClient
                    .from('operational_expenses')
                    .insert(data);
                if (error) {
                    console.error('Supabase error (insert):', error);
                    throw error;
                }
            }

            Utils.showToast('Gasto operativo guardado', 'success');
            document.getElementById('modalOperationalExpense').classList.remove('active');
            this.render();
        } catch (error) {
            console.error('Error saving operational expense:', error);
            const errorMsg = error?.message || error?.error_description || 'Error desconocido';
            Utils.showToast('Error al guardar: ' + errorMsg, 'error');
        }
    },

    toggleSelectAllAdExpenses(checked) {
        const checkboxes = document.querySelectorAll('.ad-expense-checkbox');
        checkboxes.forEach(cb => cb.checked = checked);
        this.updateSelectedAdExpensesCount();
    },

    updateSelectedAdExpensesCount() {
        const checked = document.querySelectorAll('.ad-expense-checkbox:checked').length;
        const btnDeleteSelected = document.getElementById('btnDeleteSelectedAdExpenses');
        const countSpan = document.getElementById('selectedAdExpensesCount');
        if (countSpan) countSpan.textContent = checked;
        if (btnDeleteSelected) btnDeleteSelected.style.display = checked > 0 ? 'inline-flex' : 'none';
        
        const groupToolbar = document.getElementById('adExpensesGroupToolbar');
        const groupBtn = document.getElementById('btnGroupAdExpenses');
        const groupCount = document.getElementById('groupAdExpensesCount');
        if (groupToolbar) groupToolbar.style.display = checked > 0 ? 'flex' : 'none';
        if (groupCount) groupCount.textContent = checked;
        if (groupBtn) groupBtn.disabled = (checked < 2);
    },

    async deleteSelectedAdExpenses() {
        const checked = Array.from(document.querySelectorAll('.ad-expense-checkbox:checked')).map(cb => String(cb.value));
        if (checked.length === 0) return;

        if (!confirm(`¿Estás seguro de eliminar las ${checked.length} campañas seleccionadas?`)) return;

        Utils.showToast(`Eliminando ${checked.length} campañas...`, 'info');

        try {
            await supabaseClient.from('ad_expenses').delete().in('id', checked);
            Utils.showToast(`Se eliminaron ${checked.length} campañas`, 'success');
            await this.render();
        } catch (err) {
            Utils.showToast('Error al eliminar: ' + err.message, 'error');
        }
    },

    async deleteAllAdExpenses() {
        const expenses = this.adExpenses;
        const count = expenses.length;
        if (count === 0) return;

        if (!confirm(`⚠️ ¿Estás seguro de ELIMINAR TODOS los ${count} registros de gastos publicitarios? Esta acción no se puede deshacer.`)) return;

        Utils.showToast('Vaciando registros...', 'info');

        const idsToDelete = expenses.map(s => String(s.id));

        try {
            await supabaseClient.from('ad_expenses').delete().in('id', idsToDelete);
            Utils.showToast(`Se eliminaron todos los registros (${count})`, 'success');
            await this.render();
        } catch (err) {
            Utils.showToast('Error al vaciar: ' + err.message, 'error');
        }
    },

    async manualGroupAdExpenses() {
        const checkedBoxes = document.querySelectorAll('.ad-expense-checkbox:checked');
        if (checkedBoxes.length < 2) {
            Utils.showToast('Selecciona al menos 2 campañas para agrupar.', 'warning');
            return;
        }

        const idsToMerge = Array.from(checkedBoxes).map(cb => String(cb.value));
        const recordsToMerge = this.adExpenses.filter(s => idsToMerge.includes(String(s.id)));

        if (recordsToMerge.length < 2) return;

        const mergedNames = [...new Set(recordsToMerge.map(r => r.campaign_name))];
        const defaultName = mergedNames.length <= 3 ? mergedNames.join(' + ') : `${mergedNames[0]} (+${mergedNames.length - 1} más)`;
        
        const groupName = prompt('Nombre del grupo fusionado:', defaultName);
        if (!groupName) return;

        // Create the merged record
        const merged = {
            id: this.generateUUID(),
            country: recordsToMerge[0].country,
            source: recordsToMerge[0].source || 'Facebook',
            campaign_name: groupName.trim(),
            product_name: recordsToMerge[0].product_name || '', // Keep the first product if any
            amount_spent: 0,
            impressions: 0,
            clicks: 0,
            purchases: 0,
            date_start: recordsToMerge[0].date_start
        };

        for (const src of recordsToMerge) {
            merged.amount_spent += (parseFloat(src.amount_spent) || 0);
            merged.impressions += (parseInt(src.impressions) || 0);
            merged.clicks += (parseInt(src.clicks) || 0);
            merged.purchases += (parseInt(src.purchases) || 0);
        }

        Utils.showToast('Agrupando campañas...', 'info');

        try {
            // Delete old records
            await supabaseClient.from('ad_expenses').delete().in('id', idsToMerge);
            // Insert new merged record
            await supabaseClient.from('ad_expenses').insert(merged);
            
            Utils.showToast(`Se agruparon ${recordsToMerge.length} campañas en "${merged.campaign_name}"`, 'success');
            
            // clear selected checkbox all state
            const selectAllCb = document.getElementById('selectAllAdExpenses');
            if (selectAllCb) selectAllCb.checked = false;
            
            await this.render();
        } catch (e) {
            console.warn('Error syncing group to Supabase', e);
            Utils.showToast('Error al agrupar: ' + e.message, 'error');
        }
    },

    async deleteAdExpense(id) {
        if (!confirm('¿Eliminar este gasto publicitario?')) return;
        try {
            const { error } = await supabaseClient.from('ad_expenses').delete().eq('id', id);
            if (error) throw error;
            Utils.showToast('Gasto publicitario eliminado', 'success');
            this.render();
        } catch (error) {
            Utils.showToast('Error al eliminar: ' + error.message, 'error');
        }
    },

    // ========================================
    // Ad Expense Form functions
    // ========================================

    showAddAdExpenseModal() {
        document.getElementById('formAdExpense').reset();
        document.getElementById('adExpenseId').value = '';
        
        // Defaults
        const now = new Date();
        document.getElementById('adExpenseDate').value = now.toISOString().split('T')[0];
        document.getElementById('adExpensePlatform').value = 'Facebook';
        
        const modal = document.getElementById('modalAdExpense');
        if (modal) modal.classList.add('active');
    },

    editAdExpense(id) {
        const exp = this.adExpenses.find(e => e.id === id);
        if (!exp) return;

        document.getElementById('adExpenseId').value = exp.id;
        document.getElementById('adExpenseCountry').value = exp.country || 'Ecuador';
        document.getElementById('adExpensePlatform').value = exp.source || 'Facebook';
        document.getElementById('adExpenseCampaign').value = exp.campaign_name || '';
        document.getElementById('adExpenseAmount').value = exp.amount_spent || 0;
        document.getElementById('adExpenseDate').value = exp.date_start ? exp.date_start.split('T')[0] : '';
        document.getElementById('adExpenseImpressions').value = exp.impressions || 0;
        document.getElementById('adExpenseClicks').value = exp.clicks || 0;
        document.getElementById('adExpensePurchases').value = exp.purchases || 0;

        const modal = document.getElementById('modalAdExpense');
        if (modal) modal.classList.add('active');
    },

    async saveAdExpense() {
        const id = document.getElementById('adExpenseId').value;
        const country = document.getElementById('adExpenseCountry').value;
        const source = document.getElementById('adExpensePlatform').value;
        const campaign_name = document.getElementById('adExpenseCampaign').value;
        const amount_spent = parseFloat(document.getElementById('adExpenseAmount').value) || 0;
        const date_start = document.getElementById('adExpenseDate').value;
        const impressions = parseInt(document.getElementById('adExpenseImpressions').value) || 0;
        const clicks = parseInt(document.getElementById('adExpenseClicks').value) || 0;
        const purchases = parseInt(document.getElementById('adExpensePurchases').value) || 0;

        let ctr = 0;
        if (impressions > 0) {
            ctr = (clicks / impressions) * 100;
        }

        let cpp = 0;
        if (purchases > 0) {
            cpp = amount_spent / purchases;
        }

        const data = {
            country,
            source,
            campaign_name,
            amount_spent,
            currency: 'USD',
            date_start,
            impressions,
            clicks,
            purchases,
            ctr,
            cost_per_purchase: cpp
        };

        try {
            if (id) {
                const { error } = await supabaseClient
                    .from('ad_expenses')
                    .update(data)
                    .eq('id', id);
                if (error) throw error;
                Utils.showToast('Gasto actualizado', 'success');
            } else {
                const { error } = await supabaseClient
                    .from('ad_expenses')
                    .insert(data);
                if (error) throw error;
                Utils.showToast('Gasto registrado', 'success');
            }
            
            document.getElementById('modalAdExpense').classList.remove('active');
            this.render();
        } catch (error) {
            Utils.showToast('Error al guardar: ' + error.message, 'error');
        }
    },

    async deleteOperationalExpense(id) {
        if (!confirm('¿Eliminar este gasto operativo?')) return;
        try {
            const { error } = await supabaseClient.from('operational_expenses').delete().eq('id', id);
            if (error) throw error;
            Utils.showToast('Gasto operativo eliminado', 'success');
            this.render();
        } catch (error) {
            Utils.showToast('Error al eliminar: ' + error.message, 'error');
        }
    },

    duplicateOperationalExpense(id) {
        const exp = this.operationalExpenses.find(e => e.id === id);
        if (!exp) {
            Utils.showToast("Gasto no encontrado", 'error');
            return;
        }

        const date = new Date(exp.expense_date + 'T12:00:00');
        date.setMonth(date.getMonth() + 1);
        const nextMonthDate = date.toISOString().split('T')[0];

        // Fill form with duplicated data but empty ID so it creates a new record
        document.getElementById('opExpenseId').value = '';
        document.getElementById('opExpenseCountry').value = exp.country;
        document.getElementById('opExpenseCategory').value = exp.category || 'Envío';
        document.getElementById('opExpenseDescription').value = exp.description;
        document.getElementById('opExpenseAmount').value = exp.amount;
        document.getElementById('opExpenseDate').value = nextMonthDate;
        document.getElementById('opExpensePayMethod').value = exp.payment_method || 'Efectivo';
        
        const notesObj = document.getElementById('opExpenseNotes');
        if (notesObj) notesObj.value = exp.notes || '';

        // Open modal
        const modal = document.getElementById('modalOperationalExpense');
        if (modal) {
            modal.classList.add('active');
            Utils.showToast('Revisa los datos y confirma el gasto', 'info');
        }
    },

    onCurrencyChange() {
        const currency = document.getElementById('fbImportCurrency')?.value;
        const trmContainer = document.getElementById('trmInputContainer');
        const conversionInfo = document.getElementById('conversionInfo');
        if (currency === 'COP') {
            if (trmContainer) trmContainer.style.display = 'flex';
            if (conversionInfo) conversionInfo.style.display = 'block';
        } else {
            if (trmContainer) trmContainer.style.display = 'none';
            if (conversionInfo) conversionInfo.style.display = 'none';
        }
    },

    filterAdExpenses() {
        this.renderAdExpensesTable();
    },

    clearAdFilters() {
        const resetInput = (id) => {
            const el = document.getElementById(id);
            if (el) el.value = '';
        };
        resetInput('adFilterCountry');
        resetInput('adFilterDateFrom');
        resetInput('adFilterDateTo');
        resetInput('adFilterSearch');
        this.renderAdExpensesTable();
    },

    // ========================================
    // QUICK FILTERS
    // ========================================
    setQuickFilter(period) {
        const now = new Date();
        const year = now.getFullYear();
        let from, to;

        switch (period) {
            case 'today':
                from = to = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
                break;
            case 'week':
                const dayOfWeek = now.getDay();
                const fromD = new Date(now);
                fromD.setDate(now.getDate() - dayOfWeek);
                from = `${fromD.getFullYear()}-${String(fromD.getMonth() + 1).padStart(2, '0')}-${String(fromD.getDate()).padStart(2, '0')}`;
                to = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
                break;
            case 'month':
                const mStr = String(now.getMonth() + 1).padStart(2, '0');
                const lastDay = new Date(year, now.getMonth() + 1, 0).getDate();
                from = `${year}-${mStr}-01`;
                to = `${year}-${mStr}-${String(lastDay).padStart(2, '0')}`;
                break;
            case 'quarter':
                const quarter = Math.floor(now.getMonth() / 3);
                const qStartMonth = String(quarter * 3 + 1).padStart(2, '0');
                const qEndMonth = quarter * 3 + 3;
                const qLastDay = new Date(year, qEndMonth, 0).getDate();
                from = `${year}-${qStartMonth}-01`;
                to = `${year}-${String(qEndMonth).padStart(2, '0')}-${String(qLastDay).padStart(2, '0')}`;
                break;
            case 'semester':
                const semester = Math.floor(now.getMonth() / 6);
                const sStartMonth = String(semester * 6 + 1).padStart(2, '0');
                const sEndMonth = semester * 6 + 6;
                const sLastDay = new Date(year, sEndMonth, 0).getDate();
                from = `${year}-${sStartMonth}-01`;
                to = `${year}-${String(sEndMonth).padStart(2, '0')}-${String(sLastDay).padStart(2, '0')}`;
                break;
            case 'year':
                from = `${year}-01-01`;
                to = `${year}-12-31`;
                break;
            case 'all':
                from = '2020-01-01';
                to = `${year}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
                break;
        }

        document.getElementById('isDateFrom').value = from;
        document.getElementById('isDateTo').value = to;
        document.querySelectorAll('#section-income-statement .month-tag').forEach(el => el.classList.remove('active'));
        this.applyFilters();
    },

    setMonthFilter(monthIndex, btn) {
        const now = new Date();
        const year = now.getFullYear();
        const mStr = String(monthIndex + 1).padStart(2, '0');
        const lastDay = new Date(year, monthIndex + 1, 0).getDate();
        const from = `${year}-${mStr}-01`;
        const to = `${year}-${mStr}-${String(lastDay).padStart(2, '0')}`;

        document.getElementById('isDateFrom').value = from;
        document.getElementById('isDateTo').value = to;

        document.querySelectorAll('#section-income-statement .month-tag').forEach(el => el.classList.remove('active'));
        if (btn) btn.classList.add('active');

        // Sincronizar dropdown de TRM con el mes seleccionado
        const ym = `${year}-${mStr}`;
        const rateSelect = document.getElementById('isRateMonthSelect');
        if (rateSelect) {
            rateSelect.value = ym;
            this.onRateMonthSelectChange(ym);
        }

        this.applyFilters();
    },

    // ========================================
    // EXPORT TO EXCEL
    // ========================================
    async exportToExcel() {
        if (typeof XLSX === 'undefined') {
            Utils.showToast('La librería XLSX no está disponible', 'error');
            return;
        }

        try {
            Utils.showToast('Generando reporte Excel del Estado de Resultados...', 'info');

            // Sync current filter values from DOM if available
            if (this.countryMultiSelect) {
                this.filters.countries = this.countryMultiSelect.getSelected();
                this.filters.country = this.filters.countries.length === 1 ? this.filters.countries[0] : '';
            } else if (document.getElementById('isCountryFilter')) {
                this.filters.country = document.getElementById('isCountryFilter').value || '';
            }
            if (this.productMultiSelect) {
                this.filters.products = this.productMultiSelect.getSelected();
            }
            if (document.getElementById('isDateFrom')) {
                this.filters.dateFrom = document.getElementById('isDateFrom').value || null;
            }
            if (document.getElementById('isDateTo')) {
                this.filters.dateTo = document.getElementById('isDateTo').value || null;
            }

            if (!this.guides || this.guides.length === 0) {
                await this.loadAllData();
            }

            const salesData = this.getSalesByCountry();
            const adExpData = this.getAdExpensesByCountry();
            const opExpData = this.getOpExpensesByCountry();
            const freightData = this.getFreightsByCountry();
            const extSalesSummary = this.getExternalSalesSummary();

            const totalRevenue = salesData.reduce((s, c) => s + c.totalRevenue, 0) + extSalesSummary.totalRevenue;
            const totalCOGS = salesData.reduce((s, c) => s + c.totalCost, 0) + extSalesSummary.totalCost;
            const totalShipping = salesData.reduce((s, c) => s + c.totalShipping, 0) + extSalesSummary.totalShipping + extSalesSummary.totalReturnShipping;
            const totalFreights = Object.values(freightData).reduce((s, f) => s + f.totalFreight, 0);
            const totalAdSpend = adExpData.reduce((s, c) => s + c.totalSpent, 0);
            const totalOpExp = opExpData.reduce((s, c) => s + c.total, 0);

            const grossProfit = totalRevenue - totalCOGS - totalShipping - totalFreights;
            const netProfit = grossProfit - totalAdSpend - totalOpExp;
            const grossMarginPct = totalRevenue > 0 ? (grossProfit / totalRevenue) * 100 : 0;
            const netMarginPct = totalRevenue > 0 ? (netProfit / totalRevenue) * 100 : 0;
            const roas = totalAdSpend > 0 ? (totalRevenue / totalAdSpend).toFixed(2) + 'x' : 'N/A';
            const totalOrdersDelivered = salesData.reduce((s, c) => s + c.orderCount, 0) + extSalesSummary.totalDelivered;
            const totalUnitsSold = salesData.reduce((s, c) => s + c.unitsSold, 0) + extSalesSummary.totalUnits;

            // 1. SHEET: P&L ESTADO DE RESULTADOS
            const plAoa = [
                ['ESTADO DE RESULTADOS (P&L CONSOLIDADO)'],
                ['Generado el:', new Date().toLocaleString('es-ES')],
                ['Período Desde:', this.filters.dateFrom || 'Inicio'],
                ['Período Hasta:', this.filters.dateTo || 'Hoy'],
                ['País Filtrado:', this.countryMultiSelect ? (this.countryMultiSelect.isAllSelected() ? 'Todos los Países' : this.countryMultiSelect.getSelected().join(', ')) : (this.filters.country || 'Todos los Países')],
                ['Productos Filtrados:', this.productMultiSelect ? (this.productMultiSelect.isAllSelected() ? 'Todos los Productos' : `${this.productMultiSelect.getSelected().length} seleccionados`) : 'Todos los Productos'],
                [''],
                ['CONCEPTO FINANCIERO', 'MONTO ($ USD)', '% SOBRE VENTAS'],
                ['1. VENTAS NETAS (INGRESOS TOTALES)', totalRevenue, '100.00%'],
                ['   - Costo de Mercancía Vendida (COGS)', -totalCOGS, totalRevenue > 0 ? ((totalCOGS / totalRevenue) * 100).toFixed(2) + '%' : '0%'],
                ['   - Costo de Envíos Locales', -totalShipping, totalRevenue > 0 ? ((totalShipping / totalRevenue) * 100).toFixed(2) + '%' : '0%'],
                ['   - Costo de Fletes Internacionales', -totalFreights, totalRevenue > 0 ? ((totalFreights / totalRevenue) * 100).toFixed(2) + '%' : '0%'],
                ['2. UTILIDAD BRUTA', grossProfit, `${grossMarginPct.toFixed(2)}%`],
                ['   - Gastos Publicitarios (Ads)', -totalAdSpend, totalRevenue > 0 ? ((totalAdSpend / totalRevenue) * 100).toFixed(2) + '%' : '0%'],
                ['   - Gastos Operativos', -totalOpExp, totalRevenue > 0 ? ((totalOpExp / totalRevenue) * 100).toFixed(2) + '%' : '0%'],
                ['3. UTILIDAD NETA FINAL', netProfit, `${netMarginPct.toFixed(2)}%`],
                [''],
                ['MÉTRICAS ADICIONALES', 'VALOR'],
                ['Margen Bruto', `${grossMarginPct.toFixed(2)}%`],
                ['Margen Neto', `${netMarginPct.toFixed(2)}%`],
                ['Retorno Gasto Publicitario (ROAS)', roas],
                ['Pedidos Entregados Totales', totalOrdersDelivered],
                ['Unidades Vendidas Totales', totalUnitsSold]
            ];

            const wsPL = XLSX.utils.aoa_to_sheet(plAoa);
            wsPL['!cols'] = [
                { wch: 42 },
                { wch: 20 },
                { wch: 18 }
            ];

            // 2. SHEET: DESGLOSE POR PAÍS
            const countryMap = {};
            salesData.forEach(c => {
                countryMap[c.country] = {
                    country: c.country,
                    orders: c.orderCount,
                    units: c.unitsSold,
                    revenue: c.totalRevenue,
                    cost: c.totalCost,
                    shipping: c.totalShipping,
                    freight: freightData[c.country]?.totalFreight || 0,
                    ads: 0,
                    opExp: 0
                };
            });
            adExpData.forEach(a => {
                if (!countryMap[a.country]) {
                    countryMap[a.country] = { country: a.country, orders: 0, units: 0, revenue: 0, cost: 0, shipping: 0, freight: 0, ads: 0, opExp: 0 };
                }
                countryMap[a.country].ads += a.totalSpent;
            });
            opExpData.forEach(o => {
                if (!countryMap[o.country]) {
                    countryMap[o.country] = { country: o.country, orders: 0, units: 0, revenue: 0, cost: 0, shipping: 0, freight: 0, ads: 0, opExp: 0 };
                }
                countryMap[o.country].opExp += o.total;
            });

            const countryHeaders = [
                'País',
                'Pedidos',
                'Unidades',
                'Ventas ($)',
                'Costo Mercancía ($)',
                'Costo Envíos ($)',
                'Costo Fletes ($)',
                'Utilidad Bruta ($)',
                'Publicidad ($)',
                'Gastos Operativos ($)',
                'Utilidad Neta ($)',
                'Margen Neto (%)'
            ];
            const countryRows = Object.values(countryMap).map(c => {
                const gross = c.revenue - c.cost - c.shipping - c.freight;
                const net = gross - c.ads - c.opExp;
                const netMargin = c.revenue > 0 ? ((net / c.revenue) * 100).toFixed(1) + '%' : '0%';
                return [
                    c.country,
                    c.orders,
                    c.units,
                    c.revenue,
                    c.cost,
                    c.shipping,
                    c.freight,
                    gross,
                    c.ads,
                    c.opExp,
                    net,
                    netMargin
                ];
            });

            const wsCountry = XLSX.utils.aoa_to_sheet([countryHeaders, ...countryRows]);
            wsCountry['!cols'] = [
                { wch: 16 },
                { wch: 10 },
                { wch: 10 },
                { wch: 16 },
                { wch: 18 },
                { wch: 16 },
                { wch: 16 },
                { wch: 18 },
                { wch: 16 },
                { wch: 18 },
                { wch: 18 },
                { wch: 14 }
            ];

            // 3. SHEET: RENTABILIDAD POR PRODUCTO
            const productMap = {};
            const filteredGuides = this.guides || [];
            filteredGuides.forEach(g => {
                if (this.isCancelado(g) || g.status === 'CANCELLED' || g.status === 'ANULADO') return;
                const gCountry = g.country || this.getCountryFromCity(g.cities);
                if (!this.matchesCountryFilter(gCountry)) return;
                const gDate = g.created_at ? g.created_at.split('T')[0] : (g.date || '');
                if (this.filters.dateFrom && gDate < this.filters.dateFrom) return;
                if (this.filters.dateTo && gDate > this.filters.dateTo) return;

                const isExcluded = this.isExcludedFromSales(g);
                const items = g.guide_items || g.products || g.items || [];
                const shippingUSD = this.getGuideShippingCostUSD(g);
                const shippingPerItem = items.length > 0 ? (shippingUSD / items.length) : 0;
                const totalRev = isExcluded ? 0 : this.getGuideRevenueUSD(g);
                const totalItemsCost = items.reduce((s, item) => {
                    const prod = item.products || item;
                    const unitCost = window.ProductsModule ? window.ProductsModule.getRealCost(prod) : parseFloat(prod.cost || 0) * 40000;
                    return s + (unitCost * (item.quantity || 1));
                }, 0);

                items.forEach(item => {
                    const prod = item.products || item;
                    const rawName = prod.name || item.name || 'Producto Desconocido';
                    const name = this.productMappings[rawName] || rawName;
                    if (!this.matchesProductFilter([rawName, name])) return;

                    const qty = parseInt(item.quantity || 1);
                    const unitCost = window.ProductsModule ? window.ProductsModule.getRealCost(prod) : parseFloat(prod.cost || 0) * 40000;
                    const realCost = isExcluded ? 0 : (unitCost * qty);
                    const revProp = isExcluded ? 0 : (totalItemsCost > 0 ? (realCost / totalItemsCost) * totalRev : (totalRev / items.length));

                    if (!productMap[name]) {
                        productMap[name] = { name, orders: 0, units: 0, revenue: 0, cost: 0, shipping: 0, adSpend: 0 };
                    }
                    if (!isExcluded) {
                        productMap[name].orders += 1;
                        productMap[name].units += qty;
                        productMap[name].revenue += revProp;
                        productMap[name].cost += realCost;
                    }
                    productMap[name].shipping += shippingPerItem;
                });
            });

            // Add external sales to productMap
            const extSales = this.getFilteredExternalSales();
            extSales.forEach(s => {
                const rawName = s.product_name || s.description || 'Venta Manual';
                const name = this.productMappings[rawName] || rawName;
                if (!this.matchesProductFilter([rawName, name])) return;

                if (!productMap[name]) {
                    productMap[name] = { name, orders: 0, units: 0, revenue: 0, cost: 0, shipping: 0, adSpend: 0 };
                }
                const ordersQty = (parseInt(s.delivered || 0) + parseInt(s.returned || 0));
                productMap[name].orders += ordersQty;
                productMap[name].units += (parseInt(s.units || ordersQty || 0));
                productMap[name].revenue += parseFloat(s.revenue || 0);
                productMap[name].cost += parseFloat(s.product_cost || 0);
                productMap[name].shipping += (parseFloat(s.shipping_cost || 0) + parseFloat(s.return_shipping_cost || 0));
            });

            // Add ad expenses per product
            const adExpenses = this.getFilteredAdExpenses();
            adExpenses.forEach(exp => {
                const rawName = exp.product_name;
                if (!rawName) return;
                const name = this.productMappings[rawName] || rawName;
                if (!this.matchesProductFilter([rawName, name])) return;

                if (productMap[name]) {
                    productMap[name].adSpend += parseFloat(exp.amount_spent || 0);
                } else {
                    productMap[name] = { name, orders: 0, units: 0, revenue: 0, cost: 0, shipping: 0, adSpend: parseFloat(exp.amount_spent || 0) };
                }
            });

            const sortedProductList = Object.values(productMap).sort((a, b) => b.revenue - a.revenue);
            const prodHeaders = ['#', 'Producto / Referencia', 'Pedidos', 'Unidades', 'Ventas ($)', 'Costo Producto ($)', 'Envíos ($)', 'Publicidad ($)', 'Utilidad Bruta ($)', 'Utilidad Neta ($)', 'Margen Neto (%)'];
            const prodRows = sortedProductList.map((p, idx) => {
                const gross = p.revenue - p.cost - p.shipping;
                const net = gross - p.adSpend;
                const netMargin = p.revenue > 0 ? ((net / p.revenue) * 100).toFixed(1) + '%' : '0%';
                return [
                    idx + 1,
                    p.name,
                    p.orders,
                    p.units,
                    p.revenue,
                    p.cost,
                    p.shipping,
                    p.adSpend,
                    gross,
                    net,
                    netMargin
                ];
            });

            const wsProducts = XLSX.utils.aoa_to_sheet([prodHeaders, ...prodRows]);
            wsProducts['!cols'] = [
                { wch: 6 },
                { wch: 32 },
                { wch: 10 },
                { wch: 10 },
                { wch: 16 },
                { wch: 18 },
                { wch: 16 },
                { wch: 16 },
                { wch: 18 },
                { wch: 18 },
                { wch: 14 }
            ];

            // 4. SHEET: DETALLE DE PEDIDOS
            const orderHeaders = [
                'Fecha',
                'Nº Guía / Pedido',
                'Cliente',
                'País',
                'Ciudad',
                'Estado',
                '¿Devolución?',
                'Venta ($)',
                'Costo Producto ($)',
                'Costo Envío ($)',
                'Utilidad Estimada ($)',
                'Productos'
            ];

            const orderRows = [];
            filteredGuides.forEach(g => {
                const gCountry = g.country || this.getCountryFromCity(g.cities);
                if (!this.matchesCountryFilter(gCountry)) return;
                const gDate = g.created_at ? g.created_at.split('T')[0] : (g.date || '');
                if (this.filters.dateFrom && gDate < this.filters.dateFrom) return;
                if (this.filters.dateTo && gDate > this.filters.dateTo) return;

                const items = g.guide_items || g.products || g.items || [];
                if (this.productMultiSelect && !this.productMultiSelect.isAllSelected()) {
                    const hasMatch = items.some(it => {
                        const prod = it.products || it;
                        const rawName = prod.name || it.name || '';
                        return this.matchesProductFilter(rawName);
                    });
                    if (!hasMatch) return;
                }

                const isDevol = this.isDevolucion(g);
                const isCanc = this.isCancelado(g);
                const isExcluded = isDevol || isCanc;

                const totalRev = isExcluded ? 0 : this.getGuideRevenueUSD(g);
                const shipping = isCanc ? 0 : this.getGuideShippingCostUSD(g);

                let prodCost = 0;
                let prodSummary = '';
                if (items.length > 0) {
                    prodSummary = items.map(it => `${it.quantity || 1}x ${(it.products?.name || it.name || 'Producto')}`).join(' | ');
                    if (!isExcluded) {
                        items.forEach(it => {
                            const prod = it.products || it;
                            const unitCost = window.ProductsModule ? window.ProductsModule.getRealCost(prod) : parseFloat(prod.cost || 0) * 40000;
                            prodCost += unitCost * (it.quantity || 1);
                        });
                    }
                }

                const profit = totalRev - prodCost - shipping;

                orderRows.push([
                    gDate,
                    g.guide_number || g.guideNumber || '',
                    g.client_name || g.clientName || 'N/A',
                    gCountry || '',
                    g.cities?.name || g.city || '',
                    g.guide_statuses?.name || g.status || '',
                    isDevol ? 'SÍ (Devolución)' : (isCanc ? 'SÍ (Cancelado)' : 'No'),
                    totalRev,
                    prodCost,
                    shipping,
                    profit,
                    prodSummary
                ]);
            });

            const wsOrders = XLSX.utils.aoa_to_sheet([orderHeaders, ...orderRows]);
            wsOrders['!cols'] = [
                { wch: 12 },
                { wch: 15 },
                { wch: 22 },
                { wch: 14 },
                { wch: 14 },
                { wch: 14 },
                { wch: 16 },
                { wch: 14 },
                { wch: 18 },
                { wch: 16 },
                { wch: 18 },
                { wch: 35 }
            ];

            // 5. SHEET: GASTOS OPERATIVOS Y PUBLICIDAD
            const expHeaders = ['Tipo de Gasto', 'Fecha', 'País', 'Campaña / Categoría / Producto', 'Descripción / Notas', 'Monto ($ USD)'];
            const expRows = [];

            adExpenses.forEach(a => {
                expRows.push([
                    'Publicidad (Ads)',
                    a.date_start || a.date || '',
                    a.country || '',
                    a.product_name || a.campaign_name || 'General',
                    a.notes || '',
                    parseFloat(a.amount_spent || 0)
                ]);
            });

            const opExpenses = this.getFilteredOperationalExpenses ? this.getFilteredOperationalExpenses() : [];
            opExpenses.forEach(o => {
                expRows.push([
                    'Gasto Operativo',
                    o.expense_date || o.date || '',
                    o.country || '',
                    o.category || 'Operativo',
                    o.description || '',
                    parseFloat(o.amount || 0)
                ]);
            });

            const wsExpenses = XLSX.utils.aoa_to_sheet([expHeaders, ...expRows]);
            wsExpenses['!cols'] = [
                { wch: 18 },
                { wch: 12 },
                { wch: 14 },
                { wch: 30 },
                { wch: 30 },
                { wch: 16 }
            ];

            // Build workbook
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, wsPL, 'P&L Consolidado');
            XLSX.utils.book_append_sheet(wb, wsCountry, 'Desglose por País');
            XLSX.utils.book_append_sheet(wb, wsProducts, 'Rentabilidad Productos');
            XLSX.utils.book_append_sheet(wb, wsOrders, 'Detalle de Pedidos');
            XLSX.utils.book_append_sheet(wb, wsExpenses, 'Gastos y Publicidad');

            const dateStr = (this.filters.dateFrom || 'inicio') + '_a_' + (this.filters.dateTo || 'hoy');
            XLSX.writeFile(wb, `estado_resultados_${dateStr}.xlsx`);
            Utils.showToast('Estado de Resultados descargado en Excel', 'success');

        } catch (error) {
            console.error('Error al exportar estado de resultados a Excel:', error);
            Utils.showToast('Error al generar Excel del Estado de Resultados: ' + (error.message || error), 'error');
        }
    },

    exportToCSV() {
        this.exportToExcel();
    },

    // ========================================
    // HELPERS
    // ========================================
    formatCurrency(amount) {
        const num = parseFloat(amount) || 0;
        return '$' + num.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    },

    formatDate(dateStr) {
        if (!dateStr) return '-';
        const d = new Date(dateStr + 'T00:00:00');
        return d.toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' });
    },

    getCountryFlag(country) {
        if (!country) return '🏳️';
        const c = country.toLowerCase();
        if (c.includes('ecuador') || c.includes('ecu') || c === 'ec') return '🇪🇨';
        if (c.includes('venezuela') || c.includes('ven') || c === 've') return '🇻🇪';
        if (c.includes('colombia') || c.includes('col') || c === 'co') return '🇨🇴';
        if (c.includes('chile') || c === 'cl') return '🇨🇱';
        if (c.includes('mexico') || c.includes('méxico') || c === 'mx') return '🇲🇽';
        if (c.includes('peru') || c.includes('perú') || c === 'pe') return '🇵🇪';
        if (c.includes('panama') || c.includes('panamá') || c === 'pa') return '🇵🇦';
        return '🏳️';
    },

    // ========================================
    // ORDERS DETAIL MODAL & GROUPING
    // ========================================
    ordersDetailCurrentTab: 'grouped',
    ordersDetailCurrentCountry: '',

    setOrdersDetailTab(tab) {
        this.ordersDetailCurrentTab = tab;
        document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
        document.querySelectorAll('.tab-btn').forEach(btn => btn.style.borderBottom = 'none');
        document.querySelectorAll('.tab-btn').forEach(btn => btn.style.color = 'var(--text-muted)');
        
        const activeBtn = document.getElementById(tab === 'grouped' ? 'tabOrdersDetailGrouped' : 'tabOrdersDetailList');
        if (activeBtn) {
            activeBtn.classList.add('active');
            activeBtn.style.borderBottom = '2px solid var(--primary)';
            activeBtn.style.color = 'var(--primary)';
        }
        this.renderOrdersDetail();
    },

    showOrdersDetail(country) {
        this.ordersDetailCurrentCountry = country;
        const modal = document.getElementById('modalOrdersDetail');
        if (!modal) return;
        
        const titleEl = document.getElementById('ordersDetailTitle');
        if (titleEl) {
            titleEl.innerHTML = `${this.getCountryFlag(country)} Detalle de Pedidos — ${country}`;
        }
        
        this.setOrdersDetailTab(this.ordersDetailCurrentTab);
        modal.classList.add('active');
    },

    renderOrdersDetail() {
        const country = this.ordersDetailCurrentCountry;
        const isExternal = !country.endsWith(' Domi');

        const summaryEl = document.getElementById('ordersDetailSummary');
        const tableBody = document.getElementById('ordersDetailTable');
        const tableHead = document.getElementById('ordersDetailThead');
        const tabsContainer = document.querySelector('#modalOrdersDetail .nav-tabs');
        if (!tableBody || !tableHead) return;

        if (isExternal) {
            if (tabsContainer) tabsContainer.style.display = 'none';
            let extSales = this.getFilteredExternalSales().filter(s => {
                let sc = (s.country || '').trim();
                if (sc.toLowerCase() === 'ecuador') sc = 'Ecuador Hoko';
                return sc.toLowerCase() === country.toLowerCase();
            });

            let totalRevenue = 0, totalCost = 0, totalShipping = 0, totalUnits = 0, effectiveOrders = 0, returnedOrders = 0;
            extSales.forEach(item => {
                const del = parseInt(item.delivered || 0);
                const ret = parseInt(item.returned || 0);
                effectiveOrders += del;
                returnedOrders += ret;
                totalUnits += parseInt(item.units || del || 1);
                totalRevenue += parseFloat(item.revenue || 0);
                totalCost += parseFloat(item.product_cost || 0);
                totalShipping += parseFloat(item.shipping_cost || 0) + parseFloat(item.return_shipping_cost || 0);
            });
            if (effectiveOrders === 0 && returnedOrders === 0) {
                effectiveOrders = extSales.length;
            }
            const grossProfit = totalRevenue - totalCost - totalShipping;

            if (summaryEl) {
                summaryEl.innerHTML = `
                    <div class="orders-detail-summary-grid">
                        <div class="orders-summary-item">
                            <span class="orders-summary-label">Pedidos Entregados</span>
                            <span class="orders-summary-value">${effectiveOrders}${returnedOrders > 0 ? ` <small style="font-size:0.75rem; color: #f97316; font-weight: 500;">(+${returnedOrders} dev)</small>` : ''}</span>
                        </div>
                        <div class="orders-summary-item">
                            <span class="orders-summary-label">Unidades Vendidas</span>
                            <span class="orders-summary-value">${totalUnits}</span>
                        </div>
                        <div class="orders-summary-item">
                            <span class="orders-summary-label">Ventas</span>
                            <span class="orders-summary-value" style="color: var(--success);">${this.formatCurrency(totalRevenue)}</span>
                        </div>
                        <div class="orders-summary-item">
                            <span class="orders-summary-label">Costo Prod.</span>
                            <span class="orders-summary-value" style="color: var(--danger);">${this.formatCurrency(totalCost)}</span>
                        </div>
                        <div class="orders-summary-item">
                            <span class="orders-summary-label">Envíos (Total)</span>
                            <span class="orders-summary-value" style="color: var(--danger);">${this.formatCurrency(totalShipping)}</span>
                        </div>
                        <div class="orders-summary-item">
                            <span class="orders-summary-label">Fletes</span>
                            <span class="orders-summary-value" style="color: var(--warning);">$0.00</span>
                        </div>
                        <div class="orders-summary-item orders-summary-highlight">
                            <span class="orders-summary-label">Utilidad Bruta</span>
                            <span class="orders-summary-value" style="color: ${grossProfit >= 0 ? 'var(--success)' : 'var(--danger)'}; font-size: 1.1rem;">${this.formatCurrency(grossProfit)}</span>
                        </div>
                    </div>
                `;
            }

            if (extSales.length === 0) {
                tableHead.innerHTML = '';
                tableBody.innerHTML = `
                    <tr>
                        <td colspan="9" style="text-align: center; color: var(--text-muted); padding: 2rem;">
                            No hay registros para ${country} en el período seleccionado.
                        </td>
                    </tr>`;
                return;
            }

            tableHead.innerHTML = `
                <tr>
                    <th style="width: 40px;">#</th>
                    <th>Referencia / Producto</th>
                    <th>Fecha</th>
                    <th style="text-align: center;">Entregados</th>
                    <th style="text-align: center;">Devueltos</th>
                    <th style="text-align: right;">Recaudo / Venta</th>
                    <th style="text-align: right;">Costo Prod.</th>
                    <th style="text-align: right;">Envíos / Fletes</th>
                    <th style="text-align: right;">Utilidad</th>
                </tr>
            `;
            tableBody.innerHTML = extSales.map((item, idx) => {
                const del = parseInt(item.delivered || 0);
                const ret = parseInt(item.returned || 0);
                const rev = parseFloat(item.revenue || 0);
                const cost = parseFloat(item.product_cost || 0);
                const ship = parseFloat(item.shipping_cost || 0) + parseFloat(item.return_shipping_cost || 0);
                const profit = rev - cost - ship;
                const dateStr = item.sale_date ? this.formatDate(item.sale_date) : '-';

                return `
                    <tr>
                        <td style="font-weight: 600; color: var(--text-muted); font-size: 0.8rem;">${idx + 1}</td>
                        <td>
                            <div style="font-weight: 600; font-size: 0.85rem;">${item.description || 'Producto Externo'}</div>
                            <div style="font-size: 0.72rem; color: var(--text-muted);">${country}</div>
                        </td>
                        <td style="font-size: 0.8rem;">${dateStr}</td>
                        <td style="text-align: center; font-weight: 600; color: var(--success);">${del}</td>
                        <td style="text-align: center; color: ${ret > 0 ? '#f97316' : 'var(--text-muted)'};">${ret}</td>
                        <td style="text-align: right; font-weight: 600; color: var(--success);">${this.formatCurrency(rev)}</td>
                        <td style="text-align: right; color: var(--danger);">${this.formatCurrency(cost)}</td>
                        <td style="text-align: right; color: var(--danger);">${this.formatCurrency(ship)}</td>
                        <td style="text-align: right; font-weight: 600; color: ${profit >= 0 ? 'var(--success)' : 'var(--danger)'};">${this.formatCurrency(profit)}</td>
                    </tr>
                `;
            }).join('');
            return;
        }

        // Domi guides
        if (tabsContainer) tabsContainer.style.display = '';
        const baseCountry = country.replace(' Domi', '').trim();
        const sales = this.getFilteredSales().filter(guide => {
            return this.getCountryFromCity(guide.cities) === baseCountry;
        });

        // Freight cost for this country
        const freightsByCountry = this.getFreightsByCountry();
        const countryFreight = freightsByCountry[baseCountry]?.totalFreight || freightsByCountry[country]?.totalFreight || 0;
        const grossProfit = totalRevenue - totalCost - totalShipping - countryFreight;

        if (summaryEl) {
            summaryEl.innerHTML = `
                <div class="orders-detail-summary-grid">
                    <div class="orders-summary-item">
                        <span class="orders-summary-label">Pedidos Entregados</span>
                        <span class="orders-summary-value">${effectiveOrders}${returnedOrders > 0 ? ` <small style="font-size:0.75rem; color: #f97316; font-weight: 500;">(+${returnedOrders} dev)</small>` : ''}</span>
                    </div>
                    <div class="orders-summary-item">
                        <span class="orders-summary-label">Unidades Vendidas</span>
                        <span class="orders-summary-value">${totalUnits}</span>
                    </div>
                    <div class="orders-summary-item">
                        <span class="orders-summary-label">Ventas</span>
                        <span class="orders-summary-value" style="color: var(--success);">${this.formatCurrency(totalRevenue)}</span>
                    </div>
                    <div class="orders-summary-item">
                        <span class="orders-summary-label">Costo Prod.</span>
                        <span class="orders-summary-value" style="color: var(--danger);">${this.formatCurrency(totalCost)}</span>
                    </div>
                    <div class="orders-summary-item">
                        <span class="orders-summary-label">Envíos (Total)</span>
                        <span class="orders-summary-value" style="color: var(--danger);">${this.formatCurrency(totalShipping)}</span>
                    </div>
                    <div class="orders-summary-item">
                        <span class="orders-summary-label">Fletes</span>
                        <span class="orders-summary-value" style="color: var(--warning);">${this.formatCurrency(countryFreight)}</span>
                    </div>
                    <div class="orders-summary-item orders-summary-highlight">
                        <span class="orders-summary-label">Utilidad Bruta</span>
                        <span class="orders-summary-value" style="color: ${grossProfit >= 0 ? 'var(--success)' : 'var(--danger)'}; font-size: 1.1rem;">${this.formatCurrency(grossProfit)}</span>
                    </div>
                </div>
            `;
        }

        if (sales.length === 0) {
            tableHead.innerHTML = '';
            tableBody.innerHTML = `
                <tr>
                    <td colspan="9" style="text-align: center; color: var(--text-muted); padding: 2rem;">
                        No hay pedidos para ${country} en el período seleccionado.
                    </td>
                </tr>`;
            return;
        }

        if (this.ordersDetailCurrentTab === 'list') {
            tableHead.innerHTML = `
                <tr>
                    <th style="width: 40px;">#</th>
                    <th>Cliente / Ciudad</th>
                    <th>Productos (Ref. Dropi)</th>
                    <th style="text-align: center;">Uds.</th>
                    <th style="text-align: right;">Venta</th>
                    <th style="text-align: right;">Costo Prod.</th>
                    <th style="text-align: right;">Envío</th>
                    <th style="text-align: right;">Utilidad</th>
                    <th>Fecha / Estado</th>
                </tr>
            `;
            tableBody.innerHTML = sales.map((guide, idx) => {
                const city = guide.cities?.name || '-';
                const status = guide.guide_statuses?.name || guide.status || '-';
                const isExcluded = this.isExcludedFromSales(guide);
                const isDevol = this.isDevolucion(guide);
                const revenue = isExcluded ? 0 : this.getGuideRevenueUSD(guide);
                const shipping = this.getGuideShippingCostUSD(guide);
                let cost = 0, units = 0;
                const products = [];
                if (guide.guide_items) {
                    guide.guide_items.forEach(item => {
                        const qty = parseInt(item.quantity || 0);
                        const rawCost = parseFloat(item.products?.cost || 0);
                        const unitCost = window.ProductsModule ? window.ProductsModule.getRealCost(item.products || {}) : rawCost * 40000;
                        if (!isExcluded) {
                            cost += qty * unitCost;
                            units += qty;
                        }
                        
                        const rawName = item.products?.name || 'Producto Desconocido';
                        const mappedName = this.productMappings[rawName] || rawName;
                        products.push(`${mappedName} x${qty}`);
                    });
                }
                const profit = revenue - cost - shipping;
                const dateStr = guide.created_at ? this.formatDate(guide.created_at.split('T')[0]) : '-';
                
                let statusBadge = `<div style="font-size: 0.75rem; font-weight: 500;">${status}</div>`;
                if (isDevol) {
                    statusBadge = `<span class="badge" style="background: rgba(249, 115, 22, 0.15); color: #f97316; font-size: 0.72rem; font-weight: 600; padding: 2px 6px; border-radius: 4px; border: 1px solid rgba(249, 115, 22, 0.3);">Devolución (Sin cobro)</span>`;
                } else if (status === 'Pagado') {
                    statusBadge = `<div style="color: var(--success); font-size: 0.75rem; font-weight: 500;">${status}</div>`;
                }

                const rowBg = isDevol ? 'background: rgba(249, 115, 22, 0.05);' : '';
                const isCol = this.isColombiaOrder(guide);
                const copRev = parseFloat(guide.total_amount || 0);
                const copShip = parseFloat(guide.shipping_cost || 0);

                const revDisplay = isExcluded 
                    ? `<span style="text-decoration: line-through; opacity: 0.6; font-size: 0.78rem;">${isCol ? 'COP $' + Math.round(copRev).toLocaleString('es-CO') : this.formatCurrency(copRev)}</span> <div style="font-size: 0.72rem; color: #f97316; font-weight: 600;">$0.00</div>` 
                    : `<div>${this.formatCurrency(revenue)}</div>${isCol ? '<div style="font-size: 0.7rem; color: var(--text-muted); font-weight: 500;">COP $' + Math.round(copRev).toLocaleString('es-CO') + '</div>' : ''}`;

                const shipDisplay = `<div>${this.formatCurrency(shipping)}</div>${isCol ? '<div style="font-size: 0.7rem; color: var(--text-muted); font-weight: 500;">COP $' + Math.round(copShip).toLocaleString('es-CO') + '</div>' : ''}`;

                return `
                    <tr style="${rowBg}">
                        <td style="font-weight: 600; color: var(--text-muted); font-size: 0.8rem;">${idx + 1}</td>
                        <td>
                            <div style="font-weight: 600; font-size: 0.85rem;">${guide.customer_name || guide.guide_number || '-'}</div>
                            <div style="font-size: 0.75rem; color: var(--text-muted);">${city}</div>
                        </td>
                        <td style="font-size: 0.8rem; max-width: 180px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${products.join(', ')}">${products.join(', ') || '-'}</td>
                        <td style="text-align: center;">${isExcluded ? `<span style="text-decoration: line-through; opacity: 0.6;">${guide.guide_items?.reduce((s,i)=>s+parseInt(i.quantity||0),0)||0}</span> <span style="font-size: 0.72rem; color: #f97316;">(0)</span>` : units}</td>
                        <td style="text-align: right; font-weight: 600; color: var(--success);">${revDisplay}</td>
                        <td style="text-align: right; color: var(--danger);">${this.formatCurrency(cost)}</td>
                        <td style="text-align: right; color: var(--danger);">${shipDisplay}</td>
                        <td style="text-align: right; font-weight: 600; color: ${profit >= 0 ? 'var(--success)' : 'var(--danger)'};">${this.formatCurrency(profit)}</td>
                        <td style="font-size: 0.8rem;">
                            <div>${dateStr}</div>
                            ${statusBadge}
                        </td>
                    </tr>`;
            }).join('');
        } else {
            // Grouped Tab
            tableHead.innerHTML = `
                <tr>
                    <th style="width: 40px;">#</th>
                    <th>Referencia / Producto (Maestro)</th>
                    <th style="text-align: right;">Pedidos</th>
                    <th style="text-align: right;">Uds.</th>
                    <th style="text-align: right;">Ventas</th>
                    <th style="text-align: right;">Costo Prod.</th>
                    <th style="text-align: right;">Costo Envíos</th>
                    <th style="text-align: right;">Util. Bruta (Sin Fletes)</th>
                    <th style="text-align: center;">Margen</th>
                </tr>
            `;

            const groupedMap = {};
            sales.forEach(guide => {
                if (this.isCancelado(guide)) return;
                const isExcluded = this.isExcludedFromSales(guide);
                const revenue = isExcluded ? 0 : this.getGuideRevenueUSD(guide);
                const shipping = this.getGuideShippingCostUSD(guide);
                
                let totalItemsCost = 0;
                const items = guide.guide_items || [];
                items.forEach(item => {
                    const rawCost = parseFloat(item.products?.cost || 0);
                    const cost = window.ProductsModule ? window.ProductsModule.getRealCost(item.products || {}) : rawCost * 40000;
                    totalItemsCost += (parseInt(item.quantity || 0) * cost);
                });

                items.forEach(item => {
                    const qty = parseInt(item.quantity || 0);
                    const rawCost = parseFloat(item.products?.cost || 0);
                    const cost = window.ProductsModule ? window.ProductsModule.getRealCost(item.products || {}) : rawCost * 40000;
                    const realCost = isExcluded ? 0 : (qty * cost);
                    
                    const rawName = item.products?.name || 'Producto Desconocido';
                    const mappedName = this.productMappings[rawName] || rawName;

                    const shippingProp = items.length > 0 ? (shipping / items.length) : 0;
                    const revProp = isExcluded ? 0 : (totalItemsCost > 0 ? (realCost / totalItemsCost) * revenue : (revenue / items.length));

                    if (!groupedMap[mappedName]) {
                        groupedMap[mappedName] = { name: mappedName, orders: 0, units: 0, revenue: 0, cost: 0, shipping: 0 };
                    }
                    if (!isExcluded) {
                        groupedMap[mappedName].orders += 1;
                        groupedMap[mappedName].units += qty;
                        groupedMap[mappedName].revenue += revProp;
                        groupedMap[mappedName].cost += realCost;
                    }
                    groupedMap[mappedName].shipping += shippingProp;
                });
            });

            const groupedArray = Object.values(groupedMap).sort((a, b) => b.revenue - a.revenue);

            tableBody.innerHTML = groupedArray.map((prod, idx) => {
                const profit = prod.revenue - prod.cost - prod.shipping; // Fletes country is omitted from row, only total
                const margin = prod.revenue > 0 ? ((profit / prod.revenue) * 100).toFixed(1) : '0.0';

                return `
                    <tr>
                        <td style="font-weight: 600; color: var(--text-muted); font-size: 0.8rem;">${idx + 1}</td>
                        <td style="font-weight: 600;">${prod.name}</td>
                        <td style="text-align: right;">${prod.orders}</td>
                        <td style="text-align: right;">${prod.units}</td>
                        <td style="text-align: right; font-weight: 600; color: var(--success);">${this.formatCurrency(prod.revenue)}</td>
                        <td style="text-align: right; color: var(--danger);">${this.formatCurrency(prod.cost)}</td>
                        <td style="text-align: right; color: var(--danger);">${this.formatCurrency(prod.shipping)}</td>
                        <td style="text-align: right; font-weight: 600; color: ${profit >= 0 ? 'var(--success)' : 'var(--danger)'};">${this.formatCurrency(profit)}</td>
                        <td style="text-align: center;"><span class="is-margin-badge ${parseFloat(margin) >= 30 ? 'good' : parseFloat(margin) >= 15 ? 'warning' : 'bad'}">${margin}%</span></td>
                    </tr>
                `;
            }).join('');
        }
    },

    openGroupReferencesModal() {
        const sales = this.getFilteredSales();
        const uniqueRawRefs = {};
        
        sales.forEach(guide => {
            if (guide.guide_items) {
                guide.guide_items.forEach(item => {
                    const rawName = item.products?.name;
                    if (rawName && !uniqueRawRefs[rawName]) {
                        uniqueRawRefs[rawName] = true;
                    }
                });
            }
        });
        
        const listEl = document.getElementById('groupReferencesList');
        const refsArray = Object.keys(uniqueRawRefs).sort();
        
        if (refsArray.length === 0) {
            listEl.innerHTML = '<div style="color:var(--text-muted); font-size:0.9rem;">No hay referencias de Dropi disponibles.</div>';
        } else {
            listEl.innerHTML = refsArray.map(ref => {
                const isMapped = this.productMappings[ref];
                let extraText = '';
                if (isMapped && isMapped !== ref) {
                    extraText = `<span style="font-size: 0.75rem; color: var(--text-muted); margin-left: 0.5rem;">(Agrupado en: ${isMapped})</span>`;
                }
                return `
                    <label style="display: flex; align-items: center; gap: 0.5rem; padding: 0.5rem; background: rgba(255,255,255,0.03); border-radius: 4px; cursor: pointer;">
                        <input type="checkbox" name="group_refs" value="${ref.replace(/"/g, '&quot;')}">
                        <span style="font-size: 0.9rem; flex: 1;">${ref}</span>
                        ${extraText}
                    </label>
                `;
            }).join('');
        }
        
        document.getElementById('groupRefMasterName').value = '';
        document.getElementById('modalGroupReferences').classList.add('active');
    },

    async submitGroupReferences() {
        const masterName = document.getElementById('groupRefMasterName').value.trim();
        if (!masterName) {
            Utils.showToast('Debes ingresar un Nombre Maestro', 'error');
            return;
        }
        
        const checkboxes = document.querySelectorAll('#groupReferencesList input[type="checkbox"]:checked');
        if (checkboxes.length === 0) {
            Utils.showToast('Debes seleccionar al menos una referencia', 'error');
            return;
        }
        
        checkboxes.forEach(cb => {
            this.productMappings[cb.value] = masterName;
        });
        
        localStorage.setItem('is_product_mappings', JSON.stringify(this.productMappings));
        
        Utils.showToast(`Se han agrupado ${checkboxes.length} referencias en "${masterName}"`, 'success');
        document.getElementById('modalGroupReferences').classList.remove('active');
        
        // Re-render
        if (this.ordersDetailCurrentCountry) {
            this.renderOrdersDetail();
        }
        await this.render();
    },

    closeOrdersDetailModal() {
        const modal = document.getElementById('modalOrdersDetail');
        if (modal) modal.classList.remove('active');
    },

    toggleSelectAllUnifiedSales(checked) {
        const checkboxes = document.querySelectorAll('.unified-sale-checkbox');
        checkboxes.forEach(cb => cb.checked = checked);
        this.updateSelectedUnifiedSalesCount();
    },

    updateSelectedUnifiedSalesCount() {
        const selected = document.querySelectorAll('.unified-sale-checkbox:checked');
        const count = selected.length;
        const btn = document.getElementById('btnGroupUnifiedSales');
        const countSpan = document.getElementById('groupUnifiedSalesCount');
        const toolbar = document.getElementById('unifiedSalesGroupToolbar');
        
        if (countSpan) countSpan.innerText = count;
        if (btn) btn.disabled = count < 2;
        
        // Show toolbar if at least one checkbox exists
        if (toolbar) {
            const anyCheckbox = document.querySelector('.unified-sale-checkbox');
            toolbar.style.display = anyCheckbox ? 'flex' : 'none';
        }
    },

    filterConsolidatedProducts() {
        const query = (document.getElementById('unifiedSalesSearch')?.value || '').toLowerCase();
        const tbody = document.getElementById('isProductProfitTable');
        if (!tbody) return;
        
        const rows = tbody.querySelectorAll('tr:not(.is-total-row)');
        
        rows.forEach(row => {
            // Check if it's the empty message row
            if (row.cells.length === 1 && row.cells[0].colSpan > 5) return;
            
            const text = row.textContent.toLowerCase();
            if (text.includes(query)) {
                row.style.display = '';
            } else {
                row.style.display = 'none';
            }
        });
    },

    visualGroupConsolidatedProducts() {
        const selected = document.querySelectorAll('.unified-sale-checkbox:checked');
        if (selected.length < 2) return;
        
        const products = Array.from(selected).map(cb => cb.value);
        const name = prompt('Ingresa un nombre para este grupo visual (Ej: Combos Belleza):');
        if (!name) return;
        
        this.visualMergedGroups.push({
            name: name,
            products: products
        });
        
        Utils.showToast(`Grupo visual "${name}" creado.`, 'success');
        this.renderProductProfitTable();
        
        const selectAll = document.getElementById('selectAllUnifiedSales');
        if(selectAll) selectAll.checked = false;
        this.updateSelectedUnifiedSalesCount();
    },

    ungroupVisualGroup(groupId) {
        if (!confirm('¿Deshacer este grupo visual?')) return;

        this.visualMergedGroups.splice(groupId, 1);
        Utils.showToast('Grupo visual desagrupado.', 'success');
        this.renderProductProfitTable();
        this.updateSelectedUnifiedSalesCount();
    },

    editVisualGroupName(groupId) {
        const group = this.visualMergedGroups[groupId];
        if (!group) return;

        const newName = prompt('Editar nombre del grupo:', group.name);
        if (!newName || newName.trim() === '') return;
        if (newName.trim() === group.name) return;

        this.visualMergedGroups[groupId].name = newName.trim();
        Utils.showToast(`Grupo renombrado a "${newName.trim()}".`, 'success');
        this.renderProductProfitTable();
    },

    toggleSelectAllUnifiedCountries(checked) {
        const checkboxes = document.querySelectorAll('.unified-country-checkbox');
        checkboxes.forEach(cb => {
            const tr = cb.closest('tr');
            if (tr.style.display !== 'none') {
                cb.checked = checked;
            }
        });
        this.updateSelectedUnifiedCountriesCount();
    },

    updateSelectedUnifiedCountriesCount() {
        const selected = document.querySelectorAll('.unified-country-checkbox:checked').length;
        const toolbar = document.getElementById('unifiedCountriesGroupToolbar');
        const countSpan = document.getElementById('groupUnifiedCountriesCount');
        const btn = document.getElementById('btnGroupUnifiedCountries');
        
        if (toolbar && countSpan && btn) {
            countSpan.textContent = selected;
            if (selected >= 2) {
                toolbar.style.display = 'flex';
                btn.disabled = false;
            } else if (selected === 1) {
                toolbar.style.display = 'flex';
                btn.disabled = true;
            } else {
                toolbar.style.display = 'none';
                btn.disabled = true;
            }
        }
    },

    visualGroupConsolidatedCountries() {
        const checkedBoxes = Array.from(document.querySelectorAll('.unified-country-checkbox:checked'));
        if (checkedBoxes.length < 2) return;
        
        const items = checkedBoxes.map(cb => cb.value);
        
        const name = prompt('Ingresa un nombre para este grupo de países/plataformas:', 'Nuevo Grupo');
        if (!name || name.trim() === '') return;
        
        this.visualMergedGroupsCountry.push({
            name: name.trim(),
            items: items
        });
        
        localStorage.setItem('is_visual_merged_groups_country', JSON.stringify(this.visualMergedGroupsCountry));
        
        Utils.showToast(`Grupo visual "${name}" creado.`, 'success');
        this.renderConsolidatedSalesTable();
        
        const selectAll = document.getElementById('selectAllUnifiedCountries');
        if(selectAll) selectAll.checked = false;
        this.updateSelectedUnifiedCountriesCount();
    },

    ungroupVisualGroupCountry(groupId) {
        if (!confirm('¿Deshacer este grupo visual?')) return;

        this.visualMergedGroupsCountry.splice(groupId, 1);
        localStorage.setItem('is_visual_merged_groups_country', JSON.stringify(this.visualMergedGroupsCountry));

        Utils.showToast('Grupo visual desagrupado.', 'success');
        this.renderConsolidatedSalesTable();
        this.updateSelectedUnifiedCountriesCount();
    },

    editVisualGroupNameCountry(groupId) {
        const group = this.visualMergedGroupsCountry[groupId];
        if (!group) return;

        const newName = prompt('Editar nombre del grupo:', group.name);
        if (!newName || newName.trim() === '') return;
        if (newName.trim() === group.name) return;

        this.visualMergedGroupsCountry[groupId].name = newName.trim();
        localStorage.setItem('is_visual_merged_groups_country', JSON.stringify(this.visualMergedGroupsCountry));
        Utils.showToast(`Grupo renombrado a "${newName.trim()}".`, 'success');
        this.renderConsolidatedSalesTable();
    },

    filterConsolidatedCountries() {
        const searchInput = document.getElementById('consolidatedCountriesSearch');
        if (!searchInput) return;
        const query = searchInput.value.toLowerCase();
        
        const tbody = document.getElementById('isConsolidatedSalesTable');
        if (!tbody) return;
        
        const rows = Array.from(tbody.querySelectorAll('tr:not(.is-total-row)'));
        let hasVisible = false;
        
        rows.forEach(row => {
            const countryCell = row.cells[1];
            if (!countryCell) return;
            const text = countryCell.textContent.toLowerCase();
            
            if (text.includes(query)) {
                row.style.display = '';
                hasVisible = true;
            } else {
                row.style.display = 'none';
                const cb = row.querySelector('.unified-country-checkbox');
                if (cb) cb.checked = false;
            }
        });
        
        this.updateSelectedUnifiedCountriesCount();
    },

    showCountryDetail(id, isGroup, groupId) {
        // Find which items this represents
        let itemIds = [];
        if (isGroup && groupId !== null) {
            const group = this.visualMergedGroupsCountry[groupId];
            if (group) {
                itemIds = group.items;
            }
        } else {
            itemIds = [id];
        }
        
        // Use the existing logic to find orders based on itemIds
        let allOrders = [];
        
        itemIds.forEach(itemId => {
            if (itemId.startsWith('Dropi_')) {
                const guideId = itemId.replace('Dropi_', '');
                const order = this.guides.find(g => String(g.id) === String(guideId));
                if (order && order.status !== 'CANCELLED' && order.status !== 'ANULADO') {
                    allOrders.push({
                        ...order,
                        __source: 'Dropi',
                        __sourceName: `Dropi (${this.getCountryFromCity(order.cities)})`
                    });
                }
            } else if (itemId.startsWith('Ext_')) {
                const extId = itemId.replace('Ext_', '');
                const extSale = this.externalSales.find(s => s.id === extId);
                if (extSale) {
                    allOrders.push({
                        ...extSale,
                        __source: 'Excel',
                        __sourceName: 'Otras Plataformas'
                    });
                }
            }
        });
        
        if (allOrders.length === 0) {
            Utils.showToast('No se encontraron pedidos.', 'warning');
            return;
        }
        
        // Show the detail using an adapted version of the existing modal
        this.populateAndShowOrdersDetail(allOrders, isGroup ? 'Grupo de Países' : id);
    },

    populateAndShowOrdersDetail(allOrders, title) {
        const modal = document.getElementById('modalProductOrdersDetail');
        if (!modal) return;
        
        const tbody = document.getElementById('productOrdersDetailTable');
        const titleEl = document.getElementById('productOrdersDetailTitle');
        const statsEl = document.getElementById('productOrdersDetailSummary');
        
        if (!tbody || !titleEl || !statsEl) return;
        
        titleEl.textContent = `Desglose: ${title.replace(/Dropi_|Ext_/, '')} (${allOrders.length} registros)`;
        
        let totalRev = 0;
        let totalCost = 0;
        let totalShip = 0;
        let orderCount = 0;
        
        let html = '';
        allOrders.forEach(o => {
            if (o.__source === 'Dropi') {
                const isExcluded = this.isExcludedFromSales(o);
                const isDevol = this.isDevolucion(o);
                const rev = isExcluded ? 0 : this.getGuideRevenueUSD(o);
                const ship = this.getGuideShippingCostUSD(o);
                const items = o.guide_items || [];
                const cost = isExcluded ? 0 : items.reduce((s, item) => {
                    const rawCost = parseFloat(item.products?.cost || 0);
                    const itemCost = window.ProductsModule ? window.ProductsModule.getRealCost(item.products || {}) : rawCost * 40000;
                    return s + (itemCost * (item.quantity || 1));
                }, 0);
                const totalQty = items.reduce((s, item) => s + parseInt(item.quantity || 0), 0);
                const productLabel = items.length > 0
                    ? [...new Set(items.map(item => `${item.products?.name || 'Producto Desconocido'} (x${item.quantity || 1})`))].join(', ')
                    : 'Producto Desconocido';
                const isMixedCart = new Set(items.map(item => item.products?.name || '')).size > 1;

                if (!isExcluded) {
                    orderCount++;
                    totalRev += rev;
                    totalCost += cost;
                }
                totalShip += ship;

                const date = o.created_at ? o.created_at.split('T')[0] : (o.date || '');
                const statusBadge = isDevol
                    ? '<span class="badge" style="background: rgba(249, 115, 22, 0.15); color: #f97316;">Devolución</span>'
                    : `<span class="badge ${o.status === 'DELIVERED' || o.guide_statuses?.name === 'Pagado' ? 'bg-success' : 'bg-secondary'}">${o.guide_statuses?.name || o.status}</span>`;

                const isCol = this.isColombiaOrder(o);
                const copRev = parseFloat(o.total_amount || 0);
                const copShip = parseFloat(o.shipping_cost || 0);
                const revText = isExcluded
                    ? `<span style="text-decoration: line-through; opacity: 0.6;">${isCol ? 'COP $' + Math.round(copRev).toLocaleString('es-CO') : this.formatCurrency(copRev)}</span> <span style="color: #f97316; font-size: 0.75rem;">$0.00</span>`
                    : `<div>${this.formatCurrency(rev)}</div>${isCol ? '<div style="font-size: 0.7rem; color: var(--text-muted); font-weight: 500;">COP $' + Math.round(copRev).toLocaleString('es-CO') + '</div>' : ''}`;

                const shortId = String(o.id || o.guide_number || 'N/A').slice(0, 8);
                const fullId = String(o.id || o.guide_number || 'N/A');

                html += `
                    <tr style="${isDevol ? 'background: rgba(249, 115, 22, 0.05);' : ''} ${isMixedCart ? 'background: rgba(245, 158, 11, 0.08);' : ''}">
                        <td style="padding: 0.5rem 0.75rem; font-size: 0.78rem; color: var(--text-muted); white-space: nowrap;">${date}</td>
                        <td style="padding: 0.5rem 0.75rem; white-space: nowrap;">
                            <div style="font-family: monospace; font-size: 0.72rem; color: var(--text-muted);" title="${fullId}">${shortId}...</div>
                            <span class="badge" style="background: rgba(99, 102, 241, 0.1); color: #6366f1; font-size: 0.65rem;">Dropi</span>
                        </td>
                        <td style="padding: 0.5rem 0.75rem;"><div style="white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 120px;" title="${this.getCountryFromCity(o.cities)}">${this.getCountryFromCity(o.cities)}</div></td>
                        <td style="padding: 0.5rem 0.75rem; white-space: nowrap;">${statusBadge}</td>
                        <td style="padding: 0.5rem 0.75rem;">
                            <div style="white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 220px;" title="${productLabel.replace(/"/g, '&quot;')}">${productLabel}</div>
                            ${isMixedCart ? '<span class="badge" style="background: rgba(245, 158, 11, 0.15); color: #f59e0b; font-size: 0.62rem; white-space: nowrap;">⚠ Carrito Mixto</span>' : ''}
                        </td>
                        <td style="padding: 0.5rem 0.75rem; text-align: right; font-weight: 600; white-space: nowrap;">${totalQty}</td>
                        <td style="padding: 0.5rem 0.75rem; text-align: right; color: var(--success); font-weight: 600; white-space: nowrap;">${revText}</td>
                        <td style="padding: 0.5rem 0.75rem; text-align: right; white-space: nowrap;">${this.formatCurrency(cost)}</td>
                        <td style="padding: 0.5rem 0.75rem; text-align: right; white-space: nowrap;">
                            <div>${this.formatCurrency(ship)}</div>
                            ${isCol ? '<div style="font-size: 0.68rem; color: var(--text-muted); font-weight: 500;">COP $' + Math.round(copShip).toLocaleString('es-CO') + '</div>' : ''}
                        </td>
                    </tr>`;
            } else if (o.__source === 'Excel') {
                const delUnits = parseInt(o.delivered_units !== undefined && o.delivered_units !== null ? o.delivered_units : (o.delivered || 0));
                const retUnits = parseInt(o.returned_units !== undefined && o.returned_units !== null ? o.returned_units : (o.returned || 0));
                const qty = delUnits + retUnits;
                orderCount += qty;
                const rev = parseFloat(o.revenue || 0);
                const cost = parseFloat(o.product_cost || 0);
                const ship = parseFloat(o.shipping_cost || 0) + parseFloat(o.return_shipping_cost || 0);

                totalRev += rev;
                totalCost += cost;
                totalShip += ship;

                html += `
                    <tr>
                        <td style="padding: 0.5rem 0.75rem; font-size: 0.78rem; color: var(--text-muted); white-space: nowrap;">${o.date || 'N/A'}</td>
                        <td style="padding: 0.5rem 0.75rem; white-space: nowrap;">
                            <span class="badge" style="background: rgba(168, 85, 247, 0.1); color: #a855f7; font-size: 0.65rem;">Excel</span>
                        </td>
                        <td style="padding: 0.5rem 0.75rem;"><div style="white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 120px;" title="${o.country || ''}">${o.country || 'N/A'}</div></td>
                        <td style="padding: 0.5rem 0.75rem; white-space: nowrap;">
                            <span class="badge bg-success" style="font-size: 0.65rem;">Entreg: ${o.delivered || 0}</span>
                            ${o.returned > 0 ? `<br><span class="badge bg-danger mt-1" style="font-size: 0.65rem;">Dev: ${o.returned}</span>` : ''}
                        </td>
                        <td style="padding: 0.5rem 0.75rem;"><div style="white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 220px;" title="${o.product_name || o.description || ''}">${o.product_name || o.description || 'N/A'}</div></td>
                        <td style="padding: 0.5rem 0.75rem; text-align: right; font-weight: 600; white-space: nowrap;">${qty}</td>
                        <td style="padding: 0.5rem 0.75rem; text-align: right; color: var(--success); font-weight: 600; white-space: nowrap;">${this.formatCurrency(rev)}</td>
                        <td style="padding: 0.5rem 0.75rem; text-align: right; white-space: nowrap;">${this.formatCurrency(cost)}</td>
                        <td style="padding: 0.5rem 0.75rem; text-align: right; white-space: nowrap;">${this.formatCurrency(ship)}</td>
                    </tr>`;
            }
        });
        
        tbody.innerHTML = html;
        
        if (statsEl) {
            statsEl.innerHTML = `
                <div style="display: flex; gap: 1rem; flex-wrap: wrap;">
                    <div style="background: var(--surface-hover); padding: 0.5rem 1rem; border-radius: var(--radius-sm);">
                        <div style="font-size: 0.75rem; color: var(--text-muted);">Ventas Totales</div>
                        <div style="font-weight: 600; color: var(--success);">${this.formatCurrency(totalRev)}</div>
                    </div>
                    <div style="background: var(--surface-hover); padding: 0.5rem 1rem; border-radius: var(--radius-sm);">
                        <div style="font-size: 0.75rem; color: var(--text-muted);">Pedidos</div>
                        <div style="font-weight: 600;">${orderCount}</div>
                    </div>
                </div>
            `;
        }
        
        modal.classList.add('active');
    },

    closeProductOrdersDetailModal() {
        const modal = document.getElementById('modalProductOrdersDetail');
        if (modal) modal.classList.remove('active');
    },

    showProductOrdersDetail(name, isVisualGroup, groupId) {
        const modal = document.getElementById('modalProductOrdersDetail');
        if (!modal) return;
        
        let targetProductNames = [name];
        if (isVisualGroup && groupId !== null) {
            const group = this.visualMergedGroups[groupId];
            if (group) targetProductNames = group.products;
        }

        const titleEl = document.getElementById('productOrdersDetailTitle');
        if (titleEl) {
            titleEl.innerHTML = `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <circle cx="11" cy="11" r="8"></circle>
                <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
            </svg> Detalle de Pedidos — ${name}`;
        }
        
        // Find matching orders
        const matchingOrders = [];
        let totalQty = 0, totalRev = 0, totalCost = 0, totalShip = 0;
        
        // 1. From Dropi API Guides
        const filteredGuides = this.guides || [];
        filteredGuides.forEach(g => {
            if (this.isCancelado(g) || g.status === 'CANCELLED' || g.status === 'ANULADO') return;
            const gCountry = g.country || this.getCountryFromCity(g.cities);
            if (!this.matchesCountryFilter(gCountry)) return;
            const gDate = g.created_at ? g.created_at.split('T')[0] : (g.date || '');
            if (this.filters.dateFrom && gDate < this.filters.dateFrom) return;
            if (this.filters.dateTo && gDate > this.filters.dateTo) return;
            
            const isExcluded = this.isExcludedFromSales(g);
            const isDevol = this.isDevolucion(g);
            const items = g.guide_items || g.products || g.items || [];
            let includedItems = [];
            items.forEach(item => {
                const prod = item.products || item;
                const rawName = prod.name || item.name || 'Producto Desconocido';
                const mappedName = this.productMappings[rawName] || rawName;
                if (targetProductNames.includes(mappedName)) {
                    includedItems.push(item);
                }
            });
            
            if (includedItems.length > 0) {
                const shippingUSD = this.getGuideShippingCostUSD(g);
                const shippingPerItem = items.length > 0 ? (shippingUSD / items.length) : 0;
                const totalGuideRev = isExcluded ? 0 : this.getGuideRevenueUSD(g);
                const totalItemsCost = items.reduce((s, it) => {
                    const prod = it.products || it;
                    const unitCost = window.ProductsModule ? window.ProductsModule.getRealCost(prod) : parseFloat(prod.cost || 0) * 40000;
                    return s + (unitCost * (it.quantity || 1));
                }, 0);
                
                includedItems.forEach(item => {
                    const prod = item.products || item;
                    const rawName = prod.name || item.name || 'Producto Desconocido';
                    const qty = parseInt(item.quantity || 1);
                    const unitCost = window.ProductsModule ? window.ProductsModule.getRealCost(prod) : parseFloat(prod.cost || 0) * 40000;
                    const realCost = isExcluded ? 0 : (unitCost * qty);
                    const revProp = isExcluded ? 0 : (totalItemsCost > 0 ? (realCost / totalItemsCost) * totalGuideRev : (totalGuideRev / items.length));
                    
                    if (!isExcluded) {
                        totalQty += qty;
                        totalRev += revProp;
                        totalCost += realCost;
                    }
                    totalShip += shippingPerItem;
                    
                    matchingOrders.push({
                        date: gDate,
                        origin: isDevol ? 'Dropi (Devolución)' : 'Guía Dropi',
                        location: `${g.country || ''} - ${this.getCountryFromCity(g.cities) || g.cities || ''}`,
                        status: g.guide_statuses?.name || g.status || '',
                        originalName: rawName,
                        qty: isExcluded ? 0 : qty,
                        revenue: revProp,
                        cost: realCost,
                        shipping: shippingPerItem
                    });
                });
            }
        });
        
        // 2. From External Sales
        const extSales = this.getFilteredExternalSales();
        extSales.forEach(s => {
            const rawName = s.product_name || s.description || 'Venta Manual';
            const mappedName = this.productMappings[rawName] || rawName;
            
            if (targetProductNames.includes(mappedName)) {
                const qty = parseInt(s.delivered || 0) + parseInt(s.returned || 0);
                const rev = parseFloat(s.revenue || 0);
                const cost = parseFloat(s.product_cost || 0);
                const ship = parseFloat(s.shipping_cost || 0) + parseFloat(s.return_shipping_cost || 0);
                
                totalQty += qty;
                totalRev += rev;
                totalCost += cost;
                totalShip += ship;
                
                matchingOrders.push({
                    date: s.date || '',
                    origin: s.country ? `Excel (${s.country})` : 'Otras Plataformas',
                    location: s.country || 'N/A',
                    status: s.status || 'Completado',
                    originalName: rawName,
                    qty: qty,
                    revenue: rev,
                    cost: cost,
                    shipping: ship
                });
            }
        });
        
        // Update Summary
        const summaryEl = document.getElementById('productOrdersDetailSummary');
        if (summaryEl) {
            summaryEl.innerHTML = `
                <div class="orders-detail-summary-grid" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 1rem;">
                    <div class="orders-summary-item" style="background: rgba(255,255,255,0.05); padding: 1rem; border-radius: var(--radius-md); border: 1px solid var(--border);">
                        <span class="orders-summary-label" style="display: block; font-size: 0.8rem; color: var(--text-muted); margin-bottom: 0.25rem;">Pedidos / Registros</span>
                        <span class="orders-summary-value" style="font-size: 1.2rem; font-weight: 700;">${matchingOrders.length}</span>
                    </div>
                    <div class="orders-summary-item" style="background: rgba(255,255,255,0.05); padding: 1rem; border-radius: var(--radius-md); border: 1px solid var(--border);">
                        <span class="orders-summary-label" style="display: block; font-size: 0.8rem; color: var(--text-muted); margin-bottom: 0.25rem;">Unidades Totales</span>
                        <span class="orders-summary-value" style="font-size: 1.2rem; font-weight: 700;">${totalQty}</span>
                    </div>
                    <div class="orders-summary-item" style="background: rgba(255,255,255,0.05); padding: 1rem; border-radius: var(--radius-md); border: 1px solid var(--border);">
                        <span class="orders-summary-label" style="display: block; font-size: 0.8rem; color: var(--text-muted); margin-bottom: 0.25rem;">Ventas Atribuidas</span>
                        <span class="orders-summary-value" style="font-size: 1.2rem; font-weight: 700; color: var(--success);">${this.formatCurrency(totalRev)}</span>
                    </div>
                    <div class="orders-summary-item" style="background: rgba(255,255,255,0.05); padding: 1rem; border-radius: var(--radius-md); border: 1px solid var(--border);">
                        <span class="orders-summary-label" style="display: block; font-size: 0.8rem; color: var(--text-muted); margin-bottom: 0.25rem;">Costo + Envíos</span>
                        <span class="orders-summary-value" style="font-size: 1.2rem; font-weight: 700; color: var(--danger);">${this.formatCurrency(totalCost + totalShip)}</span>
                    </div>
                </div>
            `;
        }
        
        // Update Table
        const tbody = document.getElementById('productOrdersDetailTable');
        if (tbody) {
            if (matchingOrders.length === 0) {
                tbody.innerHTML = `<tr><td colspan="9" style="text-align: center; color: var(--text-muted); padding: 2rem;">No se encontraron pedidos.</td></tr>`;
            } else {
                // Sort by date descending
                matchingOrders.sort((a, b) => b.date.localeCompare(a.date));
                
                tbody.innerHTML = matchingOrders.map(o => `
                    <tr>
                        <td>${o.date}</td>
                        <td>
                            <span style="font-size: 0.75rem; padding: 2px 6px; background: ${o.origin.includes('Excel') ? 'rgba(14, 165, 233, 0.1)' : 'rgba(16, 185, 129, 0.1)'}; color: ${o.origin.includes('Excel') ? '#0ea5e9' : '#10b981'}; border-radius: 12px; font-weight: 600;">
                                ${o.origin}
                            </span>
                        </td>
                        <td><div style="white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 150px;" title="${o.location}">${o.location}</div></td>
                        <td>${o.status}</td>
                        <td><div style="white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 200px;" title="${o.originalName}">${o.originalName}</div></td>
                        <td style="text-align: right; font-weight: 600;">${o.qty}</td>
                        <td style="text-align: right; color: var(--success);">${this.formatCurrency(o.revenue)}</td>
                        <td style="text-align: right; color: var(--danger);">${this.formatCurrency(o.cost)}</td>
                        <td style="text-align: right; color: var(--danger);">${this.formatCurrency(o.shipping)}</td>
                    </tr>
                `).join('');
            }
        }
        
        modal.classList.add('active');
    }
};

// Make module available globally
window.IncomeStatementModule = IncomeStatementModule;
