// ========================================
// Guides Module (Async - Supabase)
// ========================================

const GuidesModule = {
    currentGuideItems: [],

    init() {
        this.bindEvents();
    },

    bindEvents() {
        // New guide button
        document.getElementById('btnNewGuide').addEventListener('click', () => {
            this.openGuideModal();
        });

        // Guide form submission
        document.getElementById('formGuide').addEventListener('submit', (e) => {
            e.preventDefault();
            this.saveGuide();
        });

        // Client selection change
        document.getElementById('guideClient').addEventListener('change', (e) => {
            this.onClientSelect(e.target.value);
        });

        // Add product to guide
        document.getElementById('btnAddProductToGuide').addEventListener('click', () => {
            this.addProductToGuide();
        });

        // Product selection change - update price input
        document.getElementById('guideProductSelect').addEventListener('change', (e) => {
            const option = e.target.selectedOptions[0];
            const priceInput = document.getElementById('guideProductPrice');
            if (option && option.dataset.price) {
                priceInput.value = option.dataset.price;
            } else {
                priceInput.value = '';
            }
        });

        // Search guides
        document.getElementById('searchGuides').addEventListener('input',
            Utils.debounce(() => this.filterGuides(), 300)
        );

        // Filter by status
        document.getElementById('filterGuideStatus').addEventListener('change', () => {
            this.filterGuides();
        });

        // Modal close buttons
        document.querySelectorAll('[data-close="modalGuide"]').forEach(btn => {
            btn.addEventListener('click', () => Utils.closeModal('modalGuide'));
        });

        document.querySelectorAll('[data-close="modalGuideDetails"]').forEach(btn => {
            btn.addEventListener('click', () => Utils.closeModal('modalGuideDetails'));
        });

        // Print guide
        document.getElementById('btnPrintGuide').addEventListener('click', () => {
            this.printGuide();
        });
    },

    async render() {
        await this.filterGuides();
    },

    async filterGuides() {
        const searchQuery = document.getElementById('searchGuides').value.toLowerCase();
        const statusFilter = document.getElementById('filterGuideStatus').value;

        let guides = await Database.getGuides();

        // Sort by date (newest first)
        guides.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

        // Apply filters
        if (searchQuery) {
            guides = guides.filter(g => {
                return g.guideNumber.toLowerCase().includes(searchQuery) ||
                    (g.clientName && g.clientName.toLowerCase().includes(searchQuery));
            });
        }

        if (statusFilter) {
            guides = guides.filter(g => g.status === statusFilter);
        }

        this.renderTable(guides);
    },

    renderTable(guides) {
        const tbody = document.getElementById('guidesTable');

        if (guides.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="8" style="text-align: center; padding: 2rem; color: var(--text-muted);">
                        No se encontraron guías
                    </td>
                </tr>
            `;
            return;
        }

        tbody.innerHTML = guides.map(guide => {
            const cityClass = guide.city.toLowerCase();
            const statusClass = Utils.getStatusClass(guide.status);

            let paymentInfo = Utils.formatCurrency(guide.totalAmount);
            if (guide.city === 'Caracas') {
                let details = [];
                if (guide.amountUsd) details.push(`<span style="color: var(--success); font-weight: 500;">$${guide.amountUsd} USD</span>`);
                if (guide.paymentBs) details.push(`<span style="color: var(--info); font-weight: 500;">${guide.paymentBs} Bs</span>`);
                if (guide.deliveryTime) details.push(`<span style="color: var(--text-muted); font-size: 0.9em;">🕒 ${guide.deliveryTime}</span>`);

                if (details.length > 0) {
                    paymentInfo = `<div style="display: flex; flex-direction: column; gap: 2px;">${details.join('')}</div>`;
                }
            }

            return `
                <tr>
                    <td>
                        <strong style="color: var(--primary);">${guide.guideNumber}</strong>
                    </td>
                    <td>${Utils.formatDate(guide.createdAt)}</td>
                    <td>${guide.clientName ? Utils.escapeHtml(guide.clientName) : 'Cliente eliminado'}</td>
                    <td><span class="city-badge ${cityClass}">${guide.city}</span></td>
                    <td>${guide.itemsCount || 0} items</td>
                    <td>${paymentInfo}</td>
                    <td>
                        <span class="status-badge ${statusClass}">${guide.status}</span>
                    </td>
                    <td>
                        <div style="display: flex; gap: 4px;">
                            <button class="btn btn-icon btn-secondary" onclick="GuidesModule.viewGuide('${guide.id}')" title="Ver detalles">
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                                    <circle cx="12" cy="12" r="3"></circle>
                                </svg>
                            </button>
                            ${guide.status === 'Pendiente' ? `
                                <button class="btn btn-icon btn-secondary" onclick="GuidesModule.changeStatus('${guide.id}', 'En ruta')" title="Marcar en ruta">
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                        <circle cx="12" cy="12" r="10"></circle>
                                        <polyline points="12 6 12 12 16 14"></polyline>
                                    </svg>
                                </button>
                                <button class="btn btn-icon btn-secondary" onclick="GuidesModule.changeStatus('${guide.id}', 'Cancelado')" title="Anular Guía" style="color: var(--danger);">
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                        <circle cx="12" cy="12" r="10"></circle>
                                        <line x1="15" y1="9" x2="9" y2="15"></line>
                                        <line x1="9" y1="9" x2="15" y2="15"></line>
                                    </svg>
                                </button>
                            ` : ''}
                            ${guide.status === 'En ruta' ? `
                                <button class="btn btn-icon btn-secondary" onclick="GuidesModule.changeStatus('${guide.id}', 'Entregado')" title="Marcar entregado" style="color: var(--success);">
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                        <polyline points="20 6 9 17 4 12"></polyline>
                                    </svg>
                                </button>
                            ` : ''}
                            <button class="btn btn-icon btn-secondary" onclick="GuidesModule.deleteGuide('${guide.id}')" title="Eliminar Permanentemente">
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

    async openGuideModal(clientId = null) {
        const form = document.getElementById('formGuide');
        form.reset();
        document.getElementById('guideId').value = '';
        this.currentGuideItems = [];

        // Reset client info display
        document.getElementById('selectedClientInfo').style.display = 'none';

        // Populate clients dropdown
        const clientSelect = document.getElementById('guideClient');
        const clients = await Database.getClients();

        clientSelect.innerHTML = '<option value="">Seleccionar cliente existente...</option>';
        clients.forEach(client => {
            clientSelect.innerHTML += `<option value="${client.id}">${client.fullName} - ${client.city}</option>`;
        });

        // If clientId provided, select it
        if (clientId) {
            clientSelect.value = clientId;
            await this.onClientSelect(clientId);
        }

        // Populate products dropdown (will be filtered by city when client is selected)
        await this.updateProductsDropdown();
        this.updateGuideProductsTable();

        Utils.openModal('modalGuide');
    },

    async createGuideForClient(clientId) {
        await this.openGuideModal(clientId);
        // Navigate to guides section
        App.navigateTo('guides');
    },

    async onClientSelect(clientId) {
        const infoDiv = document.getElementById('selectedClientInfo');

        if (!clientId) {
            infoDiv.style.display = 'none';
            return;
        }

        const client = await Database.getClient(clientId);
        if (client) {
            infoDiv.style.display = 'block';
            document.getElementById('infoClientName').textContent = client.fullName;
            document.getElementById('infoClientPhone').textContent = client.phone;
            document.getElementById('infoClientAddress').textContent = client.address;
            document.getElementById('infoClientCity').textContent = client.city;

            // Update products dropdown filtered by city
            await this.updateProductsDropdown(client.city);

            // Show/Hide Caracas specific fields
            const caracasFields = document.getElementById('caracasFields');
            if (client.city === 'Caracas') {
                caracasFields.style.display = 'block';
            } else {
                caracasFields.style.display = 'none';
            }
        }
    },

    async updateProductsDropdown(city = null) {
        const productSelect = document.getElementById('guideProductSelect');
        const products = await Database.getProducts();
        const activeProducts = products.filter(p => p.active);

        productSelect.innerHTML = '<option value="">Seleccionar producto...</option>';

        for (const product of activeProducts) {
            let stock = 0;
            if (city) {
                const inventory = await Database.getInventoryByProduct(product.id, city);
                stock = inventory ? inventory.available : 0;
            }
            const stockLabel = city ? ` (Stock: ${stock})` : '';
            const disabled = city && stock === 0 ? 'disabled' : '';

            productSelect.innerHTML += `
                <option value="${product.id}" ${disabled} data-price="${product.price}" data-stock="${stock}">
                    ${product.name}${stockLabel}
                </option>
            `;
        }
    },

    async addProductToGuide() {
        const productSelect = document.getElementById('guideProductSelect');
        const productId = productSelect.value;
        const quantity = parseInt(document.getElementById('guideProductQty').value) || 1;
        const clientId = document.getElementById('guideClient').value;

        if (!productId) {
            Utils.showToast('Seleccione un producto', 'warning');
            return;
        }

        if (!clientId) {
            Utils.showToast('Primero seleccione un cliente', 'warning');
            return;
        }

        const client = await Database.getClient(clientId);
        const product = await Database.getProduct(productId);
        const inventory = await Database.getInventoryByProduct(productId, client.city);
        const availableStock = inventory ? inventory.available : 0;

        // Check if product already in list
        const existingIndex = this.currentGuideItems.findIndex(i => i.productId === productId);
        const currentQty = existingIndex >= 0 ? this.currentGuideItems[existingIndex].quantity : 0;

        if (quantity + currentQty > availableStock) {
            Utils.showToast(`Stock insuficiente. Disponible: ${availableStock - currentQty}`, 'error');
            return;
        }

        const manualPrice = parseFloat(document.getElementById('guideProductPrice').value);

        if (isNaN(manualPrice) || manualPrice < 0) {
            Utils.showToast('Ingrese un precio válido', 'warning');
            return;
        }

        if (existingIndex >= 0) {
            this.currentGuideItems[existingIndex].quantity += quantity;
            // Update price only if it's a new entry logic or keep old? 
            // Better to update logic: usually we add separate lines for different prices, but here we merge.
            // Let's assume same product same price for simplicity, or update price to latest manual price.
            // Let's update unit price to the manual one entered now
            this.currentGuideItems[existingIndex].unitPrice = manualPrice;
            this.currentGuideItems[existingIndex].subtotal =
                this.currentGuideItems[existingIndex].quantity * manualPrice;
        } else {
            this.currentGuideItems.push({
                productId,
                productName: product.name,
                quantity,
                unitPrice: manualPrice,
                subtotal: manualPrice * quantity
            });
        }

        // Reset inputs
        document.getElementById('guideProductQty').value = 1;
        document.getElementById('guideProductPrice').value = '';
        productSelect.value = '';
        this.updateGuideProductsTable();
        Utils.showToast('Producto agregado', 'success');
    },

    removeProductFromGuide(index) {
        this.currentGuideItems.splice(index, 1);
        this.updateGuideProductsTable();
    },

    updateGuideProductsTable() {
        const tbody = document.getElementById('guideProductsTable');
        const totalEl = document.getElementById('guideTotal');

        if (this.currentGuideItems.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="5" style="text-align: center; color: var(--text-muted);">
                        No hay productos agregados
                    </td>
                </tr>
            `;
            totalEl.textContent = Utils.formatCurrency(0);
            return;
        }

        tbody.innerHTML = this.currentGuideItems.map((item, index) => `
            <tr>
                <td>${Utils.escapeHtml(item.productName)}</td>
                <td>${item.quantity}</td>
                <td>${Utils.formatCurrency(item.unitPrice)}</td>
                <td>${Utils.formatCurrency(item.subtotal)}</td>
                <td>
                    <button type="button" class="btn btn-icon btn-secondary" onclick="GuidesModule.removeProductFromGuide(${index})">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <line x1="18" y1="6" x2="6" y2="18"></line>
                            <line x1="6" y1="6" x2="18" y2="18"></line>
                        </svg>
                    </button>
                </td>
            </tr>
        `).join('');

        const total = this.currentGuideItems.reduce((sum, item) => sum + item.subtotal, 0);
        totalEl.textContent = Utils.formatCurrency(total);
    },

    async saveGuide() {
        const clientId = document.getElementById('guideClient').value;
        const observations = document.getElementById('guideObservations').value.trim();

        // Caracas specific fields
        const amountUsd = document.getElementById('guideAmountUsd').value;
        const paymentBs = document.getElementById('guidePaymentBs').value;
        const deliveryTime = document.getElementById('guideDeliveryTime').value;

        if (!clientId) {
            Utils.showToast('Seleccione un cliente', 'error');
            return;
        }

        if (this.currentGuideItems.length === 0) {
            Utils.showToast('Agregue al menos un producto', 'error');
            return;
        }

        try {
            const client = await Database.getClient(clientId);
            const totalAmount = this.currentGuideItems.reduce((sum, item) => sum + item.subtotal, 0);

            // Create guide
            const guideData = {
                clientId,
                city: client.city,
                totalAmount,
                observations
            };

            // Add Caracas fields if applicable
            if (client.city === 'Caracas') {
                if (amountUsd) guideData.amountUsd = parseFloat(amountUsd);
                if (paymentBs) guideData.paymentBs = parseFloat(paymentBs);
                if (deliveryTime) guideData.deliveryTime = deliveryTime;
            }

            const guide = await Database.saveGuide(guideData);

            // Save guide items and decrease stock
            for (const item of this.currentGuideItems) {
                await Database.saveGuideItem({
                    guideId: guide.id,
                    productId: item.productId,
                    quantity: item.quantity,
                    unitPrice: item.unitPrice
                });

                // Decrease stock
                await Database.decreaseStock(item.productId, client.city, item.quantity);
            }

            Utils.closeModal('modalGuide');
            Utils.showToast(`Guía ${guide.guideNumber} creada correctamente`, 'success');
            await this.render();
            await InventoryModule.render();
            App.updateDashboard();
        } catch (error) {
            console.error('Error saving guide:', error);
            Utils.showToast('Error al crear la guía', 'error');
        }
    },

    async viewGuide(guideId) {
        const guide = await Database.getGuide(guideId);
        if (!guide) return;

        const client = await Database.getClient(guide.clientId);
        const items = await Database.getGuideItems(guideId);
        const total = items.reduce((sum, item) => sum + item.subtotal, 0);

        document.getElementById('detailGuideNumber').textContent = guide.guideNumber;

        const content = document.getElementById('guideDetailsContent');
        content.innerHTML = `
            <div class="guide-details-header">
                <div class="guide-details-info">
                    <h4>Fecha</h4>
                    <p>${Utils.formatDate(guide.createdAt, true)}</p>
                </div>
                <div class="guide-details-info">
                    <h4>Ciudad</h4>
                    <p><span class="city-badge ${guide.city.toLowerCase()}">${guide.city}</span></p>
                </div>
                <div class="guide-details-info">
                    <h4>Estado</h4>
                    <p><span class="status-badge ${Utils.getStatusClass(guide.status)}">${guide.status}</span></p>
                </div>
            </div>

            <div class="guide-details-section">
                <h3>Cliente</h3>
                <div class="client-info">
                    <p><strong>Nombre:</strong> ${client ? Utils.escapeHtml(client.fullName) : 'No disponible'}</p>
                    <p><strong>Teléfono:</strong> ${client ? Utils.escapeHtml(client.phone) : '-'}</p>
                    <p><strong>Dirección:</strong> ${client ? Utils.escapeHtml(client.address) : '-'}</p>
                    ${client && client.reference ? `<p><strong>Referencia:</strong> ${Utils.escapeHtml(client.reference)}</p>` : ''}
                </div>
            </div>

            <div class="guide-details-section">
                <h3>Productos</h3>
                <table class="table">
                    <thead>
                        <tr>
                            <th>Producto</th>
                            <th>Cantidad</th>
                            <th>Precio Unit.</th>
                            <th>Subtotal</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${items.map(item => `
                            <tr>
                                <td>${Utils.escapeHtml(item.productName || 'Producto')}</td>
                                <td>${item.quantity}</td>
                                <td>${Utils.formatCurrency(item.unitPrice)}</td>
                                <td>${Utils.formatCurrency(item.subtotal)}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                    <tfoot>
                        <tr>
                            <td colspan="3"><strong>TOTAL</strong></td>
                            <td><strong>${Utils.formatCurrency(total)}</strong></td>
                        </tr>
                    </tfoot>
                </table>
            </div>

            ${guide.observations ? `
                <div class="guide-details-section">
                    <h3>Observaciones</h3>
                    <p>${Utils.escapeHtml(guide.observations)}</p>
                </div>
            ` : ''}

            ${guide.city === 'Caracas' ? `
                <div class="guide-details-section">
                    <h3>Datos Caracas</h3>
                    <div class="client-info">
                        ${guide.amountUsd ? `<p><strong>Monto a Cancelar:</strong> $${guide.amountUsd} USD</p>` : ''}
                        ${guide.paymentBs ? `<p><strong>Pago Móvil:</strong> ${guide.paymentBs} Bs</p>` : ''}
                        ${guide.deliveryTime ? `<p><strong>Hora Entrega:</strong> ${guide.deliveryTime}</p>` : ''}
                    </div>
                </div>
            ` : ''}

            <div class="guide-details-section">
                <h3>Cambiar Estado</h3>
                <div class="guide-status-actions">
                    <button class="status-btn ${guide.status === 'Pendiente' ? 'active' : ''}" 
                            onclick="GuidesModule.changeStatus('${guide.id}', 'Pendiente')">
                        Pendiente
                    </button>
                    <button class="status-btn ${guide.status === 'En ruta' ? 'active' : ''}" 
                            onclick="GuidesModule.changeStatus('${guide.id}', 'En ruta')">
                        En ruta
                    </button>
                    <button class="status-btn ${guide.status === 'Entregado' ? 'active' : ''}" 
                            onclick="GuidesModule.changeStatus('${guide.id}', 'Entregado')">
                        Entregado
                    </button>
                    <button class="status-btn ${guide.status === 'Cancelado' ? 'active' : ''}" 
                            onclick="GuidesModule.changeStatus('${guide.id}', 'Cancelado')">
                        Cancelado
                    </button>
                </div>
            </div>
        `;

        // Store current guide ID for printing
        this.currentViewingGuideId = guideId;
        Utils.openModal('modalGuideDetails');
    },

    async deleteGuide(guideId) {
        if (!confirm('¿Está seguro de ELIMINAR permanentemente esta guía? Si la guía no estaba cancelada, se devolverá el stock.')) {
            return;
        }

        try {
            // First we need to return items to stock if not already cancelled
            const guide = await Database.getGuide(guideId);
            if (guide && guide.status !== 'Cancelado') {
                await this.returnGuideStock(guideId);
            }

            await Database.deleteGuide(guideId);
            Utils.showToast('Guía eliminada correctamente', 'success');
            await this.render();
            App.updateDashboard();
        } catch (error) {
            console.error('Error deleting guide:', error);
            Utils.showToast('Error al eliminar guía', 'error');
        }
    },

    async changeStatus(guideId, newStatus) {
        try {
            const guide = await Database.getGuide(guideId);
            if (!guide) return;

            // Logic to return stock if cancelling
            if (newStatus === 'Cancelado' && guide.status !== 'Cancelado') {
                if (confirm('¿Seguro de anular la guía? El stock será devuelto al inventario.')) {
                    await this.returnGuideStock(guideId);
                } else {
                    return; // Abort status change
                }
            }

            // Logic to deduct stock if un-cancelling (re-activating)
            if (guide.status === 'Cancelado' && newStatus !== 'Cancelado') {
                // Check if stock available? Complex. For now simply warn or just do it.
                // We need to re-deduct items.
                await this.deductGuideStock(guideId);
            }

            await Database.updateGuideStatus(guideId, newStatus);
            Utils.showToast(`Estado actualizado a "${newStatus}"`, 'success');

            // Refresh the view if modal is open
            if (document.getElementById('modalGuideDetails').classList.contains('active')) {
                await this.viewGuide(guideId);
            }

            await this.render();
            App.updateDashboard();
        } catch (error) {
            console.error('Error changing status:', error);
            Utils.showToast('Error al cambiar el estado', 'error');
        }
    },

    async returnGuideStock(guideId) {
        const items = await Database.getGuideItems(guideId);
        const guide = await Database.getGuide(guideId);
        if (!items || !guide) return;

        for (const item of items) {
            // We need to find the product and increase stock in the city
            // We need an increaseStock method in database or use updateInventory with current + qty
            await Database.increaseStock(item.productId, guide.city, item.quantity);
        }
    },

    async deductGuideStock(guideId) {
        const items = await Database.getGuideItems(guideId);
        const guide = await Database.getGuide(guideId);
        if (!items || !guide) return;

        for (const item of items) {
            await Database.decreaseStock(item.productId, guide.city, item.quantity);
        }
    },

    async printGuide() {
        if (!this.currentViewingGuideId) return;

        const guide = await Database.getGuide(this.currentViewingGuideId);
        const client = await Database.getClient(guide.clientId);
        const items = await Database.getGuideItems(this.currentViewingGuideId);
        const total = items.reduce((sum, item) => sum + item.subtotal, 0);

        // Use jsPDF to generate PDF
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF();

        // Header
        doc.setFontSize(20);
        doc.setFont('helvetica', 'bold');
        doc.text('GUÍA DE DESPACHO', 105, 20, { align: 'center' });

        doc.setFontSize(14);
        doc.text(guide.guideNumber, 105, 30, { align: 'center' });

        // Guide info
        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
        doc.text(`Fecha: ${Utils.formatDate(guide.createdAt, true)}`, 20, 45);
        doc.text(`Ciudad: ${guide.city}`, 20, 52);
        doc.text(`Estado: ${guide.status}`, 20, 59);

        // Client info
        doc.setFont('helvetica', 'bold');
        doc.text('CLIENTE:', 20, 75);
        doc.setFont('helvetica', 'normal');
        doc.text(`Nombre: ${client ? client.fullName : 'N/A'}`, 20, 82);
        doc.text(`Teléfono: ${client ? client.phone : 'N/A'}`, 20, 89);
        doc.text(`Dirección: ${client ? client.address : 'N/A'}`, 20, 96);
        if (client && client.reference) {
            doc.text(`Referencia: ${client.reference}`, 20, 103);
        }

        // Products table
        let yPos = 120;
        doc.setFont('helvetica', 'bold');
        doc.text('PRODUCTOS:', 20, yPos);
        yPos += 10;

        // Table header
        doc.setFillColor(240, 240, 240);
        doc.rect(20, yPos - 5, 170, 8, 'F');
        doc.text('Producto', 22, yPos);
        doc.text('Cant.', 120, yPos);
        doc.text('P. Unit.', 140, yPos);
        doc.text('Subtotal', 165, yPos);
        yPos += 10;

        // Table rows
        doc.setFont('helvetica', 'normal');
        items.forEach(item => {
            doc.text((item.productName || 'Producto').substring(0, 40), 22, yPos);
            doc.text(item.quantity.toString(), 125, yPos);
            doc.text(`$${item.unitPrice.toFixed(2)}`, 140, yPos);
            doc.text(`$${item.subtotal.toFixed(2)}`, 165, yPos);
            yPos += 8;
        });

        // Total
        yPos += 5;
        doc.setFont('helvetica', 'bold');
        doc.text('TOTAL:', 140, yPos);
        doc.text(`$${total.toFixed(2)}`, 165, yPos);

        // Observations
        if (guide.observations) {
            yPos += 15;
            doc.setFont('helvetica', 'bold');
            doc.text('OBSERVACIONES:', 20, yPos);
            doc.setFont('helvetica', 'normal');
            doc.text(guide.observations, 20, yPos + 7);
        }

        // Footer
        doc.setFontSize(8);
        doc.setTextColor(128);
        doc.text('Sistema de Domicilios - Quito & Guayaquil', 105, 285, { align: 'center' });

        // Save PDF
        doc.save(`guia_${guide.guideNumber}.pdf`);
        Utils.showToast('PDF generado correctamente', 'success');
    }
};

// Make module available globally
window.GuidesModule = GuidesModule;
