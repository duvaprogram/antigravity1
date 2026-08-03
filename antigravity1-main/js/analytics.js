// ========================================
// Analytics Module (Async - Supabase)
// ========================================

const AnalyticsModule = {
    currentFilters: {
        dateFrom: null,
        dateTo: null,
        city: '',
        status: '',
        productId: ''
    },
    filteredGuides: [],
    allProducts: [],
    COST_FACTOR: 40000,

    _initialized: false,

    init() {
        if (this._initialized) return;
        this._initialized = true;
        this.bindEvents();
        this.setDefaultFilters();
    },

    bindEvents() {
        // Date filters
        document.getElementById('analyticsDateFrom').addEventListener('change', () => {
            this.currentFilters.dateFrom = document.getElementById('analyticsDateFrom').value;
            this.refreshData();
        });

        document.getElementById('analyticsDateTo').addEventListener('change', () => {
            this.currentFilters.dateTo = document.getElementById('analyticsDateTo').value;
            this.refreshData();
        });

        // City filter
        document.getElementById('analyticsCity').addEventListener('change', () => {
            this.currentFilters.city = document.getElementById('analyticsCity').value;
            this.refreshData();
        });

        // Status filter
        document.getElementById('analyticsStatus').addEventListener('change', () => {
            this.currentFilters.status = document.getElementById('analyticsStatus').value;
            this.refreshData();
        });

        // Product predictive search
        const productSearch = document.getElementById('analyticsProductSearch');
        const productHidden = document.getElementById('analyticsProduct');
        const suggestions = document.getElementById('analyticsProductSuggestions');

        if (productSearch) {
            productSearch.addEventListener('input', () => {
                const query = productSearch.value.toLowerCase().trim();

                if (query.length === 0) {
                    // Clear filter if empty
                    productHidden.value = '';
                    this.currentFilters.productId = '';
                    suggestions.style.display = 'none';
                    this.refreshData();
                    return;
                }

                // Filter products
                const matches = this.allProducts
                    .filter(p => p.active && p.name.toLowerCase().includes(query))
                    .slice(0, 10);

                if (matches.length > 0) {
                    suggestions.innerHTML = matches.map(p => `
                        <div class="suggestion-item" data-id="${p.id}" data-name="${Utils.escapeHtml(p.name)}"
                            style="padding: 0.75rem 1rem; cursor: pointer; border-bottom: 1px solid var(--border);
                            transition: background 0.2s;">
                            <div style="font-weight: 500;">${Utils.escapeHtml(p.name)}</div>
                            <div style="font-size: 0.75rem; color: var(--text-muted);">SKU: ${p.sku || 'N/A'}</div>
                        </div>
                    `).join('');
                    suggestions.style.display = 'block';

                    // Bind click events
                    suggestions.querySelectorAll('.suggestion-item').forEach(item => {
                        item.addEventListener('click', () => {
                            productSearch.value = item.dataset.name;
                            productHidden.value = item.dataset.id;
                            this.currentFilters.productId = item.dataset.id;
                            suggestions.style.display = 'none';
                            this.refreshData();
                        });
                        item.addEventListener('mouseenter', () => {
                            item.style.background = 'var(--surface-hover)';
                        });
                        item.addEventListener('mouseleave', () => {
                            item.style.background = 'transparent';
                        });
                    });
                } else {
                    suggestions.innerHTML = `
                        <div style="padding: 1rem; text-align: center; color: var(--text-muted);">
                            No se encontraron productos
                        </div>
                    `;
                    suggestions.style.display = 'block';
                }
            });

            // Hide suggestions when clicking outside
            document.addEventListener('click', (e) => {
                if (!productSearch.contains(e.target) && !suggestions.contains(e.target)) {
                    suggestions.style.display = 'none';
                }
            });

            // Clear product filter button functionality
            productSearch.addEventListener('keydown', (e) => {
                if (e.key === 'Escape') {
                    productSearch.value = '';
                    productHidden.value = '';
                    this.currentFilters.productId = '';
                    suggestions.style.display = 'none';
                    this.refreshData();
                }
            });
        }
    },

    setDefaultFilters() {
        // Default: current month
        const now = new Date();
        const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

        document.getElementById('analyticsDateFrom').value = firstDayOfMonth.toISOString().split('T')[0];
        document.getElementById('analyticsDateTo').value = now.toISOString().split('T')[0];

        this.currentFilters.dateFrom = firstDayOfMonth.toISOString().split('T')[0];
        this.currentFilters.dateTo = now.toISOString().split('T')[0];
    },

    clearFilters() {
        // Reset all filters
        this.currentFilters = {
            dateFrom: null,
            dateTo: null,
            city: '',
            status: '',
            productId: ''
        };

        // Reset UI
        document.getElementById('analyticsDateFrom').value = '';
        document.getElementById('analyticsDateTo').value = '';
        document.getElementById('analyticsCity').value = '';
        document.getElementById('analyticsStatus').value = '';
        document.getElementById('analyticsProduct').value = '';

        // Reset predictive search field
        const productSearch = document.getElementById('analyticsProductSearch');
        if (productSearch) {
            productSearch.value = '';
        }

        // Clear month tag active states
        document.querySelectorAll('#section-analytics .month-tag').forEach(el => el.classList.remove('active'));

        this.refreshData();
    },

    setQuickFilter(period) {
        const now = new Date();
        let fromDate = new Date();

        switch (period) {
            case 'week':
                const dayOfWeek = now.getDay();
                fromDate = new Date(now);
                fromDate.setDate(now.getDate() - dayOfWeek);
                break;
            case 'month':
                fromDate = new Date(now.getFullYear(), now.getMonth(), 1);
                break;
            case 'year':
                fromDate = new Date(now.getFullYear(), 0, 1);
                break;
            case 'all':
                fromDate = new Date(2020, 0, 1); // Far past date
                break;
        }

        document.getElementById('analyticsDateFrom').value = fromDate.toISOString().split('T')[0];
        document.getElementById('analyticsDateTo').value = now.toISOString().split('T')[0];

        this.currentFilters.dateFrom = fromDate.toISOString().split('T')[0];
        this.currentFilters.dateTo = now.toISOString().split('T')[0];

        document.querySelectorAll('#section-analytics .month-tag').forEach(el => el.classList.remove('active'));

        this.refreshData();
    },

    setMonthFilter(monthIndex, btn) {
        const now = new Date();
        const year = now.getFullYear();
        const mStr = String(monthIndex + 1).padStart(2, '0');
        const lastDay = new Date(year, monthIndex + 1, 0).getDate();
        const from = `${year}-${mStr}-01`;
        const to = `${year}-${mStr}-${String(lastDay).padStart(2, '0')}`;

        document.getElementById('analyticsDateFrom').value = from;
        document.getElementById('analyticsDateTo').value = to;

        this.currentFilters.dateFrom = from;
        this.currentFilters.dateTo = to;

        document.querySelectorAll('#section-analytics .month-tag').forEach(el => el.classList.remove('active'));
        if (btn) btn.classList.add('active');

        this.refreshData();
    },

    async render() {
        await this.loadProducts();
        await this.refreshData();
    },

    async loadProducts() {
        try {
            // Load products for predictive search
            this.allProducts = await Database.getProducts();
        } catch (error) {
            console.error('Error loading products for filter:', error);
        }
    },

    async refreshData() {
        try {
            const guides = await Database.getGuides();

            // Apply filters
            this.filteredGuides = this.applyFilters(guides);

            // Update all stats
            this.updateSummaryStats();
            this.updateCityChart();
            this.updateStatusChart();
            this.updateCurrencyStats();
            await this.updateGuideValueStats();
            await this.updateCostStats();
            await this.updateTopProducts();
            await this.updateGuidesTable();

        } catch (error) {
            console.error('Error refreshing analytics:', error);
            Utils.showToast('Error al cargar análisis', 'error');
        }
    },

    applyFilters(guides) {
        let filtered = [...guides];

        // Date filter
        if (this.currentFilters.dateFrom) {
            const fromDate = new Date(this.currentFilters.dateFrom);
            fromDate.setHours(0, 0, 0, 0);
            filtered = filtered.filter(g => new Date(g.createdAt) >= fromDate);
        }

        if (this.currentFilters.dateTo) {
            const toDate = new Date(this.currentFilters.dateTo);
            toDate.setHours(23, 59, 59, 999);
            filtered = filtered.filter(g => new Date(g.createdAt) <= toDate);
        }

        // City filter
        if (this.currentFilters.city) {
            filtered = filtered.filter(g => g.city === this.currentFilters.city);
        }

        // Status filter
        if (this.currentFilters.status) {
            filtered = filtered.filter(g => g.status === this.currentFilters.status);
        }

        return filtered;
    },

    isDevolucion(g) {
        const st = (g.status || g.status_name || '').toLowerCase().trim();
        return st.includes('devol');
    },

    isCancelado(g) {
        const st = (g.status || g.status_name || '').toLowerCase().trim();
        return st.includes('cancel');
    },

    isExcludedFromSales(g) {
        return this.isDevolucion(g) || this.isCancelado(g);
    },

    updateSummaryStats() {
        const guides = this.filteredGuides;

        // Total guides
        const totalEl = document.getElementById('analyticsTotal');
        if (totalEl) totalEl.textContent = guides.length;

        // Delivered
        const delivered = guides.filter(g => g.status === 'Entregado').length;
        const delEl = document.getElementById('analyticsDelivered');
        if (delEl) delEl.textContent = delivered;

        // Paid
        const paid = guides.filter(g => g.status === 'Pagado').length;
        const paidEl = document.getElementById('analyticsPaid');
        if (paidEl) paidEl.textContent = paid;

        // Cancelled
        const cancelled = guides.filter(g => this.isCancelado(g)).length;
        const cancEl = document.getElementById('analyticsCancelled');
        if (cancEl) cancEl.textContent = cancelled;

        // Devolución
        const devoluciones = guides.filter(g => this.isDevolucion(g)).length;
        const devolEl = document.getElementById('analyticsDevolucion');
        if (devolEl) devolEl.textContent = devoluciones;

        // Total USD (from Caracas guides with amountUsd - EXCLUDE Devolución and Cancelado)
        const totalUsd = guides
            .filter(g => g.amountUsd && !this.isExcludedFromSales(g))
            .reduce((sum, g) => sum + (parseFloat(g.amountUsd) || 0), 0);
        const usdEl = document.getElementById('analyticsTotalUsd');
        if (usdEl) usdEl.textContent = `$${totalUsd.toFixed(2)}`;

        // Total Bs (EXCLUDE Devolución and Cancelado)
        const totalBs = guides
            .filter(g => g.paymentBs && !this.isExcludedFromSales(g))
            .reduce((sum, g) => sum + (parseFloat(g.paymentBs) || 0), 0);
        const bsEl = document.getElementById('analyticsTotalBs');
        if (bsEl) bsEl.textContent = `${totalBs.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} Bs`;
    },

    updateCityChart() {
        const guides = this.filteredGuides;

        const quitoCount = guides.filter(g => g.city === 'Quito').length;
        const guayaquilCount = guides.filter(g => g.city === 'Guayaquil').length;
        const caracasCount = guides.filter(g => g.city === 'Caracas').length;

        const maxCount = Math.max(quitoCount, guayaquilCount, caracasCount, 1);

        const qCountEl = document.getElementById('analyticsQuitoCount');
        const gCountEl = document.getElementById('analyticsGuayaquilCount');
        const cCountEl = document.getElementById('analyticsCaracasCount');
        if (qCountEl) qCountEl.textContent = quitoCount;
        if (gCountEl) gCountEl.textContent = guayaquilCount;
        if (cCountEl) cCountEl.textContent = caracasCount;

        const qBarEl = document.getElementById('analyticsQuitoBar');
        const gBarEl = document.getElementById('analyticsGuayaquilBar');
        const cBarEl = document.getElementById('analyticsCaracasBar');
        if (qBarEl) qBarEl.style.width = `${(quitoCount / maxCount) * 100}%`;
        if (gBarEl) gBarEl.style.width = `${(guayaquilCount / maxCount) * 100}%`;
        if (cBarEl) cBarEl.style.width = `${(caracasCount / maxCount) * 100}%`;
    },

    updateStatusChart() {
        const guides = this.filteredGuides;

        const statusCounts = {
            'Pendiente': guides.filter(g => g.status === 'Pendiente').length,
            'En ruta': guides.filter(g => g.status === 'En ruta').length,
            'Entregado': guides.filter(g => g.status === 'Entregado').length,
            'Pagado': guides.filter(g => g.status === 'Pagado').length,
            'Novedad': guides.filter(g => g.status === 'Novedad').length,
            'Cancelado': guides.filter(g => this.isCancelado(g)).length,
            'Devolución': guides.filter(g => this.isDevolucion(g)).length
        };

        const maxCount = Math.max(...Object.values(statusCounts), 1);

        const setBar = (id, barId, count) => {
            const countEl = document.getElementById(id);
            const barEl = document.getElementById(barId);
            if (countEl) countEl.textContent = count;
            if (barEl) barEl.style.width = `${(count / maxCount) * 100}%`;
        };

        setBar('analyticsPendienteCount', 'analyticsPendienteBar', statusCounts['Pendiente']);
        setBar('analyticsEnRutaCount', 'analyticsEnRutaBar', statusCounts['En ruta']);
        setBar('analyticsEntregadoCount', 'analyticsEntregadoBar', statusCounts['Entregado']);
        setBar('analyticsPagadoCount', 'analyticsPagadoBar', statusCounts['Pagado']);
        setBar('analyticsNovedadCount', 'analyticsNovedadBar', statusCounts['Novedad']);
        setBar('analyticsCanceladoCount', 'analyticsCanceladoBar', statusCounts['Cancelado']);
        setBar('analyticsDevolucionCount', 'analyticsDevolucionBar', statusCounts['Devolución']);
    },

    updateCurrencyStats() {
        const guides = this.filteredGuides;
        const cityFilter = this.currentFilters.city;
        const isEcuador = cityFilter === 'Quito' || cityFilter === 'Guayaquil';

        // Guides with USD payment (only effective non-cancelled, non-devolucion)
        const usdGuides = guides.filter(g => g.amountUsd && parseFloat(g.amountUsd) > 0 && !this.isExcludedFromSales(g));
        const usdCount = usdGuides.length;
        const usdAmount = usdGuides.reduce((sum, g) => sum + (parseFloat(g.amountUsd) || 0), 0);

        const usdCountEl = document.getElementById('analyticsUsdCount');
        const usdAmountEl = document.getElementById('analyticsUsdAmount');
        if (usdCountEl) usdCountEl.textContent = usdCount;
        if (usdAmountEl) usdAmountEl.textContent = `$${usdAmount.toFixed(2)}`;

        // Show/hide currency sections based on country
        const bsCurrencyCard = document.getElementById('analyticsBsCurrencyCard');
        const usdCurrencyCard = document.getElementById('analyticsUsdCurrencyCard');

        if (isEcuador) {
            if (bsCurrencyCard) bsCurrencyCard.style.display = 'none';
            if (usdCurrencyCard) usdCurrencyCard.style.display = 'block';
        } else {
            if (bsCurrencyCard) bsCurrencyCard.style.display = 'block';
            if (usdCurrencyCard) usdCurrencyCard.style.display = 'block';
        }

        // Guides with Bs payment (only effective non-cancelled, non-devolucion)
        const bsGuides = guides.filter(g => g.paymentBs && parseFloat(g.paymentBs) > 0 && !this.isExcludedFromSales(g));
        const bsCount = bsGuides.length;
        const bsAmount = bsGuides.reduce((sum, g) => sum + (parseFloat(g.paymentBs) || 0), 0);

        const bsCountEl = document.getElementById('analyticsBsCount');
        const bsAmountEl = document.getElementById('analyticsBsAmount');
        if (bsCountEl) bsCountEl.textContent = bsCount;
        if (bsAmountEl) bsAmountEl.textContent = `${bsAmount.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} Bs`;
    },

    async updateGuideValueStats() {
        let guides = this.filteredGuides;
        const cityFilter = this.currentFilters.city;
        const isEcuador = cityFilter === 'Quito' || cityFilter === 'Guayaquil';
        const productFilter = this.currentFilters.productId;

        // If product filter is active, filter guides that contain that product
        if (productFilter) {
            const guidesWithProduct = [];
            for (const guide of guides) {
                const items = await Database.getGuideItems(guide.id);
                const hasProduct = items.some(item => item.productId === productFilter);
                if (hasProduct) {
                    guidesWithProduct.push(guide);
                }
            }
            guides = guidesWithProduct;
        }

        // Realized/Effective sales guides (Devolución and Cancelado do NOT sum sales)
        const effectiveSalesGuides = guides.filter(g => !this.isExcludedFromSales(g));

        // Calculate total value of guides (totalAmount) - Only effective sales
        const totalGuideValue = effectiveSalesGuides.reduce((sum, g) => sum + (parseFloat(g.totalAmount) || 0), 0);

        // Calculate total shipping costs (shippingCost) - Shipped guides generate shipping cost even if returned!
        const shippingGuides = guides.filter(g => !this.isCancelado(g));
        const totalShippingValue = shippingGuides.reduce((sum, g) => sum + (parseFloat(g.shippingCost) || 0), 0);

        // Update display elements
        const totalValueElement = document.getElementById('analyticsTotalGuideValue');
        const shippingValueElement = document.getElementById('analyticsTotalShippingValue');

        if (totalValueElement) {
            if (isEcuador) {
                totalValueElement.textContent = `$${totalGuideValue.toFixed(2)}`;
            } else {
                totalValueElement.textContent = Utils.formatCurrency(totalGuideValue);
            }
        }

        if (shippingValueElement) {
            if (isEcuador) {
                shippingValueElement.textContent = `$${totalShippingValue.toFixed(2)}`;
            } else {
                shippingValueElement.textContent = Utils.formatCurrency(totalShippingValue);
            }
        }

        // Update summary stats currency display
        const totalBsCard = document.getElementById('analyticsTotalBsCard');
        if (isEcuador) {
            if (totalBsCard) totalBsCard.style.display = 'none';
        } else {
            if (totalBsCard) totalBsCard.style.display = 'flex';
        }
    },

    async updateCostStats() {
        let guides = this.filteredGuides;
        const cityFilter = this.currentFilters.city;
        const isEcuador = cityFilter === 'Quito' || cityFilter === 'Guayaquil';
        const productFilter = this.currentFilters.productId;

        // Build a product cost lookup map
        const productCostMap = {};
        for (const p of this.allProducts) {
            productCostMap[p.id] = (parseFloat(p.cost) || 0) * this.COST_FACTOR;
        }

        // Effective sales guides (Devolución and Cancelado do NOT sum sales revenue / sold product cost)
        const effectiveSalesGuides = guides.filter(g => !this.isExcludedFromSales(g));

        // If product filter is active, filter guides that contain that product
        let salesGuidesToProcess = effectiveSalesGuides;
        if (productFilter) {
            const guidesWithProduct = [];
            for (const guide of effectiveSalesGuides) {
                const items = await Database.getGuideItems(guide.id);
                const hasProduct = items.some(item => item.productId === productFilter);
                if (hasProduct) {
                    guidesWithProduct.push(guide);
                }
            }
            salesGuidesToProcess = guidesWithProduct;
        }

        // Calculate total product cost & revenue from effective sales
        let totalProductCost = 0;
        let totalRevenue = 0;

        for (const guide of salesGuidesToProcess) {
            const items = await Database.getGuideItems(guide.id);
            for (const item of items) {
                if (productFilter && item.productId !== productFilter) {
                    continue;
                }
                const unitCost = productCostMap[item.productId] || 0;
                totalProductCost += unitCost * item.quantity;
                totalRevenue += item.subtotal || (item.quantity * item.unitPrice);
            }
        }

        // Total shipping (includes all dispatched guides, including devoluciones)
        const shippingGuides = guides.filter(g => !this.isCancelado(g));
        const totalShipping = shippingGuides.reduce((sum, g) => sum + (parseFloat(g.shippingCost) || 0), 0);

        // Net profit = Revenue - Product Cost - Shipping
        const netProfit = totalRevenue - totalProductCost - totalShipping;

        // Margin %
        const marginPct = totalRevenue > 0 ? ((netProfit / totalRevenue) * 100) : 0;

        // Update display elements (admin only)
        const isAdminUser = AuthModule.currentUser?.role === 'admin';

        const costEl = document.getElementById('analyticsTotalProductCost');
        const profitEl = document.getElementById('analyticsNetProfit');
        const marginEl = document.getElementById('analyticsMarginPct');

        // Hide cost cards for non-admin
        const costCard = costEl?.closest('.stat-card');
        const profitCard = profitEl?.closest('.stat-card');
        const marginCard = marginEl?.closest('.stat-card');
        if (costCard) costCard.style.display = isAdminUser ? '' : 'none';
        if (profitCard) profitCard.style.display = isAdminUser ? '' : 'none';
        if (marginCard) marginCard.style.display = isAdminUser ? '' : 'none';

        if (!isAdminUser) return;

        if (costEl) {
            costEl.textContent = isEcuador ? `$${totalProductCost.toFixed(2)}` : Utils.formatCurrency(totalProductCost);
        }
        if (profitEl) {
            profitEl.textContent = isEcuador ? `$${netProfit.toFixed(2)}` : Utils.formatCurrency(netProfit);
            // Color based on positive/negative
            profitEl.style.color = netProfit >= 0 ? '#10b981' : '#ef4444';
        }
        if (marginEl) {
            marginEl.textContent = `${marginPct.toFixed(1)}%`;
            marginEl.style.color = marginPct >= 0 ? '#6366f1' : '#ef4444';
        }
    },

    async updateTopProducts() {
        // Exclude cancelled and returned guides for product sales ranking
        const guides = this.filteredGuides.filter(g => !this.isExcludedFromSales(g));
        const productSales = {};
        const productFilter = this.currentFilters.productId;

        // Build a product cost lookup map
        const productCostMap = {};
        for (const p of this.allProducts) {
            productCostMap[p.id] = (parseFloat(p.cost) || 0) * this.COST_FACTOR;
        }

        const isAdminUser = AuthModule.currentUser?.role === 'admin';

        // Show/hide cost columns in top products table header
        const topProductsTable = document.getElementById('analyticsTopProducts')?.closest('table');
        if (topProductsTable) {
            const headerCells = topProductsTable.querySelectorAll('thead th');
            if (headerCells[4]) headerCells[4].style.display = isAdminUser ? '' : 'none';
            if (headerCells[5]) headerCells[5].style.display = isAdminUser ? '' : 'none';
        }

        // Collect all items from filtered guides
        for (const guide of guides) {
            const items = await Database.getGuideItems(guide.id);
            for (const item of items) {
                if (productFilter && item.productId !== productFilter) {
                    continue;
                }

                const productName = item.productName || 'Producto';
                const productId = item.productId;
                const unitCost = productCostMap[productId] || 0;

                if (!productSales[productId]) {
                    productSales[productId] = {
                        name: productName,
                        quantity: 0,
                        revenue: 0,
                        cost: 0,
                        guideCount: 0
                    };
                }
                productSales[productId].quantity += item.quantity;
                productSales[productId].revenue += item.subtotal || (item.quantity * item.unitPrice);
                productSales[productId].cost += unitCost * item.quantity;
                productSales[productId].guideCount++;
            }
        }

        // Sort by quantity and get top 10
        const sortedProducts = Object.entries(productSales)
            .sort((a, b) => b[1].quantity - a[1].quantity)
            .slice(0, 10);

        const tbody = document.getElementById('analyticsTopProducts');

        if (sortedProducts.length === 0) {
            const colSpan = isAdminUser ? 6 : 4;
            tbody.innerHTML = `
                <tr>
                    <td colspan="${colSpan}" style="text-align: center; padding: 2rem; color: var(--text-muted);">
                        No hay datos de productos
                    </td>
                </tr>
            `;
            return;
        }

        tbody.innerHTML = sortedProducts.map((item, index) => {
            const [id, data] = item;
            const medal = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `${index + 1}`;
            const profit = data.revenue - data.cost;
            const profitColor = profit >= 0 ? '#10b981' : '#ef4444';

            const costCols = isAdminUser ? `
                    <td style="color: var(--warning); font-weight: 500;">${Utils.formatCurrency(data.cost)}</td>
                    <td style="color: ${profitColor}; font-weight: 600;">${Utils.formatCurrency(profit)}</td>
            ` : '';

            return `
                <tr>
                    <td style="text-align: center; font-weight: 600;">${medal}</td>
                    <td>
                        ${Utils.escapeHtml(data.name)}
                        <div style="font-size: 0.75rem; color: var(--text-muted);">${data.guideCount} guías</div>
                    </td>
                    <td style="text-align: center; font-weight: 600;">${data.quantity}</td>
                    <td style="color: var(--success); font-weight: 500;">${Utils.formatCurrency(data.revenue)}</td>
                    ${costCols}
                </tr>
            `;
        }).join('');
    },

    async updateGuidesTable() {
        let guides = this.filteredGuides;
        const productFilter = this.currentFilters.productId;

        // If product filter is active, filter guides that contain that product
        if (productFilter) {
            const guidesWithProduct = [];
            for (const guide of guides) {
                const items = await Database.getGuideItems(guide.id);
                const hasProduct = items.some(item => item.productId === productFilter);
                if (hasProduct) {
                    guidesWithProduct.push(guide);
                }
            }
            guides = guidesWithProduct;
        }

        const tbody = document.getElementById('analyticsGuidesTable');
        const tfoot = document.getElementById('analyticsGuidesTableFoot');
        const summaryCards = document.getElementById('analyticsTableSummaryCards');
        const recordCount = document.getElementById('analyticsRecordCount');

        if (recordCount) recordCount.textContent = `${guides.length} registros`;

        const formatBs = (num) => {
            return (num || 0).toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' Bs';
        };

        const formatUsd = (num) => {
            return '$' + (num || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        };

        if (guides.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="8" style="text-align: center; padding: 2rem; color: var(--text-muted);">
                        No se encontraron guías con los filtros aplicados
                    </td>
                </tr>
            `;
            if (tfoot) tfoot.innerHTML = '';
            if (summaryCards) summaryCards.innerHTML = '';
            return;
        }

        // Sort by date (newest first)
        const sortedGuides = [...guides].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

        const effectiveGuides = sortedGuides.filter(g => !this.isExcludedFromSales(g));
        const devolucionGuides = sortedGuides.filter(g => this.isDevolucion(g));
        const cancelledGuides = sortedGuides.filter(g => this.isCancelado(g));

        // Totals: only effective guides sum revenue and Bs payments
        const totalDollars = effectiveGuides.reduce((sum, g) => {
            const val = parseFloat(g.totalAmount || g.amountUsd || 0);
            return sum + (isNaN(val) ? 0 : val);
        }, 0);

        const totalBs = effectiveGuides.reduce((sum, g) => {
            const val = parseFloat(g.paymentBs || 0);
            return sum + (isNaN(val) ? 0 : val);
        }, 0);

        const bsGuidesCount = effectiveGuides.filter(g => g.paymentBs && parseFloat(g.paymentBs) > 0).length;

        // Flete is charged for all dispatched guides (effective + devolucion), excluded only if cancelado
        const totalFlete = sortedGuides.filter(g => !this.isCancelado(g)).reduce((sum, g) => {
            const val = parseFloat(g.shippingCost || 0);
            return sum + (isNaN(val) ? 0 : val);
        }, 0);

        tbody.innerHTML = sortedGuides.map(guide => {
            const statusClass = Utils.getStatusClass(guide.status);
            const cityClass = (guide.city || '').toLowerCase();
            const isDevol = this.isDevolucion(guide);
            const isCanc = this.isCancelado(guide);
            const isExcluded = isDevol || isCanc;

            const totalUsdVal = parseFloat(guide.totalAmount || guide.amountUsd || 0);
            const bsVal = parseFloat(guide.paymentBs || 0);
            const hasBs = !isNaN(bsVal) && bsVal > 0;

            // Total ($) column
            let totalUsdCol;
            if (isExcluded) {
                const label = isDevol ? 'Devuelto' : 'Cancelado';
                totalUsdCol = `
                    <div style="text-decoration: line-through; opacity: 0.5; color: var(--text-muted); font-size: 0.85em;">${formatUsd(totalUsdVal)}</div>
                    <div style="font-size: 0.72rem; color: #f97316; font-weight: 600;">$0.00 (${label})</div>
                `;
            } else {
                totalUsdCol = `<span style="color: var(--success); font-weight: 600;">${formatUsd(totalUsdVal)}</span>`;
            }

            // Pago en Bolívares column
            let pagoBsCol;
            if (isExcluded) {
                if (hasBs) {
                    const label = isDevol ? 'Devuelto' : 'Cancelado';
                    pagoBsCol = `
                        <div style="text-decoration: line-through; opacity: 0.5; color: var(--text-muted); font-size: 0.85em;">${formatBs(bsVal)}</div>
                        <div style="font-size: 0.72rem; color: #f97316; font-weight: 600;">0.00 Bs (${label})</div>
                    `;
                } else {
                    pagoBsCol = `<span style="color: var(--text-muted);">-</span>`;
                }
            } else if (hasBs) {
                pagoBsCol = `<span class="badge" style="background: rgba(167, 139, 250, 0.15); color: #a78bfa; font-weight: 600; padding: 3px 8px; border-radius: 6px; border: 1px solid rgba(167, 139, 250, 0.3); font-size: 0.85rem;">${formatBs(bsVal)}</span>`;
            } else {
                pagoBsCol = `<span style="color: var(--text-muted);">-</span>`;
            }

            // Shipping cost column
            let shippingCost = '-';
            if (guide.shippingCost && parseFloat(guide.shippingCost) > 0) {
                shippingCost = `<span style="color: var(--primary); font-weight: 500;">${formatUsd(parseFloat(guide.shippingCost))}</span>`;
            }

            const rowStyle = isDevol ? 'background: rgba(249, 115, 22, 0.04);' : (isCanc ? 'opacity: 0.6;' : '');

            return `
                <tr onclick="App.navigateTo('guides'); GuidesModule.viewGuide('${guide.id}')" style="cursor: pointer; ${rowStyle}" title="Ver detalles de la guía">
                    <td><strong style="color: var(--primary);">${guide.guideNumber}</strong></td>
                    <td>${Utils.formatDate(guide.createdAt)}</td>
                    <td>${Utils.escapeHtml(guide.clientName || 'N/A')}</td>
                    <td><span class="city-badge ${cityClass}">${guide.city || 'N/A'}</span></td>
                    <td>${totalUsdCol}</td>
                    <td>${pagoBsCol}</td>
                    <td>${shippingCost}</td>
                    <td><span class="status-badge ${statusClass}">${guide.status}</span></td>
                </tr>
            `;
        }).join('');

        // Update table footer totals
        if (tfoot) {
            tfoot.innerHTML = `
                <tr style="border-top: 2px solid var(--border-color, rgba(255,255,255,0.1)); font-weight: 700; background: var(--surface-hover, rgba(255,255,255,0.06));">
                    <td colspan="4" style="padding: 0.85rem 0.6rem;">
                        <div style="font-size: 0.85rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px;">
                            TOTALES (${effectiveGuides.length} cobradas / ${guides.length} guías)
                        </div>
                        ${devolucionGuides.length > 0 ? `<div style="font-size: 0.72rem; color: #f97316; font-weight: normal; margin-top: 3px;">⚠️ ${devolucionGuides.length} pedido(s) en Devolución no suman a los cobros</div>` : ''}
                    </td>
                    <td style="padding: 0.85rem 0.6rem; color: var(--success); font-size: 1rem; font-weight: 700;">
                        ${formatUsd(totalDollars)}
                    </td>
                    <td style="padding: 0.85rem 0.6rem; color: #a78bfa; font-size: 1rem; font-weight: 700;">
                        ${totalBs > 0 ? formatBs(totalBs) : '-'}
                    </td>
                    <td style="padding: 0.85rem 0.6rem; color: var(--primary); font-size: 1rem; font-weight: 700;">
                        ${formatUsd(totalFlete)}
                    </td>
                    <td></td>
                </tr>
            `;
        }

        // Update summary cards container below table
        if (summaryCards) {
            summaryCards.innerHTML = `
                <div>
                    <div style="font-size: 0.72rem; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 2px;">Total Guías</div>
                    <div style="font-size: 1.25rem; font-weight: 700; color: var(--text-primary);">${guides.length} <span style="font-size: 0.8rem; font-weight: normal; color: var(--text-muted);">(${effectiveGuides.length} efectivas)</span></div>
                    ${devolucionGuides.length > 0 ? `<div style="font-size: 0.7rem; color: #f97316; margin-top: 2px;">${devolucionGuides.length} en devolución</div>` : ''}
                </div>
                <div>
                    <div style="font-size: 0.72rem; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 2px;">Total Dólares ($)</div>
                    <div style="font-size: 1.25rem; font-weight: 700; color: var(--success, #10b981);">${formatUsd(totalDollars)}</div>
                </div>
                <div>
                    <div style="font-size: 0.72rem; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 2px;">Total Bolívares (Bs)</div>
                    <div style="font-size: 1.25rem; font-weight: 700; color: #a78bfa;">${formatBs(totalBs)}</div>
                    <div style="font-size: 0.72rem; color: var(--text-muted); margin-top: 2px;">${bsGuidesCount} pedido(s) pagados en Bs</div>
                </div>
                <div>
                    <div style="font-size: 0.72rem; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 2px;">Total Fletes ($)</div>
                    <div style="font-size: 1.25rem; font-weight: 700; color: var(--primary, #6366f1);">${formatUsd(totalFlete)}</div>
                </div>
            `;
        }
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
            Utils.showToast('Generando reporte Excel...', 'info');

            const guides = this.filteredGuides || [];
            if (guides.length === 0) {
                Utils.showToast('No hay guías para exportar con los filtros actuales', 'warning');
                return;
            }

            // Build product cost map
            const productCostMap = {};
            for (const p of this.allProducts) {
                productCostMap[p.id] = (parseFloat(p.cost) || 0) * this.COST_FACTOR;
            }

            // 1. SHEET: DETALLE DE GUÍAS
            const guidesHeaders = [
                'Nº Guía',
                'Fecha',
                'Cliente',
                'Teléfono',
                'Ciudad',
                'Dirección',
                'Estado',
                'Total Venta ($)',
                'Pago Bolívares (Bs)',
                'Costo Flete ($)',
                'Costo Mercancía ($)',
                'Ganancia Neta ($)',
                'Productos / Detalle',
                'Observaciones'
            ];

            const guidesRows = [];
            const sortedGuides = [...guides].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

            for (const guide of sortedGuides) {
                const isDevol = this.isDevolucion(guide);
                const isCanc = this.isCancelado(guide);
                const isExcluded = isDevol || isCanc;

                const totalUsdVal = isExcluded ? 0 : (parseFloat(guide.totalAmount || guide.amountUsd || 0) || 0);
                const bsVal = isExcluded ? 0 : (parseFloat(guide.paymentBs || 0) || 0);
                const shippingCost = isCanc ? 0 : (parseFloat(guide.shippingCost || 0) || 0);

                let itemsSummary = '';
                let guideProductCost = 0;
                try {
                    const items = await Database.getGuideItems(guide.id);
                    if (items && items.length > 0) {
                        itemsSummary = items.map(it => `${it.quantity || 1}x ${it.productName || 'Producto'}`).join(' | ');
                        if (!isExcluded) {
                            for (const it of items) {
                                const uCost = productCostMap[it.productId] || 0;
                                guideProductCost += uCost * (it.quantity || 1);
                            }
                        }
                    }
                } catch (e) {
                    console.warn('Error al obtener ítems de guía', guide.id, e);
                }

                const netProfit = totalUsdVal - guideProductCost - shippingCost;

                guidesRows.push([
                    guide.guideNumber || '',
                    guide.createdAt ? new Date(guide.createdAt).toLocaleDateString('es-ES') : '',
                    guide.clientName || 'N/A',
                    guide.clientPhone || guide.phone || '',
                    guide.city || '',
                    guide.address || guide.clientAddress || '',
                    guide.status || '',
                    totalUsdVal,
                    bsVal,
                    shippingCost,
                    guideProductCost,
                    netProfit,
                    itemsSummary,
                    guide.observations || guide.notes || ''
                ]);
            }

            const wsGuides = XLSX.utils.aoa_to_sheet([guidesHeaders, ...guidesRows]);
            wsGuides['!cols'] = [
                { wch: 14 },
                { wch: 12 },
                { wch: 24 },
                { wch: 15 },
                { wch: 14 },
                { wch: 28 },
                { wch: 14 },
                { wch: 15 },
                { wch: 20 },
                { wch: 15 },
                { wch: 18 },
                { wch: 18 },
                { wch: 35 },
                { wch: 30 }
            ];

            // 2. SHEET: RESUMEN Y KPIS
            const effectiveGuides = sortedGuides.filter(g => !this.isExcludedFromSales(g));
            const devolucionGuides = sortedGuides.filter(g => this.isDevolucion(g));
            const cancelledGuides = sortedGuides.filter(g => this.isCancelado(g));
            const deliveredGuides = sortedGuides.filter(g => g.status === 'Entregado');
            const paidGuides = sortedGuides.filter(g => g.status === 'Pagado');

            const totalDollars = effectiveGuides.reduce((sum, g) => sum + (parseFloat(g.totalAmount || g.amountUsd || 0) || 0), 0);
            const totalBs = effectiveGuides.reduce((sum, g) => sum + (parseFloat(g.paymentBs || 0) || 0), 0);
            const totalFletes = sortedGuides.filter(g => !this.isCancelado(g)).reduce((sum, g) => sum + (parseFloat(g.shippingCost || 0) || 0), 0);

            let totalCogs = 0;
            for (const g of effectiveGuides) {
                try {
                    const items = await Database.getGuideItems(g.id);
                    for (const it of items) {
                        const uCost = productCostMap[it.productId] || 0;
                        totalCogs += uCost * (it.quantity || 1);
                    }
                } catch (e) {}
            }

            const netProfitTotal = totalDollars - totalCogs - totalFletes;
            const marginPct = totalDollars > 0 ? (netProfitTotal / totalDollars) * 100 : 0;

            const kpiAoa = [
                ['REPORTE DE ANÁLISIS DE DATOS'],
                ['Generado el:', new Date().toLocaleString('es-ES')],
                ['Período Desde:', this.currentFilters.dateFrom || 'Inicio'],
                ['Período Hasta:', this.currentFilters.dateTo || 'Hoy'],
                ['Filtro Ciudad:', this.currentFilters.city || 'Todas'],
                ['Filtro Estado:', this.currentFilters.status || 'Todos'],
                [''],
                ['MÉTRICA / INDICADOR', 'VALOR'],
                ['Total Guías Registradas', guides.length],
                ['Guías Efectivas (Cobradas)', effectiveGuides.length],
                ['Guías Entregadas', deliveredGuides.length],
                ['Guías Pagadas', paidGuides.length],
                ['Guías en Devolución', devolucionGuides.length],
                ['Guías Canceladas', cancelledGuides.length],
                ['Ventas Totales Efectivas ($ USD)', totalDollars],
                ['Pagos Totales en Bolívares (Bs)', totalBs],
                ['Costo Total de Fletes / Envíos ($ USD)', totalFletes],
                ['Costo de Mercancía Vendida ($ USD)', totalCogs],
                ['Utilidad Neta Estimada ($ USD)', netProfitTotal],
                ['Margen de Rentabilidad (%)', `${marginPct.toFixed(2)}%`]
            ];

            const wsKpi = XLSX.utils.aoa_to_sheet(kpiAoa);
            wsKpi['!cols'] = [
                { wch: 38 },
                { wch: 25 }
            ];

            // 3. SHEET: PRODUCTOS MÁS VENDIDOS
            const productSales = {};
            for (const guide of effectiveGuides) {
                try {
                    const items = await Database.getGuideItems(guide.id);
                    for (const item of items) {
                        const productName = item.productName || 'Producto';
                        const productId = item.productId;
                        const unitCost = productCostMap[productId] || 0;

                        if (!productSales[productId]) {
                            productSales[productId] = {
                                name: productName,
                                quantity: 0,
                                revenue: 0,
                                cost: 0,
                                guideCount: 0
                            };
                        }
                        productSales[productId].quantity += (item.quantity || 1);
                        productSales[productId].revenue += item.subtotal || ((item.quantity || 1) * (item.unitPrice || 0));
                        productSales[productId].cost += unitCost * (item.quantity || 1);
                        productSales[productId].guideCount++;
                    }
                } catch (e) {}
            }

            const sortedProducts = Object.values(productSales).sort((a, b) => b.quantity - a.quantity);
            const prodHeaders = ['#', 'Producto', 'Nº de Guías', 'Unidades Vendidas', 'Ingresos Totales ($)', 'Costo Total ($)', 'Ganancia ($)', 'Margen (%)'];
            const prodRows = sortedProducts.map((p, idx) => {
                const profit = p.revenue - p.cost;
                const margin = p.revenue > 0 ? ((profit / p.revenue) * 100).toFixed(1) + '%' : '0%';
                return [
                    idx + 1,
                    p.name,
                    p.guideCount,
                    p.quantity,
                    p.revenue,
                    p.cost,
                    profit,
                    margin
                ];
            });

            const wsProd = XLSX.utils.aoa_to_sheet([prodHeaders, ...prodRows]);
            wsProd['!cols'] = [
                { wch: 6 },
                { wch: 32 },
                { wch: 12 },
                { wch: 18 },
                { wch: 20 },
                { wch: 18 },
                { wch: 18 },
                { wch: 12 }
            ];

            // Build workbook
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, wsGuides, 'Detalle de Guías');
            XLSX.utils.book_append_sheet(wb, wsKpi, 'Resumen General');
            XLSX.utils.book_append_sheet(wb, wsProd, 'Productos');

            const dateStr = (this.currentFilters.dateFrom || 'inicio') + '_a_' + (this.currentFilters.dateTo || 'hoy');
            XLSX.writeFile(wb, `reporte_analisis_datos_${dateStr}.xlsx`);
            Utils.showToast('Reporte de Análisis descargado en Excel', 'success');

        } catch (error) {
            console.error('Error al exportar análisis a Excel:', error);
            Utils.showToast('Error al generar archivo Excel', 'error');
        }
    }
};

// Make module available globally
window.AnalyticsModule = AnalyticsModule;
