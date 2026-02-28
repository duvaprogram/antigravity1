// ========================================
// Payments Module
// ========================================

const PaymentsModule = {
    payments: [],
    availableGuides: [],
    selectedGuideIds: new Set(),

    init() {
        this.bindEvents();
    },

    bindEvents() {
        document.getElementById('btnNewPayment')?.addEventListener('click', () => this.showPaymentModal());

        document.getElementById('formPayment')?.addEventListener('submit', (e) => this.handlePaymentSubmit(e));

        document.getElementById('paymentOrigin')?.addEventListener('change', (e) => {
            const customGroup = document.getElementById('paymentOriginCustomGroup');
            if (e.target.value === 'Otro') {
                customGroup.style.display = 'block';
                document.getElementById('paymentOriginCustom').required = true;
            } else {
                customGroup.style.display = 'none';
                document.getElementById('paymentOriginCustom').required = false;
            }
        });

        // Search inputs for guides in the modal
        document.getElementById('searchPaymentGuides')?.addEventListener('input', () => this.filterModalGuides());
        document.getElementById('filterPaymentGuideCity')?.addEventListener('change', () => this.filterModalGuides());
        document.getElementById('filterPaymentGuideDateStart')?.addEventListener('change', () => this.filterModalGuides());
        document.getElementById('filterPaymentGuideDateEnd')?.addEventListener('change', () => this.filterModalGuides());

        // Select all checkbox
        document.getElementById('selectAllPaymentGuides')?.addEventListener('change', (e) => {
            const checkboxes = document.querySelectorAll('.payment-guide-checkbox:not(:disabled)');
            checkboxes.forEach(cb => {
                cb.checked = e.target.checked;
                if (cb.checked) {
                    this.selectedGuideIds.add(cb.value);
                } else {
                    this.selectedGuideIds.delete(cb.value);
                }
            });
            this.updateSelectedCount();
        });
    },

    async render() {
        App.showLoading(true);
        try {
            await this.loadPayments();
            this.renderPaymentsTable();
        } catch (error) {
            console.error('Error rendering payments:', error);
            Utils.showToast('Error al cargar pagos', 'error');
        } finally {
            App.showLoading(false);
        }
    },

    async loadPayments() {
        const { data, error } = await window.supabaseClient
            .from('payments')
            .select(`
                *,
                payment_guides (
                    guides ( id, guide_number, total_amount, city_id, created_at, clients ( full_name ), cities ( name ) )
                )
            `)
            .order('created_at', { ascending: false });

        if (error) throw error;
        this.payments = data || [];
    },

    renderPaymentsTable() {
        const tbody = document.getElementById('paymentsTable');
        if (!tbody) return;

        if (this.payments.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="6" class="text-center text-muted">No hay pagos registrados.</td>
                </tr>
            `;
            return;
        }

        tbody.innerHTML = this.payments.map(payment => {
            const date = new Date(payment.created_at).toLocaleDateString('es-EC');
            const amount = parseFloat(payment.amount).toFixed(2);
            const currency = payment.currency || 'USD';
            const currencySymbol = currency === 'COP' ? 'COP $' : '$';
            const guidesCount = payment.payment_guides ? payment.payment_guides.length : 0;
            const originText = payment.origin || 'N/A';

            // Format guides preview
            let guidesPreview = 'Ninguna';
            if (guidesCount > 0) {
                const guideNos = payment.payment_guides
                    .slice(0, 3)
                    .map(pg => pg.guides?.guide_number)
                    .filter(Boolean)
                    .join(', ');
                guidesPreview = `${guidesCount} guías (${guideNos}${guidesCount > 3 ? '...' : ''})`;
            }

            return `
                <tr>
                    <td><strong>${payment.code}</strong></td>
                    <td>${date}</td>
                    <td><span class="badge" style="background: var(--surface-hover); color: var(--text-primary);">${originText}</span></td>
                    <td style="color: var(--success); font-weight: 500;">${currencySymbol}${amount}</td>
                    <td><small>${guidesPreview}</small></td>
                    <td>
                        <button class="btn btn-icon btn-sm" onclick="PaymentsModule.viewPayment('${payment.id}')" title="Ver detalle">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                                <circle cx="12" cy="12" r="3"></circle>
                            </svg>
                        </button>
                        <button class="btn btn-icon btn-sm" onclick="PaymentsModule.editPayment('${payment.id}')" title="Editar pago">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                            </svg>
                        </button>
                        <button class="btn btn-icon btn-sm text-danger" onclick="PaymentsModule.deletePayment('${payment.id}')" title="Eliminar pago">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <polyline points="3 6 5 6 21 6"></polyline>
                                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                            </svg>
                        </button>
                    </td>
                </tr>
            `;
        }).join('');
    },

    async showPaymentModal() {
        document.getElementById('modalPaymentTitle').textContent = 'Registrar Nuevo Pago';
        document.getElementById('formPayment').reset();
        document.getElementById('paymentId').value = '';
        document.getElementById('paymentOriginCustomGroup').style.display = 'none';
        document.getElementById('paymentDate').valueAsDate = new Date();

        document.getElementById('filterPaymentGuideDateStart').value = '';
        document.getElementById('filterPaymentGuideDateEnd').value = '';

        this.selectedGuideIds.clear();
        document.getElementById('selectAllPaymentGuides').checked = false;

        App.showLoading(true);
        try {
            await this.loadAvailableGuides();
            this.renderModalGuides();
        } catch (e) {
            console.error(e);
            Utils.showToast("Error al cargar guías", "error");
        } finally {
            App.showLoading(false);
            document.getElementById('modalPayment').classList.add('active');
            document.body.style.overflow = 'hidden';
            this.updateSelectedCount();
        }
    },

    async editPayment(paymentId) {
        const payment = this.payments.find(p => p.id === paymentId);
        if (!payment) return;

        document.getElementById('modalPaymentTitle').textContent = 'Editar Pago ' + payment.code;
        document.getElementById('paymentId').value = payment.id;

        let originSelect = document.getElementById('paymentOrigin');
        // Check if origin is one of the predefined options
        let isPredefined = Array.from(originSelect.options).some(opt => opt.value === payment.origin);

        if (isPredefined && payment.origin) {
            originSelect.value = payment.origin;
            document.getElementById('paymentOriginCustomGroup').style.display = 'none';
        } else {
            originSelect.value = 'Otro';
            document.getElementById('paymentOriginCustomGroup').style.display = 'block';
            document.getElementById('paymentOriginCustom').value = payment.origin || '';
        }

        document.getElementById('paymentAmount').value = payment.amount;
        document.getElementById('paymentCurrency').value = payment.currency || 'USD';
        document.getElementById('paymentDate').value = payment.created_at ? new Date(payment.created_at).toISOString().split('T')[0] : '';
        document.getElementById('paymentNotes').value = payment.notes || '';

        this.selectedGuideIds.clear();
        document.getElementById('selectAllPaymentGuides').checked = false;

        if (payment.payment_guides) {
            payment.payment_guides.forEach(pg => {
                if (pg.guides && pg.guides.id) {
                    this.selectedGuideIds.add(pg.guides.id);
                }
            });
        }

        App.showLoading(true);
        try {
            await this.loadAvailableGuides();
            this.renderModalGuides();
        } catch (e) {
            console.error(e);
            Utils.showToast("Error al cargar guías", "error");
        } finally {
            App.showLoading(false);
            document.getElementById('modalPayment').classList.add('active');
            document.body.style.overflow = 'hidden';
            this.updateSelectedCount();
        }
    },

    async loadAvailableGuides() {
        // Fetch all guides to let user search and select
        // In a real app we might only fetch unpaid guides. Here we fetch recent guides ordered by date.

        const { data, error } = await window.supabaseClient
            .from('v_guides_complete')
            .select(`
                *,
                guide_items ( products ( name ) )
            `)
            .order('created_at', { ascending: false })
            .limit(500); // Last 500 should be plenty for recent associations

        if (error) throw error;
        this.availableGuides = data || [];
    },

    renderModalGuides(guidesToRender = this.availableGuides) {
        const tbody = document.getElementById('paymentGuidesTableBody');
        if (!tbody) return;

        if (guidesToRender.length === 0) {
            tbody.innerHTML = `<tr><td colspan="6" class="text-center text-muted">No se encontraron guías</td></tr>`;
            return;
        }

        tbody.innerHTML = guidesToRender.map(guide => {
            const isChecked = this.selectedGuideIds.has(guide.id) ? 'checked' : '';
            const date = new Date(guide.created_at).toLocaleDateString();
            return `
                <tr>
                    <td>
                        <input type="checkbox" class="payment-guide-checkbox" value="${guide.id}" ${isChecked} onchange="PaymentsModule.toggleGuideSelection(this)">
                    </td>
                    <td><strong>${guide.guide_number}</strong></td>
                    <td>${date}</td>
                    <td><span class="city-badge ${guide.city_name?.toLowerCase()}">${guide.city_name}</span></td>
                    <td>${Utils.escapeHtml(guide.client_name || '')}</td>
                    <td>$${parseFloat(guide.total_amount || 0).toFixed(2)}</td>
                </tr>
            `;
        }).join('');

        // Update check-all state logic if needed
    },

    toggleGuideSelection(checkbox) {
        if (checkbox.checked) {
            this.selectedGuideIds.add(checkbox.value);
        } else {
            this.selectedGuideIds.delete(checkbox.value);
        }
        this.updateSelectedCount();
    },

    updateSelectedCount() {
        const el = document.getElementById('selectedGuidesCount');
        if (el) {
            el.textContent = this.selectedGuideIds.size;
        }
    },

    filterModalGuides() {
        const searchVal = document.getElementById('searchPaymentGuides').value.toLowerCase();
        const cityVal = document.getElementById('filterPaymentGuideCity').value;
        const dateStartVal = document.getElementById('filterPaymentGuideDateStart').value;
        const dateEndVal = document.getElementById('filterPaymentGuideDateEnd').value;

        const filtered = this.availableGuides.filter(g => {
            let matches = true;
            if (searchVal) {
                const guideNo = (g.guide_number || '').toLowerCase();
                const client = (g.client_name || '').toLowerCase();
                const productsStr = (g.guide_items || []).map(i => i.products?.name || '').join(' ').toLowerCase();

                if (!guideNo.includes(searchVal) && !client.includes(searchVal) && !productsStr.includes(searchVal)) {
                    matches = false;
                }
            }
            if (cityVal && g.city_name !== cityVal) matches = false;

            if (dateStartVal || dateEndVal) {
                const guideDate = new Date(g.created_at).toISOString().split('T')[0];
                if (dateStartVal && guideDate < dateStartVal) matches = false;
                if (dateEndVal && guideDate > dateEndVal) matches = false;
            }
            return matches;
        });

        this.renderModalGuides(filtered);
    },

    generatePaymentCode(origin) {
        let prefix = 'P-';
        const lowerOut = origin.toLowerCase();

        if (lowerOut.includes('ecuador')) prefix = 'PAY-EC-';
        else if (lowerOut.includes('venezuela') || lowerOut.includes('binance')) prefix = 'PAY-VE-';
        else if (lowerOut.includes('bogotá')) prefix = 'PAY-BOG-';
        else if (lowerOut.includes('medellín')) prefix = 'PAY-MED-';
        else if (lowerOut.includes('hoko')) return Math.floor(Math.random() * 65535).toString(16).toUpperCase().padStart(4, '0'); // e.g. 23F3

        const randomNum = Math.floor(Math.random() * 1000000).toString().padStart(6, '0');
        return `${prefix}${randomNum}`;
    },

    async handlePaymentSubmit(e) {
        e.preventDefault();

        const paymentId = document.getElementById('paymentId').value;
        const originSelect = document.getElementById('paymentOrigin').value;
        const originCustom = document.getElementById('paymentOriginCustom').value;
        const origin = originSelect === 'Otro' ? originCustom : originSelect;

        const amount = document.getElementById('paymentAmount').value;
        const currency = document.getElementById('paymentCurrency').value;
        const date = document.getElementById('paymentDate').value;
        const notes = document.getElementById('paymentNotes').value;

        App.showLoading(true);
        try {
            // Include created_at if possible
            let createdAtTarget = new Date(date);
            // set time to current time logic
            const now = new Date();
            createdAtTarget.setHours(now.getHours(), now.getMinutes(), now.getSeconds());

            let currentPaymentId = paymentId;

            if (currentPaymentId) {
                // UPDATE EXISTING
                const { error: payErr } = await window.supabaseClient
                    .from('payments')
                    .update({
                        amount: parseFloat(amount),
                        currency: currency,
                        origin: origin,
                        notes: notes,
                        created_at: createdAtTarget.toISOString()
                    })
                    .eq('id', currentPaymentId);

                if (payErr) throw payErr;

                // Remove all existing associations
                await window.supabaseClient.from('payment_guides').delete().eq('payment_id', currentPaymentId);

            } else {
                // INSERT NEW
                const paymentCode = this.generatePaymentCode(origin);
                const { data: newPayment, error: payErr } = await window.supabaseClient
                    .from('payments')
                    .insert({
                        code: paymentCode,
                        amount: parseFloat(amount),
                        currency: currency,
                        origin: origin,
                        notes: notes,
                        created_at: createdAtTarget.toISOString()
                    })
                    .select()
                    .single();

                if (payErr) throw payErr;
                currentPaymentId = newPayment.id;
            }

            // Insert new payment_guides associations (whether new or update)
            if (this.selectedGuideIds.size > 0) {
                const associations = Array.from(this.selectedGuideIds).map(guideId => ({
                    payment_id: currentPaymentId,
                    guide_id: guideId
                }));

                const { error: assocErr } = await window.supabaseClient
                    .from('payment_guides')
                    .insert(associations);

                if (assocErr) throw assocErr;
            }

            Utils.showToast(paymentId ? 'Pago actualizado correctamente' : 'Pago registrado correctamente', 'success');
            document.getElementById('modalPayment').classList.remove('active');
            document.body.style.overflow = '';

            this.render();

        } catch (error) {
            console.error('Error saving payment:', error);
            Utils.showToast('Error al guardar el pago', 'error');
        } finally {
            App.showLoading(false);
        }
    },

    async viewPayment(paymentId) {
        // Find payment data
        const payment = this.payments.find(p => p.id === paymentId);
        if (!payment) return;

        const guides = payment.payment_guides?.map(pg => pg.guides) || [];

        let guidesHtml = guides.length === 0 ? '<p>No hay guías asociadas a este pago.</p>' : `
            <table class="table" style="margin-top: 1rem;">
                <thead>
                    <tr><th>Nº Guía</th><th>Cliente</th><th>Total</th></tr>
                </thead>
                <tbody>
                    ${guides.map(g => `
                        <tr>
                            <td><strong>${g.guide_number}</strong></td>
                            <td>${Utils.escapeHtml(g.clients?.full_name || '')}</td>
                            <td>$${parseFloat(g.total_amount || 0).toFixed(2)}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        `;

        // Show in generic alert or custom modal mechanism that doesn't exist?
        // It's better to reuse ConfirmationModule's detail modal idea or custom HTML.
        // Let's show an alert or a little toast, wait, we can just inject into a generic modal if it existed.
        // We can just create a simple detail modal dynamically or use a prompt.

        // Better: create dynamic modal
        let modalEl = document.getElementById('dynamicDetailModal');
        if (!modalEl) {
            modalEl = document.createElement('div');
            modalEl.className = 'modal';
            modalEl.id = 'dynamicDetailModal';
            document.body.appendChild(modalEl);
        }

        modalEl.innerHTML = `
            <div class="modal-content" style="max-width: 600px;">
                <div class="modal-header">
                    <h2>Detalles de Pago: ${payment.code}</h2>
                    <button class="modal-close" onclick="document.getElementById('dynamicDetailModal').classList.remove('active'); document.body.style.overflow='';">&times;</button>
                </div>
                <div class="card-body">
                    <p><strong>Origen:</strong> ${payment.origin}</p>
                    <p><strong>Monto:</strong> ${(payment.currency === 'COP' ? 'COP $' : '$')}${parseFloat(payment.amount).toFixed(2)}</p>
                    <p><strong>Fecha:</strong> ${new Date(payment.created_at).toLocaleString()}</p>
                    <p><strong>Notas:</strong> ${Utils.escapeHtml(payment.notes || 'Ninguna')}</p>
                    
                    <h3 style="margin-top: 1rem;">Guías (Total: ${guides.length})</h3>
                    ${guidesHtml}
                </div>
            </div>
        `;

        modalEl.classList.add('active');
        document.body.style.overflow = 'hidden';
    },

    async deletePayment(id) {
        if (!confirm('¿Está seguro de eliminar este pago? Esta acción no se puede deshacer.')) return;

        App.showLoading(true);
        try {
            const { error } = await window.supabaseClient
                .from('payments')
                .delete()
                .eq('id', id);

            if (error) throw error;
            Utils.showToast('Pago eliminado correctamente', 'success');
            this.render();
        } catch (error) {
            console.error('Error deleting payment:', error);
            Utils.showToast('Error al eliminar pago', 'error');
        } finally {
            App.showLoading(false);
        }
    }
};

window.PaymentsModule = PaymentsModule;
