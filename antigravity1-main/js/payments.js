// ========================================
// Payments Module
// ========================================

const PaymentsModule = {
    payments: [],
    filteredPayments: [],
    availableGuides: [],
    selectedGuideIds: new Set(),
    selectedPaymentIds: new Set(),

    filters: {
        search: '',
        country: '',
        currency: '',
        dateStart: '',
        dateEnd: ''
    },

    _initialized: false,

    init() {
        if (this._initialized) return;
        this._initialized = true;
        this.bindEvents();
    },

    bindEvents() {
        // New Payment Button
        document.getElementById('btnNewPayment')?.addEventListener('click', () => this.showPaymentModal());

        // Payment Form Submit
        document.getElementById('formPayment')?.addEventListener('submit', (e) => this.handlePaymentSubmit(e));

        // Origin select in Modal (Smart auto-config)
        document.getElementById('paymentOrigin')?.addEventListener('change', (e) => {
            const val = e.target.value;
            const customGroup = document.getElementById('paymentOriginCustomGroup');
            const customInput = document.getElementById('paymentOriginCustom');
            const currencySelect = document.getElementById('paymentCurrency');
            const cityFilter = document.getElementById('filterPaymentGuideCity');

            if (val === 'Otro') {
                if (customGroup) customGroup.style.display = 'block';
                if (customInput) customInput.required = true;
            } else {
                if (customGroup) customGroup.style.display = 'none';
                if (customInput) customInput.required = false;
            }

            // Smart auto-preset for currency & modal guide city
            if (val.includes('Bogotá') || val.includes('Medellín') || val.includes('Hoko')) {
                if (currencySelect) currencySelect.value = 'COP';
                if (cityFilter) {
                    cityFilter.value = val.includes('Bogotá') ? 'Bogota' : val.includes('Medellín') ? 'Medellin' : '';
                    this.filterModalGuides();
                }
            } else if (val.includes('Ecuador')) {
                if (currencySelect) currencySelect.value = 'USD';
                if (cityFilter) {
                    cityFilter.value = 'Quito';
                    this.filterModalGuides();
                }
            } else if (val.includes('Venezuela') || val.includes('Binance')) {
                if (currencySelect) currencySelect.value = 'USD';
                if (cityFilter) {
                    cityFilter.value = 'Caracas';
                    this.filterModalGuides();
                }
            }
        });

        // Search & Filters in Main Payments Section
        document.getElementById('payFilterSearch')?.addEventListener('input', (e) => {
            this.filters.search = e.target.value.trim().toLowerCase();
            this.applyFilters();
        });

        document.getElementById('payFilterCountry')?.addEventListener('change', (e) => {
            this.filters.country = e.target.value;
            this.applyFilters();
        });

        document.getElementById('payFilterCurrency')?.addEventListener('change', (e) => {
            this.filters.currency = e.target.value;
            this.applyFilters();
        });

        document.getElementById('payFilterDateStart')?.addEventListener('change', (e) => {
            this.filters.dateStart = e.target.value;
            this.applyFilters();
        });

        document.getElementById('payFilterDateEnd')?.addEventListener('change', (e) => {
            this.filters.dateEnd = e.target.value;
            this.applyFilters();
        });

        document.getElementById('btnPayClearFilters')?.addEventListener('click', () => {
            this.clearFilters();
        });

        // Select All Checkbox in Table Header
        document.getElementById('selectAllPaymentsHeader')?.addEventListener('change', (e) => {
            this.selectAllPayments(e.target.checked);
        });

        // Floating Calculator Clear Button
        document.getElementById('btnCalcClearSelection')?.addEventListener('click', () => {
            this.clearPaymentSelection();
        });

        // Search inputs for guides in the modal
        document.getElementById('searchPaymentGuides')?.addEventListener('input', () => this.filterModalGuides());
        document.getElementById('filterPaymentGuideCity')?.addEventListener('change', () => this.filterModalGuides());
        document.getElementById('filterPaymentGuideDateStart')?.addEventListener('change', () => this.filterModalGuides());
        document.getElementById('filterPaymentGuideDateEnd')?.addEventListener('change', () => this.filterModalGuides());

        // Select all checkbox in Modal
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

    /**
     * Smart Country Detection from Origin, Notes and Associated Guide Cities
     */
    detectCountry(payment) {
        const origin = (payment.origin || '').toLowerCase();
        const notes = (payment.notes || '').toLowerCase();

        let guideCities = [];
        if (payment.payment_guides && Array.isArray(payment.payment_guides)) {
            guideCities = payment.payment_guides
                .map(pg => pg.guides?.cities?.name || pg.guides?.city_name || '')
                .filter(Boolean)
                .map(c => c.toLowerCase());
        }

        const combined = `${origin} ${notes} ${guideCities.join(' ')}`.normalize("NFD").replace(/[\u0300-\u036f]/g, "");

        // 1. Colombia detection (Bogota, Medellin, Cali, Barranquilla, Hoko, etc.)
        if (
            combined.includes('bogota') ||
            combined.includes('medellin') ||
            combined.includes('cali') ||
            combined.includes('barranquilla') ||
            combined.includes('bucaramanga') ||
            combined.includes('colombia') ||
            combined.includes('hoko') ||
            combined.includes('domiciliarios bogota') ||
            combined.includes('domiciliarios medellin')
        ) {
            return {
                name: 'Colombia',
                flag: '🇨🇴',
                color: '#3b82f6',
                bg: 'rgba(59, 130, 246, 0.15)',
                border: 'rgba(59, 130, 246, 0.3)'
            };
        }

        // 2. Ecuador detection (Quito, Guayaquil, Cuenca, Machala, Ecuador, etc.)
        if (
            combined.includes('quito') ||
            combined.includes('guayaquil') ||
            combined.includes('cuenca') ||
            combined.includes('machala') ||
            combined.includes('ecuador') ||
            combined.includes('domicilios ecuador')
        ) {
            return {
                name: 'Ecuador',
                flag: '🇪🇨',
                color: '#f59e0b',
                bg: 'rgba(245, 158, 11, 0.15)',
                border: 'rgba(245, 158, 11, 0.3)'
            };
        }

        // 3. Venezuela detection (Caracas, Binance, Venezuela, Bolivares, etc.)
        if (
            combined.includes('caracas') ||
            combined.includes('maracaibo') ||
            combined.includes('valencia') ||
            combined.includes('venezuela') ||
            combined.includes('binance') ||
            combined.includes('bolivar') ||
            combined.includes(' bs')
        ) {
            return {
                name: 'Venezuela',
                flag: '🇻🇪',
                color: '#a855f7',
                bg: 'rgba(168, 85, 247, 0.15)',
                border: 'rgba(168, 85, 247, 0.3)'
            };
        }

        // 4. Default / Other
        return {
            name: 'Otro',
            flag: '🌐',
            color: '#94a3b8',
            bg: 'rgba(148, 163, 184, 0.15)',
            border: 'rgba(148, 163, 184, 0.3)'
        };
    },

    async render() {
        App.showLoading(true);
        try {
            await this.loadPayments();
            this.applyFilters();
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
                    guides ( id, guide_number, total_amount, shipping_cost, payment_bs, amount_usd, observations, status_id, guide_statuses ( name ), city_id, created_at, clients ( full_name ), cities ( name ) )
                )
            `)
            .order('created_at', { ascending: false });

        if (error) throw error;
        this.payments = data || [];
        this.filteredPayments = [...this.payments];
    },

    applyFilters() {
        const { search, country, currency, dateStart, dateEnd } = this.filters;

        this.filteredPayments = this.payments.filter(payment => {
            // 1. Search Query
            if (search) {
                const code = (payment.code || '').toLowerCase();
                const origin = (payment.origin || '').toLowerCase();
                const notes = (payment.notes || '').toLowerCase();
                const guidesStr = (payment.payment_guides || [])
                    .map(pg => `${pg.guides?.guide_number || ''} ${pg.guides?.clients?.full_name || ''}`)
                    .join(' ')
                    .toLowerCase();

                if (!code.includes(search) && !origin.includes(search) && !notes.includes(search) && !guidesStr.includes(search)) {
                    return false;
                }
            }

            // 2. Country Filter (Smart)
            if (country) {
                const detected = this.detectCountry(payment);
                if (detected.name !== country) {
                    return false;
                }
            }

            // 3. Currency Filter
            if (currency) {
                const payCurrency = (payment.currency || 'USD').toUpperCase();
                if (payCurrency !== currency.toUpperCase()) {
                    return false;
                }
            }

            // 4. Date Range Filter
            if (dateStart || dateEnd) {
                const payDate = payment.created_at ? new Date(payment.created_at).toISOString().split('T')[0] : '';
                if (dateStart && payDate < dateStart) return false;
                if (dateEnd && payDate > dateEnd) return false;
            }

            return true;
        });

        this.renderPaymentsDashboard(this.filteredPayments);
        this.renderPaymentsTable();
        this.updateCalculatorWidget();
    },

    clearFilters() {
        this.filters = { search: '', country: '', currency: '', dateStart: '', dateEnd: '' };

        const searchEl = document.getElementById('payFilterSearch');
        if (searchEl) searchEl.value = '';

        const countryEl = document.getElementById('payFilterCountry');
        if (countryEl) countryEl.value = '';

        const currEl = document.getElementById('payFilterCurrency');
        if (currEl) currEl.value = '';

        const dStartEl = document.getElementById('payFilterDateStart');
        if (dStartEl) dStartEl.value = '';

        const dEndEl = document.getElementById('payFilterDateEnd');
        if (dEndEl) dEndEl.value = '';

        this.applyFilters();
    },

    /**
     * Render the Multi-Currency Payments Dashboard
     */
    renderPaymentsDashboard(paymentsList = this.filteredPayments) {
        let totalUsd = 0;
        let countUsd = 0;
        let totalCop = 0;
        let countCop = 0;
        let totalGuides = 0;

        const countryMap = {
            'Colombia': { count: 0, usd: 0, cop: 0, flag: '🇨🇴' },
            'Ecuador': { count: 0, usd: 0, cop: 0, flag: '🇪🇨' },
            'Venezuela': { count: 0, usd: 0, cop: 0, flag: '🇻🇪' },
            'Otro': { count: 0, usd: 0, cop: 0, flag: '🌐' }
        };

        paymentsList.forEach(payment => {
            const amount = parseFloat(payment.amount || 0);
            const currency = (payment.currency || 'USD').toUpperCase();
            const guidesCount = payment.payment_guides ? payment.payment_guides.length : 0;
            totalGuides += guidesCount;

            const countryInfo = this.detectCountry(payment);
            const countryKey = countryMap[countryInfo.name] ? countryInfo.name : 'Otro';

            countryMap[countryKey].count++;

            if (currency === 'COP') {
                totalCop += amount;
                countCop++;
                countryMap[countryKey].cop += amount;
            } else {
                totalUsd += amount;
                countUsd++;
                countryMap[countryKey].usd += amount;
            }
        });

        // 1. Total USD Card
        const elUsd = document.getElementById('payStatTotalUsd');
        if (elUsd) {
            elUsd.textContent = `$${totalUsd.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
        }
        const elCountUsd = document.getElementById('payStatCountUsd');
        if (elCountUsd) {
            elCountUsd.textContent = `${countUsd} pago${countUsd === 1 ? '' : 's'} en USD`;
        }

        // 2. Total COP Card
        const elCop = document.getElementById('payStatTotalCop');
        if (elCop) {
            elCop.textContent = `COP $${Math.round(totalCop).toLocaleString('es-CO')}`;
        }
        const elCountCop = document.getElementById('payStatCountCop');
        if (elCountCop) {
            elCountCop.textContent = `${countCop} pago${countCop === 1 ? '' : 's'} en COP`;
        }

        // 3. Total Guides Card
        const elGuides = document.getElementById('payStatTotalGuides');
        if (elGuides) {
            elGuides.textContent = totalGuides.toLocaleString();
        }
        const elTotalPayments = document.getElementById('payStatTotalPayments');
        if (elTotalPayments) {
            elTotalPayments.textContent = `${paymentsList.length} pago${paymentsList.length === 1 ? '' : 's'} registrados`;
        }

        // 4. Country Breakdown Card
        const elBreakdown = document.getElementById('payStatCountryBreakdown');
        if (elBreakdown) {
            const activeCountries = Object.entries(countryMap).filter(([_, data]) => data.count > 0);
            if (activeCountries.length === 0) {
                elBreakdown.innerHTML = `<span style="color: var(--text-muted);">Sin pagos en el filtro</span>`;
            } else {
                elBreakdown.innerHTML = activeCountries.map(([name, data]) => {
                    let amountText = '';
                    if (data.usd > 0 && data.cop > 0) {
                        amountText = `$${data.usd.toFixed(0)} + COP $${(data.cop / 1000000).toFixed(1)}M`;
                    } else if (data.cop > 0) {
                        amountText = `COP $${Math.round(data.cop).toLocaleString('es-CO')}`;
                    } else {
                        amountText = `$${data.usd.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
                    }

                    return `
                        <div style="display: flex; justify-content: space-between; align-items: center;">
                            <span>${data.flag} <strong>${name}</strong> <small style="color: var(--text-muted);">(${data.count})</small></span>
                            <span style="font-weight: 600; color: var(--text-primary);">${amountText}</span>
                        </div>
                    `;
                }).join('');
            }
        }
    },

    /**
     * Render Payments Table with Checkboxes and Smart Country Badges
     */
    renderPaymentsTable() {
        const tbody = document.getElementById('paymentsTable');
        if (!tbody) return;

        if (this.filteredPayments.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="7" class="text-center text-muted" style="padding: 2.5rem 1rem;">
                        <div style="font-size: 2rem; margin-bottom: 0.5rem; opacity: 0.6;">🔍</div>
                        <div>No se encontraron pagos con los filtros seleccionados.</div>
                    </td>
                </tr>
            `;
            const headerCb = document.getElementById('selectAllPaymentsHeader');
            if (headerCb) headerCb.checked = false;
            return;
        }

        // Check if all filtered payments are currently selected
        const allFilteredSelected = this.filteredPayments.length > 0 && this.filteredPayments.every(p => this.selectedPaymentIds.has(p.id));
        const headerCb = document.getElementById('selectAllPaymentsHeader');
        if (headerCb) headerCb.checked = allFilteredSelected;

        tbody.innerHTML = this.filteredPayments.map(payment => {
            const isSelected = this.selectedPaymentIds.has(payment.id);
            const date = payment.created_at ? new Date(payment.created_at).toLocaleDateString('es-EC') : 'N/A';
            const amountNum = parseFloat(payment.amount || 0);
            const currency = (payment.currency || 'USD').toUpperCase();
            const isCop = currency === 'COP';
            const guidesCount = payment.payment_guides ? payment.payment_guides.length : 0;
            const originText = payment.origin || 'N/A';

            // Smart country detection
            const countryInfo = this.detectCountry(payment);

            // Format guides preview
            let guidesPreview = '<span style="color: var(--text-muted);">Ninguna</span>';
            if (guidesCount > 0) {
                const guideNos = payment.payment_guides
                    .slice(0, 3)
                    .map(pg => pg.guides?.guide_number)
                    .filter(Boolean)
                    .join(', ');
                guidesPreview = `<strong>${guidesCount}</strong> guías <small style="color: var(--text-muted);">(${guideNos}${guidesCount > 3 ? '...' : ''})</small>`;
            }

            const formattedAmount = isCop
                ? `COP $${Math.round(amountNum).toLocaleString('es-CO')}`
                : `$${amountNum.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

            const rowStyle = isSelected ? 'background: rgba(139, 92, 246, 0.08);' : '';

            return `
                <tr style="${rowStyle}">
                    <td style="text-align: center;">
                        <input type="checkbox" class="payment-row-checkbox" value="${payment.id}" ${isSelected ? 'checked' : ''} onchange="PaymentsModule.togglePaymentSelection('${payment.id}', this.checked)">
                    </td>
                    <td><strong style="color: var(--primary, #8b5cf6); font-family: monospace; font-size: 0.95rem;">${payment.code}</strong></td>
                    <td>${date}</td>
                    <td>
                        <div style="display: flex; align-items: center; gap: 6px; flex-wrap: wrap;">
                            <span class="badge" style="background: ${countryInfo.bg}; color: ${countryInfo.color}; border: 1px solid ${countryInfo.border}; font-weight: 600; font-size: 0.75rem; padding: 2px 7px; border-radius: 6px;">
                                ${countryInfo.flag} ${countryInfo.name}
                            </span>
                            <span style="font-size: 0.85rem; color: var(--text-secondary);">${Utils.escapeHtml(originText)}</span>
                        </div>
                    </td>
                    <td>
                        <span style="font-weight: 700; font-size: 1rem; color: ${isCop ? '#60a5fa' : 'var(--success, #10b981)'};">
                            ${formattedAmount}
                        </span>
                        <span class="badge" style="font-size: 0.68rem; margin-left: 4px; background: rgba(255,255,255,0.06); color: var(--text-muted);">${currency}</span>
                    </td>
                    <td><small>${guidesPreview}</small></td>
                    <td>
                        <div style="display: flex; gap: 4px;">
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
                        </div>
                    </td>
                </tr>
            `;
        }).join('');
    },

    /**
     * Toggle individual payment checkbox selection
     */
    togglePaymentSelection(paymentId, isChecked) {
        if (isChecked) {
            this.selectedPaymentIds.add(paymentId);
        } else {
            this.selectedPaymentIds.delete(paymentId);
        }
        this.updateCalculatorWidget();
        this.renderPaymentsTable();
    },

    /**
     * Select / Deselect all visible filtered payments
     */
    selectAllPayments(isChecked) {
        if (isChecked) {
            this.filteredPayments.forEach(p => this.selectedPaymentIds.add(p.id));
        } else {
            this.filteredPayments.forEach(p => this.selectedPaymentIds.delete(p.id));
        }
        this.updateCalculatorWidget();
        this.renderPaymentsTable();
    },

    /**
     * Clear all payment selections
     */
    clearPaymentSelection() {
        this.selectedPaymentIds.clear();
        this.updateCalculatorWidget();
        this.renderPaymentsTable();
    },

    /**
     * Update Live Floating Calculator Widget
     */
    updateCalculatorWidget() {
        const widget = document.getElementById('paymentsFloatingCalculator');
        if (!widget) return;

        const count = this.selectedPaymentIds.size;
        if (count === 0) {
            widget.style.display = 'none';
            return;
        }

        let sumUsd = 0;
        let sumCop = 0;

        this.selectedPaymentIds.forEach(id => {
            const payment = this.payments.find(p => p.id === id);
            if (payment) {
                const amount = parseFloat(payment.amount || 0);
                const curr = (payment.currency || 'USD').toUpperCase();
                if (curr === 'COP') {
                    sumCop += amount;
                } else {
                    sumUsd += amount;
                }
            }
        });

        widget.style.display = 'block';

        const countEl = document.getElementById('calcSelectedCount');
        if (countEl) countEl.textContent = count;

        const sumUsdEl = document.getElementById('calcSumUsd');
        if (sumUsdEl) {
            sumUsdEl.textContent = `$${sumUsd.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
        }

        const sumCopEl = document.getElementById('calcSumCop');
        if (sumCopEl) {
            sumCopEl.textContent = `COP $${Math.round(sumCop).toLocaleString('es-CO')}`;
        }
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
        const { data, error } = await window.supabaseClient
            .from('v_guides_complete')
            .select(`
                *,
                guide_items ( products ( name ) )
            `)
            .order('created_at', { ascending: false })
            .limit(500);

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
            const bsVal = parseFloat(guide.payment_bs || guide.paymentBs || 0);
            const hasBs = !isNaN(bsVal) && bsVal > 0;
            return `
                <tr>
                    <td>
                        <input type="checkbox" class="payment-guide-checkbox" value="${guide.id}" ${isChecked} onchange="PaymentsModule.toggleGuideSelection(this)">
                    </td>
                    <td><strong>${guide.guide_number}</strong></td>
                    <td>${date}</td>
                    <td><span class="city-badge ${guide.city_name?.toLowerCase()}">${guide.city_name}</span></td>
                    <td>${Utils.escapeHtml(guide.client_name || '')}</td>
                    <td>
                        <div>$${parseFloat(guide.total_amount || 0).toFixed(2)}</div>
                        ${hasBs ? `<small style="color: #a78bfa; font-weight: 600; display: block;">${bsVal.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} Bs</small>` : ''}
                    </td>
                </tr>
            `;
        }).join('');
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
            if (cityVal && g.city_name !== cityVal) {
                matches = false;
            }
            if (dateStartVal) {
                const guideDate = new Date(g.created_at);
                const startDate = new Date(dateStartVal);
                if (guideDate < startDate) matches = false;
            }
            if (dateEndVal) {
                const guideDate = new Date(g.created_at);
                const endDate = new Date(dateEndVal);
                endDate.setHours(23, 59, 59, 999);
                if (guideDate > endDate) matches = false;
            }
            return matches;
        });

        this.renderModalGuides(filtered);
    },

    async viewPayment(paymentId) {
        const payment = this.payments.find(p => p.id === paymentId);
        if (!payment) return;

        let guides = payment.payment_guides?.map(pg => pg.guides).filter(Boolean) || [];

        const isReturnOrCancel = (g) => {
            const st = (g.status || g.status_name || g.guide_statuses?.name || '').toLowerCase().trim();
            return st.includes('devol') || st.includes('cancel');
        };

        try {
            if (window.Database && typeof window.Database.getGuides === 'function') {
                const allDbGuides = await window.Database.getGuides();
                if (allDbGuides && allDbGuides.length > 0) {
                    guides = guides.map(g => {
                        const full = allDbGuides.find(dbG => dbG.id === g.id || dbG.guideNumber === g.guide_number);
                        const statusName = full?.status || g.guide_statuses?.name || g.status_name || g.status || '';
                        if (full) {
                            return {
                                ...g,
                                status: statusName,
                                statusColor: full.statusColor,
                                payment_bs: (g.payment_bs !== undefined && g.payment_bs !== null && g.payment_bs !== '') ? g.payment_bs : full.paymentBs,
                                amount_usd: (g.amount_usd !== undefined && g.amount_usd !== null) ? g.amount_usd : full.amountUsd,
                                total_amount: g.total_amount ?? full.totalAmount,
                                shipping_cost: g.shipping_cost ?? full.shippingCost,
                                clients: g.clients || { full_name: full.clientName },
                                observations: g.observations ?? full.observations
                            };
                        }
                        return {
                            ...g,
                            status: statusName
                        };
                    });
                }
            }
        } catch (e) {
            console.warn('Error enriching payment guides:', e);
        }

        const effectiveGuides = guides.filter(g => !isReturnOrCancel(g));
        const devolucionGuides = guides.filter(g => isReturnOrCancel(g));

        const totalDollars = effectiveGuides.reduce((sum, g) => sum + (parseFloat(g.total_amount || g.amount_usd || 0) || 0), 0);
        const totalBs = effectiveGuides.reduce((sum, g) => {
            const val = parseFloat(g.payment_bs || g.paymentBs || 0);
            return sum + (isNaN(val) ? 0 : val);
        }, 0);
        const totalFlete = guides.reduce((sum, g) => sum + (parseFloat(g.shipping_cost || g.shippingCost || 0) || 0), 0);

        const formatBs = (num) => {
            return num.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' Bs';
        };

        const formatUsd = (num) => {
            return '$' + num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        };

        const countryInfo = this.detectCountry(payment);

        let guidesHtml = guides.length === 0 ? '<p class="text-muted" style="padding: 1rem 0;">No hay guías asociadas a este pago.</p>' : `
            <div style="overflow-x: auto; margin-top: 1rem; border-radius: var(--radius-md); border: 1px solid var(--border);">
                <table class="table" style="margin: 0; width: 100%; font-size: 0.9rem;">
                    <thead>
                        <tr style="background: var(--surface-hover, rgba(255,255,255,0.04));">
                            <th style="padding: 0.75rem 0.6rem;">Nº Guía</th>
                            <th style="padding: 0.75rem 0.6rem;">Cliente</th>
                            <th style="padding: 0.75rem 0.6rem; text-align: right;">Total ($)</th>
                            <th style="padding: 0.75rem 0.6rem; text-align: right;">Pago en Bolívares</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${guides.map(g => {
                            const isDevol = isReturnOrCancel(g);
                            const bsVal = parseFloat(g.payment_bs || g.paymentBs || 0);
                            const hasBs = !isNaN(bsVal) && bsVal > 0;
                            const totalUsd = parseFloat(g.total_amount || g.amount_usd || 0);

                            if (isDevol) {
                                return `
                                <tr style="background: rgba(249, 115, 22, 0.06);">
                                    <td style="padding: 0.75rem 0.6rem;"><strong>${g.guide_number}</strong></td>
                                    <td style="padding: 0.75rem 0.6rem;">
                                        <div style="display: flex; align-items: center; gap: 6px; flex-wrap: wrap;">
                                            <span>${Utils.escapeHtml(g.clients?.full_name || 'N/A')}</span>
                                            <span class="badge" style="background: rgba(249, 115, 22, 0.15); color: #f97316; font-size: 0.72rem; font-weight: 600; padding: 2px 6px; border-radius: 4px; border: 1px solid rgba(249, 115, 22, 0.3);">Devolución</span>
                                        </div>
                                    </td>
                                    <td style="padding: 0.75rem 0.6rem; text-align: right;">
                                        <div style="text-decoration: line-through; opacity: 0.5; color: var(--text-muted); font-size: 0.85rem;">${formatUsd(totalUsd)}</div>
                                        <div style="font-size: 0.72rem; color: #f97316; font-weight: 600;">$0.00 (No suma)</div>
                                    </td>
                                    <td style="padding: 0.75rem 0.6rem; text-align: right;">
                                        ${hasBs 
                                            ? `<div style="text-decoration: line-through; opacity: 0.5; color: var(--text-muted); font-size: 0.85rem;">${formatBs(bsVal)}</div><div style="font-size: 0.72rem; color: #f97316; font-weight: 600;">0.00 Bs (No suma)</div>`
                                            : `<span style="color: var(--text-muted);">-</span>`
                                        }
                                    </td>
                                </tr>
                                `;
                            }

                            return `
                            <tr>
                                <td style="padding: 0.75rem 0.6rem;"><strong>${g.guide_number}</strong></td>
                                <td style="padding: 0.75rem 0.6rem;">${Utils.escapeHtml(g.clients?.full_name || 'N/A')}</td>
                                <td style="padding: 0.75rem 0.6rem; text-align: right; font-weight: 600; color: var(--success);">${formatUsd(totalUsd)}</td>
                                <td style="padding: 0.75rem 0.6rem; text-align: right;">
                                    ${hasBs 
                                        ? `<span class="badge" style="background: rgba(167, 139, 250, 0.15); color: #a78bfa; font-weight: 600; padding: 3px 8px; border-radius: 6px; border: 1px solid rgba(167, 139, 250, 0.3);">${formatBs(bsVal)}</span>`
                                        : `<span style="color: var(--text-muted);">-</span>`
                                    }
                                </td>
                            </tr>
                            `;
                        }).join('')}
                    </tbody>
                    <tfoot>
                        <tr style="border-top: 2px solid var(--border); font-weight: 700; background: var(--surface-hover, rgba(255,255,255,0.06));">
                            <td colspan="2" style="padding: 0.85rem 0.6rem;">
                                <div style="text-transform: uppercase; font-size: 0.82rem; letter-spacing: 0.5px;">TOTALES (${effectiveGuides.length} cobradas / ${guides.length} guías)</div>
                                ${devolucionGuides.length > 0 ? `<div style="font-size: 0.72rem; color: #f97316; font-weight: normal; margin-top: 3px;">⚠️ ${devolucionGuides.length} pedido(s) en Devolución no suman a los cobros</div>` : ''}
                            </td>
                            <td style="padding: 0.85rem 0.6rem; text-align: right; color: var(--success); font-size: 1rem;">${formatUsd(totalDollars)}</td>
                            <td style="padding: 0.85rem 0.6rem; text-align: right; color: #a78bfa; font-size: 1rem;">${totalBs > 0 ? formatBs(totalBs) : '-'}</td>
                        </tr>
                    </tfoot>
                </table>
            </div>

            <div style="margin-top: 1.25rem; padding: 1rem 1.25rem; background: var(--surface-hover, rgba(255,255,255,0.03)); border-radius: var(--radius-md); border: 1px solid var(--border); display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 1rem;">
                <div>
                    <div style="font-size: 0.72rem; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 2px;">Total Guías</div>
                    <div style="font-size: 1.25rem; font-weight: 700; color: var(--text-primary);">${guides.length} <span style="font-size: 0.8rem; font-weight: normal; color: var(--text-muted);">(${effectiveGuides.length} cobradas)</span></div>
                    ${devolucionGuides.length > 0 ? `<div style="font-size: 0.7rem; color: #f97316; margin-top: 2px;">${devolucionGuides.length} en devolución</div>` : ''}
                </div>
                <div>
                    <div style="font-size: 0.72rem; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 2px;">Total Dólares ($)</div>
                    <div style="font-size: 1.25rem; font-weight: 700; color: var(--success, #10b981);">${formatUsd(totalDollars)}</div>
                </div>
                <div>
                    <div style="font-size: 0.72rem; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 2px;">Total Bolívares (Bs)</div>
                    <div style="font-size: 1.25rem; font-weight: 700; color: #a78bfa;">${formatBs(totalBs)}</div>
                </div>
                <div>
                    <div style="font-size: 0.72rem; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 2px;">Total Flete ($)</div>
                    <div style="font-size: 1.25rem; font-weight: 700; color: var(--info, #38bdf8);">${formatUsd(totalFlete)}</div>
                </div>
            </div>
        `;

        let modalEl = document.getElementById('dynamicDetailModal');
        if (!modalEl) {
            modalEl = document.createElement('div');
            modalEl.className = 'modal';
            modalEl.id = 'dynamicDetailModal';
            document.body.appendChild(modalEl);
        }

        const isCop = (payment.currency || 'USD').toUpperCase() === 'COP';
        const formattedPayAmount = isCop
            ? `COP $${Math.round(parseFloat(payment.amount || 0)).toLocaleString('es-CO')}`
            : `$${parseFloat(payment.amount || 0).toFixed(2)}`;

        modalEl.innerHTML = `
            <div class="modal-content" style="max-width: 700px;">
                <div class="modal-header">
                    <h2>Detalles de Pago: ${payment.code}</h2>
                    <button class="modal-close" onclick="document.getElementById('dynamicDetailModal').classList.remove('active'); document.body.style.overflow='';">&times;</button>
                </div>
                <div class="card-body">
                    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 0.75rem; margin-bottom: 1rem; padding-bottom: 1rem; border-bottom: 1px solid var(--border);">
                        <p style="margin: 0;">
                            <strong>País / Origen:</strong> 
                            <span class="badge" style="background: ${countryInfo.bg}; color: ${countryInfo.color}; border: 1px solid ${countryInfo.border}; margin-left: 4px;">
                                ${countryInfo.flag} ${countryInfo.name}
                            </span>
                            ${payment.origin ? ` - ${payment.origin}` : ''}
                        </p>
                        <p style="margin: 0;"><strong>Monto Recibido:</strong> <span style="color: ${isCop ? '#60a5fa' : 'var(--success)'}; font-weight: 600;">${formattedPayAmount}</span></p>
                        <p style="margin: 0;"><strong>Fecha:</strong> ${new Date(payment.created_at).toLocaleString()}</p>
                    </div>
                    <p style="margin-bottom: 1.25rem;"><strong>Notas:</strong> ${Utils.escapeHtml(payment.notes || 'Ninguna')}</p>
                    
                    <h3 style="margin-top: 1rem; font-size: 1.1rem; display: flex; align-items: center; justify-content: space-between;">
                        <span>Guías Vinculadas (${guides.length})</span>
                    </h3>
                    ${guidesHtml}
                </div>
            </div>
        `;

        modalEl.classList.add('active');
        document.body.style.overflow = 'hidden';
    },

    generatePaymentCode(origin) {
        let prefix = 'P-';
        const lowerOut = (origin || '').toLowerCase();

        if (lowerOut.includes('ecuador') || lowerOut.includes('quito') || lowerOut.includes('guayaquil')) prefix = 'PAY-EC-';
        else if (lowerOut.includes('venezuela') || lowerOut.includes('binance') || lowerOut.includes('caracas')) prefix = 'PAY-VE-';
        else if (lowerOut.includes('bogot')) prefix = 'PAY-BOG-';
        else if (lowerOut.includes('medell')) prefix = 'PAY-MED-';
        else if (lowerOut.includes('hoko')) return Math.floor(Math.random() * 65535).toString(16).toUpperCase().padStart(4, '0');

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
            let createdAtTarget = new Date(date);
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

            // Insert new payment_guides associations
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

            await this.render();

        } catch (error) {
            console.error('Error saving payment:', error);
            Utils.showToast('Error al guardar el pago', 'error');
        } finally {
            App.showLoading(false);
        }
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
            this.selectedPaymentIds.delete(id);
            Utils.showToast('Pago eliminado correctamente', 'success');
            await this.render();
        } catch (error) {
            console.error('Error deleting payment:', error);
            Utils.showToast('Error al eliminar pago', 'error');
        } finally {
            App.showLoading(false);
        }
    }
};

window.PaymentsModule = PaymentsModule;
