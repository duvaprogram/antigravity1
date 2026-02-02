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

        // History button
        document.getElementById('btnInventoryHistory').addEventListener('click', () => {
            this.openHistoryModal();
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

        document.querySelectorAll('[data-close="modalInventoryHistory"]').forEach(btn => {
            btn.addEventListener('click', () => Utils.closeModal('modalInventoryHistory'));
        });

        // History filters
        this.bindHistoryFilters();
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
                    <div style="margin-top: 1rem; text-align: right;">
                        <button class="btn btn-icon btn-secondary" onclick="InventoryModule.deleteInventoryItem('${item.productId}', '${item.city}')" title="Eliminar del inventario" style="color: var(--danger);">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <polyline points="3 6 5 6 21 6"></polyline>
                                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                            </svg>
                        </button>
                    </div>
                </div>
            `;
        }).join('');
    },

    async deleteInventoryItem(productId, city) {
        if (confirm(`¿Está seguro de ELIMINAR el inventario de este producto en ${city}? Esta acción no se puede deshacer.`)) {
            try {
                await Database.deleteInventory(productId, city);
                Utils.showToast('Inventario eliminado correctamente', 'success');
                await this.render();
                App.updateDashboard();
            } catch (error) {
                console.error('Error deleting inventory:', error);
                Utils.showToast('Error al eliminar el inventario', 'error');
            }
        }
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

        if (!productId || !city || (isNaN(quantity) && movementType !== 'ajuste') || !reason) {
            Utils.showToast('Complete todos los campos requeridos', 'error');
            return;
        }

        // For adjustment, 0 is allowed. For others, must be > 0
        if (movementType !== 'ajuste' && quantity <= 0) {
            Utils.showToast('La cantidad debe ser mayor a 0', 'error');
            return;
        }

        try {
            // Get current stock
            const currentInventory = await Database.getInventoryByProduct(productId, city);
            const previousStock = currentInventory ? currentInventory.available : 0;

            let newStock;
            let actualQuantity; // This is the delta for history

            if (movementType === 'entrada') {
                // Add stock
                actualQuantity = quantity;
                newStock = previousStock + quantity;
                await Database.updateInventory(productId, city, quantity, minStock, false);
            } else if (movementType === 'salida') {
                // Remove stock
                if (previousStock < quantity) {
                    Utils.showToast(`Stock insuficiente. Disponible: ${previousStock}`, 'error');
                    return;
                }
                actualQuantity = -quantity;
                newStock = previousStock - quantity;
                await Database.decreaseStock(productId, city, quantity);
            } else if (movementType === 'ajuste') {
                // Fix stock (Set value directly)
                actualQuantity = quantity - previousStock; // Delta = New - Old
                newStock = quantity;
                await Database.updateInventory(productId, city, quantity, minStock, true);
            }

            // Register movement in database
            try {
                await Database.registerInventoryMovement({
                    productId,
                    city,
                    movementType,
                    quantity: Math.abs(actualQuantity),
                    previousStock,
                    newStock,
                    reason
                });
            } catch (err) {
                console.warn('Could not register movement:', err);
            }

            Utils.closeModal('modalStock');
            let actionText = 'actualizado';
            if (movementType === 'entrada') actionText = 'agregado';
            else if (movementType === 'salida') actionText = 'retirado';
            else if (movementType === 'ajuste') actionText = 'corregido';

            Utils.showToast(`Stock ${actionText} correctamente.`, 'success');
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
    },

    async openHistoryModal() {
        // Clear filters
        document.getElementById('filterHistoryCity').value = '';
        document.getElementById('filterHistoryType').value = '';
        document.getElementById('filterHistoryDate').value = '';

        // Load history
        await this.loadHistory();
        Utils.openModal('modalInventoryHistory');
    },

    async loadHistory() {
        const cityFilter = document.getElementById('filterHistoryCity').value;
        const typeFilter = document.getElementById('filterHistoryType').value;
        const dateFilter = document.getElementById('filterHistoryDate').value;

        const filters = {};
        if (cityFilter) filters.city = cityFilter;
        if (typeFilter) filters.movementType = typeFilter;
        if (dateFilter) filters.date = dateFilter;

        const movements = await Database.getInventoryMovements(filters);
        this.renderHistoryTable(movements);
    },

    renderHistoryTable(movements) {
        const tbody = document.getElementById('inventoryHistoryTable');

        if (movements.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="9" style="text-align: center; padding: 2rem; color: var(--text-muted);">
                        No se encontraron movimientos de inventario
                    </td>
                </tr>
            `;
            return;
        }

        tbody.innerHTML = movements.map(m => {
            const typeClass = m.movementType === 'entrada' ? 'success' : 'danger';
            const typeIcon = m.movementType === 'entrada' ? '➕' : '➖';
            const typeLabel = m.movementType === 'entrada' ? 'Entrada' : 'Salida';
            const cityClass = m.city.toLowerCase();

            return `
                <tr>
                    <td>${Utils.formatDate(m.createdAt, true)}</td>
                    <td>
                        <strong>${Utils.escapeHtml(m.productName)}</strong>
                        <br><small style="color: var(--text-muted);">${Utils.escapeHtml(m.sku)}</small>
                    </td>
                    <td><span class="city-badge ${cityClass}">${m.city}</span></td>
                    <td>
                        <span style="color: var(--${typeClass}); font-weight: 600;">
                            ${typeIcon} ${typeLabel}
                        </span>
                    </td>
                    <td><strong>${m.quantity}</strong></td>
                    <td>${m.previousStock}</td>
                    <td><strong>${m.newStock}</strong></td>
                    <td>${Utils.escapeHtml(m.reason || '')}</td>
                    <td>${Utils.escapeHtml(m.createdBy || 'Sistema')}</td>
                </tr>
            `;
        }).join('');
    },

    bindHistoryFilters() {
        const filterCity = document.getElementById('filterHistoryCity');
        const filterType = document.getElementById('filterHistoryType');
        const filterDate = document.getElementById('filterHistoryDate');

        if (filterCity) {
            filterCity.addEventListener('change', () => this.loadHistory());
        }
        if (filterType) {
            filterType.addEventListener('change', () => this.loadHistory());
        }
        if (filterDate) {
            filterDate.addEventListener('change', () => this.loadHistory());
        }
    }
};

// Make module available globally
window.InventoryModule = InventoryModule;
