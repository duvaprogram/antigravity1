// ========================================
// Confirmation Module (Async - Supabase)
// Single Panel with Calendar Filters
// ========================================

const ConfirmationModule = {
    // Filter state for stats panel
    statFilters: {
        dateFrom: null,
        dateTo: null,
        page: ''
    },

    // Filter state for table
    tableFilters: {
        dateFrom: null,
        dateTo: null,
        page: ''
    },

    // All records cache
    allRecords: [],

    init() {
        this.bindEvents();
    },

    bindEvents() {
        const form = document.getElementById('formConfirmation');
        if (form) {
            form.addEventListener('submit', (e) => {
                e.preventDefault();
                this.saveRecord();
            });

            // Live calculation
            const inputs = ['confTotal', 'confConfirmed', 'confDuplicates', 'confCancelled', 'confCancelledClient'];
            inputs.forEach(id => {
                const el = document.getElementById(id);
                if (el) {
                    el.addEventListener('input', () => this.calculatePreview());
                }
            });
        }

        // Stats panel filter events
        const statDateFrom = document.getElementById('statDateFrom');
        const statDateTo = document.getElementById('statDateTo');
        const statPage = document.getElementById('statPage');

        if (statDateFrom) {
            statDateFrom.addEventListener('change', () => this.updateStatsFromFilters());
        }
        if (statDateTo) {
            statDateTo.addEventListener('change', () => this.updateStatsFromFilters());
        }
        if (statPage) {
            statPage.addEventListener('change', () => this.updateStatsFromFilters());
        }

        // Table filter events
        const filterDateFrom = document.getElementById('filterDateFrom');
        const filterDateTo = document.getElementById('filterDateTo');

        if (filterDateFrom) {
            filterDateFrom.addEventListener('change', () => this.applyFilters());
        }
        if (filterDateTo) {
            filterDateTo.addEventListener('change', () => this.applyFilters());
        }
    },

    async render() {
        await this.updateTables();

        // Set date to today if empty
        const dateInput = document.getElementById('confDate');
        if (dateInput && !dateInput.value) {
            dateInput.valueAsDate = new Date();
        }

        // Set default filter to current month
        this.setQuickFilter('month');
        this.calculatePreview();
    },

    // Quick filter buttons
    setQuickFilter(period) {
        const now = new Date();
        let dateFrom, dateTo;

        if (period === 'week') {
            // Start of current week (Monday)
            const day = now.getDay();
            const diff = now.getDate() - day + (day === 0 ? -6 : 1);
            dateFrom = new Date(now.getFullYear(), now.getMonth(), diff);
            dateTo = new Date(now.getFullYear(), now.getMonth(), diff + 6);
        } else if (period === 'month') {
            // Current month
            dateFrom = new Date(now.getFullYear(), now.getMonth(), 1);
            dateTo = new Date(now.getFullYear(), now.getMonth() + 1, 0);
        } else {
            // All - no filter
            dateFrom = null;
            dateTo = null;
        }

        // Update input fields
        const statDateFrom = document.getElementById('statDateFrom');
        const statDateTo = document.getElementById('statDateTo');

        if (statDateFrom) {
            statDateFrom.value = dateFrom ? dateFrom.toISOString().split('T')[0] : '';
        }
        if (statDateTo) {
            statDateTo.value = dateTo ? dateTo.toISOString().split('T')[0] : '';
        }

        // Update stats
        this.updateStatsFromFilters();
    },

    updateStatsFromFilters() {
        const statDateFrom = document.getElementById('statDateFrom');
        const statDateTo = document.getElementById('statDateTo');
        const statPage = document.getElementById('statPage');

        this.statFilters.dateFrom = statDateFrom ? statDateFrom.value : null;
        this.statFilters.dateTo = statDateTo ? statDateTo.value : null;
        this.statFilters.page = statPage ? statPage.value : '';

        this.updatePeriodStats();
    },

    calculatePreview() {
        const totalInput = document.getElementById('confTotal');
        const confirmedInput = document.getElementById('confConfirmed');
        const duplicatesInput = document.getElementById('confDuplicates');
        const cancelledInput = document.getElementById('confCancelled');

        const total = parseFloat(totalInput ? totalInput.value : 0) || 0;
        const confirmed = parseFloat(confirmedInput ? confirmedInput.value : 0) || 0;
        const duplicates = parseFloat(duplicatesInput ? duplicatesInput.value : 0) || 0;
        const cancelled = parseFloat(cancelledInput ? cancelledInput.value : 0) || 0;

        // Gross Percentage
        const percentage = total > 0 ? ((confirmed / total) * 100).toFixed(1) : 0;

        // Net Effectiveness
        const netTotal = total - duplicates - cancelled;
        let netPercentage = 0;
        if (netTotal > 0) {
            netPercentage = ((confirmed / netTotal) * 100).toFixed(1);
        }

        // Update Displays
        const display = document.getElementById('confPercentageValue');
        const detail = document.getElementById('confStatsDetail');
        const netDisplay = document.getElementById('confNetPercentageValue');

        if (display) {
            display.textContent = `${percentage}%`;
            this.stylePercentage(display, percentage);
        }

        if (detail) {
            detail.textContent = `${confirmed} / ${total} Confirmados`;
        }

        if (netDisplay) {
            netDisplay.textContent = `${netPercentage}%`;
            this.stylePercentage(netDisplay, netPercentage);
        }
    },

    stylePercentage(element, value) {
        if (value >= 80) element.style.color = 'var(--success)';
        else if (value >= 50) element.style.color = 'var(--warning)';
        else element.style.color = 'var(--danger)';
    },

    async saveRecord() {
        const date = document.getElementById('confDate').value;
        const page = document.getElementById('confPage').value;
        const totalOrders = parseInt(document.getElementById('confTotal').value);
        const confirmed = parseInt(document.getElementById('confConfirmed').value);
        const duplicates = parseInt(document.getElementById('confDuplicates').value) || 0;
        const cancelledCoverage = parseInt(document.getElementById('confCancelled').value) || 0;
        const cancelledClient = parseInt(document.getElementById('confCancelledClient').value) || 0;

        if (!date || !page || !totalOrders && totalOrders !== 0) {
            Utils.showToast('Por favor complete los campos requeridos', 'error');
            return;
        }

        const record = {
            date,
            page,
            totalOrders,
            confirmed,
            duplicates,
            cancelledCoverage,
            cancelledClient
        };

        try {
            await Database.saveConfirmation(record);
            Utils.showToast('Registro guardado exitosamente', 'success');

            // Clear numeric inputs
            ['confTotal', 'confConfirmed', 'confDuplicates', 'confCancelled', 'confCancelledClient']
                .forEach(id => {
                    const el = document.getElementById(id);
                    if (el) {
                        el.value = (id === 'confTotal' || id === 'confConfirmed') ? '' : '0';
                    }
                });

            await this.updateTables();
            await this.updatePeriodStats();
            this.calculatePreview();
        } catch (error) {
            console.error('Error saving confirmation:', error);
            Utils.showToast('Error al guardar el registro', 'error');
        }
    },

    async updateTables() {
        const records = await Database.getConfirmations();
        this.allRecords = records;

        // Sort by date desc
        records.sort((a, b) => new Date(b.date) - new Date(a.date) || new Date(b.createdAt) - new Date(a.createdAt));

        // Apply table filters
        const filteredRecords = this.filterRecordsForTable(records);

        // Update record count
        const recordCount = document.getElementById('recordCount');
        if (recordCount) {
            recordCount.textContent = `${filteredRecords.length} de ${records.length} registros`;
        }

        // Full History
        const historyBody = document.getElementById('confHistoryTable');
        if (historyBody) {
            historyBody.innerHTML = filteredRecords.length ? filteredRecords.map(r => `
                <tr>
                    <td>${r.date}</td>
                    <td>${r.page}</td>
                    <td>${r.totalOrders}</td>
                    <td>${r.confirmed}</td>
                    <td>${r.duplicates}</td>
                    <td>${r.cancelledCoverage}</td>
                    <td>${r.cancelledClient || 0}</td>
                    <td>
                        <span class="status-badge ${this.getPercentageClass(r.grossPercentage)}">
                            ${r.grossPercentage}%
                        </span>
                    </td>
                    <td>
                        <span class="status-badge ${this.getPercentageClass(r.netPercentage || 0)}">
                            ${r.netPercentage || 0}%
                        </span>
                    </td>
                    <td>
                        <button class="btn btn-icon btn-danger btn-sm" onclick="ConfirmationModule.deleteRecord('${r.id}')" title="Eliminar">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <polyline points="3 6 5 6 21 6"></polyline>
                                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                            </svg>
                        </button>
                    </td>
                </tr>
            `).join('') : '<tr><td colspan="10" style="text-align: center; color: var(--text-muted); padding: 2rem;">No hay registros de confirmación</td></tr>';
        }

        // Preview (Recent)
        const previewBody = document.getElementById('confPreviewTable');
        if (previewBody) {
            previewBody.innerHTML = records.length ? records.slice(0, 5).map(r => `
                <tr>
                    <td>${r.date}</td>
                    <td>${r.page}</td>
                    <td style="font-weight: bold; color: ${this.getPercentageColor(r.grossPercentage)}">${r.grossPercentage}%</td>
                </tr>
            `).join('') : '<tr><td colspan="3" style="text-align: center; color: var(--text-muted);">Sin datos</td></tr>';
        }
    },

    filterRecordsForTable(records) {
        let filtered = [...records];

        // Filter by date range
        if (this.tableFilters.dateFrom) {
            filtered = filtered.filter(r => r.date >= this.tableFilters.dateFrom);
        }
        if (this.tableFilters.dateTo) {
            filtered = filtered.filter(r => r.date <= this.tableFilters.dateTo);
        }

        // Filter by page
        if (this.tableFilters.page) {
            filtered = filtered.filter(r => r.page === this.tableFilters.page);
        }

        return filtered;
    },

    filterRecordsForStats(records) {
        let filtered = [...records];

        // Filter by date range
        if (this.statFilters.dateFrom) {
            filtered = filtered.filter(r => r.date >= this.statFilters.dateFrom);
        }
        if (this.statFilters.dateTo) {
            filtered = filtered.filter(r => r.date <= this.statFilters.dateTo);
        }

        // Filter by page
        if (this.statFilters.page) {
            filtered = filtered.filter(r => r.page === this.statFilters.page);
        }

        return filtered;
    },

    applyFilters() {
        const dateFrom = document.getElementById('filterDateFrom');
        const dateTo = document.getElementById('filterDateTo');
        const page = document.getElementById('filterPage');

        this.tableFilters.dateFrom = dateFrom ? dateFrom.value : null;
        this.tableFilters.dateTo = dateTo ? dateTo.value : null;
        this.tableFilters.page = page ? page.value : '';

        // Update filter summary
        this.updateFilterSummary();

        // Refresh tables
        this.updateTables();
    },

    clearFilters() {
        const dateFrom = document.getElementById('filterDateFrom');
        const dateTo = document.getElementById('filterDateTo');
        const page = document.getElementById('filterPage');

        if (dateFrom) dateFrom.value = '';
        if (dateTo) dateTo.value = '';
        if (page) page.value = '';

        this.tableFilters = {
            dateFrom: null,
            dateTo: null,
            page: ''
        };

        // Hide filter summary
        const filterSummary = document.getElementById('filterSummary');
        if (filterSummary) filterSummary.style.display = 'none';

        // Refresh tables
        this.updateTables();
    },

    updateFilterSummary() {
        const filterSummary = document.getElementById('filterSummary');
        const filterSummaryText = document.getElementById('filterSummaryText');

        if (!filterSummary || !filterSummaryText) return;

        const parts = [];

        if (this.tableFilters.dateFrom && this.tableFilters.dateTo) {
            parts.push(`Desde ${this.formatDate(this.tableFilters.dateFrom)} hasta ${this.formatDate(this.tableFilters.dateTo)}`);
        } else if (this.tableFilters.dateFrom) {
            parts.push(`Desde ${this.formatDate(this.tableFilters.dateFrom)}`);
        } else if (this.tableFilters.dateTo) {
            parts.push(`Hasta ${this.formatDate(this.tableFilters.dateTo)}`);
        }

        if (this.tableFilters.page) {
            parts.push(`Página: ${this.tableFilters.page}`);
        }

        if (parts.length > 0) {
            filterSummaryText.textContent = parts.join(' | ');
            filterSummary.style.display = 'flex';
        } else {
            filterSummary.style.display = 'none';
        }
    },

    formatDate(dateStr) {
        const date = new Date(dateStr + 'T00:00:00');
        return date.toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' });
    },

    async updatePeriodStats() {
        const records = this.allRecords.length > 0 ? this.allRecords : await Database.getConfirmations();

        if (records.length === 0) {
            this.resetPeriodStats();
            return;
        }

        // Filter records based on stat filters
        const filteredRecords = this.filterRecordsForStats(records);

        // Calculate stats
        const stats = this.calculatePeriodTotals(filteredRecords);

        // Update UI
        this.updateStatElement('periodTotalOrders', stats.totalOrders);
        this.updateStatElement('periodConfirmed', stats.confirmed);
        this.updateStatElement('periodGrossPercent', `${stats.grossPercent}%`);
        this.updateStatElement('periodNetPercent', `${stats.netPercent}%`);

        // Update date range display
        const dateRange = document.getElementById('periodDateRange');
        if (dateRange) {
            if (this.statFilters.dateFrom && this.statFilters.dateTo) {
                dateRange.textContent = `${this.formatDate(this.statFilters.dateFrom)} - ${this.formatDate(this.statFilters.dateTo)} (${filteredRecords.length} registros)`;
            } else if (this.statFilters.dateFrom) {
                dateRange.textContent = `Desde ${this.formatDate(this.statFilters.dateFrom)} (${filteredRecords.length} registros)`;
            } else if (this.statFilters.dateTo) {
                dateRange.textContent = `Hasta ${this.formatDate(this.statFilters.dateTo)} (${filteredRecords.length} registros)`;
            } else {
                dateRange.textContent = `Todos los registros (${filteredRecords.length} registros)`;
            }
        }
    },

    calculatePeriodTotals(records) {
        const totalOrders = records.reduce((sum, r) => sum + (r.totalOrders || 0), 0);
        const confirmed = records.reduce((sum, r) => sum + (r.confirmed || 0), 0);
        const duplicates = records.reduce((sum, r) => sum + (r.duplicates || 0), 0);
        const cancelled = records.reduce((sum, r) => sum + (r.cancelledCoverage || 0), 0);

        const grossPercent = totalOrders > 0 ? ((confirmed / totalOrders) * 100).toFixed(1) : 0;
        const netTotal = totalOrders - duplicates - cancelled;
        const netPercent = netTotal > 0 ? ((confirmed / netTotal) * 100).toFixed(1) : 0;

        return { totalOrders, confirmed, grossPercent, netPercent };
    },

    updateStatElement(id, value) {
        const el = document.getElementById(id);
        if (el) {
            el.textContent = value;
            el.classList.add('stat-updated');
            setTimeout(() => el.classList.remove('stat-updated'), 300);
        }
    },

    resetPeriodStats() {
        const elements = ['periodTotalOrders', 'periodConfirmed', 'periodGrossPercent', 'periodNetPercent'];

        elements.forEach(id => {
            const el = document.getElementById(id);
            if (el) el.textContent = id.includes('Percent') ? '0%' : '0';
        });

        const dateRange = document.getElementById('periodDateRange');
        if (dateRange) dateRange.textContent = 'Sin datos';
    },

    async deleteRecord(id) {
        if (confirm('¿Está seguro de eliminar este registro?')) {
            try {
                await Database.deleteConfirmation(id);
                await this.updateTables();
                await this.updatePeriodStats();
                Utils.showToast('Registro eliminado');
            } catch (error) {
                console.error('Error deleting confirmation:', error);
                Utils.showToast('Error al eliminar el registro', 'error');
            }
        }
    },

    getPercentageClass(p) {
        if (p >= 80) return 'status-delivered';
        if (p >= 50) return 'status-transit';
        return 'status-cancelled';
    },

    getPercentageColor(p) {
        if (p >= 80) return 'var(--success)';
        if (p >= 50) return 'var(--warning)';
        return 'var(--danger)';
    }
};

window.ConfirmationModule = ConfirmationModule;
