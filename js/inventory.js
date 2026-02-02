// ========================================
// Inventory Module (Async - Supabase)
// ========================================

const InventoryModule = {
    currentCity: 'all',

    init() {
        this.bindEvents();
    },

    bindEvents() {
        // City tabs
        document.querySelectorAll('.city-tab').forEach(tab => {
            tab.addEventListener('click', (e) => {
                document.querySelectorAll('.city-tab').forEach(t => t.classList.remove('active'));
                e.target.classList.add('active');
                this.currentCity = e.target.dataset.city;
                this.render();
            });
        });

        // Update stock button
        document.getElementById('btnUpdateStock').addEventListener('click', () => {
            this.openStockModal();
        });

        // Stock form submission
        document.getElementById('formStock').addEventListener('submit', (e) => {
            e.preventDefault();
            this.updateStock();
        });

        // Modal close buttons
        document.querySelectorAll('[data-close="modalStock"]').forEach(btn => {
            btn.addEventListener('click', () => Utils.closeModal('modalStock'));
        });
    },

    async render() {
        const inventory = await Database.getInventoryByCity(this.currentCity);
        const container = document.getElementById('inventoryGrid');

        if (inventory.length === 0) {
            container.innerHTML = `
                <div style="grid-column: 1 / -1; text-align: center; padding: 3rem; color: var(--text-muted);">
                    <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1" style="margin-bottom: 1rem; opacity: 0.5;">
                        <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path>
                    </svg>
                    <p>No hay inventario registrado${this.currentCity !== 'all' ? ' en ' + this.currentCity : ''}</p>
                    <button class="btn btn-primary" style="margin-top: 1rem;" onclick="InventoryModule.openStockModal()">
                        Agregar Stock
                    </button>
                </div>
            `;
            return;
        }

        container.innerHTML = inventory.map(item => {
            const isLowStock = item.isLowStock || item.available <= item.minStock;
            const cityClass = item.city.toLowerCase();

            return `
                <div class="inventory-card ${isLowStock ? 'low-stock' : ''}">
                    <div class="inventory-header">
                        <div>
                            <div class="inventory-product">${Utils.escapeHtml(item.productName)}</div>
                            <div class="inventory-sku">${Utils.escapeHtml(item.sku)}</div>
                        </div>
                        <span class="city-badge ${cityClass}">${item.city}</span>
                    </div>
                    <div class="inventory-stats">
                        <div class="inventory-stat">
                            <div class="inventory-stat-value ${isLowStock ? 'warning' : ''}">${item.available}</div>
                            <div class="inventory-stat-label">Disponible</div>
                        </div>
                        <div class="inventory-stat">
                            <div class="inventory-stat-value">${item.reserved}</div>
                            <div class="inventory-stat-label">Reservado</div>
                        </div>
                        <div class="inventory-stat">
                            <div class="inventory-stat-value">${item.minStock}</div>
                            <div class="inventory-stat-label">Mínimo</div>
                        </div>
                    </div>
                    ${isLowStock ? `
                        <div style="margin-top: 1rem; padding: 0.5rem; background: var(--danger-light); border-radius: var(--radius-sm); text-align: center;">
                            <span style="color: var(--danger); font-size: 0.75rem; font-weight: 600;">
                                ⚠ STOCK BAJO
                            </span>
                        </div>
                    ` : ''}
                </div>
            `;
        }).join('');
    },

    async openStockModal() {
        const form = document.getElementById('formStock');
        form.reset();

        // Populate products dropdown
        const productSelect = document.getElementById('stockProduct');
        const products = await Database.getProducts();
        const activeProducts = products.filter(p => p.active);

        productSelect.innerHTML = '<option value="">Seleccionar producto...</option>';
        activeProducts.forEach(product => {
            productSelect.innerHTML += `<option value="${product.id}">${product.name} (${product.sku})</option>`;
        });

        Utils.openModal('modalStock');
    },

    async updateStock() {
        const productId = document.getElementById('stockProduct').value;
        const city = document.getElementById('stockCity').value;
        const movementType = document.getElementById('stockMovementType').value;
        const quantity = parseInt(document.getElementById('stockQuantity').value);
        const reason = document.getElementById('stockReason').value.trim();
        const minStock = parseInt(document.getElementById('stockMinimum').value) || 5;

        if (!productId || !city || !quantity || !reason) {
            Utils.showToast('Complete todos los campos requeridos', 'error');
            return;
        }

        try {
            // Get current stock
            const currentInventory = await Database.getInventoryByProduct(productId, city);
            const previousStock = currentInventory ? currentInventory.available : 0;

            let newStock;
            let actualQuantity;

            if (movementType === 'entrada') {
                // Add stock
                actualQuantity = quantity;
                newStock = previousStock + quantity;
                await Database.updateInventory(productId, city, quantity, minStock);
            } else {
                // Remove stock
                if (previousStock < quantity) {
                    Utils.showToast(`Stock insuficiente. Disponible: ${previousStock}`, 'error');
                    return;
                }
                actualQuantity = -quantity;
                newStock = previousStock - quantity;
                await Database.decreaseStock(productId, city, quantity);
            }

            // Register movement in database (if table exists)
            try {
                await Database.registerInventoryMovement({
                    productId,
                    city,
                    movementType,
                    quantity: Math.abs(quantity),
                    previousStock,
                    newStock,
                    reason
                });
            } catch (err) {
                console.warn('Could not register movement (table may not exist yet):', err);
            }

            Utils.closeModal('modalStock');
            const action = movementType === 'entrada' ? 'agregado' : 'retirado';
            Utils.showToast(`Stock ${action} correctamente. ${reason}`, 'success');
            await this.render();
            App.updateDashboard();
        } catch (error) {
            console.error('Error updating stock:', error);
            Utils.showToast('Error al actualizar el stock', 'error');
        }
    },

    async getAvailableStock(productId, city) {
        const inventory = await Database.getInventoryByProduct(productId, city);
        return inventory ? inventory.available : 0;
    }
};

// Make module available globally
window.InventoryModule = InventoryModule;
