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

    init() {
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

        // Product filter
        document.getElementById('analyticsProduct').addEventListener('change', () => {
            this.currentFilters.productId = document.getElementById('analyticsProduct').value;
            this.refreshData();
        });
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
            this.allProducts = await Database.getProducts();
            const select = document.getElementById('analyticsProduct');

            // Keep the first option (Todos los productos)
            select.innerHTML = '<option value="">Todos los productos</option>';

            // Add all active products
            this.allProducts
                .filter(p => p.active)
                .sort((a, b) => a.name.localeCompare(b.name))
                .forEach(product => {
                    const option = document.createElement('option');
                    option.value = product.id;
                    option.textContent = product.name;
                    select.appendChild(option);
                });
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
            this.updateGuideValueStats();
            await this.updateTopProducts();
            this.updateGuidesTable();

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

    updateSummaryStats() {
        const guides = this.filteredGuides;

        // Total guides
        document.getElementById('analyticsTotal').textContent = guides.length;

        // Delivered
        const delivered = guides.filter(g => g.status === 'Entregado').length;
        document.getElementById('analyticsDelivered').textContent = delivered;

        // Paid
        const paid = guides.filter(g => g.status === 'Pagado').length;
        document.getElementById('analyticsPaid').textContent = paid;

        // Cancelled
        const cancelled = guides.filter(g => g.status === 'Cancelado').length;
        document.getElementById('analyticsCancelled').textContent = cancelled;

        // Total USD (from Caracas guides with amountUsd)
        const totalUsd = guides
            .filter(g => g.amountUsd && g.status !== 'Cancelado')
            .reduce((sum, g) => sum + (parseFloat(g.amountUsd) || 0), 0);
        document.getElementById('analyticsTotalUsd').textContent = `$${totalUsd.toFixed(2)}`;

        // Total Bs
        const totalBs = guides
            .filter(g => g.paymentBs && g.status !== 'Cancelado')
            .reduce((sum, g) => sum + (parseFloat(g.paymentBs) || 0), 0);
        document.getElementById('analyticsTotalBs').textContent = `${totalBs.toFixed(2)} Bs`;
    },

    updateCityChart() {
        const guides = this.filteredGuides;

        const quitoCount = guides.filter(g => g.city === 'Quito').length;
        const guayaquilCount = guides.filter(g => g.city === 'Guayaquil').length;
        const caracasCount = guides.filter(g => g.city === 'Caracas').length;

        const maxCount = Math.max(quitoCount, guayaquilCount, caracasCount, 1);

        document.getElementById('analyticsQuitoCount').textContent = quitoCount;
        document.getElementById('analyticsGuayaquilCount').textContent = guayaquilCount;
        document.getElementById('analyticsCaracasCount').textContent = caracasCount;

        document.getElementById('analyticsQuitoBar').style.width = `${(quitoCount / maxCount) * 100}%`;
        document.getElementById('analyticsGuayaquilBar').style.width = `${(guayaquilCount / maxCount) * 100}%`;
        document.getElementById('analyticsCaracasBar').style.width = `${(caracasCount / maxCount) * 100}%`;
    },

    updateStatusChart() {
        const guides = this.filteredGuides;

        const statusCounts = {
            'Pendiente': guides.filter(g => g.status === 'Pendiente').length,
            'En ruta': guides.filter(g => g.status === 'En ruta').length,
            'Entregado': guides.filter(g => g.status === 'Entregado').length,
            'Pagado': guides.filter(g => g.status === 'Pagado').length,
            'Cancelado': guides.filter(g => g.status === 'Cancelado').length
        };

        const maxCount = Math.max(...Object.values(statusCounts), 1);

        document.getElementById('analyticsPendienteCount').textContent = statusCounts['Pendiente'];
        document.getElementById('analyticsEnRutaCount').textContent = statusCounts['En ruta'];
        document.getElementById('analyticsEntregadoCount').textContent = statusCounts['Entregado'];
        document.getElementById('analyticsPagadoCount').textContent = statusCounts['Pagado'];
        document.getElementById('analyticsCanceladoCount').textContent = statusCounts['Cancelado'];

        document.getElementById('analyticsPendienteBar').style.width = `${(statusCounts['Pendiente'] / maxCount) * 100}%`;
        document.getElementById('analyticsEnRutaBar').style.width = `${(statusCounts['En ruta'] / maxCount) * 100}%`;
        document.getElementById('analyticsEntregadoBar').style.width = `${(statusCounts['Entregado'] / maxCount) * 100}%`;
        document.getElementById('analyticsPagadoBar').style.width = `${(statusCounts['Pagado'] / maxCount) * 100}%`;
        document.getElementById('analyticsCanceladoBar').style.width = `${(statusCounts['Cancelado'] / maxCount) * 100}%`;
    },

    updateCurrencyStats() {
        const guides = this.filteredGuides;
        const cityFilter = this.currentFilters.city;
        const isEcuador = cityFilter === 'Quito' || cityFilter === 'Guayaquil';

        // Guides with USD payment
        const usdGuides = guides.filter(g => g.amountUsd && parseFloat(g.amountUsd) > 0 && g.status !== 'Cancelado');
        const usdCount = usdGuides.length;
        const usdAmount = usdGuides.reduce((sum, g) => sum + (parseFloat(g.amountUsd) || 0), 0);

        document.getElementById('analyticsUsdCount').textContent = usdCount;
        document.getElementById('analyticsUsdAmount').textContent = `$${usdAmount.toFixed(2)}`;

        // Show/hide currency sections based on country
        const bsCurrencyCard = document.getElementById('analyticsBsCurrencyCard');
        const usdCurrencyCard = document.getElementById('analyticsUsdCurrencyCard');

        if (isEcuador) {
            // Ecuador only uses USD - hide Bs section
            if (bsCurrencyCard) bsCurrencyCard.style.display = 'none';
            if (usdCurrencyCard) usdCurrencyCard.style.display = 'block';
        } else {
            // Show both for Venezuela (Caracas) or All
            if (bsCurrencyCard) bsCurrencyCard.style.display = 'block';
            if (usdCurrencyCard) usdCurrencyCard.style.display = 'block';
        }

        // Guides with Bs payment
        const bsGuides = guides.filter(g => g.paymentBs && parseFloat(g.paymentBs) > 0 && g.status !== 'Cancelado');
        const bsCount = bsGuides.length;
        const bsAmount = bsGuides.reduce((sum, g) => sum + (parseFloat(g.paymentBs) || 0), 0);

        document.getElementById('analyticsBsCount').textContent = bsCount;
        document.getElementById('analyticsBsAmount').textContent = `${bsAmount.toFixed(2)} Bs`;
    },

    updateGuideValueStats() {
        const guides = this.filteredGuides.filter(g => g.status !== 'Cancelado');
        const cityFilter = this.currentFilters.city;
        const isEcuador = cityFilter === 'Quito' || cityFilter === 'Guayaquil';

        // Calculate total value of guides (totalAmount)
        const totalGuideValue = guides.reduce((sum, g) => sum + (parseFloat(g.totalAmount) || 0), 0);

        // Calculate total shipping costs (shippingCost)
        const totalShippingValue = guides.reduce((sum, g) => sum + (parseFloat(g.shippingCost) || 0), 0);

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
        const totalUsdElement = document.getElementById('analyticsTotalUsd');
        const totalBsElement = document.getElementById('analyticsTotalBs');
        const totalBsCard = document.getElementById('analyticsTotalBsCard');

        if (isEcuador) {
            // For Ecuador, hide Bs total
            if (totalBsCard) totalBsCard.style.display = 'none';
        } else {
            if (totalBsCard) totalBsCard.style.display = 'flex';
        }
    },

    async updateTopProducts() {
        // Filter out cancelled guides for product stats
        const guides = this.filteredGuides.filter(g => g.status !== 'Cancelado');
        const productSales = {};
        const productFilter = this.currentFilters.productId;

        // Collect all items from filtered guides
        for (const guide of guides) {
            const items = await Database.getGuideItems(guide.id);
            for (const item of items) {
                // If product filter is active, only count that product
                if (productFilter && item.productId !== productFilter) {
                    continue;
                }

                const productName = item.productName || 'Producto';
                const productId = item.productId;

                if (!productSales[productId]) {
                    productSales[productId] = {
                        name: productName,
                        quantity: 0,
                        revenue: 0,
                        guideCount: 0
                    };
                }
                productSales[productId].quantity += item.quantity;
                productSales[productId].revenue += item.subtotal || (item.quantity * item.unitPrice);
                productSales[productId].guideCount++;
            }
        }

        // Sort by quantity and get top 10
        const sortedProducts = Object.entries(productSales)
            .sort((a, b) => b[1].quantity - a[1].quantity)
            .slice(0, 10);

        const tbody = document.getElementById('analyticsTopProducts');

        if (sortedProducts.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="4" style="text-align: center; padding: 2rem; color: var(--text-muted);">
                        No hay datos de productos
                    </td>
                </tr>
            `;
            return;
        }

        tbody.innerHTML = sortedProducts.map((item, index) => {
            const [id, data] = item;
            const medal = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `${index + 1}`;
            return `
                <tr>
                    <td style="text-align: center; font-weight: 600;">${medal}</td>
                    <td>
                        ${Utils.escapeHtml(data.name)}
                        <div style="font-size: 0.75rem; color: var(--text-muted);">${data.guideCount} guías</div>
                    </td>
                    <td style="text-align: center; font-weight: 600;">${data.quantity}</td>
                    <td style="color: var(--success); font-weight: 500;">${Utils.formatCurrency(data.revenue)}</td>
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

        recordCount.textContent = `${guides.length} registros`;

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
            const cityClass = guide.city.toLowerCase();

            // Determine payment info based on country/city filter
            let paymentInfo;
            if (isEcuador || guide.city === 'Quito' || guide.city === 'Guayaquil') {
                // Ecuador uses dollars
                paymentInfo = `<span style="color: var(--success);">$${(guide.totalAmount || 0).toFixed(2)}</span>`;
            } else if (guide.amountUsd) {
                paymentInfo = `<span style="color: var(--success);">$${guide.amountUsd}</span>`;
            } else {
                paymentInfo = Utils.formatCurrency(guide.totalAmount);
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
                    <td>${guide.clientName || 'N/A'}</td>
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
