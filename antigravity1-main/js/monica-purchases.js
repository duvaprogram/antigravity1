// ========================================
// Compras Mónica
// Compras que hace Mónica en cada país. Una compra de Venezuela pagada con
// "Caja de Venezuela" descuenta de la caja en dólares de Venezuela.
// ========================================

const MonicaPurchasesModule = {
    COUNTRIES: {
        'Colombia': { flag: '🇨🇴', currency: 'COP' },
        'Ecuador': { flag: '🇪🇨', currency: 'USD' },
        'Venezuela': { flag: '🇻🇪', currency: 'USD' },
        'México': { flag: '🇲🇽', currency: 'MXN' },
        'Otro': { flag: '🌐', currency: 'USD' }
    },

    PAYMENT_METHODS: ['Caja de Venezuela', 'Efectivo', 'Transferencia', 'Binance', 'Tarjeta', 'Otro'],

    allRecords: [],

    filters: {
        country: '',
        method: '',
        dateFrom: '',
        dateTo: ''
    },

    _initialized: false,

    init() {
        if (this._initialized) return;
        this._initialized = true;
        this.bindEvents();
    },

    bindEvents() {
        document.getElementById('formMonicaPurchase')?.addEventListener('submit', (e) => {
            e.preventDefault();
            this.savePurchase();
        });

        document.getElementById('monicaPurchaseCountry')?.addEventListener('change', () => this.onCountryChange());
        document.getElementById('monicaPurchaseMethod')?.addEventListener('change', () => this.onMethodChange());

        const filterFields = {
            monicaFilterCountry: 'country',
            monicaFilterMethod: 'method',
            monicaFilterDateFrom: 'dateFrom',
            monicaFilterDateTo: 'dateTo'
        };
        Object.entries(filterFields).forEach(([elementId, key]) => {
            document.getElementById(elementId)?.addEventListener('change', (e) => {
                this.filters[key] = e.target.value;
                this.renderStats();
                this.renderTable();
            });
        });
    },

    async render() {
        App.showLoading(true);
        try {
            this.allRecords = await this.fetchRecords();
            this.renderStats();
            this.renderTable();
            await this.renderCaja();
        } catch (error) {
            console.error('Error loading Compras Mónica:', error);
            Utils.showToast('Error al cargar las compras de Mónica', 'error');
        } finally {
            App.showLoading(false);
        }
    },

    async fetchRecords() {
        const { data, error } = await window.supabaseClient
            .from('monica_purchases')
            .select('*')
            .order('date', { ascending: false })
            .order('created_at', { ascending: false });

        if (error) throw error;
        return data || [];
    },

    filteredRecords() {
        return this.allRecords.filter(r => {
            if (this.filters.country && r.country !== this.filters.country) return false;
            if (this.filters.method && r.payment_method !== this.filters.method) return false;
            if (this.filters.dateFrom && r.date < this.filters.dateFrom) return false;
            if (this.filters.dateTo && r.date > this.filters.dateTo) return false;
            return true;
        });
    },

    isCajaMethod(method) {
        return method === VenezuelaFX.CAJA_METODO;
    },

    affectsCaja(record) {
        return record.country === 'Venezuela' && this.isCajaMethod(record.payment_method);
    },

    formatMoney(amount, currency) {
        const n = Number(amount) || 0;
        const isCop = currency === 'COP';
        const digits = isCop ? 0 : 2;
        const locale = isCop ? 'es-CO' : 'en-US';
        const prefix = { COP: 'COP $', USD: '$', MXN: 'MXN $', VES: 'Bs ' }[currency] || `${currency} `;
        return prefix + n.toLocaleString(locale, { minimumFractionDigits: digits, maximumFractionDigits: digits });
    },

    renderStats() {
        const rows = this.filteredRecords();

        const countEl = document.getElementById('monicaStatCount');
        if (countEl) countEl.textContent = rows.length;

        const countSubEl = document.getElementById('monicaStatCountSub');
        if (countSubEl) countSubEl.textContent = `de ${this.allRecords.length} registradas`;

        const totals = {};
        rows.forEach(r => {
            totals[r.currency] = (totals[r.currency] || 0) + (Number(r.amount) || 0);
        });
        const totalEl = document.getElementById('monicaStatTotal');
        if (totalEl) {
            const parts = Object.entries(totals).map(([currency, amount]) => this.formatMoney(amount, currency));
            totalEl.textContent = parts.length ? parts.join(' · ') : '$0.00';
        }
    },

    async renderCaja() {
        const saldoEl = document.getElementById('monicaCajaSaldo');
        const detailEl = document.getElementById('monicaCajaDetail');
        if (!saldoEl || !detailEl) return;

        try {
            const caja = await VenezuelaFX.loadCaja();
            saldoEl.textContent = this.formatMoney(caja.saldo, 'USD');
            saldoEl.style.color = caja.saldo < 0 ? 'var(--danger)' : '#10b981';
            detailEl.textContent = `Entró ${this.formatMoney(caja.totalEntradas, 'USD')} · salió ${this.formatMoney(caja.totalSalidas, 'USD')} (desde el corte del 13 oct)`;
        } catch (error) {
            console.error('Error reading Venezuela cash box:', error);
            saldoEl.textContent = '—';
            detailEl.textContent = 'No se pudo leer la caja. Revisa que exista la tabla monica_purchases.';
        }
    },

    renderTable() {
        const tbody = document.getElementById('monicaPurchasesTable');
        if (!tbody) return;

        const rows = this.filteredRecords();

        const countEl = document.getElementById('monicaRecordCount');
        if (countEl) countEl.textContent = `${rows.length} de ${this.allRecords.length} registros`;

        if (!rows.length) {
            tbody.innerHTML = `<tr><td colspan="8" style="text-align: center; color: var(--text-muted); padding: 2rem;">No hay compras registradas</td></tr>`;
            return;
        }

        tbody.innerHTML = rows.map(r => {
            const country = this.COUNTRIES[r.country] || this.COUNTRIES.Otro;
            const cajaBadge = this.affectsCaja(r)
                ? ' <span class="status-badge pendiente" title="Descuenta de la caja en dólares de Venezuela">Caja VE</span>'
                : '';
            const quantity = r.quantity > 1 ? ` <small style="color: var(--text-muted);">(x${r.quantity})</small>` : '';

            return `
                <tr>
                    <td>${r.date}</td>
                    <td>${country.flag} ${Utils.escapeHtml(r.country)}</td>
                    <td>${Utils.escapeHtml(r.store || '-')}</td>
                    <td>${Utils.escapeHtml(r.description)}${quantity}</td>
                    <td style="font-weight: 600; color: var(--success);">${this.formatMoney(r.amount, r.currency)}</td>
                    <td>${Utils.escapeHtml(r.payment_method)}${cajaBadge}</td>
                    <td style="font-size: 0.85rem; color: var(--text-muted);">${Utils.escapeHtml(r.notes || '')}</td>
                    <td>
                        <div style="display: flex; gap: 0.5rem;">
                            <button class="btn btn-secondary btn-sm" onclick="MonicaPurchasesModule.openModal('${r.id}')">Editar</button>
                            <button class="btn btn-danger btn-sm" onclick="MonicaPurchasesModule.deletePurchase('${r.id}')">Eliminar</button>
                        </div>
                    </td>
                </tr>
            `;
        }).join('');
    },

    openModal(id = null) {
        const modal = document.getElementById('modalMonicaPurchase');
        const form = document.getElementById('formMonicaPurchase');
        if (!modal || !form) return;

        form.reset();
        document.getElementById('monicaPurchaseId').value = '';

        if (id) {
            const record = this.allRecords.find(r => r.id === id);
            if (!record) return;

            document.getElementById('modalMonicaPurchaseTitle').textContent = 'Editar Compra';
            document.getElementById('monicaPurchaseId').value = record.id;
            document.getElementById('monicaPurchaseDate').value = record.date;
            document.getElementById('monicaPurchaseCountry').value = record.country;
            document.getElementById('monicaPurchaseStore').value = record.store || '';
            document.getElementById('monicaPurchaseDescription').value = record.description;
            document.getElementById('monicaPurchaseQuantity').value = record.quantity || 1;
            document.getElementById('monicaPurchaseAmount').value = record.amount;
            document.getElementById('monicaPurchaseCurrency').value = record.currency || 'USD';
            document.getElementById('monicaPurchaseMethod').value = record.payment_method;
            document.getElementById('monicaPurchaseNotes').value = record.notes || '';
        } else {
            document.getElementById('modalMonicaPurchaseTitle').textContent = 'Nueva Compra';
            document.getElementById('monicaPurchaseDate').valueAsDate = new Date();
            document.getElementById('monicaPurchaseCountry').value = 'Colombia';
            document.getElementById('monicaPurchaseQuantity').value = 1;
            this.onCountryChange();
        }

        this.updateFormHint();
        modal.classList.add('active');
    },

    // Al cambiar de país se pone la moneda habitual de ese país
    onCountryChange() {
        const country = document.getElementById('monicaPurchaseCountry').value;
        const info = this.COUNTRIES[country];
        if (info) document.getElementById('monicaPurchaseCurrency').value = info.currency;
        this.updateFormHint();
    },

    // La caja de Venezuela siempre es en dólares
    onMethodChange() {
        const method = document.getElementById('monicaPurchaseMethod').value;
        if (this.isCajaMethod(method)) document.getElementById('monicaPurchaseCurrency').value = 'USD';
        this.updateFormHint();
    },

    updateFormHint() {
        const hint = document.getElementById('monicaPurchaseHint');
        if (!hint) return;

        const country = document.getElementById('monicaPurchaseCountry').value;
        const method = document.getElementById('monicaPurchaseMethod').value;
        const date = document.getElementById('monicaPurchaseDate').value;

        if (!this.isCajaMethod(method)) {
            hint.textContent = '';
        } else if (country !== 'Venezuela') {
            hint.innerHTML = '<span style="color: var(--warning);">⚠ La caja de Venezuela solo aplica a compras hechas en Venezuela.</span>';
        } else if (date && date < VenezuelaFX.CAJA_CORTE) {
            hint.innerHTML = `<span style="color: var(--warning);">⚠ Compras anteriores al ${VenezuelaFX.CAJA_CORTE} no descuentan de la caja.</span>`;
        } else {
            hint.textContent = 'Esta compra descuenta de la caja en dólares de Venezuela.';
        }
    },

    async savePurchase() {
        const id = document.getElementById('monicaPurchaseId').value;
        const date = document.getElementById('monicaPurchaseDate').value;
        const country = document.getElementById('monicaPurchaseCountry').value;
        const store = document.getElementById('monicaPurchaseStore').value.trim();
        const description = document.getElementById('monicaPurchaseDescription').value.trim();
        const quantity = parseInt(document.getElementById('monicaPurchaseQuantity').value) || 1;
        const amount = parseFloat(document.getElementById('monicaPurchaseAmount').value);
        const currency = document.getElementById('monicaPurchaseCurrency').value;
        const paymentMethod = document.getElementById('monicaPurchaseMethod').value;
        const notes = document.getElementById('monicaPurchaseNotes').value.trim();

        if (!date || !country || !description || !(amount > 0)) {
            Utils.showToast('Por favor complete los campos requeridos', 'error');
            return;
        }

        if (this.isCajaMethod(paymentMethod) && (country !== 'Venezuela' || currency !== 'USD')) {
            Utils.showToast('La caja de Venezuela es solo para compras en Venezuela y en dólares', 'error');
            return;
        }

        const record = {
            date,
            country,
            store: store || null,
            description,
            quantity,
            amount,
            currency,
            payment_method: paymentMethod,
            notes: notes || null
        };

        try {
            const request = id
                ? window.supabaseClient.from('monica_purchases').update(record).eq('id', id)
                : window.supabaseClient.from('monica_purchases').insert([record]);
            const { error } = await request;
            if (error) throw error;

            Utils.showToast(id ? 'Compra actualizada' : 'Compra registrada', 'success');
            document.getElementById('modalMonicaPurchase').classList.remove('active');
            await this.render();
        } catch (error) {
            console.error('Error saving Compras Mónica:', error);
            Utils.showToast('Error al guardar la compra', 'error');
        }
    },

    async deletePurchase(id) {
        if (!confirm('¿Está seguro de eliminar esta compra?')) return;

        try {
            const { error } = await window.supabaseClient
                .from('monica_purchases')
                .delete()
                .eq('id', id);
            if (error) throw error;

            Utils.showToast('Compra eliminada');
            await this.render();
        } catch (error) {
            console.error('Error deleting Compras Mónica:', error);
            Utils.showToast('Error al eliminar la compra', 'error');
        }
    }
};

window.MonicaPurchasesModule = MonicaPurchasesModule;
