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
        const recordCount = document.getElementById('analyticsRecordCount');

        if (recordCount) recordCount.textContent = `${guides.length} registros`;

        if (guides.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="7" style="text-align: center; padding: 2rem; color: var(--text-muted);">
                        No se encontraron guías con los filtros aplicados
                    </td>
                </tr>
            `;
            return;
        }

        // Sort by date (newest first)
        const sortedGuides = [...guides].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

        const cityFilter = this.currentFilters.city;
        const isEcuador = cityFilter === 'Quito' || cityFilter === 'Guayaquil';

        tbody.innerHTML = sortedGuides.map(guide => {
            const statusClass = Utils.getStatusClass(guide.status);
            const cityClass = (guide.city || '').toLowerCase();
            const isDevol = this.isDevolucion(guide);
            const isCanc = this.isCancelado(guide);

            // Determine payment info based on country/city filter
            let paymentInfo;
            if (isDevol || isCanc) {
                const label = isDevol ? 'Devuelto' : 'Cancelado';
                const originalVal = parseFloat(guide.amountUsd || guide.totalAmount || 0);
                paymentInfo = `<span style="text-decoration: line-through; opacity: 0.5; color: var(--text-muted); font-size: 0.85em;">$${originalVal.toFixed(2)}</span> <span style="font-size: 0.78em; color: #f97316; font-weight: 600;">($0 ${label})</span>`;
            } else if (isEcuador || guide.city === 'Quito' || guide.city === 'Guayaquil') {
                paymentInfo = `<span style="color: var(--success); font-weight: 600;">$${(parseFloat(guide.totalAmount) || 0).toFixed(2)}</span>`;
            } else if (guide.amountUsd) {
                paymentInfo = `<span style="color: var(--success); font-weight: 600;">$${parseFloat(guide.amountUsd).toFixed(2)}</span>`;
            } else {
                paymentInfo = `<span style="color: var(--success); font-weight: 600;">${Utils.formatCurrency(guide.totalAmount)}</span>`;
            }

            // Shipping cost in separate column
            let shippingCost = '-';
            if (guide.shippingCost && parseFloat(guide.shippingCost) > 0) {
                if (isEcuador || guide.city === 'Quito' || guide.city === 'Guayaquil') {
                    shippingCost = `<span style="color: var(--primary);">$${parseFloat(guide.shippingCost).toFixed(2)}</span>`;
                } else {
                    shippingCost = `<span style="color: var(--primary);">${Utils.formatCurrency(guide.shippingCost)}</span>`;
                }
            }

            return `
                <tr onclick="App.navigateTo('guides'); GuidesModule.viewGuide('${guide.id}')" style="cursor: pointer;" title="Ver detalles de la guía">
                    <td><strong style="color: var(--primary);">${guide.guideNumber}</strong></td>
                    <td>${Utils.formatDate(guide.createdAt)}</td>
                    <td>${Utils.escapeHtml(guide.clientName || 'N/A')}</td>
                    <td><span class="city-badge ${cityClass}">${guide.city}</span></td>
                    <td>${paymentInfo}</td>
                    <td>${shippingCost}</td>
                    <td><span class="status-badge ${statusClass}">${guide.status}</span></td>
                </tr>
            `;
        }).join('');
    }
};

// Make module available globally
window.AnalyticsModule = AnalyticsModule;
