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

        // Filter by status
        document.getElementById('filterStatus').addEventListener('change', () => {
            this.filterProducts();
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
        await this.filterProducts();
    },

    async filterProducts() {
        const searchQuery = document.getElementById('searchProducts').value.toLowerCase();
        const statusFilter = document.getElementById('filterStatus').value;

        let products = await Database.getProducts();

        // Apply filters
        if (searchQuery) {
            products = products.filter(p =>
                p.name.toLowerCase().includes(searchQuery) ||
                p.sku.toLowerCase().includes(searchQuery) ||
                (p.import_number && p.import_number.toString().includes(searchQuery))
            );
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
                    <td colspan="7" style="text-align: center; padding: 2rem; color: var(--text-muted);">
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

            return `
            <tr>
                <td><code style="color: var(--primary);">${Utils.escapeHtml(product.sku)}</code></td>
                <td>
                    <strong>${Utils.escapeHtml(product.name)}</strong>
                    <br><small style="color: var(--text-muted);">${Utils.escapeHtml(product.description || '')}</small>
                </td>
                <td>${product.import_number || '-'}</td>
                <td>${Utils.formatCurrency(product.price)}</td>
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
            import_number: parseInt(importNumber),
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
            alert('Error detallado: ' + JSON.stringify(error, null, 2));
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
