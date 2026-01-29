// ========================================
// Purchases Module (Async - Supabase)
// Tracking purchases in Colombian Pesos
// ========================================

const PurchasesModule = {
    // Filter state
    filters: {
        dateFrom: null,
        dateTo: null,
        provider: ''
    },

    // All records cache
    allRecords: [],

    init() {
        this.bindEvents();
    },

    bindEvents() {
        const form = document.getElementById('formPurchase');
        if (form) {
            form.addEventListener('submit', (e) => {
                e.preventDefault();
                this.savePurchase();
            });
        }

        // Filter events
        const filterDateFrom = document.getElementById('purchaseFilterDateFrom');
        const filterDateTo = document.getElementById('purchaseFilterDateTo');
        const filterProvider = document.getElementById('purchaseFilterProvider');

        if (filterDateFrom) {
            filterDateFrom.addEventListener('change', () => this.applyFilters());
        }
        if (filterDateTo) {
            filterDateTo.addEventListener('change', () => this.applyFilters());
        }
        if (filterProvider) {
            filterProvider.addEventListener('change', () => this.applyFilters());
        }
    },

    async render() {
        await this.updateTable();
        await this.updateStats();
        await this.populateProviderFilter();
    },

    openPurchaseModal(id = null) {
        const modal = document.getElementById('modalPurchase');
        const title = document.getElementById('modalPurchaseTitle');
        const form = document.getElementById('formPurchase');

        if (!modal || !form) return;

        form.reset();
        document.getElementById('purchaseId').value = '';

        if (id) {
            title.textContent = 'Editar Compra';
            this.loadPurchaseForEdit(id);
        } else {
            title.textContent = 'Nueva Compra';
            // Set today's date
            document.getElementById('purchaseDate').valueAsDate = new Date();
        }

        modal.classList.add('active');
    },

    async loadPurchaseForEdit(id) {
        const purchase = this.allRecords.find(p => p.id === id);
        if (!purchase) return;

        document.getElementById('purchaseId').value = purchase.id;
        document.getElementById('purchaseDate').value = purchase.date;
        document.getElementById('purchaseProvider').value = purchase.provider;
        document.getElementById('purchaseDescription').value = purchase.description;
        document.getElementById('purchaseQuantity').value = purchase.quantity || 1;
        document.getElementById('purchaseAmount').value = purchase.amount;
        document.getElementById('purchasePaymentMethod').value = purchase.payment_method || 'Efectivo';
        document.getElementById('purchaseCategory').value = purchase.category || 'Mercancía';
        document.getElementById('purchaseNotes').value = purchase.notes || '';
    },

    async savePurchase() {
        const id = document.getElementById('purchaseId').value;
        const date = document.getElementById('purchaseDate').value;
        const provider = document.getElementById('purchaseProvider').value.trim();
        const description = document.getElementById('purchaseDescription').value.trim();
        const quantity = parseInt(document.getElementById('purchaseQuantity').value) || 1;
        const amount = parseFloat(document.getElementById('purchaseAmount').value);
        const paymentMethod = document.getElementById('purchasePaymentMethod').value;
        const category = document.getElementById('purchaseCategory').value;
        const notes = document.getElementById('purchaseNotes').value.trim();

        if (!date || !provider || !description || !amount) {
            Utils.showToast('Por favor complete los campos requeridos', 'error');
            return;
        }

        const purchase = {
            date,
            provider,
            description,
            quantity,
            amount,
            payment_method: paymentMethod,
            category,
            notes
        };

        try {
            if (id) {
                // Update existing
                const { error } = await supabaseClient
                    .from('purchases')
                    .update(purchase)
                    .eq('id', id);

                if (error) throw error;
                Utils.showToast('Compra actualizada exitosamente', 'success');
            } else {
                // Create new
                const { error } = await supabaseClient
                    .from('purchases')
                    .insert([purchase]);

                if (error) throw error;
                Utils.showToast('Compra registrada exitosamente', 'success');
            }

            // Close modal and refresh
            document.getElementById('modalPurchase').classList.remove('active');
            await this.render();
        } catch (error) {
            console.error('Error saving purchase:', error);
            Utils.showToast('Error al guardar la compra', 'error');
        }
    },

    async getPurchases() {
        try {
            const { data, error } = await supabaseClient
                .from('purchases')
                .select('*')
                .order('date', { ascending: false });

            if (error) throw error;
            return data || [];
        } catch (error) {
            console.error('Error fetching purchases:', error);
            return [];
        }
    },

    async updateTable() {
        const purchases = await this.getPurchases();
        this.allRecords = purchases;

        // Apply filters
        const filtered = this.filterRecords(purchases);

        // Update record count
        const recordCount = document.getElementById('purchaseRecordCount');
        if (recordCount) {
            recordCount.textContent = `${filtered.length} de ${purchases.length} registros`;
        }

        // Render table
        const tableBody = document.getElementById('purchasesTable');
        if (!tableBody) return;

        tableBody.innerHTML = filtered.length ? filtered.map(p => `
            <tr>
                <td>${p.date}</td>
                <td>${p.provider}</td>
                <td>${p.description}</td>
                <td>${p.quantity || 1}</td>
                <td style="font-weight: 600; color: var(--success);">$${this.formatCurrency(p.amount)}</td>
                <td>
                    <span class="status-badge ${this.getPaymentMethodClass(p.payment_method)}">
                        ${p.payment_method}
                    </span>
                </td>
                <td>
                    <div style="display: flex; gap: 0.5rem;">
                        <button class="btn btn-icon btn-secondary btn-sm" onclick="PurchasesModule.openPurchaseModal('${p.id}')" title="Editar">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                            </svg>
                        </button>
                        <button class="btn btn-icon btn-danger btn-sm" onclick="PurchasesModule.deletePurchase('${p.id}')" title="Eliminar">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <polyline points="3 6 5 6 21 6"></polyline>
                                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                            </svg>
                        </button>
                    </div>
                </td>
            </tr>
        `).join('') : '<tr><td colspan="7" style="text-align: center; color: var(--text-muted); padding: 2rem;">No hay compras registradas</td></tr>';
    },

    async updateStats() {
        const purchases = this.allRecords.length > 0 ? this.allRecords : await this.getPurchases();

        // Total purchases count
        const totalPurchases = document.getElementById('totalPurchases');
        if (totalPurchases) {
            totalPurchases.textContent = purchases.length;
        }

        // Total spent
        const totalAmount = purchases.reduce((sum, p) => sum + (parseFloat(p.amount) || 0), 0);
        const totalSpent = document.getElementById('totalSpent');
        if (totalSpent) {
            totalSpent.textContent = `$${this.formatCurrency(totalAmount)}`;
        }

        // This month's spending
        const now = new Date();
        const currentMonth = now.getMonth();
        const currentYear = now.getFullYear();
        const monthlyPurchases = purchases.filter(p => {
            const date = new Date(p.date);
            return date.getMonth() === currentMonth && date.getFullYear() === currentYear;
        });
        const monthlyAmount = monthlyPurchases.reduce((sum, p) => sum + (parseFloat(p.amount) || 0), 0);
        const monthlySpent = document.getElementById('monthlySpent');
        if (monthlySpent) {
            monthlySpent.textContent = `$${this.formatCurrency(monthlyAmount)}`;
        }

        // Unique providers
        const providers = new Set(purchases.map(p => p.provider));
        const uniqueProviders = document.getElementById('uniqueProviders');
        if (uniqueProviders) {
            uniqueProviders.textContent = providers.size;
        }
    },

    async populateProviderFilter() {
        const select = document.getElementById('purchaseFilterProvider');
        if (!select) return;

        const purchases = this.allRecords.length > 0 ? this.allRecords : await this.getPurchases();
        const providers = [...new Set(purchases.map(p => p.provider))].sort();

        // Keep the "Todos" option and add providers
        select.innerHTML = '<option value="">Todos</option>' +
            providers.map(p => `<option value="${p}">${p}</option>`).join('');
    },

    filterRecords(records) {
        let filtered = [...records];

        if (this.filters.dateFrom) {
            filtered = filtered.filter(r => r.date >= this.filters.dateFrom);
        }
        if (this.filters.dateTo) {
            filtered = filtered.filter(r => r.date <= this.filters.dateTo);
        }
        if (this.filters.provider) {
            filtered = filtered.filter(r => r.provider === this.filters.provider);
        }

        return filtered;
    },

    applyFilters() {
        const dateFrom = document.getElementById('purchaseFilterDateFrom');
        const dateTo = document.getElementById('purchaseFilterDateTo');
        const provider = document.getElementById('purchaseFilterProvider');

        this.filters.dateFrom = dateFrom ? dateFrom.value : null;
        this.filters.dateTo = dateTo ? dateTo.value : null;
        this.filters.provider = provider ? provider.value : '';

        this.updateTable();
    },

    clearFilters() {
        const dateFrom = document.getElementById('purchaseFilterDateFrom');
        const dateTo = document.getElementById('purchaseFilterDateTo');
        const provider = document.getElementById('purchaseFilterProvider');

        if (dateFrom) dateFrom.value = '';
        if (dateTo) dateTo.value = '';
        if (provider) provider.value = '';

        this.filters = {
            dateFrom: null,
            dateTo: null,
            provider: ''
        };

        this.updateTable();
    },

    async deletePurchase(id) {
        if (!confirm('¿Está seguro de eliminar esta compra?')) return;

        try {
            const { error } = await supabaseClient
                .from('purchases')
                .delete()
                .eq('id', id);

            if (error) throw error;

            Utils.showToast('Compra eliminada');
            await this.render();
        } catch (error) {
            console.error('Error deleting purchase:', error);
            Utils.showToast('Error al eliminar la compra', 'error');
        }
    },

    formatCurrency(amount) {
        return new Intl.NumberFormat('es-CO', {
            minimumFractionDigits: 0,
            maximumFractionDigits: 0
        }).format(amount);
    },

    getPaymentMethodClass(method) {
        switch (method) {
            case 'Efectivo': return 'status-delivered';
            case 'Transferencia': return 'status-transit';
            case 'Nequi': return 'status-transit';
            case 'Daviplata': return 'status-transit';
            case 'Tarjeta': return 'status-processing';
            case 'Crédito': return 'status-cancelled';
            default: return '';
        }
    }
};

window.PurchasesModule = PurchasesModule;
