// ========================================
// Income Statement Module (Estado de Resultados)
// ========================================

const IncomeStatementModule = {
    // Data stores
    guides: [],
    guideItems: [],
    adExpenses: [],
    operationalExpenses: [],
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
            this.renderAdExpensesTable();
            this.renderOperationalExpensesTable();
            this.renderPLStatement();
        } catch (error) {
            console.error('Error rendering income statement:', error);
        }
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
            this.operationalExpenses = opExpenses || [];

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
                    const cost = parseFloat(item.products?.cost || 0);
                    byCountry[country].totalCost += qty * cost;
                    byCountry[country].unitsSold += qty;
                });
            }
        });

        return Object.values(byCountry);
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
        const grossProfit = totalRevenue - totalCOGS;
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

        if (salesData.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="7" style="text-align: center; color: var(--text-muted); padding: 2rem;">
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
            totalRevenue: 0, totalCost: 0, totalShipping: 0, orderCount: 0, unitsSold: 0
        };

        tbody.innerHTML = salesData.map(row => {
            totalRow.totalRevenue += row.totalRevenue;
            totalRow.totalCost += row.totalCost;
            totalRow.totalShipping += row.totalShipping;
            totalRow.orderCount += row.orderCount;
            totalRow.unitsSold += row.unitsSold;
            const grossProfit = row.totalRevenue - row.totalCost;
            const margin = row.totalRevenue > 0 ? ((grossProfit / row.totalRevenue) * 100).toFixed(1) : '0.0';

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
                    <td style="text-align: right; color: var(--danger);">${this.formatCurrency(row.totalCost)}</td>
                    <td style="text-align: right; font-weight: 600; color: ${grossProfit >= 0 ? 'var(--success)' : 'var(--danger)'};">
                        ${this.formatCurrency(grossProfit)}
                    </td>
                    <td style="text-align: center;">
                        <span class="is-margin-badge ${parseFloat(margin) >= 30 ? 'good' : parseFloat(margin) >= 15 ? 'warning' : 'bad'}">${margin}%</span>
                    </td>
                </tr>`;
        }).join('');

        // Total row
        const totalGross = totalRow.totalRevenue - totalRow.totalCost;
        const totalMargin = totalRow.totalRevenue > 0 ? ((totalGross / totalRow.totalRevenue) * 100).toFixed(1) : '0.0';
        tbody.innerHTML += `
            <tr class="is-total-row">
                <td><strong>TOTAL</strong></td>
                <td style="text-align: right; font-weight: 700;">${totalRow.orderCount}</td>
                <td style="text-align: right; font-weight: 700;">${totalRow.unitsSold}</td>
                <td style="text-align: right; font-weight: 700; color: var(--success);">${this.formatCurrency(totalRow.totalRevenue)}</td>
                <td style="text-align: right; font-weight: 700; color: var(--danger);">${this.formatCurrency(totalRow.totalCost)}</td>
                <td style="text-align: right; font-weight: 700; color: ${totalGross >= 0 ? 'var(--success)' : 'var(--danger)'};">${this.formatCurrency(totalGross)}</td>
                <td style="text-align: center;"><span class="is-margin-badge ${parseFloat(totalMargin) >= 30 ? 'good' : parseFloat(totalMargin) >= 15 ? 'warning' : 'bad'}">${totalMargin}%</span></td>
            </tr>`;
    },

    renderAdExpensesTable() {
        const tbody = document.getElementById('isAdExpensesTable');
        if (!tbody) return;

        // Get base filtered expenses (by main income statement filters)
        let expenses = this.getFilteredAdExpenses();

        // Apply ad-specific filters
        const adCountry = document.getElementById('adFilterCountry')?.value || '';
        const adDateFrom = document.getElementById('adFilterDateFrom')?.value || '';
        const adDateTo = document.getElementById('adFilterDateTo')?.value || '';
        const adSearch = (document.getElementById('adFilterSearch')?.value || '').toLowerCase().trim();

        if (adCountry) {
            expenses = expenses.filter(e => e.country === adCountry);
        }
        if (adDateFrom) {
            expenses = expenses.filter(e => e.date_start >= adDateFrom);
        }
        if (adDateTo) {
            expenses = expenses.filter(e => e.date_start <= adDateTo);
        }
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
                    <td colspan="10" style="text-align: center; color: var(--text-muted); padding: 2rem;">
                        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1" style="margin-bottom: 0.5rem; opacity: 0.3;">
                            <circle cx="12" cy="12" r="10"></circle>
                            <path d="M8 12h8"></path>
                        </svg>
                        <br>No hay gastos publicitarios. Importa un reporte de Facebook para comenzar.
                    </td>
                </tr>`;
            return;
        }

        tbody.innerHTML = expenses.map(exp => {
            const costPerPurchase = exp.purchases > 0 ? (exp.amount_spent / exp.purchases) : 0;
            const ctr = exp.impressions > 0 ? ((exp.clicks / exp.impressions) * 100) : 0;
            return `
                <tr>
                    <td>
                        <span class="country-flag">${this.getCountryFlag(exp.country)}</span>
                        ${exp.country}
                    </td>
                    <td style="font-size: 0.8rem; max-width: 200px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${exp.campaign_name || ''}">${exp.campaign_name || '-'}</td>
                    <td style="text-align: right; font-weight: 600; color: var(--danger);">$${parseFloat(exp.amount_spent).toFixed(2)}</td>
                    <td style="text-align: right;">${(exp.impressions || 0).toLocaleString()}</td>
                    <td style="text-align: right;">${exp.clicks || 0}</td>
                    <td style="text-align: center;">${ctr.toFixed(2)}%</td>
                    <td style="text-align: center; font-weight: 600;">${exp.purchases || 0}</td>
                    <td style="text-align: right;">
                        ${exp.purchases > 0 ? `$${costPerPurchase.toFixed(2)}` : '-'}
                    </td>
                    <td style="font-size: 0.8rem; color: var(--text-muted);">${this.formatDate(exp.date_start)}</td>
                    <td>
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
                    <td>
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

    renderPLStatement() {
        const container = document.getElementById('isPLStatement');
        if (!container) return;

        const salesData = this.getSalesByCountry();
        const adExpData = this.getAdExpensesByCountry();
        const opExpData = this.getOpExpensesByCountry();

        const totalRevenue = salesData.reduce((s, c) => s + c.totalRevenue, 0);
        const totalCOGS = salesData.reduce((s, c) => s + c.totalCost, 0);
        const totalShipping = salesData.reduce((s, c) => s + c.totalShipping, 0);
        const grossProfit = totalRevenue - totalCOGS;
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
                    <span style="padding-left: 1rem;">📢 Publicidad (Facebook/Meta)</span>
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
                    statusEl.innerHTML = `<div style="color: var(--danger);">❌ El archivo no contiene datos. Asegúrate de exportar la tabla desde el Administrador de Anuncios de Facebook.</div>`;
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
                            💡 <strong>Sugerencia:</strong> Exporta el archivo directamente desde el Administrador de Anuncios de Facebook 
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

            results.push({
                country: country,
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
                source: 'Facebook',
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

        try {
            // Sanitize data - only send columns that exist in the ad_expenses table
            const sanitizedData = this.fbImportData.map(row => {
                const clean = {
                    country: row.country,
                    campaign_name: row.campaign_name,
                    ad_set_name: row.ad_set_name,
                    ad_name: row.ad_name,
                    amount_spent: row.amount_spent,
                    impressions: row.impressions || 0,
                    clicks: row.clicks || 0,
                    reach: row.reach || 0,
                    purchases: row.purchases || 0,
                    cpc: row.cpc || 0,
                    cpm: row.cpm || 0,
                    ctr: row.ctr || 0,
                    cost_per_purchase: row.cost_per_purchase || 0,
                    date_start: row.date_start,
                    date_end: row.date_end,
                    source: row.source || 'Facebook',
                };
                // Only add optional fields if they have values
                if (row.currency) clean.currency = row.currency;
                return clean;
            });

            // Insert in batches of 50
            const batchSize = 50;
            let insertedCount = 0;
            for (let i = 0; i < sanitizedData.length; i += batchSize) {
                const batch = sanitizedData.slice(i, i + batchSize);
                const { error } = await supabaseClient
                    .from('ad_expenses')
                    .insert(batch);
                if (error) {
                    console.error('Supabase insert error:', error);
                    // If it's a column error, try without optional columns
                    if (error.message && error.message.includes('column')) {
                        // Strip potentially missing columns and retry
                        const safeBatch = batch.map(r => {
                            const { currency, ...rest } = r;
                            return rest;
                        });
                        const { error: retryError } = await supabaseClient
                            .from('ad_expenses')
                            .insert(safeBatch);
                        if (retryError) throw retryError;
                    } else {
                        throw error;
                    }
                }
                insertedCount += batch.length;
            }

            Utils.showNotification(`✅ ${insertedCount} registros de Facebook importados correctamente`, 'success');
            this.cancelFBImport();
            this.render();
        } catch (error) {
            console.error('Error importing FB data:', error);
            Utils.showNotification('Error al importar datos de Facebook: ' + error.message, 'error');
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

            Utils.showNotification('Gasto operativo guardado', 'success');
            document.getElementById('modalOperationalExpense').classList.remove('active');
            this.render();
        } catch (error) {
            console.error('Error saving operational expense:', error);
            Utils.showNotification('Error al guardar: ' + error.message, 'error');
        }
    },

    async deleteAdExpense(id) {
        if (!confirm('¿Eliminar este gasto publicitario?')) return;
        try {
            const { error } = await supabaseClient.from('ad_expenses').delete().eq('id', id);
            if (error) throw error;
            Utils.showNotification('Gasto publicitario eliminado', 'success');
            this.render();
        } catch (error) {
            Utils.showNotification('Error al eliminar: ' + error.message, 'error');
        }
    },

    async deleteOperationalExpense(id) {
        if (!confirm('¿Eliminar este gasto operativo?')) return;
        try {
            const { error } = await supabaseClient.from('operational_expenses').delete().eq('id', id);
            if (error) throw error;
            Utils.showNotification('Gasto operativo eliminado', 'success');
            this.render();
        } catch (error) {
            Utils.showNotification('Error al eliminar: ' + error.message, 'error');
        }
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
        this.applyFilters();
    },

    // ========================================
    // EXPORT
    // ========================================
    exportToCSV() {
        const salesData = this.getSalesByCountry();
        const adExpData = this.getAdExpensesByCountry();
        const opExpData = this.getOpExpensesByCountry();

        const totalRevenue = salesData.reduce((s, c) => s + c.totalRevenue, 0);
        const totalCOGS = salesData.reduce((s, c) => s + c.totalCost, 0);
        const grossProfit = totalRevenue - totalCOGS;
        const totalAdSpend = adExpData.reduce((s, c) => s + c.totalSpent, 0);
        const totalOpExp = opExpData.reduce((s, c) => s + c.total, 0);
        const netProfit = grossProfit - totalAdSpend - totalOpExp;

        let csv = 'Estado de Resultados\n';
        csv += `Período,${this.filters.dateFrom || 'Inicio'},${this.filters.dateTo || 'Fin'}\n`;
        csv += `País,${this.filters.country || 'Todos'}\n\n`;
        csv += 'Concepto,Monto\n';
        csv += `Ventas Netas,${totalRevenue.toFixed(2)}\n`;
        csv += `Costo de Mercancía,${totalCOGS.toFixed(2)}\n`;
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

        Utils.showNotification('Estado de resultados exportado', 'success');
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
    }
};

// Make module available globally
window.IncomeStatementModule = IncomeStatementModule;
