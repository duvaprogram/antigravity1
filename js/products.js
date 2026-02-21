// ========================================
// Products Module (Async - Supabase)
// Enhanced with sorting, filtering & stats
// ========================================

const ProductsModule = {
    // Current sort state
    currentSort: { field: 'default', direction: 'asc' },

    // Cost encryption factor
    COST_FACTOR: 40000,

    isAdmin() {
        return AuthModule.currentUser?.role === 'admin';
    },

    // Decode the stored cost to get real cost
    getRealCost(product) {
        const storedCost = parseFloat(product.cost) || 0;
        return storedCost * this.COST_FACTOR;
    },

    init() {
        this.bindEvents();
    },

    bindEvents() {
        // New product button
        document.getElementById('btnNewProduct').addEventListener('click', () => {
            this.openProductModal();
        });

        // Product form submission
        document.getElementById('formProduct').addEventListener('submit', (e) => {
            e.preventDefault();
            this.saveProduct();
        });

        // Search products (debounced)
        document.getElementById('searchProducts').addEventListener('input',
            Utils.debounce(() => this.filterProducts(), 300)
        );

        // Filter by status
        document.getElementById('filterStatus').addEventListener('change', () => {
            this.filterProducts();
        });

        // Sort select
        document.getElementById('productSortSelect').addEventListener('change', (e) => {
            const val = e.target.value;
            if (val === 'default') {
                this.currentSort = { field: 'default', direction: 'asc' };
            } else {
                const [field, dir] = val.split('-');
                this.currentSort = { field, direction: dir };
            }
            this.updateSortableHeaders();
            this.filterProducts();
        });

        // Filter by category
        document.getElementById('filterProductCategory').addEventListener('change', () => {
            this.filterProducts();
        });

        // Clear filters button
        document.getElementById('btnClearProductFilters').addEventListener('click', () => {
            this.clearFilters();
        });

        // Sortable table headers
        document.querySelectorAll('#productsTableEl .sortable-th').forEach(th => {
            th.addEventListener('click', () => {
                const sortField = th.dataset.sort;
                this.handleHeaderSort(sortField);
            });
        });

        // Auto-generate SKU when import number changes
        document.getElementById('productImportNumber').addEventListener('input', (e) => {
            this.generateSku(e.target.value);
        });

        // Modal close buttons
        document.querySelectorAll('[data-close="modalProduct"]').forEach(btn => {
            btn.addEventListener('click', () => Utils.closeModal('modalProduct'));
        });
    },

    handleHeaderSort(sortField) {
        // Map header sort fields to our sort fields
        const fieldMap = {
            'sku': 'name', // sort by name when clicking SKU (more useful)
            'name': 'name',
            'import': 'import',
            'cost': 'cost',
            'price': 'price',
            'date': 'date'
        };

        const mapped = fieldMap[sortField] || sortField;

        if (this.currentSort.field === mapped) {
            // Toggle direction
            this.currentSort.direction = this.currentSort.direction === 'asc' ? 'desc' : 'asc';
        } else {
            this.currentSort.field = mapped;
            this.currentSort.direction = 'desc'; // Default to desc for most useful view
        }

        // Sync the dropdown
        const selectVal = `${mapped}-${this.currentSort.direction}`;
        const select = document.getElementById('productSortSelect');
        const option = select.querySelector(`option[value="${selectVal}"]`);
        if (option) {
            select.value = selectVal;
        } else {
            select.value = 'default';
        }

        this.updateSortableHeaders();
        this.filterProducts();
    },

    updateSortableHeaders() {
        // Clear all header states
        document.querySelectorAll('#productsTableEl .sortable-th').forEach(th => {
            th.classList.remove('sort-asc', 'sort-desc');
        });

        if (this.currentSort.field === 'default') return;

        // Map back to header data-sort
        const reverseMap = {
            'name': 'name',
            'import': 'import',
            'cost': 'cost',
            'price': 'price',
            'date': 'date'
        };

        const headerField = reverseMap[this.currentSort.field];
        if (headerField) {
            const th = document.querySelector(`#productsTableEl .sortable-th[data-sort="${headerField}"]`);
            if (th) {
                th.classList.add(this.currentSort.direction === 'asc' ? 'sort-asc' : 'sort-desc');
            }
        }
    },

    clearFilters() {
        document.getElementById('searchProducts').value = '';
        document.getElementById('productSortSelect').value = 'default';
        document.getElementById('filterProductCategory').value = '';
        document.getElementById('filterStatus').value = '';
        this.currentSort = { field: 'default', direction: 'asc' };
        this.updateSortableHeaders();
        this.filterProducts();
    },

    generateSku(importNumber) {
        const skuInput = document.getElementById('productSku');
        if (!importNumber || importNumber < 1) {
            skuInput.value = '';
            return;
        }

        // Generate random letter A-Z
        const randomLetter = String.fromCharCode(65 + Math.floor(Math.random() * 26));

        // Generate random number 0-9
        const randomNumber = Math.floor(Math.random() * 10);

        // Generate SKU: format {LetraAleatoria}{NumeroAleatorio}{NumeroImportacion}
        skuInput.value = `${randomLetter}${randomNumber}${importNumber}`;
    },

    async render() {
        await this.populateCategories();
        await this.filterProducts();
    },

    async populateCategories() {
        try {
            const products = await Database.getProducts();
            const categories = [...new Set(products.map(p => p.category).filter(Boolean))].sort();
            const select = document.getElementById('filterProductCategory');
            const currentVal = select.value;

            // Keep the first "all" option, replace the rest
            select.innerHTML = '<option value="">Todas las categorías</option>';
            categories.forEach(cat => {
                const opt = document.createElement('option');
                opt.value = cat;
                opt.textContent = cat;
                select.appendChild(opt);
            });

            // Restore selection if it still exists
            if (currentVal && categories.includes(currentVal)) {
                select.value = currentVal;
            }
        } catch (e) {
            console.error('Error populating categories:', e);
        }
    },

    async filterProducts() {
        const searchQuery = document.getElementById('searchProducts').value.toLowerCase();
        const statusFilter = document.getElementById('filterStatus').value;
        const categoryFilter = document.getElementById('filterProductCategory').value;

        let products = await Database.getProducts();
        const totalProducts = products.length;

        // Apply search filter
        if (searchQuery) {
            products = products.filter(p =>
                p.name.toLowerCase().includes(searchQuery) ||
                p.sku.toLowerCase().includes(searchQuery) ||
                (p.import_number && p.import_number.toString().includes(searchQuery))
            );
        }

        // Apply status filter
        if (statusFilter !== '') {
            const isActive = statusFilter === 'true';
            products = products.filter(p => p.active === isActive);
        }

        // Apply category filter
        if (categoryFilter) {
            products = products.filter(p => p.category === categoryFilter);
        }

        // Apply sorting
        products = this.sortProducts(products);

        // Render summary, count, table
        this.renderSummary(products, totalProducts);
        this.renderCount(products.length, totalProducts);
        this.renderTable(products);
    },

    sortProducts(products) {
        const { field, direction } = this.currentSort;

        if (field === 'default') return products;

        const sorted = [...products].sort((a, b) => {
            let valA, valB;

            switch (field) {
                case 'price':
                    valA = parseFloat(a.price) || 0;
                    valB = parseFloat(b.price) || 0;
                    break;
                case 'cost':
                    valA = this.getRealCost(a);
                    valB = this.getRealCost(b);
                    break;
                case 'name':
                    valA = (a.name || '').toLowerCase();
                    valB = (b.name || '').toLowerCase();
                    return direction === 'asc'
                        ? valA.localeCompare(valB, 'es')
                        : valB.localeCompare(valA, 'es');
                case 'margin':
                    valA = this.calcMarginPct(a);
                    valB = this.calcMarginPct(b);
                    break;
                case 'date':
                    valA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
                    valB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
                    break;
                case 'import':
                    valA = parseInt(a.import_number) || 0;
                    valB = parseInt(b.import_number) || 0;
                    break;
                default:
                    return 0;
            }

            if (direction === 'asc') return valA - valB;
            return valB - valA;
        });

        return sorted;
    },

    calcMarginPct(product) {
        const price = parseFloat(product.price) || 0;
        const cost = this.getRealCost(product);
        if (price === 0) return 0;
        return ((price - cost) / price) * 100;
    },

    renderSummary(products, totalProducts) {
        const container = document.getElementById('productsSummary');
        const admin = this.isAdmin();

        if (products.length === 0) {
            container.innerHTML = '';
            return;
        }

        const activeCount = products.filter(p => p.active).length;
        const totalPrice = products.reduce((sum, p) => sum + (parseFloat(p.price) || 0), 0);
        const avgPrice = products.length > 0 ? totalPrice / products.length : 0;

        let costCards = '';
        if (admin) {
            const totalCost = products.reduce((sum, p) => sum + this.getRealCost(p), 0);
            const avgCost = products.length > 0 ? totalCost / products.length : 0;
            const avgMargin = products.length > 0
                ? products.reduce((sum, p) => sum + this.calcMarginPct(p), 0) / products.length
                : 0;

            costCards = `
            <div class="product-summary-card">
                <div class="product-summary-icon" style="background: rgba(245, 158, 11, 0.1); color: #f59e0b;">💰</div>
                <div class="product-summary-info">
                    <span class="product-summary-value">${Utils.formatCurrency(avgCost)}</span>
                    <span class="product-summary-label">Costo promedio</span>
                </div>
            </div>
            <div class="product-summary-card">
                <div class="product-summary-icon" style="background: ${avgMargin >= 0 ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)'}; color: ${avgMargin >= 0 ? '#10b981' : '#ef4444'};">📊</div>
                <div class="product-summary-info">
                    <span class="product-summary-value">${avgMargin.toFixed(1)}%</span>
                    <span class="product-summary-label">Margen promedio</span>
                </div>
            </div>
            `;
        }

        container.innerHTML = `
            <div class="product-summary-card">
                <div class="product-summary-icon" style="background: rgba(99, 102, 241, 0.1); color: #6366f1;">📦</div>
                <div class="product-summary-info">
                    <span class="product-summary-value">${products.length}</span>
                    <span class="product-summary-label">Productos${products.length !== totalProducts ? ' (filtrados)' : ''}</span>
                </div>
            </div>
            <div class="product-summary-card">
                <div class="product-summary-icon" style="background: rgba(16, 185, 129, 0.1); color: #10b981;">✓</div>
                <div class="product-summary-info">
                    <span class="product-summary-value">${activeCount}</span>
                    <span class="product-summary-label">Activos</span>
                </div>
            </div>
            <div class="product-summary-card">
                <div class="product-summary-icon" style="background: rgba(59, 130, 246, 0.1); color: #3b82f6;">💲</div>
                <div class="product-summary-info">
                    <span class="product-summary-value">${Utils.formatCurrency(avgPrice)}</span>
                    <span class="product-summary-label">Precio promedio</span>
                </div>
            </div>
            ${costCards}
        `;
    },

    renderCount(filteredCount, totalCount) {
        const container = document.getElementById('productsCount');
        if (filteredCount === totalCount) {
            container.textContent = `Mostrando ${totalCount} producto${totalCount !== 1 ? 's' : ''}`;
        } else {
            container.textContent = `Mostrando ${filteredCount} de ${totalCount} producto${totalCount !== 1 ? 's' : ''}`;
        }
    },

    renderTable(products) {
        const tbody = document.getElementById('productsTable');
        const admin = this.isAdmin();

        // Show/hide cost and margin columns based on role
        const costHeader = document.querySelector('#productsTableEl .sortable-th[data-sort="cost"]');
        const marginHeader = document.querySelector('#productsTableEl th:nth-child(6)');
        if (costHeader) costHeader.style.display = admin ? '' : 'none';
        if (marginHeader) marginHeader.style.display = admin ? '' : 'none';

        // Hide cost sort options for non-admin
        const sortSelect = document.getElementById('productSortSelect');
        if (sortSelect) {
            sortSelect.querySelectorAll('option').forEach(opt => {
                if (opt.value.startsWith('cost-') || opt.value.startsWith('margin-')) {
                    opt.style.display = admin ? '' : 'none';
                }
            });
        }

        if (products.length === 0) {
            const colSpan = admin ? 9 : 7;
            tbody.innerHTML = `
                <tr>
                    <td colspan="${colSpan}" style="text-align: center; padding: 2rem; color: var(--text-muted);">
                        No se encontraron productos
                    </td>
                </tr>
            `;
            return;
        }

        tbody.innerHTML = products.map(product => {
            // Format creation date
            const createdDate = product.createdAt ? new Date(product.createdAt).toLocaleDateString('es-CO', {
                year: 'numeric',
                month: 'short',
                day: 'numeric'
            }) : '-';

            const price = parseFloat(product.price) || 0;

            // Cost and margin only for admin
            let costCell = '';
            let marginCell = '';
            if (admin) {
                const cost = this.getRealCost(product);
                const marginAmount = price - cost;
                const marginPct = price > 0 ? ((marginAmount / price) * 100) : 0;
                const marginClass = marginPct > 0 ? 'positive' : (marginPct < 0 ? 'negative' : 'neutral');

                costCell = `<td><span style="color: var(--warning);">${Utils.formatCurrency(cost)}</span></td>`;
                marginCell = `<td>
                    <span class="margin-badge ${marginClass}">
                        ${marginPct >= 0 ? '+' : ''}${marginPct.toFixed(1)}%
                    </span>
                    <br><small style="color: var(--text-muted);">${Utils.formatCurrency(marginAmount)}</small>
                </td>`;
            }

            return `
            <tr>
                <td><code style="color: var(--primary);">${Utils.escapeHtml(product.sku)}</code></td>
                <td>
                    <strong>${Utils.escapeHtml(product.name)}</strong>
                    <br><small style="color: var(--text-muted);">${Utils.escapeHtml(product.description || '')}</small>
                    ${product.category ? `<br><small style="color: var(--primary); opacity: 0.7;">${Utils.escapeHtml(product.category)}</small>` : ''}
                </td>
                <td>${product.import_number || '-'}</td>
                ${costCell}
                <td><span style="color: var(--success);">${Utils.formatCurrency(price)}</span></td>
                ${marginCell}
                <td>
                    <span style="font-size: 0.8rem; color: var(--text-muted);">${createdDate}</span>
                </td>
                <td>
                    <span class="status-badge ${product.active ? 'active' : 'inactive'}">
                        ${product.active ? 'Activo' : 'Inactivo'}
                    </span>
                </td>
                <td>
                    <button class="btn btn-icon btn-secondary" onclick="ProductsModule.editProduct('${product.id}')" title="Editar">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                        </svg>
                    </button>
                    <button class="btn btn-icon btn-secondary" onclick="ProductsModule.deleteProduct('${product.id}')" title="Eliminar">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <polyline points="3 6 5 6 21 6"></polyline>
                            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                        </svg>
                    </button>
                </td>
            </tr>
        `}).join('');
    },

    async openProductModal(productId = null) {
        const modal = document.getElementById('modalProduct');
        const form = document.getElementById('formProduct');
        const title = document.getElementById('modalProductTitle');
        const admin = this.isAdmin();

        // Show/hide cost field based on role
        const costGroup = document.getElementById('productCost')?.closest('.form-group');
        if (costGroup) {
            costGroup.style.display = admin ? '' : 'none';
        }

        form.reset();
        document.getElementById('productId').value = '';
        document.getElementById('productActive').checked = true;

        if (productId) {
            const product = await Database.getProduct(productId);
            if (product) {
                title.textContent = 'Editar Producto';
                document.getElementById('productId').value = product.id;
                document.getElementById('productName').value = product.name;
                document.getElementById('productImportNumber').value = product.import_number || '';
                document.getElementById('productSku').value = product.sku;
                document.getElementById('productDescription').value = product.description || '';
                document.getElementById('productCategory').value = product.category || '';
                // Show real cost for admin (decoded)
                if (admin) {
                    document.getElementById('productCost').value = this.getRealCost(product) || '';
                }
                document.getElementById('productPrice').value = product.price;
                document.getElementById('productActive').checked = product.active;
            }
        } else {
            title.textContent = 'Nuevo Producto';
        }

        Utils.openModal('modalProduct');
    },

    editProduct(productId) {
        this.openProductModal(productId);
    },

    async saveProduct() {
        const importNumber = document.getElementById('productImportNumber').value;
        const sku = document.getElementById('productSku').value.trim();

        // Validate import number is entered
        if (!importNumber) {
            Utils.showToast('Ingrese el Número de Importación', 'error');
            return;
        }

        // Validate SKU was generated
        if (!sku) {
            Utils.showToast('El SKU no se ha generado correctamente', 'error');
            return;
        }

        const product = {
            id: document.getElementById('productId').value || null,
            name: document.getElementById('productName').value.trim(),
            sku: sku,
            description: document.getElementById('productDescription').value.trim(),
            category: document.getElementById('productCategory').value,
            import_number: parseInt(importNumber),
            cost: this.isAdmin() ? (parseFloat(document.getElementById('productCost').value) || 0) / this.COST_FACTOR : undefined,
            price: parseFloat(document.getElementById('productPrice').value),
            active: document.getElementById('productActive').checked
        };

        try {
            // Validate SKU uniqueness
            const existingProducts = await Database.getProducts();
            const duplicateSku = existingProducts.find(p =>
                p.sku.toLowerCase() === product.sku.toLowerCase() && p.id !== product.id
            );

            if (duplicateSku) {
                Utils.showToast('Ya existe un producto con este SKU', 'error');
                return;
            }

            await Database.saveProduct(product);
            Utils.closeModal('modalProduct');
            Utils.showToast(product.id ? 'Producto actualizado correctamente' : 'Producto creado correctamente', 'success');
            await this.render();
            App.updateDashboard();
        } catch (error) {
            console.error('Error saving product:', error);
            const msg = error.message || 'Error al guardar el producto';
            Utils.showToast(msg, 'error');
        }
    },

    async deleteProduct(productId) {
        if (confirm('¿Está seguro de ELIMINAR permanentemente este producto? Esta acción no se puede deshacer.')) {
            try {
                await Database.deleteProduct(productId);
                Utils.showToast('Producto eliminado correctamente', 'success');
                await this.render();
                App.updateDashboard();
            } catch (error) {
                console.error('Error deleting product:', error);
                Utils.showToast('Error al eliminar el producto', 'error');
            }
        }
    }
};

// Make module available globally
window.ProductsModule = ProductsModule;
