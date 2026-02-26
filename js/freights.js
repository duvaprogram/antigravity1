// ========================================
// Freights Module (Async - Supabase)
// Tracking freight costs in various currencies
// ========================================

const FreightsModule = {
    // Filter state
    filters: {
        dateFrom: null,
        dateTo: null,
        route: ''
    },

    // All records cache
    allRecords: [],

    init() {
        this.bindEvents();
    },

    bindEvents() {
        const form = document.getElementById('formFreight');
        if (form) {
            form.addEventListener('submit', (e) => {
                e.preventDefault();
                this.saveFreight();
            });
        }

        // Filter events
        const filterDateFrom = document.getElementById('freightFilterDateFrom');
        const filterDateTo = document.getElementById('freightFilterDateTo');
        const filterRoute = document.getElementById('freightFilterRoute');

        if (filterDateFrom) {
            filterDateFrom.addEventListener('change', () => this.applyFilters());
        }
        if (filterDateTo) {
            filterDateTo.addEventListener('change', () => this.applyFilters());
        }
        if (filterRoute) {
            filterRoute.addEventListener('change', () => this.applyFilters());
        }
    },

    async render() {
        await this.updateTable();
        await this.updateStats();
    },

    openFreightModal(id = null) {
        const modal = document.getElementById('modalFreight');
        const title = document.getElementById('modalFreightTitle');
        const form = document.getElementById('formFreight');

        if (!modal || !form) return;

        form.reset();
        document.getElementById('freightId').value = '';

        if (id) {
            title.textContent = 'Editar Flete';
            this.loadFreightForEdit(id);
        } else {
            title.textContent = 'Registrar Nuevo Flete';
            // Set today's date
            document.getElementById('freightDate').valueAsDate = new Date();
        }

        modal.classList.add('active');
    },

    async loadFreightForEdit(id) {
        const freight = this.allRecords.find(f => f.id === id);
        if (!freight) return;

        document.getElementById('freightId').value = freight.id;
        document.getElementById('freightDate').value = freight.date;
        document.getElementById('freightRoute').value = freight.route;
        document.getElementById('freightPurchaseRef').value = freight.purchase_ref || '';
        document.getElementById('freightAmount').value = freight.amount;
        document.getElementById('freightCurrency').value = freight.currency || 'USD';
        document.getElementById('freightNotes').value = freight.notes || '';
    },

    async saveFreight() {
        const id = document.getElementById('freightId').value;
        const date = document.getElementById('freightDate').value;
        const route = document.getElementById('freightRoute').value;
        const purchase_ref = document.getElementById('freightPurchaseRef').value.trim();
        const amount = parseFloat(document.getElementById('freightAmount').value);
        const currency = document.getElementById('freightCurrency').value;
        const notes = document.getElementById('freightNotes').value.trim();

        if (!date || !route || isNaN(amount)) {
            Utils.showToast('Por favor complete los campos requeridos', 'error');
            return;
        }

        const freight = {
            date,
            route,
            purchase_ref,
            amount,
            currency,
            notes
        };

        try {
            if (id) {
                // Update existing
                const { error } = await supabaseClient
                    .from('freights')
                    .update(freight)
                    .eq('id', id);

                if (error) throw error;
                Utils.showToast('Flete actualizado exitosamente', 'success');
            } else {
                // Create new
                const { error } = await supabaseClient
                    .from('freights')
                    .insert([freight]);

                if (error) throw error;
                Utils.showToast('Flete registrado exitosamente', 'success');
            }

            // Close modal and refresh
            document.getElementById('modalFreight').classList.remove('active');
            await this.render();
        } catch (error) {
            console.error('Error saving freight:', error);
            if (error.code === '42P01') {
                Utils.showToast('La tabla de freights no existe. Por favor contacte al administrador.', 'error');
            } else {
                Utils.showToast('Error al guardar el flete', 'error');
            }
        }
    },

    async getFreights() {
        try {
            const { data, error } = await supabaseClient
                .from('freights')
                .select('*')
                .order('date', { ascending: false });

            if (error) {
                if (error.code === '42P01') {
                    console.log('Freights table does not exist yet. Please create it.');
                    // Returning empty array if table doesn't exist
                    return [];
                }
                throw error;
            }
            return data || [];
        } catch (error) {
            console.error('Error fetching freights:', error);
            return [];
        }
    },

    async updateTable() {
        const freights = await this.getFreights();
        this.allRecords = freights;

        // Apply filters
        const filtered = this.filterRecords(freights);

        // Update record count
        const recordCount = document.getElementById('freightRecordCount');
        if (recordCount) {
            recordCount.textContent = `${filtered.length} de ${freights.length} registros`;
        }

        // Render table
        const tableBody = document.getElementById('freightsTable');
        if (!tableBody) return;

        tableBody.innerHTML = filtered.length ? filtered.map(f => `
            <tr>
                <td>${f.date}</td>
                <td><span class="status-badge" style="background: var(--info-light); color: var(--info);">${f.route}</span></td>
                <td>${f.purchase_ref || '-'}</td>
                <td style="font-weight: 600; color: var(--primary);">${f.amount.toFixed(2)}</td>
                <td><strong>${f.currency}</strong></td>
                <td><span class="text-muted" style="font-size: 0.8rem;">${f.notes ? Utils.escapeHtml(f.notes) : '-'}</span></td>
                <td>
                    <div style="display: flex; gap: 0.5rem;">
                        <button class="btn btn-icon btn-secondary btn-sm" onclick="FreightsModule.openFreightModal('${f.id}')" title="Editar">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                            </svg>
                        </button>
                        <button class="btn btn-icon btn-danger btn-sm" onclick="FreightsModule.deleteFreight('${f.id}')" title="Eliminar">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <polyline points="3 6 5 6 21 6"></polyline>
                                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                            </svg>
                        </button>
                    </div>
                </td>
            </tr>
        `).join('') : '<tr><td colspan="7" style="text-align: center; color: var(--text-muted); padding: 2rem;">No hay fletes registrados</td></tr>';
    },

    async updateStats() {
        const freights = this.allRecords.length > 0 ? this.allRecords : await this.getFreights();

        // Total freights count
        const totalFreights = document.getElementById('totalFreights');
        if (totalFreights) {
            totalFreights.textContent = freights.length;
        }

        // Total spent (simplification: summing USD only, or summing disregarding currency)
        // Let's sum only USD for the "Total Movilizado (USD)"
        const usdFreights = freights.filter(f => f.currency === 'USD');
        const totalUsd = usdFreights.reduce((sum, f) => sum + (parseFloat(f.amount) || 0), 0);
        const totalFreightSpentUSD = document.getElementById('totalFreightSpentUSD');
        if (totalFreightSpentUSD) {
            totalFreightSpentUSD.textContent = `$${totalUsd.toFixed(2)}`;
        }

        // This month's spending (USD)
        const now = new Date();
        const currentMonth = now.getMonth();
        const currentYear = now.getFullYear();
        const monthlyUsdFreights = usdFreights.filter(f => {
            const date = new Date(f.date);
            return date.getMonth() === currentMonth && date.getFullYear() === currentYear;
        });
        const monthlyAmount = monthlyUsdFreights.reduce((sum, f) => sum + (parseFloat(f.amount) || 0), 0);
        const monthlyFreightSpent = document.getElementById('monthlyFreightSpent');
        if (monthlyFreightSpent) {
            monthlyFreightSpent.textContent = `$${monthlyAmount.toFixed(2)}`;
        }
    },

    filterRecords(records) {
        let filtered = [...records];

        if (this.filters.dateFrom) {
            filtered = filtered.filter(f => f.date >= this.filters.dateFrom);
        }
        if (this.filters.dateTo) {
            filtered = filtered.filter(f => f.date <= this.filters.dateTo);
        }
        if (this.filters.route) {
            filtered = filtered.filter(f => f.route === this.filters.route);
        }

        return filtered;
    },

    applyFilters() {
        const dateFrom = document.getElementById('freightFilterDateFrom');
        const dateTo = document.getElementById('freightFilterDateTo');
        const route = document.getElementById('freightFilterRoute');

        this.filters.dateFrom = dateFrom ? dateFrom.value : null;
        this.filters.dateTo = dateTo ? dateTo.value : null;
        this.filters.route = route ? route.value : '';

        this.updateTable();
    },

    clearFilters() {
        const dateFrom = document.getElementById('freightFilterDateFrom');
        const dateTo = document.getElementById('freightFilterDateTo');
        const route = document.getElementById('freightFilterRoute');

        if (dateFrom) dateFrom.value = '';
        if (dateTo) dateTo.value = '';
        if (route) route.value = '';

        this.filters = {
            dateFrom: null,
            dateTo: null,
            route: ''
        };

        this.updateTable();
    },

    async deleteFreight(id) {
        if (!confirm('¿Está seguro de eliminar este flete?')) return;

        try {
            const { error } = await supabaseClient
                .from('freights')
                .delete()
                .eq('id', id);

            if (error) throw error;

            Utils.showToast('Flete eliminado exitosamente', 'success');
            await this.render();
        } catch (error) {
            console.error('Error deleting freight:', error);
            Utils.showToast('Error al eliminar el flete', 'error');
        }
    }
};

window.FreightsModule = FreightsModule;
