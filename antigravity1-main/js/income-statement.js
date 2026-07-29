// ========================================
// Income Statement Module (Estado de Resultados)
// ========================================

const IncomeStatementModule = {
    // Data stores
    guides: [],
    guideItems: [],
    adExpenses: [],
    operationalExpenses: [],
    operationalExpenses: [],
    externalSales: [],
    freights: [],
    products: [],

    // Current filters
    filters: {
        country: '',
        dateFrom: null,
        dateTo: null
    },

    // FB Import state
    fbImportData: null,
    fbImportBatchId: null,

    initialized: false,

    async init() {
        if (this.initialized) return;
        this.initialized = true;
        this.bindEvents();
        this.setDefaultFilters();
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
    },

    applyFilters() {
        this.filters.country = document.getElementById('isCountryFilter')?.value || '';
        this.filters.dateFrom = document.getElementById('isDateFrom')?.value || null;
        this.filters.dateTo = document.getElementById('isDateTo')?.value || null;
        this.render();
    },

    async render() {
        try {
            await this.loadAllData();
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
            // Load guides with items
            const { data: guides, error: guidesError } = await supabaseClient
                .from('guides')
                .select(`
                    *,
                    cities!guides_city_id_fkey(name, country),
                    guide_statuses!guides_status_id_fkey(name),
                    guide_items(*, products!guide_items_product_id_fkey(name, cost, price, sku))
                `)
                .in('status_id', await this.getDeliveredStatusIds());

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
            if (opError) throw opError;
            this.operationalExpenses = opExpenses || [];

            // Load external sales (Supabase + LocalStorage Hybrid with Deduplication)
            let supabaseExtSales = [];
            try {
                const { data: extSales, error: extError } = await supabaseClient
                    .from('external_sales')
                    .select('*')
                    .order('sale_date', { ascending: false });

                if (!extError && extSales) {
                    supabaseExtSales = extSales;
                }
            } catch (e) {
                console.warn('Alerta al cargar external_sales de Supabase:', e);
            }

            const localExtSales = this.loadExternalSalesFromLocal();
            const combinedExtSales = [...supabaseExtSales, ...localExtSales];

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

        } catch (error) {
            console.error('Error loading data:', error);
        }
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
        const city = cityData.name || '';
        if (['Quito', 'Guayaquil'].includes(city)) return 'Ecuador';
        if (city === 'Caracas') return 'Venezuela';
        return cityData.country || 'Desconocido';
    },

    filterByDateAndCountry(items, dateField = 'created_at', getCountry = null) {
        return items.filter(item => {
            let dateVal = item[dateField];
            if (!dateVal) return false;
            const itemDate = new Date(dateVal).toISOString().split('T')[0];

            if (this.filters.dateFrom && itemDate < this.filters.dateFrom) return false;
            if (this.filters.dateTo && itemDate > this.filters.dateTo) return false;

            if (this.filters.country && getCountry) {
                const country = getCountry(item);
                if (country !== this.filters.country) return false;
            }

            return true;
        });
    },

    // ========================================
    // SALES DATA
    // ========================================
    getFilteredSales() {
        return this.filterByDateAndCountry(
            this.guides,
            'created_at',
            (guide) => this.getCountryFromCity(guide.cities)
        );
    },

    getSalesByCountry() {
        const sales = this.getFilteredSales();
        const byCountry = {};

        sales.forEach(guide => {
            const country = this.getCountryFromCity(guide.cities);
            if (!byCountry[country]) {
                byCountry[country] = {
                    country,
                    totalRevenue: 0,
                    totalCost: 0,
                    totalShipping: 0,
                    orderCount: 0,
                    unitsSold: 0
                };
            }

            byCountry[country].totalRevenue += parseFloat(guide.total_amount || 0);
            byCountry[country].totalShipping += parseFloat(guide.shipping_cost || 0);
            byCountry[country].orderCount++;

            if (guide.guide_items) {
                guide.guide_items.forEach(item => {
                    const qty = parseInt(item.quantity || 0);
                    const rawCost = parseFloat(item.products?.cost || 0);
                    const cost = window.ProductsModule ? window.ProductsModule.getRealCost(item.products || {}) : rawCost * 40000;
                    byCountry[country].totalCost += qty * cost;
                    byCountry[country].unitsSold += qty;
                });
            }
        });

        return Object.values(byCountry);
    },

    // ========================================
    // FREIGHT COSTS DATA
    // ========================================
    getFreightDestinationCountry(route) {
        if (!route) return null;
        const r = route.toLowerCase();
        const parts = route.split('->');
        if (parts.length === 2) {
            const dest = parts[1].trim();
            if (dest === 'Colombia') return 'Colombia';
            if (dest === 'Ecuador') return 'Ecuador';
            if (dest === 'Venezuela') return 'Venezuela';
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

            if (this.filters.country) {
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
        return this.filterByDateAndCountry(
            this.operationalExpenses,
            'expense_date',
            (expense) => expense.country
        );
    },

    getOpExpensesByCountry() {
        const expenses = this.getFilteredOperationalExpenses();
        const byCountry = {};

        expenses.forEach(exp => {
            const country = exp.country;
            if (!byCountry[country]) {
                byCountry[country] = { country, total: 0, byCategory: {} };
            }
            byCountry[country].total += parseFloat(exp.amount || 0);
            const cat = exp.category || 'Otro';
            byCountry[country].byCategory[cat] = (byCountry[country].byCategory[cat] || 0) + parseFloat(exp.amount || 0);
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

        if (salesData.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="10" style="text-align: center; color: var(--text-muted); padding: 2rem;">
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
            totalRevenue: 0, totalCost: 0, totalShipping: 0, totalFreight: 0, orderCount: 0, unitsSold: 0
        };

        tbody.innerHTML = salesData.map(row => {
            const countryFreight = freightsByCountry[row.country]?.totalFreight || 0;
            totalRow.totalRevenue += row.totalRevenue;
            totalRow.totalCost += row.totalCost;
            totalRow.totalShipping += row.totalShipping;
            totalRow.totalFreight += countryFreight;
            totalRow.orderCount += row.orderCount;
            totalRow.unitsSold += row.unitsSold;

            const grossProfit = row.totalRevenue - row.totalCost - row.totalShipping - countryFreight;
            const margin = row.totalRevenue > 0 ? ((grossProfit / row.totalRevenue) * 100).toFixed(1) : '0.0';

            // Porcentajes sobre las ventas
            const costPct = row.totalRevenue > 0 ? ((row.totalCost / row.totalRevenue) * 100).toFixed(1) : '0.0';
            const shippingPct = row.totalRevenue > 0 ? ((row.totalShipping / row.totalRevenue) * 100).toFixed(1) : '0.0';

            return `
                <tr>
                    <td>
                        <div style="display: flex; align-items: center; gap: 0.5rem;">
                            <span class="country-flag">${this.getCountryFlag(row.country)}</span>
                            <strong>${row.country}</strong>
                        </div>
                    </td>
                    <td style="text-align: right; font-weight: 600;">${row.orderCount}</td>
                    <td style="text-align: right;">${row.unitsSold}</td>
                    <td style="text-align: right; font-weight: 600; color: var(--success);">${this.formatCurrency(row.totalRevenue)}</td>
                    <td style="text-align: right; color: var(--danger);">
                        <div>${this.formatCurrency(row.totalCost)}</div>
                        <div style="font-size: 0.72rem; opacity: 0.8; font-weight: 500;">${costPct}%</div>
                    </td>
                    <td style="text-align: right; color: var(--danger);">
                        <div>${this.formatCurrency(row.totalShipping)}</div>
                        <div style="font-size: 0.72rem; opacity: 0.8; font-weight: 500;">${shippingPct}%</div>
                    </td>
                    <td style="text-align: right; color: var(--warning);">${this.formatCurrency(countryFreight)}</td>
                    <td style="text-align: right; font-weight: 600; color: ${grossProfit >= 0 ? 'var(--success)' : 'var(--danger)'};">
                        ${this.formatCurrency(grossProfit)}
                    </td>
                    <td style="text-align: center;">
                        <span class="is-margin-badge ${parseFloat(margin) >= 30 ? 'good' : parseFloat(margin) >= 15 ? 'warning' : 'bad'}">${margin}%</span>
                    </td>
                    <td style="text-align: center;">
                        <button class="btn btn-icon btn-sm is-detail-btn" onclick="IncomeStatementModule.showOrdersDetail('${row.country}')" title="Ver detalle de pedidos de ${row.country}">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                <circle cx="11" cy="11" r="8"></circle>
                                <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                            </svg>
                        </button>
                    </td>
                </tr>`;
        }).join('');

        // Total row
        const totalGross = totalRow.totalRevenue - totalRow.totalCost - totalRow.totalShipping - totalRow.totalFreight;
        const totalMargin = totalRow.totalRevenue > 0 ? ((totalGross / totalRow.totalRevenue) * 100).toFixed(1) : '0.0';
        const totalCostPct = totalRow.totalRevenue > 0 ? ((totalRow.totalCost / totalRow.totalRevenue) * 100).toFixed(1) : '0.0';
        const totalShippingPct = totalRow.totalRevenue > 0 ? ((totalRow.totalShipping / totalRow.totalRevenue) * 100).toFixed(1) : '0.0';

        tbody.innerHTML += `
            <tr class="is-total-row">
                <td><strong>TOTAL</strong></td>
                <td style="text-align: right; font-weight: 700;">${totalRow.orderCount}</td>
                <td style="text-align: right; font-weight: 700;">${totalRow.unitsSold}</td>
                <td style="text-align: right; font-weight: 700; color: var(--success);">${this.formatCurrency(totalRow.totalRevenue)}</td>
                <td style="text-align: right; font-weight: 700; color: var(--danger);">
                    <div>${this.formatCurrency(totalRow.totalCost)}</div>
                    <div style="font-size: 0.72rem; opacity: 0.9;">${totalCostPct}%</div>
                </td>
                <td style="text-align: right; font-weight: 700; color: var(--danger);">
                    <div>${this.formatCurrency(totalRow.totalShipping)}</div>
                    <div style="font-size: 0.72rem; opacity: 0.9;">${totalShippingPct}%</div>
                </td>
                <td style="text-align: right; font-weight: 700; color: var(--warning);">${this.formatCurrency(totalRow.totalFreight)}</td>
                <td style="text-align: right; font-weight: 700; color: ${totalGross >= 0 ? 'var(--success)' : 'var(--danger)'};">${this.formatCurrency(totalGross)}</td>
                <td style="text-align: center;"><span class="is-margin-badge ${parseFloat(totalMargin) >= 30 ? 'good' : parseFloat(totalMargin) >= 15 ? 'warning' : 'bad'}">${totalMargin}%</span></td>
                <td></td>
            </tr>`;
    },

    renderConsolidatedSalesTable() {
        const tbody = document.getElementById('isConsolidatedSalesTable');
        if (!tbody) return;

        const salesByCountry = this.getSalesByCountry();
        const freightsByCountry = this.getFreightsByCountry();
        const adExpensesByCountry = this.getAdExpensesByCountry();
        const externalSales = this.getFilteredExternalSales();

        // Build mapping for external sales per country
        const extByCountry = {};
        externalSales.forEach(s => {
            const c = s.country || 'Global';
            if (!extByCountry[c]) {
                extByCountry[c] = { revenue: 0, cost: 0, shipping: 0, delivered: 0 };
            }
            extByCountry[c].revenue += parseFloat(s.revenue || 0);
            extByCountry[c].cost += parseFloat(s.product_cost || 0);
            extByCountry[c].shipping += parseFloat(s.shipping_cost || 0);
            extByCountry[c].delivered += (parseInt(s.delivered || 0) + parseInt(s.returned || 0));
        });

        // Ad spend map
        const adMap = {};
        adExpensesByCountry.forEach(item => {
            adMap[item.country] = item.totalSpent || 0;
        });

        // Unique set of countries
        const countriesSet = new Set([
            ...salesByCountry.map(s => s.country),
            ...Object.keys(extByCountry).filter(c => c !== 'Todos' && c !== 'Global')
        ]);

        const consolidatedList = Array.from(countriesSet).map(country => {
            const guideData = salesByCountry.find(s => s.country === country) || {
                orderCount: 0, unitsSold: 0, totalRevenue: 0, totalCost: 0, totalShipping: 0
            };
            const extData = extByCountry[country] || { revenue: 0, cost: 0, shipping: 0, delivered: 0 };
            const freight = freightsByCountry[country]?.totalFreight || 0;
            const adSpend = adMap[country] || 0;

            const totalOrders = guideData.orderCount + extData.delivered;
            const totalUnits = guideData.unitsSold;
            const totalRevenue = guideData.totalRevenue + extData.revenue;
            const totalCost = guideData.totalCost + extData.cost;
            const totalShipping = guideData.totalShipping + extData.shipping;
            const grossProfit = totalRevenue - totalCost - totalShipping - freight - adSpend;
            const margin = totalRevenue > 0 ? ((grossProfit / totalRevenue) * 100).toFixed(1) : '0.0';

            const costPct = totalRevenue > 0 ? ((totalCost / totalRevenue) * 100).toFixed(1) : '0.0';
            const shippingPct = totalRevenue > 0 ? ((totalShipping / totalRevenue) * 100).toFixed(1) : '0.0';
            const adPct = totalRevenue > 0 ? ((adSpend / totalRevenue) * 100).toFixed(1) : '0.0';

            return {
                country,
                orderCount: totalOrders,
                unitsSold: totalUnits,
                totalRevenue,
                totalCost,
                totalShipping,
                freight,
                adSpend,
                grossProfit,
                margin,
                costPct,
                shippingPct,
                adPct
            };
        });

        if (consolidatedList.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="10" style="text-align: center; color: var(--text-muted); padding: 2rem;">
                        No hay ventas consolidadas en este período.
                    </td>
                </tr>`;
            return;
        }

        const totalRow = {
            orderCount: 0, unitsSold: 0, totalRevenue: 0, totalCost: 0, totalShipping: 0, totalFreight: 0, totalAdSpend: 0
        };

        tbody.innerHTML = consolidatedList.map(row => {
            totalRow.orderCount += row.orderCount;
            totalRow.unitsSold += row.unitsSold;
            totalRow.totalRevenue += row.totalRevenue;
            totalRow.totalCost += row.totalCost;
            totalRow.totalShipping += row.totalShipping;
            totalRow.totalFreight += row.freight;
            totalRow.totalAdSpend += row.adSpend;

            return `
                <tr>
                    <td>
                        <div style="display: flex; align-items: center; gap: 0.5rem;">
                            <span class="country-flag">${this.getCountryFlag(row.country)}</span>
                            <strong>${row.country}</strong>
                        </div>
                    </td>
                    <td style="text-align: right; font-weight: 600;">${row.orderCount}</td>
                    <td style="text-align: right;">${row.unitsSold || '-'}</td>
                    <td style="text-align: right; font-weight: 600; color: var(--success);">${this.formatCurrency(row.totalRevenue)}</td>
                    <td style="text-align: right; color: var(--danger);">
                        <div>${this.formatCurrency(row.totalCost)}</div>
                        <div style="font-size: 0.72rem; opacity: 0.8; font-weight: 500;">${row.costPct}%</div>
                    </td>
                    <td style="text-align: right; color: var(--danger);">
                        <div>${this.formatCurrency(row.totalShipping)}</div>
                        <div style="font-size: 0.72rem; opacity: 0.8; font-weight: 500;">${row.shippingPct}%</div>
                    </td>
                    <td style="text-align: right; color: var(--warning);">${this.formatCurrency(row.freight)}</td>
                    <td style="text-align: right; color: #ec4899; font-weight: 500;">
                        <div>${this.formatCurrency(row.adSpend)}</div>
                        <div style="font-size: 0.72rem; opacity: 0.85; font-weight: 500;">${row.adPct}%</div>
                    </td>
                    <td style="text-align: right; font-weight: 600; color: ${row.grossProfit >= 0 ? 'var(--success)' : 'var(--danger)'};">
                        ${this.formatCurrency(row.grossProfit)}
                    </td>
                    <td style="text-align: center;">
                        <span class="is-margin-badge ${parseFloat(row.margin) >= 30 ? 'good' : parseFloat(row.margin) >= 15 ? 'warning' : 'bad'}">${row.margin}%</span>
                    </td>
                </tr>`;
        }).join('');

        // Total row
        const totalGross = totalRow.totalRevenue - totalRow.totalCost - totalRow.totalShipping - totalRow.totalFreight - totalRow.totalAdSpend;
        const totalMargin = totalRow.totalRevenue > 0 ? ((totalGross / totalRow.totalRevenue) * 100).toFixed(1) : '0.0';
        const totalCostPct = totalRow.totalRevenue > 0 ? ((totalRow.totalCost / totalRow.totalRevenue) * 100).toFixed(1) : '0.0';
        const totalShippingPct = totalRow.totalRevenue > 0 ? ((totalRow.totalShipping / totalRow.totalRevenue) * 100).toFixed(1) : '0.0';
        const totalAdPct = totalRow.totalRevenue > 0 ? ((totalRow.totalAdSpend / totalRow.totalRevenue) * 100).toFixed(1) : '0.0';

        tbody.innerHTML += `
            <tr class="is-total-row">
                <td><strong>TOTAL CONSOLIDADO</strong></td>
                <td style="text-align: right; font-weight: 700;">${totalRow.orderCount}</td>
                <td style="text-align: right; font-weight: 700;">${totalRow.unitsSold}</td>
                <td style="text-align: right; font-weight: 700; color: var(--success);">${this.formatCurrency(totalRow.totalRevenue)}</td>
                <td style="text-align: right; font-weight: 700; color: var(--danger);">
                    <div>${this.formatCurrency(totalRow.totalCost)}</div>
                    <div style="font-size: 0.72rem; opacity: 0.9;">${totalCostPct}%</div>
                </td>
                <td style="text-align: right; font-weight: 700; color: var(--danger);">
                    <div>${this.formatCurrency(totalRow.totalShipping)}</div>
                    <div style="font-size: 0.72rem; opacity: 0.9;">${totalShippingPct}%</div>
                </td>
                <td style="text-align: right; font-weight: 700; color: var(--warning);">${this.formatCurrency(totalRow.totalFreight)}</td>
                <td style="text-align: right; font-weight: 700; color: #ec4899;">
                    <div>${this.formatCurrency(totalRow.totalAdSpend)}</div>
                    <div style="font-size: 0.72rem; opacity: 0.9;">${totalAdPct}%</div>
                </td>
                <td style="text-align: right; font-weight: 700; color: ${totalGross >= 0 ? 'var(--success)' : 'var(--danger)'};">${this.formatCurrency(totalGross)}</td>
                <td style="text-align: center;"><span class="is-margin-badge ${parseFloat(totalMargin) >= 30 ? 'good' : parseFloat(totalMargin) >= 15 ? 'warning' : 'bad'}">${totalMargin}%</span></td>
            </tr>`;
    },

    renderAdExpensesTable() {
        const tbody = document.getElementById('isAdExpensesTable');
        if (!tbody) return;

        // Comenzar con TODOS los gastos para que los filtros locales puedan sobrescribir los globales
        let expenses = this.adExpenses;

        // Obtain specific filters for ads and global filters as fallbacks
        const adCountry = document.getElementById('adFilterCountry')?.value || '';
        const adDateFrom = document.getElementById('adFilterDateFrom')?.value || '';
        const adDateTo = document.getElementById('adFilterDateTo')?.value || '';
        const adSearch = (document.getElementById('adFilterSearch')?.value || '').toLowerCase().trim();

        // 1. Filtrar por Pais (Local override de Global)
        const filterCountry = adCountry || this.filters.country;
        if (filterCountry) {
            expenses = expenses.filter(e => e.country === filterCountry);
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
                    <td colspan="12" style="text-align: center; color: var(--text-muted); padding: 2rem;">
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
        return this.filterByDateAndCountry(
            this.externalSales,
            'sale_date',
            (sale) => sale.country === 'Todos' ? null : sale.country
        );
    },

    getExternalSalesSummary() {
        const sales = this.getFilteredExternalSales();
        let totalRevenue = 0, totalCost = 0, totalShipping = 0;
        sales.forEach(s => {
            totalRevenue += parseFloat(s.revenue || 0);
            totalCost += parseFloat(s.product_cost || 0);
            totalShipping += parseFloat(s.shipping_cost || 0);
        });
        return { totalRevenue, totalCost, totalShipping };
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

        // Delete from Supabase in background
        try {
            await supabaseClient.from('external_sales').delete().in('id', checked);
        } catch (err) {
            console.warn('Alerta al eliminar en Supabase:', err);
        }

        Utils.showToast(`Se eliminaron ${checked.length} registros`, 'success');

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
        const count = this.externalSales.length;
        if (count === 0) return;

        if (!confirm(`⚠️ ¿Estás seguro de ELIMINAR TODOS los ${count} registros de ventas externas? Esta acción no se puede deshacer.`)) return;

        Utils.showToast('Vaclando todos los registros...', 'info');

        const idsToDelete = this.externalSales.map(s => String(s.id));

        // 1. Clear memory & localStorage immediately
        this.externalSales = [];
        this.saveExternalSalesToLocal();
        this.isExternalSalesExpanded = false;

        // 2. Clear Supabase in background
        try {
            await supabaseClient.from('external_sales').delete().in('id', idsToDelete);
        } catch (err) {
            console.warn('Alerta al vaciar en Supabase:', err);
        }

        Utils.showToast(`Se eliminaron todos los registros (${count})`, 'success');

        this.renderSummaryCards();
        this.renderSalesTable();
        this.renderConsolidatedSalesTable();
        this.renderAdExpensesTable();
        this.renderOperationalExpensesTable();
        this.renderExternalSalesTable();
        this.renderProductProfitTable();
        this.renderPLStatement();
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
            delivered: 0,
            returned: 0
        };

        for (const src of recordsToMerge) {
            merged.revenue += (parseFloat(src.revenue) || 0);
            merged.product_cost += (parseFloat(src.product_cost) || 0);
            merged.shipping_cost += (parseFloat(src.shipping_cost) || 0);
            merged.delivered += (parseInt(src.delivered) || 0);
            merged.returned += (parseInt(src.returned) || 0);
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

    renderExternalSalesTable() {
        const tbody = document.getElementById('isExternalSalesTable');
        const expandContainer = document.getElementById('extSalesExpandContainer');
        const btnDeleteAll = document.getElementById('btnDeleteAllExtSales');
        const btnDeleteSelected = document.getElementById('btnDeleteSelectedExtSales');

        if (!tbody) return;

        const sales = this.getFilteredExternalSales();

        if (btnDeleteAll) {
            btnDeleteAll.style.display = sales.length > 0 ? 'inline-flex' : 'none';
        }
        if (btnDeleteSelected) {
            btnDeleteSelected.style.display = 'none';
        }
        const selectAllCb = document.getElementById('selectAllExtSales');
        if (selectAllCb) selectAllCb.checked = false;

        if (sales.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="11" style="text-align: center; color: var(--text-muted); padding: 2rem;">
                        No hay ventas manuales o importadas registradas en este período.
                    </td>
                </tr>`;
            if (expandContainer) expandContainer.innerHTML = '';
            return;
        }

        const limit = 5;
        const visibleSales = this.isExternalSalesExpanded ? sales : sales.slice(0, limit);

        tbody.innerHTML = visibleSales.map(sale => {
            const delivered = sale.delivered || 0;
            const returned = sale.returned || 0;
            const totalOrders = delivered + returned;
            const returnRate = totalOrders > 0 ? ((returned / totalOrders) * 100).toFixed(1) : '0.0';

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
                    <td style="text-align: right;">${delivered}</td>
                    <td style="text-align: right;">${returned}</td>
                    <td style="text-align: center;">${returnRate}%</td>
                    <td style="font-size: 0.85rem;">${this.formatDate(sale.sale_date)}</td>
                    <td style="white-space: nowrap;">
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

        if (expandContainer) {
            if (sales.length > limit) {
                expandContainer.innerHTML = `
                    <span style="font-size: 0.82rem; color: var(--text-muted);">
                        Mostrando ${visibleSales.length} de ${sales.length} registros cargados
                    </span>
                    <button type="button" class="btn btn-secondary btn-sm" onclick="IncomeStatementModule.toggleExpandExternalSales()" style="background: rgba(255,255,255,0.06); border: 1px solid var(--border); font-size: 0.82rem;">
                        ${this.isExternalSalesExpanded ? '🔼 Plegar Lista (Ver menos)' : '🔽 Desglosar Todos (' + sales.length + ' registros)'}
                    </button>`;
            } else {
                expandContainer.innerHTML = `<span style="font-size: 0.82rem; color: var(--text-muted);">${sales.length} registros en total</span>`;
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
        document.getElementById('extSaleDelivered').value = sale.delivered || 0;
        document.getElementById('extSaleReturned').value = sale.returned || 0;

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
            delivered: parseInt(document.getElementById('extSaleDelivered').value) || 0,
            returned: parseInt(document.getElementById('extSaleReturned').value) || 0
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
        await this.render();
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

            let statusIdx = 2, productIdx = 12, stockIdx = 13, contentIdx = 15;
            let recaudoIdx = 25, costoIdx = 26, safeFleteEntregaIdx = 27, safeFleteDevIdx = 28;
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
                productIdx = findColExact(['producto', 'nombre producto', 'articulo'], 12);
                stockIdx = findColExact(['id del stock', 'stock id', 'sku', 'id stock'], 13);
                contentIdx = findColExact(['contenido del producto', 'contenido', 'detalle'], 15);
                recaudoIdx = findColExact(['recaudo', 'valor recaudo', 'monto recaudo'], 25);
                costoIdx = findColExact(['costo del producto', 'costo producto', 'costo prod', 'costo'], 26);
                const fleteEntregaIdx = headers.findIndex(h => h.includes('flete') && !h.includes('devoluc'));
                const fleteDevIdx = headers.findIndex(h => h.includes('devoluc') || h.includes('flete por dev'));
                if (fleteEntregaIdx !== -1) safeFleteEntregaIdx = fleteEntregaIdx;
                if (fleteDevIdx !== -1) safeFleteDevIdx = fleteDevIdx;
            }

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

                const recaudo = this.parseExcelNumber(row[recaudoIdx]);
                const costoProd = this.parseExcelNumber(row[costoIdx]);
                const fleteEntrega = this.parseExcelNumber(row[safeFleteEntregaIdx]);
                const fleteDevolucion = this.parseExcelNumber(row[safeFleteDevIdx]);

                const statusLower = status.toLowerCase();
                const isReturned = statusLower.includes('devuelt') || statusLower.includes('cancel');

                if (isReturned) totalReturnedGuides++;
                else totalDeliveredGuides++;

                let groupKey = '';
                if (stockId) groupKey = stockId.toLowerCase();
                else if (rawProduct) groupKey = rawProduct.toLowerCase();
                else if (content) groupKey = content.toLowerCase();
                else groupKey = 'sin_referencia';

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
                finalProductName = finalProductName.replace(/^\d+\s+/, '').trim();
                if (!finalProductName) finalProductName = stockId || 'Producto Externo';

                if (!productGroupMap[groupKey]) {
                    productGroupMap[groupKey] = {
                        country: 'Ecuador',
                        sale_date: new Date().toISOString().split('T')[0],
                        description: finalProductName,
                        stock_id: stockId,
                        revenue: 0,
                        product_cost: 0,
                        shipping_cost: 0,
                        delivered: 0,
                        returned: 0
                    };
                }

                const grp = productGroupMap[groupKey];
                if (isReturned) {
                    grp.returned += 1;
                    grp.shipping_cost += (fleteDevolucion > 0 ? fleteDevolucion : fleteEntrega);
                } else {
                    grp.delivered += 1;
                    grp.revenue += recaudo;
                    grp.product_cost += costoProd;
                    grp.shipping_cost += fleteEntrega;
                }
            }

            this.updateImportProgress(92, 'Finalizando agrupación...');
            await new Promise(r => setTimeout(r, 50));

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

        let totalRev = 0, totalCost = 0, totalShip = 0, deliveredCount = 0, returnedCount = 0;
        records.forEach(r => {
            totalRev += (r.revenue || 0);
            totalCost += (r.product_cost || 0);
            totalShip += (r.shipping_cost || 0);
            deliveredCount += (r.delivered || 0);
            returnedCount += (r.returned || 0);
        });
        const totalScanned = records.totalScannedGuides || (deliveredCount + returnedCount);

        const cardsEl = document.getElementById('importPreviewSummaryCards');
        if (cardsEl) {
            cardsEl.innerHTML = `
                <div style="background: rgba(16, 185, 129, 0.1); border: 1px solid rgba(16, 185, 129, 0.3); padding: 0.85rem; border-radius: var(--radius-md); text-align: center;">
                    <div style="font-size: 0.75rem; color: var(--text-muted);">Pedidos Procesados</div>
                    <div style="font-size: 1.4rem; font-weight: 700; color: #34d399;">${totalScanned}</div>
                    <div style="font-size: 0.72rem; color: var(--text-muted); margin-top: 0.25rem;">${records.length} referencias agrupadas</div>
                </div>
                <div style="background: rgba(59, 130, 246, 0.1); border: 1px solid rgba(59, 130, 246, 0.3); padding: 0.85rem; border-radius: var(--radius-md); text-align: center;">
                    <div style="font-size: 0.75rem; color: var(--text-muted);">Total Recaudo (Col. Z)</div>
                    <div style="font-size: 1.4rem; font-weight: 700; color: #60a5fa;">$${totalRev.toFixed(2)}</div>
                    <div style="font-size: 0.72rem; color: var(--text-muted); margin-top: 0.25rem;">${deliveredCount} entregados / ${returnedCount} devueltos</div>
                </div>
                <div style="background: rgba(239, 68, 68, 0.1); border: 1px solid rgba(239, 68, 68, 0.3); padding: 0.85rem; border-radius: var(--radius-md); text-align: center;">
                    <div style="font-size: 0.75rem; color: var(--text-muted);">Costos & Fletes</div>
                    <div style="font-size: 1.4rem; font-weight: 700; color: #f87171;">$${(totalCost + totalShip).toFixed(2)}</div>
                    <div style="font-size: 0.72rem; color: var(--text-muted); margin-top: 0.25rem;">Prod: $${totalCost.toFixed(2)} | Fletes: $${totalShip.toFixed(2)}</div>
                </div>`;
        }

        this.renderImportPreviewTable(records);

        const confirmBtn = document.getElementById('btnConfirmImportExcel');
        if (confirmBtn) confirmBtn.innerText = `Confirmar e Importar ${records.length} Referencias`;

        // Reset select all checkbox
        const selectAll = document.getElementById('importSelectAll');
        if (selectAll) selectAll.checked = false;
        this.updateManualGroupCount();

        modal.style.display = 'flex';
        modal.style.opacity = '1';
        modal.style.visibility = 'visible';
        modal.style.zIndex = '999999';
        modal.classList.add('active');
    },

    renderImportPreviewTable(records) {
        const tableBody = document.getElementById('importPreviewTableBody');
        if (!tableBody) return;
        tableBody.innerHTML = records.map((r, idx) => `
            <tr data-import-idx="${idx}" style="cursor: pointer;" onclick="IncomeStatementModule.toggleImportRowCheck(${idx}, event)">
                <td style="text-align: center;" onclick="event.stopPropagation();">
                    <input type="checkbox" class="import-row-check" data-idx="${idx}" onchange="IncomeStatementModule.updateManualGroupCount()" style="cursor: pointer;">
                </td>
                <td style="font-weight: 600; color: var(--text);">
                    ${r.description}
                    ${r.stock_id ? `<div style="font-size:0.7rem; color:var(--text-muted);">Ref: ${r.stock_id}</div>` : ''}
                </td>
                <td style="text-align: center; color: var(--success); font-weight: 600;">${r.delivered}</td>
                <td style="text-align: center; color: var(--danger);">${r.returned}</td>
                <td style="text-align: right; color: var(--success); font-weight: 600;">$${(r.revenue || 0).toFixed(2)}</td>
                <td style="text-align: right; color: var(--danger);">$${(r.product_cost || 0).toFixed(2)}</td>
                <td style="text-align: right; color: var(--primary);">$${(r.shipping_cost || 0).toFixed(2)}</td>
            </tr>`).join('');
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
        document.querySelectorAll('.import-row-check').forEach(cb => cb.checked = checked);
        this.updateManualGroupCount();
    },

    updateManualGroupCount() {
        const checked = document.querySelectorAll('.import-row-check:checked').length;
        const countEl = document.getElementById('manualGroupCount');
        const btn = document.getElementById('btnManualGroup');
        if (countEl) countEl.textContent = checked;
        if (btn) btn.disabled = (checked < 2);
    },

    manualGroupSelected() {
        const records = this.pendingImportRecords;
        if (!records || records.length === 0) return;

        const checkedBoxes = document.querySelectorAll('.import-row-check:checked');
        if (checkedBoxes.length < 2) {
            Utils.showToast('Selecciona al menos 2 productos para agrupar.', 'warning');
            return;
        }

        // Get the selected indices (sorted descending for safe splicing)
        const selectedIdxs = Array.from(checkedBoxes).map(cb => parseInt(cb.dataset.idx)).sort((a, b) => a - b);

        // The first selected becomes the merged record
        const mergedIdx = selectedIdxs[0];
        const merged = { ...records[mergedIdx] };
        const mergedNames = [merged.description];

        // Sum values from all other selected records into merged
        for (let i = 1; i < selectedIdxs.length; i++) {
            const src = records[selectedIdxs[i]];
            merged.delivered += (src.delivered || 0);
            merged.returned += (src.returned || 0);
            merged.revenue += (src.revenue || 0);
            merged.product_cost += (src.product_cost || 0);
            merged.shipping_cost += (src.shipping_cost || 0);
            if (!mergedNames.includes(src.description)) mergedNames.push(src.description);
        }

        // Ask for group name
        const defaultName = mergedNames.length <= 3 ? mergedNames.join(' + ') : `${mergedNames[0]} (+${mergedNames.length - 1} más)`;
        const groupName = prompt('Nombre del grupo fusionado:', defaultName);
        if (!groupName) return; // user cancelled

        merged.description = groupName.trim() || defaultName;

        // Remove selected records (reverse order to maintain indices)
        for (let i = selectedIdxs.length - 1; i >= 0; i--) {
            records.splice(selectedIdxs[i], 1);
        }

        // Insert merged record at the beginning
        records.unshift(merged);

        // Re-render table and update summary cards
        this.pendingImportRecords = records;
        this.openImportPreviewModal(records, '');
        Utils.showToast(`${selectedIdxs.length} productos agrupados en "${merged.description}"`, 'success');
    },

    closeImportPreviewModal() {
        const modal = document.getElementById('modalImportExcelPreview');
        if (modal) {
            modal.classList.remove('active');
            modal.style.display = 'none';
        }
        this.pendingImportRecords = [];
    },


    generateUUID() {
        if (typeof crypto !== 'undefined' && crypto.randomUUID) {
            try { return crypto.randomUUID(); } catch (e) {}
        }
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
            const r = Math.random() * 16 | 0, v = c === 'x' ? r : (r & 0x3 | 0x8);
            return v.toString(16);
        });
    },


    async confirmImportExternalSales() {
        if (!this.pendingImportRecords || this.pendingImportRecords.length === 0) {
            this.closeImportPreviewModal();
            return;
        }

        const recordsToSave = [...this.pendingImportRecords];
        this.closeImportPreviewModal();

        this.showImportLoadingOverlay('Guardando Registros...', 'Preparando datos para almacenamiento local y en la nube...');
        
        // Let overlay render
        await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));

        this.updateImportProgress(10, 'Generando identificadores únicos...');
        await new Promise(r => setTimeout(r, 50));

        // Create objects with valid UUIDs for memory and local storage
        const preparedRecords = recordsToSave.map(r => ({
            id: this.generateUUID(),
            country: r.country || 'Ecuador',
            sale_date: r.sale_date || new Date().toISOString().split('T')[0],
            description: r.description || 'Producto Externo',
            revenue: parseFloat(r.revenue) || 0,
            product_cost: parseFloat(r.product_cost) || 0,
            shipping_cost: parseFloat(r.shipping_cost) || 0,
            delivered: parseInt(r.delivered) || 0,
            returned: parseInt(r.returned) || 0
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
                delivered: r.delivered,
                returned: r.returned
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
            Utils.showToast(`Se guardaron ${preparedRecords.length} registros en almacenamiento local. Error de sincronización.`, 'success');
        }


    renderProductProfitTable() {
        const tbody = document.getElementById('isProductProfitTable');
        if (!tbody) return;

        const productMap = {};

        // 1. Process Guides (Orders)
        const filteredGuides = this.guides || [];
        filteredGuides.forEach(g => {
            if (g.status === 'CANCELLED' || g.status === 'ANULADO') return;
            if (this.filters.country && g.country !== this.filters.country) return;
            const gDate = g.created_at ? g.created_at.split('T')[0] : (g.date || '');
            if (this.filters.dateFrom && gDate < this.filters.dateFrom) return;
            if (this.filters.dateTo && gDate > this.filters.dateTo) return;

            const items = g.products || g.items || [];
            const shippingPerItem = items.length > 0 ? (parseFloat(g.shipping_cost || 0) / items.length) : 0;
            const totalRev = parseFloat(g.total_amount || g.revenue || 0);
            const totalItemsCost = items.reduce((s, item) => s + (ProductsModule.getRealCost(item) * (item.quantity || 1)), 0);

            items.forEach(item => {
                const name = item.name || 'Producto Desconocido';
                const qty = parseInt(item.quantity || 1);
                const realCost = ProductsModule.getRealCost(item) * qty;
                const revProp = totalItemsCost > 0 ? (realCost / totalItemsCost) * totalRev : (totalRev / items.length);

                if (!productMap[name]) {
                    productMap[name] = {
                        name, orders: 0, units: 0, revenue: 0, cost: 0, shipping: 0, freight: 0, adSpend: 0
                    };
                }
                productMap[name].orders += 1;
                productMap[name].units += qty;
                productMap[name].revenue += revProp;
                productMap[name].cost += realCost;
                productMap[name].shipping += shippingPerItem;
            });
        });

        // 2. Process External Sales (Otras Plataformas)
        const extSales = this.getFilteredExternalSales();
        extSales.forEach(s => {
            const name = s.product_name || s.description || 'Venta Manual';
            if (!productMap[name]) {
                productMap[name] = {
                    name, orders: 0, units: 0, revenue: 0, cost: 0, shipping: 0, freight: 0, adSpend: 0
                };
            }
            productMap[name].orders += (parseInt(s.delivered || 0) + parseInt(s.returned || 0));
            productMap[name].revenue += parseFloat(s.revenue || 0);
            productMap[name].cost += parseFloat(s.product_cost || 0);
            productMap[name].shipping += parseFloat(s.shipping_cost || 0);
        });

        // 3. Process Ad Expenses per Product
        const adExpenses = this.getFilteredAdExpenses();
        adExpenses.forEach(exp => {
            const name = exp.product_name;
            if (name && productMap[name]) {
                productMap[name].adSpend += parseFloat(exp.amount_spent || 0);
            } else if (name) {
                productMap[name] = {
                    name, orders: 0, units: 0, revenue: 0, cost: 0, shipping: 0, freight: 0, adSpend: parseFloat(exp.amount_spent || 0)
                };
            }
        });

        const productList = Object.values(productMap);

        if (productList.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="9" style="text-align: center; color: var(--text-muted); padding: 2rem;">
                        No hay datos de productos en el período seleccionado.
                    </td>
                </tr>`;
            return;
        }

        const totalRow = {
            orders: 0, units: 0, revenue: 0, cost: 0, shipping: 0, adSpend: 0
        };

        tbody.innerHTML = productList.map(p => {
            const grossProfit = p.revenue - p.cost - p.shipping - p.freight - p.adSpend;
            const margin = p.revenue > 0 ? ((grossProfit / p.revenue) * 100).toFixed(1) : '0.0';
            const costPct = p.revenue > 0 ? ((p.cost / p.revenue) * 100).toFixed(1) : '0.0';
            const shippingPct = p.revenue > 0 ? ((p.shipping / p.revenue) * 100).toFixed(1) : '0.0';
            const adPct = p.revenue > 0 ? ((p.adSpend / p.revenue) * 100).toFixed(1) : '0.0';

            totalRow.orders += p.orders;
            totalRow.units += p.units;
            totalRow.revenue += p.revenue;
            totalRow.cost += p.cost;
            totalRow.shipping += p.shipping;
            totalRow.adSpend += p.adSpend;

            return `
                <tr>
                    <td><strong>${p.name}</strong></td>
                    <td style="text-align: right; font-weight: 600;">${p.orders}</td>
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
                <td><strong>TOTAL PRODUCTOS</strong></td>
                <td style="text-align: right; font-weight: 700;">${totalRow.orders}</td>
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
            </tr>`;
    },

    renderPLStatement() {
        const container = document.getElementById('isPLStatement');
        if (!container) return;

        const salesData = this.getSalesByCountry();
        const adExpData = this.getAdExpensesByCountry();
        const opExpData = this.getOpExpensesByCountry();
        const extSalesSummary = this.getExternalSalesSummary();

        const totalRevenue = salesData.reduce((s, c) => s + c.totalRevenue, 0) + extSalesSummary.totalRevenue;
        const totalCOGS = salesData.reduce((s, c) => s + c.totalCost, 0) + extSalesSummary.totalCost;
        const totalShipping = salesData.reduce((s, c) => s + c.totalShipping, 0) + extSalesSummary.totalShipping;
        const grossProfit = totalRevenue - totalCOGS - totalShipping;
        const totalAdSpend = adExpData.reduce((s, c) => s + c.totalSpent, 0);
        const totalOpExp = opExpData.reduce((s, c) => s + c.total, 0);
        const totalExpenses = totalAdSpend + totalOpExp;
        const netProfit = grossProfit - totalExpenses;
        const grossMargin = totalRevenue > 0 ? ((grossProfit / totalRevenue) * 100).toFixed(1) : '0.0';
        const netMargin = totalRevenue > 0 ? ((netProfit / totalRevenue) * 100).toFixed(1) : '0.0';

        // Build categories breakdown
        let opCategoriesHTML = '';
        const allCategories = {};
        this.getFilteredOperationalExpenses().forEach(exp => {
            const cat = exp.category || 'Otro';
            allCategories[cat] = (allCategories[cat] || 0) + parseFloat(exp.amount || 0);
        });

        for (const [cat, amount] of Object.entries(allCategories).sort((a, b) => b[1] - a[1])) {
            opCategoriesHTML += `
                <div class="is-pl-detail-row">
                    <span style="padding-left: 2rem; color: var(--text-muted);">${cat}</span>
                    <span style="color: var(--danger);">${this.formatCurrency(amount)}</span>
                </div>`;
        }

        container.innerHTML = `
            <div class="is-pl-section">
                <div class="is-pl-row is-pl-header-row">
                    <span>INGRESOS</span>
                    <span></span>
                </div>
                <div class="is-pl-row">
                    <span style="padding-left: 1rem;">Ventas Netas</span>
                    <span style="color: var(--success); font-weight: 600;">${this.formatCurrency(totalRevenue)}</span>
                </div>
                <div class="is-pl-row is-pl-subtotal">
                    <span>Total Ingresos</span>
                    <span style="font-weight: 700; color: var(--success);">${this.formatCurrency(totalRevenue)}</span>
                </div>
            </div>

            <div class="is-pl-section">
                <div class="is-pl-row is-pl-header-row">
                    <span>COSTO DE VENTAS</span>
                    <span></span>
                </div>
                <div class="is-pl-row">
                    <span style="padding-left: 1rem;">Costo de Mercancía Vendida</span>
                    <span style="color: var(--danger);">${this.formatCurrency(totalCOGS)}</span>
                </div>
                <div class="is-pl-row">
                    <span style="padding-left: 1rem;">Costo de Fletes (Envíos)</span>
                    <span style="color: var(--danger);">${this.formatCurrency(totalShipping)}</span>
                </div>
                <div class="is-pl-row is-pl-subtotal highlight-green">
                    <span>UTILIDAD BRUTA</span>
                    <span style="font-weight: 700; color: ${grossProfit >= 0 ? 'var(--success)' : 'var(--danger)'};">
                        ${this.formatCurrency(grossProfit)}
                        <small style="font-weight: 400; font-size: 0.75rem;"> (${grossMargin}%)</small>
                    </span>
                </div>
            </div>

            <div class="is-pl-section">
                <div class="is-pl-row is-pl-header-row">
                    <span>GASTOS OPERATIVOS</span>
                    <span></span>
                </div>
                <div class="is-pl-row">
                    <span style="padding-left: 1rem;">📢 Inversión Publicitaria (Ads)</span>
                    <span style="color: var(--danger); font-weight: 500;">${this.formatCurrency(totalAdSpend)}</span>
                </div>
                ${opCategoriesHTML}
                <div class="is-pl-row is-pl-subtotal">
                    <span>Total Gastos Operativos</span>
                    <span style="font-weight: 700; color: var(--danger);">${this.formatCurrency(totalExpenses)}</span>
                </div>
            </div>

            <div class="is-pl-section">
                <div class="is-pl-row is-pl-total ${netProfit >= 0 ? 'profit' : 'loss'}">
                    <span>UTILIDAD NETA</span>
                    <span>
                        ${this.formatCurrency(netProfit)}
                        <small style="font-weight: 400; font-size: 0.8rem;"> (${netMargin}%)</small>
                    </span>
                </div>
            </div>

            <div class="is-pl-kpis">
                <div class="is-kpi-card">
                    <div class="is-kpi-value">${salesData.reduce((s, c) => s + c.orderCount, 0)}</div>
                    <div class="is-kpi-label">Pedidos</div>
                </div>
                <div class="is-kpi-card">
                    <div class="is-kpi-value">${totalRevenue > 0 && salesData.reduce((s, c) => s + c.orderCount, 0) > 0 ? this.formatCurrency(totalRevenue / salesData.reduce((s, c) => s + c.orderCount, 0)) : '$0'}</div>
                    <div class="is-kpi-label">Ticket Promedio</div>
                </div>
                <div class="is-kpi-card">
                    <div class="is-kpi-value">${adExpData.reduce((s, c) => s + c.totalPurchases, 0)}</div>
                    <div class="is-kpi-label">Compras vía Ads</div>
                </div>
                <div class="is-kpi-card">
                    <div class="is-kpi-value">${totalAdSpend > 0 ? (totalRevenue / totalAdSpend).toFixed(2) + 'x' : 'N/A'}</div>
                    <div class="is-kpi-label">ROAS</div>
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
                dateStart = new Date().toISOString().split('T')[0];
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
                if (this.filters.country && row.country !== this.filters.country) return false;
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
        document.getElementById('opExpenseCountry').value = exp.country || 'Ecuador';
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
        const data = {
            country: document.getElementById('opExpenseCountry').value,
            category: document.getElementById('opExpenseCategory').value,
            description: document.getElementById('opExpenseDescription').value,
            amount: parseFloat(document.getElementById('opExpenseAmount').value) || 0,
            expense_date: document.getElementById('opExpenseDate').value,
            payment_method: document.getElementById('opExpensePayMethod').value || 'Efectivo',
            notes: document.getElementById('opExpenseNotes')?.value || ''
        };

        try {
            if (id) {
                const { error } = await supabaseClient
                    .from('operational_expenses')
                    .update(data)
                    .eq('id', id);
                if (error) throw error;
            } else {
                const { error } = await supabaseClient
                    .from('operational_expenses')
                    .insert(data);
                if (error) throw error;
            }

            Utils.showToast('Gasto operativo guardado', 'success');
            document.getElementById('modalOperationalExpense').classList.remove('active');
            this.render();
        } catch (error) {
            console.error('Error saving operational expense:', error);
            Utils.showToast('Error al guardar: ' + error.message, 'error');
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
        let from, to;

        switch (period) {
            case 'today':
                from = to = now.toISOString().split('T')[0];
                break;
            case 'week':
                const dayOfWeek = now.getDay();
                from = new Date(now);
                from.setDate(now.getDate() - dayOfWeek);
                to = new Date(now);
                from = from.toISOString().split('T')[0];
                to = to.toISOString().split('T')[0];
                break;
            case 'month':
                from = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
                to = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];
                break;
            case 'quarter':
                const quarter = Math.floor(now.getMonth() / 3);
                from = new Date(now.getFullYear(), quarter * 3, 1).toISOString().split('T')[0];
                to = new Date(now.getFullYear(), quarter * 3 + 3, 0).toISOString().split('T')[0];
                break;
            case 'semester':
                const semester = Math.floor(now.getMonth() / 6);
                from = new Date(now.getFullYear(), semester * 6, 1).toISOString().split('T')[0];
                to = new Date(now.getFullYear(), semester * 6 + 6, 0).toISOString().split('T')[0];
                break;
            case 'year':
                from = new Date(now.getFullYear(), 0, 1).toISOString().split('T')[0];
                to = new Date(now.getFullYear(), 11, 31).toISOString().split('T')[0];
                break;
            case 'all':
                from = '2020-01-01';
                to = now.toISOString().split('T')[0];
                break;
        }

        document.getElementById('isDateFrom').value = from;
        document.getElementById('isDateTo').value = to;
        document.querySelectorAll('.month-tag').forEach(el => el.classList.remove('active'));
        this.applyFilters();
    },

    setMonthFilter(monthIndex, btn) {
        const now = new Date();
        const year = now.getFullYear();
        const from = new Date(year, monthIndex, 1).toISOString().split('T')[0];
        const to = new Date(year, monthIndex + 1, 0).toISOString().split('T')[0];

        document.getElementById('isDateFrom').value = from;
        document.getElementById('isDateTo').value = to;

        document.querySelectorAll('.month-tag').forEach(el => el.classList.remove('active'));
        if (btn) btn.classList.add('active');

        this.applyFilters();
    },

    // ========================================
    // EXPORT
    // ========================================
    exportToCSV() {
        const salesData = this.getSalesByCountry();
        const adExpData = this.getAdExpensesByCountry();
        const opExpData = this.getOpExpensesByCountry();
        const extSalesSummary = this.getExternalSalesSummary();

        const totalRevenue = salesData.reduce((s, c) => s + c.totalRevenue, 0) + extSalesSummary.totalRevenue;
        const totalCOGS = salesData.reduce((s, c) => s + c.totalCost, 0) + extSalesSummary.totalCost;
        const totalShipping = salesData.reduce((s, c) => s + c.totalShipping, 0) + extSalesSummary.totalShipping;
        const grossProfit = totalRevenue - totalCOGS - totalShipping;
        const totalAdSpend = adExpData.reduce((s, c) => s + c.totalSpent, 0);
        const totalOpExp = opExpData.reduce((s, c) => s + c.total, 0);
        const netProfit = grossProfit - totalAdSpend - totalOpExp;

        let csv = 'Estado de Resultados\n';
        csv += `Período,${this.filters.dateFrom || 'Inicio'},${this.filters.dateTo || 'Fin'}\n`;
        csv += `País,${this.filters.country || 'Todos'}\n\n`;
        csv += 'Concepto,Monto\n';
        csv += `Ventas Netas,${totalRevenue.toFixed(2)}\n`;
        csv += `Costo de Mercancía,${totalCOGS.toFixed(2)}\n`;
        csv += `Costo de Fletes,${totalShipping.toFixed(2)}\n`;
        csv += `Utilidad Bruta,${grossProfit.toFixed(2)}\n`;
        csv += `Gastos Publicitarios,${totalAdSpend.toFixed(2)}\n`;
        csv += `Gastos Operativos,${totalOpExp.toFixed(2)}\n`;
        csv += `Utilidad Neta,${netProfit.toFixed(2)}\n`;

        // Download
        const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `estado_resultados_${this.filters.dateFrom || 'all'}.csv`;
        link.click();

        Utils.showToast('Estado de resultados exportado', 'success');
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
        const flags = {
            'Ecuador': '🇪🇨',
            'Venezuela': '🇻🇪',
            'Colombia': '🇨🇴'
        };
        return flags[country] || '🏳️';
    },

    // ========================================
    // ORDERS DETAIL MODAL
    // ========================================
    showOrdersDetail(country) {
        const sales = this.getFilteredSales().filter(guide => {
            return this.getCountryFromCity(guide.cities) === country;
        });

        const modal = document.getElementById('modalOrdersDetail');
        if (!modal) return;

        const titleEl = document.getElementById('ordersDetailTitle');
        if (titleEl) {
            titleEl.innerHTML = `${this.getCountryFlag(country)} Detalle de Pedidos — ${country}`;
        }

        const summaryEl = document.getElementById('ordersDetailSummary');
        const tableBody = document.getElementById('ordersDetailTable');
        if (!tableBody) return;

        // Calculate summary
        let totalRevenue = 0, totalCost = 0, totalShipping = 0, totalUnits = 0;
        sales.forEach(g => {
            totalRevenue += parseFloat(g.total_amount || 0);
            totalShipping += parseFloat(g.shipping_cost || 0);
            if (g.guide_items) {
                g.guide_items.forEach(item => {
                    const qty = parseInt(item.quantity || 0);
                    const rawCost = parseFloat(item.products?.cost || 0);
                    const cost = window.ProductsModule ? window.ProductsModule.getRealCost(item.products || {}) : rawCost * 40000;
                    totalCost += qty * cost;
                    totalUnits += qty;
                });
            }
        });

        // Freight cost for this country
        const freightsByCountry = this.getFreightsByCountry();
        const countryFreight = freightsByCountry[country]?.totalFreight || 0;
        const grossProfit = totalRevenue - totalCost - totalShipping - countryFreight;

        if (summaryEl) {
            summaryEl.innerHTML = `
                <div class="orders-detail-summary-grid">
                    <div class="orders-summary-item">
                        <span class="orders-summary-label">Pedidos</span>
                        <span class="orders-summary-value">${sales.length}</span>
                    </div>
                    <div class="orders-summary-item">
                        <span class="orders-summary-label">Unidades</span>
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
                        <span class="orders-summary-label">Envíos</span>
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
            tableBody.innerHTML = `
                <tr>
                    <td colspan="9" style="text-align: center; color: var(--text-muted); padding: 2rem;">
                        No hay pedidos para ${country} en el período seleccionado.
                    </td>
                </tr>`;
        } else {
            tableBody.innerHTML = sales.map((guide, idx) => {
                const city = guide.cities?.name || '-';
                const status = guide.guide_statuses?.name || '-';
                const revenue = parseFloat(guide.total_amount || 0);
                const shipping = parseFloat(guide.shipping_cost || 0);
                let cost = 0, units = 0;
                const products = [];
                if (guide.guide_items) {
                    guide.guide_items.forEach(item => {
                        const qty = parseInt(item.quantity || 0);
                        const rawCost = parseFloat(item.products?.cost || 0);
                        const unitCost = window.ProductsModule ? window.ProductsModule.getRealCost(item.products || {}) : rawCost * 40000;
                        cost += qty * unitCost;
                        units += qty;
                        products.push(`${item.products?.name || 'Producto'} x${qty}`);
                    });
                }
                const profit = revenue - cost - shipping;
                const dateStr = guide.created_at ? this.formatDate(guide.created_at.split('T')[0]) : '-';
                const statusClass = status === 'Pagado' ? 'color: var(--success);' : 'color: var(--primary);';

                return `
                    <tr>
                        <td style="font-weight: 600; color: var(--text-muted); font-size: 0.8rem;">${idx + 1}</td>
                        <td>
                            <div style="font-weight: 600; font-size: 0.85rem;">${guide.customer_name || guide.guide_number || '-'}</div>
                            <div style="font-size: 0.75rem; color: var(--text-muted);">${city}</div>
                        </td>
                        <td style="font-size: 0.8rem; max-width: 180px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${products.join(', ')}">${products.join(', ') || '-'}</td>
                        <td style="text-align: center;">${units}</td>
                        <td style="text-align: right; font-weight: 600; color: var(--success);">${this.formatCurrency(revenue)}</td>
                        <td style="text-align: right; color: var(--danger);">${this.formatCurrency(cost)}</td>
                        <td style="text-align: right; color: var(--danger);">${this.formatCurrency(shipping)}</td>
                        <td style="text-align: right; font-weight: 600; color: ${profit >= 0 ? 'var(--success)' : 'var(--danger)'};">${this.formatCurrency(profit)}</td>
                        <td style="font-size: 0.8rem;">
                            <div>${dateStr}</div>
                            <div style="${statusClass} font-size: 0.75rem; font-weight: 500;">${status}</div>
                        </td>
                    </tr>`;
            }).join('');
        }

        modal.classList.add('active');
    },

    closeOrdersDetailModal() {
        const modal = document.getElementById('modalOrdersDetail');
        if (modal) modal.classList.remove('active');
    }
};

// Make module available globally
window.IncomeStatementModule = IncomeStatementModule;
