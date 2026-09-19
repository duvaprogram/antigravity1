// ========================================
// Gastos Mensuales (Finanzas Personales)
// ========================================

const ExpensesModule = {
    expenses: [],
    categories: [],
    currentMonth: null,
    initialized: false,
    editingExpenseId: null,
    editingCategoryId: null,

    filters: { categoryId: '', paymentMethod: '', type: '', search: '' },
    sort: { field: 'date', dir: 'desc' },
    charts: { category: null, trend: null, pace: null },

    PAYMENT_METHODS: [
        { value: 'cash', label: '💵 Efectivo' },
        { value: 'debit', label: '💳 Débito' },
        { value: 'credit', label: '💳 Crédito' },
        { value: 'transfer', label: '🏦 Transferencia' },
        { value: 'other', label: '📦 Otro' }
    ],

    // ========================================
    // CICLO DE VIDA
    // ========================================
    init() {
        if (!this.currentMonth) this.currentMonth = this.todayMonth();
        if (!this.initialized) {
            this.bindEvents();
            this.initialized = true;
        }
    },

    bindEvents() {
        const on = (id, evt, fn) => {
            const el = document.getElementById(id);
            if (el) el.addEventListener(evt, fn);
        };

        on('btnExpPrevMonth', 'click', () => this.shiftMonth(-1));
        on('btnExpNextMonth', 'click', () => this.shiftMonth(1));
        on('expMonthPicker', 'change', (e) => {
            if (e.target.value) {
                this.currentMonth = e.target.value;
                this.render();
            }
        });

        on('btnNewExpense', 'click', () => this.openExpenseModal());
        on('btnExpCategories', 'click', () => this.openCategoriesModal());
        on('btnExpExport', 'click', () => this.exportToExcel());

        on('formExpense', 'submit', (e) => this.handleSaveExpense(e));
        on('formExpCategory', 'submit', (e) => this.handleSaveCategory(e));

        on('expFilterCategory', 'change', (e) => {
            this.filters.categoryId = e.target.value;
            this.renderTable();
        });
        on('expFilterPayment', 'change', (e) => {
            this.filters.paymentMethod = e.target.value;
            this.renderTable();
        });
        on('expFilterType', 'change', (e) => {
            this.filters.type = e.target.value;
            this.renderTable();
        });
        on('expSearch', 'input', (e) => {
            this.filters.search = e.target.value;
            this.renderTable();
        });

        const thead = document.getElementById('expTableHead');
        if (thead) {
            thead.addEventListener('click', (e) => {
                const th = e.target.closest('th[data-sort]');
                if (!th) return;
                const field = th.dataset.sort;
                if (this.sort.field === field) {
                    this.sort.dir = this.sort.dir === 'asc' ? 'desc' : 'asc';
                } else {
                    this.sort.field = field;
                    this.sort.dir = field === 'date' || field === 'amount' ? 'desc' : 'asc';
                }
                this.renderTable();
            });
        }
    },

    async render() {
        this.init();
        try {
            await this.loadData();
            this.syncMonthControls();
            this.populateFilterOptions();
            this.renderKPIs();
            this.renderBudgets();
            this.renderTable();
            this.renderCharts();
            this.toggleSetupNotice(Database.expensesTablesMissing);
        } catch (error) {
            console.error('Error rendering expenses module:', error);
            Utils.showToast('Error al cargar los gastos', 'error');
        }
    },

    // Aviso visible cuando aún no se ha ejecutado supabase_expenses_schema.sql
    toggleSetupNotice(show) {
        const notice = document.getElementById('expSetupNotice');
        if (notice) notice.style.display = show ? '' : 'none';
    },

    async loadData() {
        // Se cargan 12 meses hacia atrás para poder graficar tendencia y comparar.
        const from = this.addMonths(this.currentMonth, -11) + '-01';
        const to = this.monthEnd(this.currentMonth);

        const [categories, expenses] = await Promise.all([
            Database.getExpenseCategories(),
            Database.getExpenses(from, to)
        ]);

        this.categories = categories || [];
        this.expenses = expenses || [];
    },

    // ========================================
    // HELPERS DE FECHA
    // ========================================
    todayMonth() {
        const d = new Date();
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    },

    todayISO() {
        const d = new Date();
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    },

    addMonths(ym, delta) {
        const [y, m] = ym.split('-').map(Number);
        const d = new Date(y, m - 1 + delta, 1);
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    },

    monthEnd(ym) {
        const [y, m] = ym.split('-').map(Number);
        return `${ym}-${String(new Date(y, m, 0).getDate()).padStart(2, '0')}`;
    },

    daysInMonth(ym) {
        const [y, m] = ym.split('-').map(Number);
        return new Date(y, m, 0).getDate();
    },

    // new Date('2026-09-01') se interpreta como medianoche UTC y en UTC-5 se
    // renderiza como el día anterior. Por eso una fecha sin hora se arma a mano.
    formatDate(dateStr) {
        if (!dateStr) return '';
        const m = String(dateStr).match(/^(\d{4})-(\d{2})-(\d{2})/);
        if (!m) return Utils.formatDate(dateStr);
        const [, y, mo, d] = m;
        return new Date(Number(y), Number(mo) - 1, Number(d))
            .toLocaleDateString('es-EC', { year: 'numeric', month: 'short', day: 'numeric' });
    },

    monthLabel(ym) {
        const [y, m] = ym.split('-').map(Number);
        const names = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
            'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
        return `${names[m - 1]} ${y}`;
    },

    shiftMonth(delta) {
        this.currentMonth = this.addMonths(this.currentMonth, delta);
        this.render();
    },

    syncMonthControls() {
        const label = document.getElementById('expMonthLabel');
        if (label) label.textContent = this.monthLabel(this.currentMonth);

        const picker = document.getElementById('expMonthPicker');
        if (picker) picker.value = this.currentMonth;

        const badge = document.getElementById('expMonthBadge');
        if (badge) {
            const isCurrent = this.currentMonth === this.todayMonth();
            badge.textContent = isCurrent ? 'Mes en curso' : 'Mes cerrado';
            badge.style.background = isCurrent ? 'rgba(34, 197, 94, 0.15)' : 'rgba(100, 116, 139, 0.15)';
            badge.style.color = isCurrent ? '#22c55e' : '#94a3b8';
        }
    },

    // ========================================
    // DATOS DERIVADOS
    // ========================================
    expensesOfMonth(ym) {
        return this.expenses.filter(e => (e.date || '').startsWith(ym));
    },

    // Se prefiere el registro completo: el objeto del JOIN solo trae
    // name/icon/color y le falta monthly_budget.
    categoryOf(expense) {
        const full = this.categories.find(c => c.id === expense.category_id);
        return full || expense.pf_expense_categories || null;
    },

    paymentLabel(value) {
        const found = this.PAYMENT_METHODS.find(p => p.value === value);
        return found ? found.label : '📦 Otro';
    },

    computeKPIs() {
        const monthExpenses = this.expensesOfMonth(this.currentMonth);
        const prevExpenses = this.expensesOfMonth(this.addMonths(this.currentMonth, -1));

        const total = monthExpenses.reduce((s, e) => s + parseFloat(e.amount || 0), 0);
        const prevTotal = prevExpenses.reduce((s, e) => s + parseFloat(e.amount || 0), 0);

        const fixed = monthExpenses.filter(e => e.is_recurring)
            .reduce((s, e) => s + parseFloat(e.amount || 0), 0);

        const budget = this.categories.reduce((s, c) => s + parseFloat(c.monthly_budget || 0), 0);

        const totalDays = this.daysInMonth(this.currentMonth);
        const isCurrent = this.currentMonth === this.todayMonth();
        // En el mes en curso el promedio se calcula sobre los días transcurridos,
        // de lo contrario la proyección quedaría artificialmente baja.
        const elapsedDays = isCurrent ? new Date().getDate() : totalDays;

        const dailyAvg = elapsedDays > 0 ? total / elapsedDays : 0;
        const projection = isCurrent ? dailyAvg * totalDays : total;

        const variation = prevTotal > 0 ? ((total - prevTotal) / prevTotal) * 100 : null;

        return {
            total, prevTotal, variation, budget, fixed,
            variable: total - fixed,
            count: monthExpenses.length,
            avgTicket: monthExpenses.length ? total / monthExpenses.length : 0,
            dailyAvg, projection, isCurrent, totalDays, elapsedDays,
            budgetUsed: budget > 0 ? (total / budget) * 100 : null,
            remaining: budget - total
        };
    },

    // ========================================
    // KPIs
    // ========================================
    renderKPIs() {
        const k = this.computeKPIs();
        const set = (id, val, color) => {
            const el = document.getElementById(id);
            if (!el) return;
            el.textContent = val;
            if (color) el.style.color = color;
        };

        set('expKpiTotal', Utils.formatCurrency(k.total));
        set('expKpiCount', `${k.count} ${k.count === 1 ? 'movimiento' : 'movimientos'} · Ticket ${Utils.formatCurrency(k.avgTicket)}`);

        // Presupuesto
        if (k.budget > 0) {
            set('expKpiBudget', Utils.formatCurrency(k.budget));
            const pct = k.budgetUsed;
            const over = k.remaining < 0;
            set('expKpiBudgetSub',
                `${pct.toFixed(1)}% usado · ${over ? 'Excedido' : 'Disponible'} ${Utils.formatCurrency(Math.abs(k.remaining))}`,
                over ? 'var(--danger)' : (pct > 85 ? '#f59e0b' : 'var(--success)'));
        } else {
            set('expKpiBudget', '—');
            set('expKpiBudgetSub', 'Define presupuestos en Categorías', 'var(--text-muted)');
        }

        // Promedio diario y proyección
        set('expKpiDaily', Utils.formatCurrency(k.dailyAvg));
        set('expKpiDailySub', k.isCurrent
            ? `Proyección del mes: ${Utils.formatCurrency(k.projection)}`
            : `Sobre ${k.totalDays} días del mes`);

        // Variación
        if (k.variation === null) {
            set('expKpiVariation', '—');
            set('expKpiVariationSub', 'Sin gastos el mes anterior', 'var(--text-muted)');
        } else {
            const up = k.variation > 0;
            set('expKpiVariation', `${up ? '▲' : '▼'} ${Math.abs(k.variation).toFixed(1)}%`,
                up ? 'var(--danger)' : 'var(--success)');
            set('expKpiVariationSub',
                `Mes anterior: ${Utils.formatCurrency(k.prevTotal)}`, 'var(--text-muted)');
        }

        // Fijos vs variables
        const fixedPct = k.total > 0 ? (k.fixed / k.total) * 100 : 0;
        set('expKpiFixed', Utils.formatCurrency(k.fixed));
        set('expKpiFixedSub', `${fixedPct.toFixed(0)}% del total · Variables ${Utils.formatCurrency(k.variable)}`);
    },

    // ========================================
    // PRESUPUESTO POR CATEGORÍA
    // ========================================
    renderBudgets() {
        const container = document.getElementById('expBudgetList');
        if (!container) return;

        const monthExpenses = this.expensesOfMonth(this.currentMonth);
        const spentByCat = {};
        monthExpenses.forEach(e => {
            const id = e.category_id || 'none';
            spentByCat[id] = (spentByCat[id] || 0) + parseFloat(e.amount || 0);
        });

        const rows = this.categories
            .map(c => ({
                cat: c,
                spent: spentByCat[c.id] || 0,
                budget: parseFloat(c.monthly_budget || 0)
            }))
            .filter(r => r.spent > 0 || r.budget > 0)
            .sort((a, b) => b.spent - a.spent);

        if (rows.length === 0) {
            container.innerHTML = `
                <div style="text-align: center; padding: 2.5rem 1rem; color: var(--text-muted);">
                    <div style="font-size: 2rem; margin-bottom: 0.5rem;">📊</div>
                    <p style="margin: 0;">Aún no hay gastos ni presupuestos en ${this.monthLabel(this.currentMonth)}.</p>
                </div>`;
            return;
        }

        container.innerHTML = rows.map(r => {
            const hasBudget = r.budget > 0;
            const pct = hasBudget ? Math.min((r.spent / r.budget) * 100, 100) : 0;
            const rawPct = hasBudget ? (r.spent / r.budget) * 100 : 0;
            const over = hasBudget && r.spent > r.budget;
            const warn = hasBudget && !over && rawPct >= 85;
            const barColor = over ? 'var(--danger)' : (warn ? '#f59e0b' : (r.cat.color || '#6366f1'));

            const statusText = hasBudget
                ? (over
                    ? `Excedido por ${Utils.formatCurrency(r.spent - r.budget)}`
                    : `Quedan ${Utils.formatCurrency(r.budget - r.spent)}`)
                : 'Sin presupuesto definido';

            return `
                <div style="padding: 0.85rem 0; border-bottom: 1px solid var(--border);">
                    <div style="display: flex; justify-content: space-between; align-items: center; gap: 1rem; margin-bottom: 0.5rem; flex-wrap: wrap;">
                        <div style="display: flex; align-items: center; gap: 0.6rem; min-width: 0;">
                            <span style="font-size: 1.1rem;">${r.cat.icon || '📦'}</span>
                            <span style="font-weight: 600; color: var(--text-primary);">${this.escape(r.cat.name)}</span>
                            ${over ? '<span style="font-size: 0.68rem; background: rgba(239,68,68,0.15); color: var(--danger); padding: 2px 6px; border-radius: 4px; font-weight: 700;">EXCEDIDO</span>' : ''}
                        </div>
                        <div style="text-align: right;">
                            <span style="font-weight: 700; color: var(--text-primary);">${Utils.formatCurrency(r.spent)}</span>
                            ${hasBudget ? `<span style="color: var(--text-muted); font-size: 0.85rem;"> / ${Utils.formatCurrency(r.budget)}</span>` : ''}
                        </div>
                    </div>
                    <div style="height: 7px; background: var(--bg-secondary); border-radius: 4px; overflow: hidden;">
                        <div style="height: 100%; width: ${hasBudget ? pct : 0}%; background: ${barColor}; border-radius: 4px; transition: width 0.4s ease;"></div>
                    </div>
                    <div style="display: flex; justify-content: space-between; margin-top: 0.35rem;">
                        <span style="font-size: 0.75rem; color: ${over ? 'var(--danger)' : 'var(--text-muted)'};">${statusText}</span>
                        ${hasBudget ? `<span style="font-size: 0.75rem; color: var(--text-muted);">${rawPct.toFixed(0)}%</span>` : ''}
                    </div>
                </div>`;
        }).join('');
    },

    // ========================================
    // TABLA
    // ========================================
    getFilteredExpenses() {
        let list = this.expensesOfMonth(this.currentMonth);

        if (this.filters.categoryId) {
            list = list.filter(e => e.category_id === this.filters.categoryId);
        }
        if (this.filters.paymentMethod) {
            list = list.filter(e => (e.payment_method || 'cash') === this.filters.paymentMethod);
        }
        if (this.filters.type === 'fixed') {
            list = list.filter(e => e.is_recurring);
        } else if (this.filters.type === 'variable') {
            list = list.filter(e => !e.is_recurring);
        }
        if (this.filters.search.trim()) {
            const q = this.filters.search.trim().toLowerCase();
            list = list.filter(e => {
                const cat = this.categoryOf(e);
                return (e.description || '').toLowerCase().includes(q)
                    || (e.notes || '').toLowerCase().includes(q)
                    || (cat?.name || '').toLowerCase().includes(q);
            });
        }

        const dir = this.sort.dir === 'asc' ? 1 : -1;
        return [...list].sort((a, b) => {
            let va, vb;
            switch (this.sort.field) {
                case 'amount':
                    va = parseFloat(a.amount || 0); vb = parseFloat(b.amount || 0);
                    break;
                case 'category':
                    va = (this.categoryOf(a)?.name || ''); vb = (this.categoryOf(b)?.name || '');
                    return va.localeCompare(vb) * dir;
                case 'description':
                    va = (a.description || ''); vb = (b.description || '');
                    return va.localeCompare(vb) * dir;
                default:
                    va = a.date || ''; vb = b.date || '';
                    if (va === vb) {
                        return String(b.created_at || '').localeCompare(String(a.created_at || '')) * dir;
                    }
                    return va < vb ? -dir : dir;
            }
            return va < vb ? -dir : (va > vb ? dir : 0);
        });
    },

    renderTable() {
        const tbody = document.getElementById('expTableBody');
        if (!tbody) return;

        const list = this.getFilteredExpenses();
        this.updateSortIndicators();

        const footer = document.getElementById('expTableFooter');
        if (footer) {
            const sum = list.reduce((s, e) => s + parseFloat(e.amount || 0), 0);
            footer.textContent = `${list.length} ${list.length === 1 ? 'movimiento' : 'movimientos'} · Total ${Utils.formatCurrency(sum)}`;
        }

        if (list.length === 0) {
            tbody.innerHTML = `
                <tr><td colspan="7" style="text-align: center; padding: 2.5rem 1rem; color: var(--text-muted);">
                    <div style="font-size: 2rem; margin-bottom: 0.5rem;">🧾</div>
                    No hay gastos que coincidan con los filtros en ${this.monthLabel(this.currentMonth)}.
                </td></tr>`;
            return;
        }

        tbody.innerHTML = list.map(e => {
            const cat = this.categoryOf(e);
            const color = cat?.color || '#64748b';
            return `
                <tr>
                    <td style="white-space: nowrap;">${this.formatDate(e.date)}</td>
                    <td>
                        <span style="display: inline-flex; align-items: center; gap: 0.4rem; background: ${color}22; color: ${color}; padding: 3px 9px; border-radius: 6px; font-size: 0.8rem; font-weight: 600; white-space: nowrap;">
                            ${cat?.icon || '📦'} ${this.escape(cat?.name || 'Sin categoría')}
                        </span>
                    </td>
                    <td>
                        <div style="font-weight: 500; color: var(--text-primary);">${this.escape(e.description || '')}</div>
                        ${e.notes ? `<div style="font-size: 0.75rem; color: var(--text-muted); margin-top: 2px;">${this.escape(e.notes)}</div>` : ''}
                    </td>
                    <td style="white-space: nowrap; font-size: 0.85rem;">${this.paymentLabel(e.payment_method)}</td>
                    <td style="text-align: center;">
                        ${e.is_recurring
                            ? '<span style="font-size: 0.7rem; background: rgba(99,102,241,0.15); color: #818cf8; padding: 2px 7px; border-radius: 4px; font-weight: 600;">FIJO</span>'
                            : '<span style="font-size: 0.7rem; color: var(--text-muted);">Variable</span>'}
                    </td>
                    <td style="text-align: right; font-weight: 700; color: var(--text-primary); white-space: nowrap;">
                        ${Utils.formatCurrency(parseFloat(e.amount || 0))}
                    </td>
                    <td style="text-align: right; white-space: nowrap;">
                        <button class="btn btn-icon btn-sm" title="Editar" onclick="ExpensesModule.openExpenseModal('${e.id}')">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                            </svg>
                        </button>
                        <button class="btn btn-icon btn-sm btn-danger-light" title="Eliminar" onclick="ExpensesModule.deleteExpense('${e.id}')">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <polyline points="3 6 5 6 21 6"></polyline>
                                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                            </svg>
                        </button>
                    </td>
                </tr>`;
        }).join('');
    },

    updateSortIndicators() {
        document.querySelectorAll('#expTableHead th[data-sort]').forEach(th => {
            const base = th.dataset.label || th.textContent.replace(/[▲▼]\s*$/, '').trim();
            th.dataset.label = base;
            th.textContent = th.dataset.sort === this.sort.field
                ? `${base} ${this.sort.dir === 'asc' ? '▲' : '▼'}`
                : base;
        });
    },

    populateFilterOptions() {
        const catFilter = document.getElementById('expFilterCategory');
        if (catFilter) {
            const current = this.filters.categoryId;
            catFilter.innerHTML = '<option value="">Todas las categorías</option>' +
                this.categories.map(c => `<option value="${c.id}">${c.icon || '📦'} ${this.escape(c.name)}</option>`).join('');
            catFilter.value = current;
        }

        const payFilter = document.getElementById('expFilterPayment');
        if (payFilter && !payFilter.dataset.filled) {
            payFilter.innerHTML = '<option value="">Todos los métodos</option>' +
                this.PAYMENT_METHODS.map(p => `<option value="${p.value}">${p.label}</option>`).join('');
            payFilter.dataset.filled = '1';
        }
    },

    // ========================================
    // GRÁFICOS
    // ========================================
    renderCharts() {
        if (typeof Chart === 'undefined') return;
        this.renderCategoryChart();
        this.renderTrendChart();
        this.renderPaceChart();
    },

    chartTextColor() {
        return getComputedStyle(document.body).getPropertyValue('--text-muted').trim() || '#94a3b8';
    },

    renderCategoryChart() {
        const canvas = document.getElementById('expCategoryChart');
        if (!canvas) return;

        const monthExpenses = this.expensesOfMonth(this.currentMonth);
        const byCat = {};
        monthExpenses.forEach(e => {
            const cat = this.categoryOf(e);
            const key = cat?.name || 'Sin categoría';
            if (!byCat[key]) byCat[key] = { total: 0, color: cat?.color || '#64748b' };
            byCat[key].total += parseFloat(e.amount || 0);
        });

        const entries = Object.entries(byCat).sort((a, b) => b[1].total - a[1].total);
        if (this.charts.category) this.charts.category.destroy();

        const empty = document.getElementById('expCategoryChartEmpty');
        if (entries.length === 0) {
            canvas.style.display = 'none';
            if (empty) empty.style.display = 'block';
            return;
        }
        canvas.style.display = '';
        if (empty) empty.style.display = 'none';

        const total = entries.reduce((s, [, v]) => s + v.total, 0);

        this.charts.category = new Chart(canvas, {
            type: 'doughnut',
            data: {
                labels: entries.map(([k]) => k),
                datasets: [{
                    data: entries.map(([, v]) => v.total),
                    backgroundColor: entries.map(([, v]) => v.color),
                    borderWidth: 0
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                cutout: '62%',
                plugins: {
                    legend: {
                        position: 'right',
                        labels: { color: this.chartTextColor(), boxWidth: 12, padding: 10, font: { size: 11 } }
                    },
                    tooltip: {
                        callbacks: {
                            label: (ctx) => {
                                const pct = total > 0 ? (ctx.parsed / total) * 100 : 0;
                                return ` ${Utils.formatCurrency(ctx.parsed)} (${pct.toFixed(1)}%)`;
                            }
                        }
                    }
                }
            }
        });
    },

    renderTrendChart() {
        const canvas = document.getElementById('expTrendChart');
        if (!canvas) return;

        const months = [];
        for (let i = 5; i >= 0; i--) months.push(this.addMonths(this.currentMonth, -i));

        const totals = months.map(m =>
            this.expensesOfMonth(m).reduce((s, e) => s + parseFloat(e.amount || 0), 0));
        const budget = this.categories.reduce((s, c) => s + parseFloat(c.monthly_budget || 0), 0);

        if (this.charts.trend) this.charts.trend.destroy();

        const datasets = [{
            label: 'Gasto del mes',
            data: totals,
            backgroundColor: months.map(m => m === this.currentMonth ? '#6366f1' : 'rgba(99, 102, 241, 0.35)'),
            borderRadius: 6,
            borderSkipped: false
        }];

        if (budget > 0) {
            datasets.push({
                label: 'Presupuesto',
                data: months.map(() => budget),
                type: 'line',
                borderColor: '#f59e0b',
                borderDash: [6, 4],
                borderWidth: 2,
                pointRadius: 0,
                fill: false
            });
        }

        this.charts.trend = new Chart(canvas, {
            type: 'bar',
            data: {
                labels: months.map(m => {
                    const [y, mm] = m.split('-');
                    const short = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
                    return `${short[Number(mm) - 1]} ${String(y).slice(2)}`;
                }),
                datasets
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: budget > 0, labels: { color: this.chartTextColor(), boxWidth: 12, font: { size: 11 } } },
                    tooltip: { callbacks: { label: (ctx) => ` ${ctx.dataset.label}: ${Utils.formatCurrency(ctx.parsed.y)}` } }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: { color: this.chartTextColor(), callback: (v) => '$' + v },
                        grid: { color: 'rgba(148, 163, 184, 0.12)' }
                    },
                    x: { ticks: { color: this.chartTextColor() }, grid: { display: false } }
                }
            }
        });
    },

    renderPaceChart() {
        const canvas = document.getElementById('expPaceChart');
        if (!canvas) return;

        const days = this.daysInMonth(this.currentMonth);
        const monthExpenses = this.expensesOfMonth(this.currentMonth);

        const perDay = new Array(days).fill(0);
        monthExpenses.forEach(e => {
            const day = parseInt((e.date || '').split('-')[2], 10);
            if (day >= 1 && day <= days) perDay[day - 1] += parseFloat(e.amount || 0);
        });

        const isCurrent = this.currentMonth === this.todayMonth();
        const lastDay = isCurrent ? new Date().getDate() : days;

        let running = 0;
        const cumulative = perDay.map((v, i) => {
            running += v;
            // En el mes en curso no se dibuja el futuro: quedaría como una línea plana engañosa.
            return i < lastDay ? running : null;
        });

        const budget = this.categories.reduce((s, c) => s + parseFloat(c.monthly_budget || 0), 0);

        if (this.charts.pace) this.charts.pace.destroy();

        const datasets = [{
            label: 'Gasto acumulado',
            data: cumulative,
            borderColor: '#6366f1',
            backgroundColor: 'rgba(99, 102, 241, 0.15)',
            borderWidth: 2,
            pointRadius: 0,
            tension: 0.25,
            fill: true,
            spanGaps: false
        }];

        if (budget > 0) {
            datasets.push({
                label: 'Ritmo ideal',
                data: perDay.map((_, i) => (budget / days) * (i + 1)),
                borderColor: '#22c55e',
                borderDash: [5, 4],
                borderWidth: 2,
                pointRadius: 0,
                fill: false
            });
        }

        this.charts.pace = new Chart(canvas, {
            type: 'line',
            data: { labels: perDay.map((_, i) => i + 1), datasets },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                interaction: { mode: 'index', intersect: false },
                plugins: {
                    legend: { labels: { color: this.chartTextColor(), boxWidth: 12, font: { size: 11 } } },
                    tooltip: {
                        callbacks: {
                            title: (items) => `Día ${items[0].label}`,
                            label: (ctx) => ` ${ctx.dataset.label}: ${Utils.formatCurrency(ctx.parsed.y)}`
                        }
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: { color: this.chartTextColor(), callback: (v) => '$' + v },
                        grid: { color: 'rgba(148, 163, 184, 0.12)' }
                    },
                    x: {
                        ticks: { color: this.chartTextColor(), maxTicksLimit: 12 },
                        grid: { display: false }
                    }
                }
            }
        });
    },

    // ========================================
    // MODAL DE GASTO
    // ========================================
    openExpenseModal(id = null) {
        if (this.categories.length === 0) {
            Utils.showToast('Primero crea al menos una categoría de gasto', 'warning');
            this.openCategoriesModal();
            return;
        }

        this.editingExpenseId = id;
        const expense = id ? this.expenses.find(e => e.id === id) : null;

        const title = document.getElementById('modalExpenseTitle');
        if (title) title.textContent = expense ? 'Editar Gasto' : 'Registrar Gasto';

        const catSelect = document.getElementById('expCategory');
        if (catSelect) {
            catSelect.innerHTML = this.categories
                .map(c => `<option value="${c.id}">${c.icon || '📦'} ${this.escape(c.name)}</option>`).join('');
        }

        const paySelect = document.getElementById('expPaymentMethod');
        if (paySelect) {
            paySelect.innerHTML = this.PAYMENT_METHODS
                .map(p => `<option value="${p.value}">${p.label}</option>`).join('');
        }

        const set = (elId, val) => {
            const el = document.getElementById(elId);
            if (el) el.value = val;
        };

        if (expense) {
            set('expAmount', parseFloat(expense.amount || 0));
            set('expDate', expense.date || this.todayISO());
            set('expCategory', expense.category_id || '');
            set('expDescription', expense.description || '');
            set('expPaymentMethod', expense.payment_method || 'cash');
            set('expNotes', expense.notes || '');
            const rec = document.getElementById('expIsRecurring');
            if (rec) rec.checked = !!expense.is_recurring;
        } else {
            set('expAmount', '');
            // Si se mira un mes distinto al actual, se propone el día 1 de ese mes.
            set('expDate', this.currentMonth === this.todayMonth()
                ? this.todayISO()
                : `${this.currentMonth}-01`);
            set('expCategory', this.categories[0]?.id || '');
            set('expDescription', '');
            set('expPaymentMethod', 'cash');
            set('expNotes', '');
            const rec = document.getElementById('expIsRecurring');
            if (rec) rec.checked = false;
        }

        Utils.openModal('modalExpense');
        setTimeout(() => document.getElementById('expAmount')?.focus(), 80);
    },

    async handleSaveExpense(e) {
        e.preventDefault();

        const amount = parseFloat(document.getElementById('expAmount')?.value || 0);
        const description = (document.getElementById('expDescription')?.value || '').trim();

        if (!(amount > 0)) {
            Utils.showToast('El monto debe ser mayor a cero', 'warning');
            return;
        }
        if (!description) {
            Utils.showToast('Escribe una descripción del gasto', 'warning');
            return;
        }

        try {
            await Database.saveExpense({
                id: this.editingExpenseId,
                amount,
                description,
                date: document.getElementById('expDate')?.value,
                categoryId: document.getElementById('expCategory')?.value || null,
                paymentMethod: document.getElementById('expPaymentMethod')?.value,
                isRecurring: document.getElementById('expIsRecurring')?.checked,
                notes: (document.getElementById('expNotes')?.value || '').trim()
            });

            Utils.closeModal('modalExpense');
            Utils.showToast(this.editingExpenseId ? 'Gasto actualizado' : 'Gasto registrado', 'success');

            // Si el gasto quedó en otro mes, se salta a ese mes para que sea visible.
            const savedMonth = (document.getElementById('expDate')?.value || '').slice(0, 7);
            if (savedMonth && savedMonth !== this.currentMonth) this.currentMonth = savedMonth;

            this.editingExpenseId = null;
            await this.render();
        } catch (error) {
            console.error('Error saving expense:', error);
            Utils.showToast('No se pudo guardar el gasto', 'error');
        }
    },

    async deleteExpense(id) {
        const expense = this.expenses.find(e => e.id === id);
        const label = expense ? `"${expense.description}" por ${Utils.formatCurrency(parseFloat(expense.amount || 0))}` : 'este gasto';
        if (!confirm(`¿Eliminar ${label}? Esta acción no se puede deshacer.`)) return;

        try {
            await Database.deleteExpense(id);
            Utils.showToast('Gasto eliminado', 'success');
            await this.render();
        } catch (error) {
            console.error('Error deleting expense:', error);
            Utils.showToast('No se pudo eliminar el gasto', 'error');
        }
    },

    // ========================================
    // CATEGORÍAS
    // ========================================
    openCategoriesModal() {
        this.editingCategoryId = null;
        this.renderCategoriesList();
        this.resetCategoryForm();
        Utils.openModal('modalExpCategories');
    },

    resetCategoryForm() {
        this.editingCategoryId = null;
        const set = (id, val) => {
            const el = document.getElementById(id);
            if (el) el.value = val;
        };
        set('expCatName', '');
        set('expCatIcon', '📦');
        set('expCatColor', '#6366f1');
        set('expCatBudget', '');

        const btn = document.getElementById('btnSaveExpCategory');
        if (btn) btn.textContent = 'Agregar Categoría';
        const cancel = document.getElementById('btnCancelExpCategoryEdit');
        if (cancel) cancel.style.display = 'none';
    },

    editCategory(id) {
        const cat = this.categories.find(c => c.id === id);
        if (!cat) return;

        this.editingCategoryId = id;
        const set = (elId, val) => {
            const el = document.getElementById(elId);
            if (el) el.value = val;
        };
        set('expCatName', cat.name);
        set('expCatIcon', cat.icon || '📦');
        set('expCatColor', cat.color || '#6366f1');
        set('expCatBudget', parseFloat(cat.monthly_budget || 0) || '');

        const btn = document.getElementById('btnSaveExpCategory');
        if (btn) btn.textContent = 'Guardar Cambios';
        const cancel = document.getElementById('btnCancelExpCategoryEdit');
        if (cancel) cancel.style.display = '';

        document.getElementById('expCatName')?.focus();
    },

    renderCategoriesList() {
        const container = document.getElementById('expCategoriesList');
        if (!container) return;

        if (this.categories.length === 0) {
            container.innerHTML = `
                <div style="text-align: center; padding: 1.5rem; color: var(--text-muted); font-size: 0.9rem;">
                    No hay categorías. Crea la primera con el formulario de arriba.
                </div>`;
            return;
        }

        // Se cuenta el uso histórico para advertir antes de borrar.
        const usage = {};
        this.expenses.forEach(e => {
            if (e.category_id) usage[e.category_id] = (usage[e.category_id] || 0) + 1;
        });

        container.innerHTML = this.categories.map(c => {
            const count = usage[c.id] || 0;
            const budget = parseFloat(c.monthly_budget || 0);
            return `
                <div style="display: flex; align-items: center; gap: 0.75rem; padding: 0.65rem 0.25rem; border-bottom: 1px solid var(--border);">
                    <span style="width: 10px; height: 10px; border-radius: 50%; background: ${c.color || '#6366f1'}; flex-shrink: 0;"></span>
                    <span style="font-size: 1.05rem;">${c.icon || '📦'}</span>
                    <div style="flex: 1; min-width: 0;">
                        <div style="font-weight: 600; color: var(--text-primary);">${this.escape(c.name)}</div>
                        <div style="font-size: 0.75rem; color: var(--text-muted);">
                            ${budget > 0 ? `Presupuesto ${Utils.formatCurrency(budget)}/mes` : 'Sin presupuesto'}
                            ${count > 0 ? ` · ${count} ${count === 1 ? 'gasto' : 'gastos'}` : ''}
                        </div>
                    </div>
                    <button class="btn btn-icon btn-sm" title="Editar" onclick="ExpensesModule.editCategory('${c.id}')">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                        </svg>
                    </button>
                    <button class="btn btn-icon btn-sm btn-danger-light" title="Eliminar" onclick="ExpensesModule.deleteCategory('${c.id}')">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <polyline points="3 6 5 6 21 6"></polyline>
                            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                        </svg>
                    </button>
                </div>`;
        }).join('');
    },

    async handleSaveCategory(e) {
        e.preventDefault();

        const name = (document.getElementById('expCatName')?.value || '').trim();
        if (!name) {
            Utils.showToast('Escribe un nombre para la categoría', 'warning');
            return;
        }

        const duplicate = this.categories.find(c =>
            c.name.toLowerCase() === name.toLowerCase() && c.id !== this.editingCategoryId);
        if (duplicate) {
            Utils.showToast('Ya existe una categoría con ese nombre', 'warning');
            return;
        }

        try {
            await Database.saveExpenseCategory({
                id: this.editingCategoryId,
                name,
                icon: (document.getElementById('expCatIcon')?.value || '📦').trim() || '📦',
                color: document.getElementById('expCatColor')?.value || '#6366f1',
                monthlyBudget: parseFloat(document.getElementById('expCatBudget')?.value || 0) || 0,
                sortOrder: this.editingCategoryId
                    ? (this.categories.find(c => c.id === this.editingCategoryId)?.sort_order || 0)
                    : this.categories.length + 1
            });

            Utils.showToast(this.editingCategoryId ? 'Categoría actualizada' : 'Categoría creada', 'success');
            this.resetCategoryForm();

            this.categories = await Database.getExpenseCategories();
            this.renderCategoriesList();
            this.populateFilterOptions();
            this.renderKPIs();
            this.renderBudgets();
            this.renderCharts();
        } catch (error) {
            console.error('Error saving category:', error);
            Utils.showToast('No se pudo guardar la categoría', 'error');
        }
    },

    async deleteCategory(id) {
        const cat = this.categories.find(c => c.id === id);
        if (!cat) return;

        const count = this.expenses.filter(e => e.category_id === id).length;
        const warning = count > 0
            ? `\n\n${count} ${count === 1 ? 'gasto quedará' : 'gastos quedarán'} sin categoría (no se eliminan).`
            : '';
        if (!confirm(`¿Eliminar la categoría "${cat.name}"?${warning}`)) return;

        try {
            await Database.deleteExpenseCategory(id);
            Utils.showToast('Categoría eliminada', 'success');
            if (this.editingCategoryId === id) this.resetCategoryForm();
            await this.render();
            this.renderCategoriesList();
        } catch (error) {
            console.error('Error deleting category:', error);
            Utils.showToast('No se pudo eliminar la categoría', 'error');
        }
    },

    // ========================================
    // EXPORTAR
    // ========================================
    exportToExcel() {
        if (typeof XLSX === 'undefined') {
            Utils.showToast('La librería de Excel no está disponible', 'error');
            return;
        }

        const list = this.getFilteredExpenses();
        if (list.length === 0) {
            Utils.showToast('No hay gastos para exportar en este mes', 'warning');
            return;
        }

        const k = this.computeKPIs();
        const wb = XLSX.utils.book_new();

        // Hoja 1: resumen
        const resumen = [
            ['REPORTE DE GASTOS MENSUALES'],
            ['Período:', this.monthLabel(this.currentMonth)],
            ['Generado el:', new Date().toLocaleString('es-EC')],
            [],
            ['INDICADOR', 'VALOR'],
            ['Total gastado', k.total],
            ['Presupuesto mensual', k.budget],
            ['Disponible / Excedido', k.remaining],
            ['% de presupuesto usado', k.budgetUsed !== null ? `${k.budgetUsed.toFixed(1)}%` : 'N/A'],
            ['Gastos fijos', k.fixed],
            ['Gastos variables', k.variable],
            ['Nº de movimientos', k.count],
            ['Ticket promedio', k.avgTicket],
            ['Promedio diario', k.dailyAvg],
            ['Proyección fin de mes', k.projection],
            ['Total mes anterior', k.prevTotal],
            ['Variación vs mes anterior', k.variation !== null ? `${k.variation.toFixed(1)}%` : 'N/A']
        ];
        const wsResumen = XLSX.utils.aoa_to_sheet(resumen);
        wsResumen['!cols'] = [{ wch: 30 }, { wch: 22 }];
        XLSX.utils.book_append_sheet(wb, wsResumen, 'Resumen');

        // Hoja 2: detalle
        const detalle = [['Fecha', 'Categoría', 'Descripción', 'Método de Pago', 'Tipo', 'Monto ($)', 'Notas']];
        list.forEach(e => {
            const cat = this.categoryOf(e);
            detalle.push([
                e.date || '',
                cat?.name || 'Sin categoría',
                e.description || '',
                this.paymentLabel(e.payment_method).replace(/^[^\s]+\s/, ''),
                e.is_recurring ? 'Fijo' : 'Variable',
                parseFloat(e.amount || 0),
                e.notes || ''
            ]);
        });
        const wsDetalle = XLSX.utils.aoa_to_sheet(detalle);
        wsDetalle['!cols'] = [{ wch: 12 }, { wch: 18 }, { wch: 38 }, { wch: 16 }, { wch: 10 }, { wch: 12 }, { wch: 30 }];
        XLSX.utils.book_append_sheet(wb, wsDetalle, 'Detalle');

        // Hoja 3: por categoría
        const byCat = {};
        list.forEach(e => {
            const cat = this.categoryOf(e);
            const key = cat?.name || 'Sin categoría';
            if (!byCat[key]) byCat[key] = { total: 0, count: 0, budget: parseFloat(cat?.monthly_budget || 0) };
            byCat[key].total += parseFloat(e.amount || 0);
            byCat[key].count++;
        });
        const porCat = [['Categoría', 'Nº Gastos', 'Total ($)', 'Presupuesto ($)', 'Diferencia ($)', '% del Total']];
        Object.entries(byCat)
            .sort((a, b) => b[1].total - a[1].total)
            .forEach(([name, v]) => {
                porCat.push([
                    name, v.count, v.total, v.budget,
                    v.budget > 0 ? v.budget - v.total : '',
                    k.total > 0 ? `${((v.total / k.total) * 100).toFixed(1)}%` : '0%'
                ]);
            });
        const wsCat = XLSX.utils.aoa_to_sheet(porCat);
        wsCat['!cols'] = [{ wch: 22 }, { wch: 10 }, { wch: 14 }, { wch: 16 }, { wch: 14 }, { wch: 12 }];
        XLSX.utils.book_append_sheet(wb, wsCat, 'Por Categoría');

        XLSX.writeFile(wb, `gastos_${this.currentMonth}.xlsx`);
        Utils.showToast('Reporte exportado', 'success');
    },

    escape(str) {
        return String(str ?? '').replace(/[&<>"']/g, ch => ({
            '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
        })[ch]);
    }
};

window.ExpensesModule = ExpensesModule;
