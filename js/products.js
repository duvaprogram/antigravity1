// ========================================
// Products Module (Async - Supabase)
// ========================================

const ProductsModule = {
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

        // Search products
        document.getElementById('searchProducts').addEventListener('input',
            Utils.debounce((e) => this.filterProducts(), 300)
        );

        // Filter by category
        document.getElementById('filterCategory').addEventListener('change', () => {
            this.filterProducts();
        });

        // Filter by status
        document.getElementById('filterStatus').addEventListener('change', () => {
            this.filterProducts();
        });

        // Modal close buttons
        document.querySelectorAll('[data-close="modalProduct"]').forEach(btn => {
            btn.addEventListener('click', () => Utils.closeModal('modalProduct'));
        });
    },

    async render() {
        await this.filterProducts();
    },

    async filterProducts() {
        const searchQuery = document.getElementById('searchProducts').value.toLowerCase();
        const categoryFilter = document.getElementById('filterCategory').value;
        const statusFilter = document.getElementById('filterStatus').value;

        let products = await Database.getProducts();

        // Apply filters
        if (searchQuery) {
            products = products.filter(p =>
                p.name.toLowerCase().includes(searchQuery) ||
                p.sku.toLowerCase().includes(searchQuery)
            );
        }

        if (categoryFilter) {
            products = products.filter(p => p.category === categoryFilter);
        }

        if (statusFilter !== '') {
            const isActive = statusFilter === 'true';
            products = products.filter(p => p.active === isActive);
        }

        this.renderTable(products);
    },

    renderTable(products) {
        const tbody = document.getElementById('productsTable');

        if (products.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="6" style="text-align: center; padding: 2rem; color: var(--text-muted);">
                        No se encontraron productos
                    </td>
                </tr>
            `;
            return;
        }

        tbody.innerHTML = products.map(product => `
            <tr>
                <td><code style="color: var(--primary);">${Utils.escapeHtml(product.sku)}</code></td>
                <td>
                    <strong>${Utils.escapeHtml(product.name)}</strong>
                    <br><small style="color: var(--text-muted);">${Utils.escapeHtml(product.description || '')}</small>
                </td>
                <td>${Utils.escapeHtml(product.category)}</td>
                <td>${Utils.formatCurrency(product.price)}</td>
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
        `).join('');
    },

    async openProductModal(productId = null) {
        const modal = document.getElementById('modalProduct');
        const form = document.getElementById('formProduct');
        const title = document.getElementById('modalProductTitle');

        form.reset();
        document.getElementById('productId').value = '';
        document.getElementById('productActive').checked = true;

        if (productId) {
            const product = await Database.getProduct(productId);
            if (product) {
                title.textContent = 'Editar Producto';
                document.getElementById('productId').value = product.id;
                document.getElementById('productName').value = product.name;
                document.getElementById('productSku').value = product.sku;
                document.getElementById('productDescription').value = product.description || '';
                document.getElementById('productCategory').value = product.category;
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
        const product = {
            id: document.getElementById('productId').value || null,
            name: document.getElementById('productName').value.trim(),
            sku: document.getElementById('productSku').value.trim(),
            description: document.getElementById('productDescription').value.trim(),
            category: document.getElementById('productCategory').value,
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
            Utils.showToast('Error al guardar el producto', 'error');
        }
    },

    async deleteProduct(productId) {
        if (confirm('¿Está seguro de desactivar este producto?')) {
            try {
                await Database.deleteProduct(productId);
                Utils.showToast('Producto desactivado correctamente', 'success');
                await this.render();
                App.updateDashboard();
            } catch (error) {
                console.error('Error deleting product:', error);
                Utils.showToast('Error al desactivar el producto', 'error');
            }
        }
    }
};

// Make module available globally
window.ProductsModule = ProductsModule;
