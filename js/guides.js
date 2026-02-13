const GuidesModule = {
    currentGuideItems: [],
    allClients: [],
    allProducts: [],
    selectedCity: null,
    adjustingGuideId: null,

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

        // Client autocomplete search
        const clientSearchInput = document.getElementById('guideClientSearch');
        clientSearchInput.addEventListener('input', Utils.debounce(() => {
            this.searchClients(clientSearchInput.value);
        }, 200));

        clientSearchInput.addEventListener('focus', () => {
            if (clientSearchInput.value.length >= 1) {
                this.searchClients(clientSearchInput.value);
            }
        });

        // Product autocomplete search
        const productSearchInput = document.getElementById('guideProductSearch');
        productSearchInput.addEventListener('input', Utils.debounce(() => {
            this.searchProducts(productSearchInput.value);
        }, 200));

        productSearchInput.addEventListener('focus', () => {
            if (productSearchInput.value.length >= 1) {
                this.searchProducts(productSearchInput.value);
            }
        });

        // Add product to guide
        document.getElementById('btnAddProductToGuide').addEventListener('click', () => {
            this.addProductToGuide();
        });

        // Search guides
        document.getElementById('searchGuides').addEventListener('input',
            Utils.debounce(() => this.filterGuides(), 300)
        );

        // Filter by status
        document.getElementById('filterGuideStatus').addEventListener('change', () => {
            this.filterGuides();
        });

        // Filter by city
        document.getElementById('filterGuideCity').addEventListener('change', () => {
            this.filterGuides();
        });

        // Filter by payment method
        document.getElementById('filterGuidePayment').addEventListener('change', () => {
            this.filterGuides();
        });

        // Filter by date
        document.getElementById('filterGuideDate').addEventListener('change', () => {
            this.filterGuides();
        });

        // Clear all filters
        document.getElementById('btnClearFilters').addEventListener('click', () => {
            document.getElementById('searchGuides').value = '';
            document.getElementById('filterGuideStatus').value = '';
            document.getElementById('filterGuideCity').value = '';
            document.getElementById('filterGuidePayment').value = '';
            document.getElementById('filterGuideDate').value = '';
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

        // Close autocomplete when clicking outside
        document.addEventListener('click', (e) => {
            if (!e.target.closest('.autocomplete-container')) {
                document.querySelectorAll('.autocomplete-suggestions').forEach(el => {
                    el.classList.remove('active');
                });
            }
        });

        // Handle keyboard navigation in autocomplete
        document.getElementById('guideClientSearch').addEventListener('keydown', (e) => {
            this.handleAutocompleteKeyboard(e, 'clientSuggestions');
        });

        document.getElementById('guideProductSearch').addEventListener('keydown', (e) => {
            this.handleAutocompleteKeyboard(e, 'productSuggestions');
        });
    },

    // Handle keyboard navigation in autocomplete
    handleAutocompleteKeyboard(e, suggestionsId) {
        const suggestions = document.getElementById(suggestionsId);
        const items = suggestions.querySelectorAll('.autocomplete-item:not(.disabled)');
        const activeItem = suggestions.querySelector('.autocomplete-item.active');
        let currentIndex = Array.from(items).indexOf(activeItem);

        switch (e.key) {
            case 'ArrowDown':
                e.preventDefault();
                if (currentIndex < items.length - 1) {
                    items[currentIndex]?.classList.remove('active');
                    items[currentIndex + 1]?.classList.add('active');
                    items[currentIndex + 1]?.scrollIntoView({ block: 'nearest' });
                } else if (currentIndex === -1 && items.length > 0) {
                    items[0]?.classList.add('active');
                }
                break;
            case 'ArrowUp':
                e.preventDefault();
                if (currentIndex > 0) {
                    items[currentIndex]?.classList.remove('active');
                    items[currentIndex - 1]?.classList.add('active');
                    items[currentIndex - 1]?.scrollIntoView({ block: 'nearest' });
                }
                break;
            case 'Enter':
                e.preventDefault();
                if (activeItem) {
                    activeItem.click();
                }
                break;
            case 'Escape':
                suggestions.classList.remove('active');
                break;
        }
    },

    // Search clients for autocomplete
    async searchClients(query) {
        const suggestionsEl = document.getElementById('clientSuggestions');

        if (query.length < 1) {
            suggestionsEl.classList.remove('active');
            return;
        }

        // Load all clients if not loaded
        if (this.allClients.length === 0) {
            this.allClients = await Database.getClients();
        }

        const queryLower = query.toLowerCase();
        const filtered = this.allClients.filter(client =>
            client.fullName.toLowerCase().includes(queryLower) ||
            client.phone.includes(query)
        ).slice(0, 10);

        if (filtered.length === 0) {
            suggestionsEl.innerHTML = '<div class="autocomplete-no-results">No se encontraron clientes</div>';
        } else {
            suggestionsEl.innerHTML = filtered.map(client => `
                <div class="autocomplete-item" data-id="${client.id}">
                    <div class="item-main">${this.highlightMatch(client.fullName, query)}</div>
                    <div class="item-secondary">
                        <span>📞 ${client.phone}</span>
                        <span class="item-badge">${client.city}</span>
                    </div>
                </div>
            `).join('');

            // Add click handlers
            suggestionsEl.querySelectorAll('.autocomplete-item').forEach(item => {
                item.addEventListener('click', () => {
                    this.selectClient(item.dataset.id);
                });
            });
        }

        suggestionsEl.classList.add('active');
    },

    // Select a client from autocomplete
    async selectClient(clientId) {
        const client = this.allClients.find(c => c.id === clientId) || await Database.getClient(clientId);
        if (!client) return;

        // Update hidden input and search field
        document.getElementById('guideClient').value = clientId;
        document.getElementById('guideClientSearch').value = client.fullName;
        document.getElementById('clientSuggestions').classList.remove('active');

        // Store selected city for product filtering
        this.selectedCity = client.city;

        // Show client info
        await this.onClientSelect(clientId);

        // Hide search field and show info
        document.getElementById('guideClientSearch').parentElement.style.display = 'none';
    },

    // Clear client selection
    clearClientSelection() {
        document.getElementById('guideClient').value = '';
        document.getElementById('guideClientSearch').value = '';
        document.getElementById('guideClientSearch').parentElement.style.display = 'block';
        document.getElementById('selectedClientInfo').style.display = 'none';
        document.getElementById('caracasFields').style.display = 'none';
        this.selectedCity = null;

        // Clear product selection too since it depends on city
        this.clearProductSelection();
    },

    // Search products for autocomplete
    async searchProducts(query) {
        const suggestionsEl = document.getElementById('productSuggestions');
        const clientId = document.getElementById('guideClient').value;

        if (!clientId) {
            suggestionsEl.innerHTML = '<div class="autocomplete-no-results">Primero seleccione un cliente</div>';
            suggestionsEl.classList.add('active');
            return;
        }

        // Load all products if not loaded
        if (this.allProducts.length === 0) {
            const products = await Database.getProducts();
            this.allProducts = products.filter(p => p.active);
        }

        const queryLower = query.toLowerCase();
        let filtered = this.allProducts;

        if (query.length >= 1) {
            filtered = filtered.filter(product =>
                product.name.toLowerCase().includes(queryLower) ||
                (product.sku && product.sku.toLowerCase().includes(queryLower))
            );
        }

        filtered = filtered.slice(0, 15);

        // Get stock for each product
        const productsWithStock = await Promise.all(filtered.map(async product => {
            const inventory = await Database.getInventoryByProduct(product.id, this.selectedCity);
            return {
                ...product,
                stock: inventory ? inventory.available : 0
            };
        }));

        if (productsWithStock.length === 0) {
            suggestionsEl.innerHTML = '<div class="autocomplete-no-results">No se encontraron productos</div>';
        } else {
            suggestionsEl.innerHTML = productsWithStock.map(product => {
                const stockClass = product.stock > 5 ? 'success' : (product.stock > 0 ? 'warning' : 'danger');
                const disabled = product.stock === 0 ? 'disabled' : '';
                return `
                    <div class="autocomplete-item ${disabled}" data-id="${product.id}" data-price="${product.price}" data-stock="${product.stock}" data-name="${product.name}">
                        <div class="item-main">${query.length >= 1 ? this.highlightMatch(product.name, query) : product.name}</div>
                        <div class="item-secondary">
                            <span>💵 ${Utils.formatCurrency(product.price)}</span>
                            <span class="item-badge ${stockClass}">Stock: ${product.stock}</span>
                            ${product.sku ? `<span style="color: var(--text-muted);">SKU: ${product.sku}</span>` : ''}
                        </div>
                    </div>
                `;
            }).join('');

            // Add click handlers
            suggestionsEl.querySelectorAll('.autocomplete-item:not(.disabled)').forEach(item => {
                item.addEventListener('click', () => {
                    this.selectProduct(item.dataset.id, item.dataset.name, item.dataset.price, item.dataset.stock);
                });
            });
        }

        suggestionsEl.classList.add('active');
    },

    // Select a product from autocomplete
    selectProduct(productId, productName, price, stock) {
        document.getElementById('guideProductSelect').value = productId;
        document.getElementById('guideProductSearch').value = productName;
        document.getElementById('guideProductPrice').value = price;
        document.getElementById('productSuggestions').classList.remove('active');

        // Show stock info
        const stockEl = document.getElementById('selectedProductStock');
        stockEl.textContent = `Stock disponible: ${stock}`;
        stockEl.style.display = 'inline';
    },

    // Clear product selection
    clearProductSelection() {
        document.getElementById('guideProductSelect').value = '';
        document.getElementById('guideProductSearch').value = '';
        document.getElementById('guideProductPrice').value = '';
        document.getElementById('selectedProductStock').style.display = 'none';
    },

    // Highlight matching text
    highlightMatch(text, query) {
        if (!query) return text;
        const regex = new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
        return text.replace(regex, '<span class="autocomplete-highlight">$1</span>');
    },

    async render() {
        await this.filterGuides();
    },

    async filterGuides() {
        const searchQuery = document.getElementById('searchGuides').value.toLowerCase();
        const statusFilter = document.getElementById('filterGuideStatus').value;
        const cityFilter = document.getElementById('filterGuideCity').value;
        const paymentFilter = document.getElementById('filterGuidePayment').value;
        const dateFilter = document.getElementById('filterGuideDate').value;

        let guides = await Database.getGuides();

        // Sort by date (newest first)
        guides.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

        // Apply search filter
        if (searchQuery) {
            guides = guides.filter(g => {
                return g.guideNumber.toLowerCase().includes(searchQuery) ||
                    (g.clientName && g.clientName.toLowerCase().includes(searchQuery));
            });
        }

        // Apply status filter
        if (statusFilter) {
            guides = guides.filter(g => g.status === statusFilter);
        }

        // Apply city filter
        if (cityFilter) {
            guides = guides.filter(g => g.city === cityFilter);
        }

        // Apply payment method filter
        if (paymentFilter) {
            guides = guides.filter(g => {
                if (paymentFilter === 'USD') {
                    return g.amountUsd && parseFloat(g.amountUsd) > 0;
                } else if (paymentFilter === 'BS') {
                    return g.paymentBs && parseFloat(g.paymentBs) > 0;
                }
                return true;
            });
        }

        // Apply date filter
        if (dateFilter) {
            guides = guides.filter(g => {
                const guideDate = new Date(g.createdAt).toISOString().split('T')[0];
                return guideDate === dateFilter;
            });
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
                            ${guide.status === 'Entregado' ? `
                                <button class="btn btn-icon btn-secondary" onclick="GuidesModule.changeStatus('${guide.id}', 'Pagado')" title="Marcar como pagado" style="color: #8b5cf6;">
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                        <rect x="1" y="4" width="22" height="16" rx="2" ry="2"></rect>
                                        <line x1="1" y1="10" x2="23" y2="10"></line>
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
        this.selectedCity = null;

        // Reset client search and info display
        document.getElementById('guideClientSearch').value = '';
        document.getElementById('guideClient').value = '';
        document.getElementById('guideClientSearch').parentElement.style.display = 'block';
        document.getElementById('selectedClientInfo').style.display = 'none';
        document.getElementById('clientSuggestions').classList.remove('active');

        // Reset product search
        this.clearProductSelection();
        document.getElementById('productSuggestions').classList.remove('active');

        // Clear caches to get fresh data
        this.allClients = [];
        this.allProducts = [];

        // If clientId provided, select it
        if (clientId) {
            await this.selectClient(clientId);
        }

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

            // Clear previous product selection when client (and potentially city) changes
            this.clearProductSelection();

            // Show/Hide Caracas specific fields
            const caracasFields = document.getElementById('caracasFields');
            if (client.city === 'Caracas') {
                caracasFields.style.display = 'block';
            } else {
                caracasFields.style.display = 'none';
            }
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
        this.clearProductSelection();

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
        const shippingCost = document.getElementById('guideShippingCost').value;

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

            // Add shipping cost if provided
            if (shippingCost) {
                guideData.shippingCost = parseFloat(shippingCost);
            }

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
                            <td colspan="3"><strong>Subtotal Productos</strong></td>
                            <td><strong>${Utils.formatCurrency(total)}</strong></td>
                        </tr>
                        ${guide.shippingCost ? `
                        <tr>
                            <td colspan="3"><strong>🚚 Valor de Flete</strong></td>
                            <td><strong>${Utils.formatCurrency(guide.shippingCost)}</strong></td>
                        </tr>
                        <tr style="background: var(--primary-light);">
                            <td colspan="3"><strong>TOTAL</strong></td>
                            <td><strong>${Utils.formatCurrency(total + guide.shippingCost)}</strong></td>
                        </tr>
                        ` : ''}
                    </tfoot>
                </table>
            </div>

            ${guide.shippingCost || guide.shippingCostOriginal ? `
                <div class="guide-details-section" style="background: linear-gradient(135deg, rgba(16, 185, 129, 0.1), rgba(59, 130, 246, 0.1)); padding: 1rem; border-radius: var(--radius-md);">
                    <div style="display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 0.5rem;">
                        <div style="display: flex; align-items: center; gap: 0.5rem;">
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--primary)" stroke-width="2">
                                <rect x="1" y="3" width="15" height="13"></rect>
                                <polygon points="16 8 20 8 23 11 23 16 16 16 16 8"></polygon>
                                <circle cx="5.5" cy="18.5" r="2.5"></circle>
                                <circle cx="18.5" cy="18.5" r="2.5"></circle>
                            </svg>
                            <span style="font-weight: 600; color: var(--text-primary);">Flete: ${Utils.formatCurrency(guide.shippingCost)}</span>
                            ${guide.shippingAdjustedAt ? `<span style="font-size: 0.8rem; color: var(--success); font-weight: 500;">✅ Ajustado</span>` : ''}
                        </div>
                        <button type="button" class="btn btn-sm btn-secondary" onclick="GuidesModule.openAdjustShippingModal('${guide.id}')" style="white-space: nowrap;">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                            </svg>
                            Ajustar Flete
                        </button>
                    </div>
                    ${guide.shippingCostOriginal && guide.shippingAdjustedAt ? `
                        <div style="margin-top: 0.75rem; padding-top: 0.75rem; border-top: 1px solid rgba(99, 102, 241, 0.2); font-size: 0.85rem;">
                            <div style="display: flex; flex-wrap: wrap; gap: 1rem; color: var(--text-muted);">
                                <span>📋 Flete Original: <strong style="color: var(--text-secondary);">${Utils.formatCurrency(guide.shippingCostOriginal)}</strong></span>
                                <span>📅 Ajustado: <strong style="color: var(--text-secondary);">${Utils.formatDate(guide.shippingAdjustedAt, true)}</strong></span>
                            </div>
                            ${guide.shippingAdjustmentNote ? `<div style="margin-top: 0.5rem; color: var(--text-muted);">💬 ${Utils.escapeHtml(guide.shippingAdjustmentNote)}</div>` : ''}
                        </div>
                    ` : ''}
                    ${!guide.shippingAdjustedAt && guide.shippingCost ? `
                        <div style="margin-top: 0.5rem; font-size: 0.8rem; color: var(--warning);">
                            ⚠️ Flete pendiente de ajuste
                        </div>
                    ` : ''}
                </div>
            ` : `
                <div class="guide-details-section" style="background: rgba(99, 102, 241, 0.05); padding: 1rem; border-radius: var(--radius-md); border: 1px dashed var(--border);">
                    <div style="display: flex; align-items: center; justify-content: space-between;">
                        <span style="color: var(--text-muted);">🚚 Sin flete asignado</span>
                        <button type="button" class="btn btn-sm btn-primary" onclick="GuidesModule.openAdjustShippingModal('${guide.id}')">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <line x1="12" y1="5" x2="12" y2="19"></line>
                                <line x1="5" y1="12" x2="19" y2="12"></line>
                            </svg>
                            Agregar Flete
                        </button>
                    </div>
                </div>
            `}

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
                    <button class="status-btn ${guide.status === 'Pagado' ? 'active' : ''}" 
                            onclick="GuidesModule.changeStatus('${guide.id}', 'Pagado')">
                        Pagado
                    </button>
                <button class="status-btn ${guide.status === 'Cancelado' ? 'active' : ''}" 
                            onclick="GuidesModule.changeStatus('${guide.id}', 'Cancelado')">
                        Cancelado
                    </button>
                    <button class="status-btn ${guide.status === 'Devolución' ? 'active' : ''}" 
                            onclick="GuidesModule.changeStatus('${guide.id}', 'Devolución')">
                        Devolución
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

            // Statuses that return stock to inventory
            const stockReturnStatuses = ['Cancelado', 'Devolución'];
            const isReturningStock = stockReturnStatuses.includes(newStatus);
            const wasReturningStock = stockReturnStatuses.includes(guide.status);

            // Logic to return stock if cancelling or returning
            if (isReturningStock && !wasReturningStock) {
                const confirmMessage = newStatus === 'Devolución'
                    ? '¿Seguro de marcar como devolución? El stock será devuelto al inventario.'
                    : '¿Seguro de anular la guía? El stock será devuelto al inventario.';
                if (confirm(confirmMessage)) {
                    await this.returnGuideStock(guideId);
                } else {
                    return; // Abort status change
                }
            }

            // Logic to deduct stock if un-cancelling or un-returning (re-activating)
            if (wasReturningStock && !isReturningStock) {
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

    async openAdjustShippingModal(guideId) {
        const guide = await Database.getGuide(guideId);
        if (!guide) return;

        // Store guide ID for the adjustment
        this.adjustingGuideId = guideId;

        // Set current values in the modal
        document.getElementById('adjustShippingGuideNumber').textContent = guide.guideNumber;
        document.getElementById('adjustShippingCurrentCost').textContent = guide.shippingCost ? Utils.formatCurrency(guide.shippingCost) : 'No asignado';
        document.getElementById('adjustShippingNewCost').value = guide.shippingCost || '';
        document.getElementById('adjustShippingNote').value = '';

        // Show original cost info if available
        const originalInfo = document.getElementById('adjustShippingOriginalInfo');
        if (guide.shippingCostOriginal) {
            originalInfo.style.display = 'block';
            document.getElementById('adjustShippingOriginalCost').textContent = Utils.formatCurrency(guide.shippingCostOriginal);
        } else {
            originalInfo.style.display = 'none';
        }

        // Calculate days since creation
        const createdDate = new Date(guide.createdAt);
        const now = new Date();
        const daysSinceCreation = Math.floor((now - createdDate) / (1000 * 60 * 60 * 24));
        document.getElementById('adjustShippingDaysInfo').textContent = `Guía creada hace ${daysSinceCreation} día(s) — ${Utils.formatDate(guide.createdAt)}`;

        Utils.openModal('modalAdjustShipping');
    },

    async saveShippingAdjustment() {
        const newCost = parseFloat(document.getElementById('adjustShippingNewCost').value);
        const note = document.getElementById('adjustShippingNote').value.trim();

        if (isNaN(newCost) || newCost < 0) {
            Utils.showToast('Ingrese un valor de flete válido', 'warning');
            return;
        }

        if (!this.adjustingGuideId) return;

        try {
            await Database.updateGuideShippingCost(this.adjustingGuideId, newCost, note);

            Utils.closeModal('modalAdjustShipping');
            Utils.showToast('Flete ajustado correctamente', 'success');

            // Refresh the guide details view if open
            if (document.getElementById('modalGuideDetails').classList.contains('active')) {
                await this.viewGuide(this.adjustingGuideId);
            }

            await this.render();
            this.adjustingGuideId = null;
        } catch (error) {
            console.error('Error adjusting shipping cost:', error);
            Utils.showToast('Error al ajustar el flete', 'error');
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
        doc.text('TOTAL PRODUCTOS:', 120, yPos);
        doc.text(`$${total.toFixed(2)}`, 165, yPos);

        // Shipping cost in PDF
        if (guide.shippingCost) {
            yPos += 10;
            doc.text('FLETE:', 120, yPos);
            doc.text(`$${guide.shippingCost.toFixed(2)}`, 165, yPos);

            if (guide.shippingCostOriginal && guide.shippingAdjustedAt) {
                yPos += 7;
                doc.setFont('helvetica', 'normal');
                doc.setFontSize(8);
                doc.text(`(Original: $${guide.shippingCostOriginal.toFixed(2)} - Ajustado)`, 120, yPos);
                doc.setFontSize(10);
            }

            yPos += 8;
            doc.setFont('helvetica', 'bold');
            doc.setFillColor(230, 240, 255);
            doc.rect(118, yPos - 5, 72, 8, 'F');
            doc.text('TOTAL GENERAL:', 120, yPos);
            doc.text(`$${(total + guide.shippingCost).toFixed(2)}`, 165, yPos);
        }

        // Observations
        if (guide.observations) {
            yPos += 15;
            doc.setFont('helvetica', 'bold');
            doc.text('OBSERVACIONES:', 20, yPos);
            doc.setFont('helvetica', 'normal');
            doc.text(guide.observations, 20, yPos + 7);
            yPos += 15;
        }

        // Caracas payment info
        if (guide.city === 'Caracas') {
            yPos += 10;
            doc.setFont('helvetica', 'bold');
            doc.text('INFORMACION DE PAGO:', 20, yPos);
            doc.setFont('helvetica', 'normal');
            yPos += 8;

            if (guide.amountUsd) {
                doc.text('Monto en Divisa: $' + guide.amountUsd + ' USD', 20, yPos);
                yPos += 7;
            }
            if (guide.paymentBs) {
                doc.text('Pago Movil: ' + guide.paymentBs + ' Bs', 20, yPos);
                yPos += 7;
            }
            if (guide.deliveryTime) {
                doc.text('Hora de Entrega: ' + guide.deliveryTime, 20, yPos);
                yPos += 7;
            }
        }

        // Footer
        doc.setFontSize(8);
        doc.setTextColor(128);
        doc.text('Sistema de Domicilios - Quito, Guayaquil & Caracas', 105, 285, { align: 'center' });

        // Save PDF
        doc.save(`guia_${guide.guideNumber}.pdf`);
        Utils.showToast('PDF generado correctamente', 'success');
    }
};

// Make module available globally
window.GuidesModule = GuidesModule;
