// ========================================
// Personal Finance Module
// ========================================

const FinanceModule = {
    accounts: [],
    categories: [],
    snapshots: [],
    distributionChart: null,
    evolutionChart: null,

    defaultCategories: [
        { name: '🏦 Cuenta Bancaria', type: 'asset' },
        { name: '💵 Efectivo', type: 'asset' },
        { name: '🏠 Bienes/Propiedades', type: 'asset' },
        { name: '💳 Tarjeta de Crédito', type: 'liability' },
        { name: '📄 Préstamo', type: 'liability' },
        { name: '📦 Otro', type: 'asset' },
        { name: '📦 Otro (Pasivo)', type: 'liability' }
    ],

    init() {
        this.bindEvents();
    },

    bindEvents() {
        // Buttons to open modals
        const btnNewPFAccount = document.getElementById('btnNewPFAccount');
        if (btnNewPFAccount) {
            btnNewPFAccount.addEventListener('click', () => this.openAccountModal());
        }

        const btnManagePFCategories = document.getElementById('btnManagePFCategories');
        if (btnManagePFCategories) {
            btnManagePFCategories.addEventListener('click', () => this.openCategoriesModal());
        }

        const btnSavePFSnapshot = document.getElementById('btnSavePFSnapshot');
        if (btnSavePFSnapshot) {
            btnSavePFSnapshot.addEventListener('click', () => this.saveCurrentSnapshot());
        }

        // Form submits
        const formPFAccount = document.getElementById('formPFAccount');
        if (formPFAccount) {
            formPFAccount.addEventListener('submit', (e) => this.handleSaveAccount(e));
        }

        const formPFTransaction = document.getElementById('formPFTransaction');
        if (formPFTransaction) {
            formPFTransaction.addEventListener('submit', (e) => this.handleSaveTransaction(e));
        }

        const formPFCategory = document.getElementById('formPFCategory');
        if (formPFCategory) {
            formPFCategory.addEventListener('submit', (e) => this.handleSaveCategory(e));
        }

        // Type dropdown change to filter categories dropdown
        const pfAccountType = document.getElementById('pfAccountType');
        if (pfAccountType) {
            pfAccountType.addEventListener('change', () => this.updateCategorySelectOptions());
        }
    },

    async render() {
        App.showLoading(true);
        try {
            await this.loadData();
            await this.updateDashboard();
            this.renderTables();
            this.renderSnapshotsTable();
            await this.renderCharts();
        } catch (error) {
            console.error('Error rendering finance module:', error);
            Utils.showToast('Error al cargar datos financieros', 'error');
        } finally {
            App.showLoading(false);
        }
    },

    async loadData() {
        try {
            const [accounts, categories, snapshots] = await Promise.all([
                Database.getPFAccounts(),
                Database.getPFCategories(),
                Database.getPFSnapshots()
            ]);
            this.accounts = accounts;
            this.categories = categories;
            this.snapshots = snapshots;
        } catch (error) {
            console.error('Error loading finance data:', error);
            this.accounts = [];
            this.categories = [];
            this.snapshots = [];
        }
    },

    getCategoryDisplayName(categoryKey) {
        const legacyNames = {
            'bank': '🏦 Cuenta Bancaria',
            'cash': '💵 Efectivo',
            'property': '🏠 Bienes/Propiedades',
            'credit_card': '💳 Tarjeta de Crédito',
            'loan': '📄 Préstamo',
            'other': '📦 Otro'
        };
        return legacyNames[categoryKey] || categoryKey;
    },

    async calculateInventoryValue() {
        try {
            const inventory = await Database.getInventory();
            const products = await Database.getProducts();
            
            return inventory.reduce((sum, item) => {
                const product = products.find(p => p.id === item.productId);
                let itemCost = 0;
                if (product) {
                    const storedCost = parseFloat(product.cost) || 0;
                    // Decode cost
                    itemCost = storedCost * 40000;
                }
                return sum + (itemCost * (item.available || 0));
            }, 0);
        } catch (error) {
            console.error('Error calculating inventory value:', error);
            return 0;
        }
    },

    async updateDashboard() {
        let totalAssets = 0;
        let totalLiabilities = 0;

        this.accounts.forEach(acc => {
            if (acc.type === 'asset') {
                totalAssets += parseFloat(acc.balance || 0);
            } else if (acc.type === 'liability') {
                totalLiabilities += parseFloat(acc.balance || 0);
            }
        });

        const inventoryVal = await this.calculateInventoryValue();
        const netWorth = totalAssets + inventoryVal - totalLiabilities;

        const statAssets = document.getElementById('statTotalAssets');
        const statInventory = document.getElementById('statPFInventory');
        const statLiabilities = document.getElementById('statTotalLiabilities');
        const statNetWorth = document.getElementById('statNetWorth');

        if (statAssets) statAssets.textContent = Utils.formatCurrency(totalAssets);
        if (statInventory) statInventory.textContent = Utils.formatCurrency(inventoryVal);
        if (statLiabilities) statLiabilities.textContent = Utils.formatCurrency(totalLiabilities);
        if (statNetWorth) {
            statNetWorth.textContent = Utils.formatCurrency(netWorth);
            if (netWorth < 0) {
                statNetWorth.style.color = 'var(--danger)';
            } else {
                statNetWorth.style.color = ''; // default
            }
        }
    },

    renderTables() {
        const assetsTable = document.getElementById('pfAssetsTable');
        const liabilitiesTable = document.getElementById('pfLiabilitiesTable');

        if (!assetsTable || !liabilitiesTable) return;

        const assets = this.accounts.filter(a => a.type === 'asset');
        const liabilities = this.accounts.filter(a => a.type === 'liability');

        // Render Assets
        if (assets.length === 0) {
            assetsTable.innerHTML = `<tr><td colspan="4" style="text-align: center; color: var(--text-muted);">No hay activos registrados</td></tr>`;
        } else {
            assetsTable.innerHTML = assets.map(acc => `
                <tr>
                    <td><strong>${Utils.escapeHtml(acc.name)}</strong></td>
                    <td><span class="badge" style="background: var(--bg-secondary); color: var(--text-primary); border: 1px solid var(--border);">${Utils.escapeHtml(this.getCategoryDisplayName(acc.category))}</span></td>
                    <td style="color: var(--success); font-weight: 600;">${Utils.formatCurrency(acc.balance)} ${acc.currency}</td>
                    <td>
                        <button class="btn btn-sm btn-icon" style="color: var(--primary);" title="Editar Cuenta" onclick="FinanceModule.editAccount('${acc.id}')">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                            </svg>
                        </button>
                        <button class="btn btn-sm btn-icon" style="color: var(--success);" title="Ingresar Dinero" onclick="FinanceModule.openTransactionModal('${acc.id}', 'income')">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <line x1="12" y1="5" x2="12" y2="19"></line>
                                <line x1="5" y1="12" x2="19" y2="12"></line>
                            </svg>
                        </button>
                        <button class="btn btn-sm btn-icon" style="color: var(--danger);" title="Retirar Dinero" onclick="FinanceModule.openTransactionModal('${acc.id}', 'expense')">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <line x1="5" y1="12" x2="19" y2="12"></line>
                            </svg>
                        </button>
                        <button class="btn btn-sm btn-icon" style="color: var(--text-muted);" title="Eliminar" onclick="FinanceModule.deleteAccount('${acc.id}')">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <polyline points="3 6 5 6 21 6"></polyline>
                                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                            </svg>
                        </button>
                    </td>
                </tr>
            `).join('');
        }

        // Render Liabilities
        if (liabilities.length === 0) {
            liabilitiesTable.innerHTML = `<tr><td colspan="4" style="text-align: center; color: var(--text-muted);">No hay pasivos registrados</td></tr>`;
        } else {
            liabilitiesTable.innerHTML = liabilities.map(acc => `
                <tr>
                    <td><strong>${Utils.escapeHtml(acc.name)}</strong></td>
                    <td><span class="badge" style="background: var(--bg-secondary); color: var(--text-primary); border: 1px solid var(--border);">${Utils.escapeHtml(this.getCategoryDisplayName(acc.category))}</span></td>
                    <td style="color: var(--danger); font-weight: 600;">${Utils.formatCurrency(acc.balance)} ${acc.currency}</td>
                    <td>
                        <button class="btn btn-sm btn-icon" style="color: var(--primary);" title="Editar Cuenta" onclick="FinanceModule.editAccount('${acc.id}')">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                            </svg>
                        </button>
                        <button class="btn btn-sm btn-icon" style="color: var(--success);" title="Registrar Préstamo / Aumento deuda" onclick="FinanceModule.openTransactionModal('${acc.id}', 'income')">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <line x1="12" y1="5" x2="12" y2="19"></line>
                                <line x1="5" y1="12" x2="19" y2="12"></line>
                            </svg>
                        </button>
                        <button class="btn btn-sm btn-icon" style="color: var(--primary);" title="Abonar a Deuda" onclick="FinanceModule.openTransactionModal('${acc.id}', 'expense')">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <polyline points="20 6 9 17 4 12"></polyline>
                            </svg>
                        </button>
                        <button class="btn btn-sm btn-icon" style="color: var(--text-muted);" title="Eliminar" onclick="FinanceModule.deleteAccount('${acc.id}')">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <polyline points="3 6 5 6 21 6"></polyline>
                                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                            </svg>
                        </button>
                    </td>
                </tr>
            `).join('');
        }
    },

    updateCategorySelectOptions(selectedCategoryVal = '') {
        const type = document.getElementById('pfAccountType').value;
        const categorySelect = document.getElementById('pfAccountCategory');
        if (!categorySelect) return;

        const availableCats = this.categories.length > 0 ? this.categories : this.defaultCategories;
        const filtered = availableCats.filter(c => c.type === type);

        categorySelect.innerHTML = filtered.map(c => `
            <option value="${Utils.escapeHtml(c.name)}">${Utils.escapeHtml(c.name)}</option>
        `).join('');

        if (selectedCategoryVal) {
            const mappedVal = this.getCategoryDisplayName(selectedCategoryVal);
            categorySelect.value = mappedVal;
            if (categorySelect.value !== mappedVal) {
                // If value doesn't exist in dropdown, add it dynamically for compatibility
                const opt = document.createElement('option');
                opt.value = selectedCategoryVal;
                opt.textContent = mappedVal;
                categorySelect.appendChild(opt);
                categorySelect.value = selectedCategoryVal;
            }
        }
    },

    openAccountModal() {
        document.getElementById('formPFAccount').reset();
        document.getElementById('pfAccountId').value = '';
        this.updateCategorySelectOptions();
        document.getElementById('modalPFAccount').classList.add('active');
        document.getElementById('pfAccountName').focus();
    },

    editAccount(id) {
        const account = this.accounts.find(a => a.id === id);
        if (!account) return;

        document.getElementById('pfAccountId').value = account.id;
        document.getElementById('pfAccountName').value = account.name;
        document.getElementById('pfAccountType').value = account.type;
        
        this.updateCategorySelectOptions(account.category);

        document.getElementById('pfAccountBalance').value = account.balance;
        document.getElementById('pfAccountCurrency').value = account.currency;

        document.getElementById('modalPFAccount').classList.add('active');
    },

    async handleSaveAccount(e) {
        e.preventDefault();
        
        const account = {
            id: document.getElementById('pfAccountId').value || null,
            name: document.getElementById('pfAccountName').value.trim(),
            type: document.getElementById('pfAccountType').value,
            category: document.getElementById('pfAccountCategory').value,
            balance: parseFloat(document.getElementById('pfAccountBalance').value || 0),
            currency: document.getElementById('pfAccountCurrency').value
        };

        App.showLoading(true);
        try {
            await Database.savePFAccount(account);
            Utils.showToast('Cuenta guardada correctamente', 'success');
            document.getElementById('modalPFAccount').classList.remove('active');
            await this.render();
        } catch (error) {
            Utils.showToast('Error al guardar la cuenta', 'error');
            console.error(error);
        } finally {
            App.showLoading(false);
        }
    },

    async deleteAccount(id) {
        if (!confirm('¿Estás seguro de eliminar esta cuenta? Se perderá el historial.')) return;
        
        App.showLoading(true);
        try {
            await Database.deletePFAccount(id);
            Utils.showToast('Cuenta eliminada', 'success');
            await this.render();
        } catch (error) {
            Utils.showToast('Error al eliminar cuenta', 'error');
            console.error(error);
        } finally {
            App.showLoading(false);
        }
    },

    openTransactionModal(accountId, type) {
        document.getElementById('formPFTransaction').reset();
        document.getElementById('pfTxAccountId').value = accountId;
        document.getElementById('pfTxType').value = type;
        document.getElementById('pfTxDate').value = new Date().toISOString().split('T')[0];
        
        const title = document.getElementById('modalPFTransactionTitle');
        if (type === 'income') {
            title.textContent = 'Registrar Ingreso / Aumento';
        } else {
            title.textContent = 'Registrar Retiro / Abono';
        }

        document.getElementById('modalPFTransaction').classList.add('active');
        document.getElementById('pfTxAmount').focus();
    },

    async handleSaveTransaction(e) {
        e.preventDefault();

        const tx = {
            accountId: document.getElementById('pfTxAccountId').value,
            type: document.getElementById('pfTxType').value,
            amount: parseFloat(document.getElementById('pfTxAmount').value),
            date: document.getElementById('pfTxDate').value,
            description: document.getElementById('pfTxDescription').value.trim()
        };

        App.showLoading(true);
        try {
            await Database.savePFTransaction(tx);
            Utils.showToast('Transacción registrada', 'success');
            document.getElementById('modalPFTransaction').classList.remove('active');
            await this.render();
        } catch (error) {
            Utils.showToast('Error al guardar transacción', 'error');
            console.error(error);
        } finally {
            App.showLoading(false);
        }
    },

    // ========================================
    // Dynamic Categories Logic
    // ========================================
    openCategoriesModal() {
        document.getElementById('formPFCategory').reset();
        this.renderCategoriesTable();
        document.getElementById('modalPFCategories').classList.add('active');
    },

    renderCategoriesTable() {
        const tbody = document.getElementById('pfCategoriesListTable');
        if (!tbody) return;

        const cats = this.categories.length > 0 ? this.categories : this.defaultCategories;

        tbody.innerHTML = cats.map(cat => {
            const typeLabel = cat.type === 'asset' ? '🟢 Activo' : '🔴 Pasivo';
            
            // Protected categories can't be deleted (standard keys or seeded defaults)
            const protectedNames = [
                'bank', 'cash', 'property', 'credit_card', 'loan', 'other',
                '🏦 Cuenta Bancaria', '💵 Efectivo', '🏠 Bienes/Propiedades',
                '💳 Tarjeta de Crédito', '📄 Préstamo', '📦 Otro', '📦 Otro (Pasivo)'
            ];
            const isProtected = !cat.id || protectedNames.includes(cat.name);

            const deleteButton = isProtected 
                ? `<span style="color: var(--text-muted); font-size: 0.8rem;">Sistema</span>` 
                : `<button class="btn btn-sm btn-icon" style="color: var(--danger);" title="Eliminar" onclick="FinanceModule.deleteCategory('${cat.id}')">
                       <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                           <polyline points="3 6 5 6 21 6"></polyline>
                           <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                       </svg>
                   </button>`;

            return `
                <tr>
                    <td><strong>${Utils.escapeHtml(cat.name)}</strong></td>
                    <td>${typeLabel}</td>
                    <td>${deleteButton}</td>
                </tr>
            `;
        }).join('');
    },

    async handleSaveCategory(e) {
        e.preventDefault();
        const name = document.getElementById('pfCatName').value.trim();
        const type = document.getElementById('pfCatType').value;

        if (!name) return;

        App.showLoading(true);
        try {
            await Database.savePFCategory({ name, type });
            Utils.showToast('Categoría agregada correctamente', 'success');
            document.getElementById('pfCatName').value = '';
            await this.loadData();
            this.renderCategoriesTable();
            this.updateCategorySelectOptions();
        } catch (error) {
            console.error('Error saving category:', error);
            let msg = 'Error al guardar categoría';
            if (error) {
                if (error.code === '23505' || (error.message && error.message.toLowerCase().includes('already exists'))) {
                    msg = 'La categoría ya existe';
                } else if (error.message) {
                    msg = `Error: ${error.message}`;
                }
            }
            Utils.showToast(msg, 'error');
        } finally {
            App.showLoading(false);
        }
    },

    async deleteCategory(id) {
        if (!confirm('¿Seguro de eliminar esta categoría? Las cuentas existentes no se verán afectadas.')) return;

        App.showLoading(true);
        try {
            await Database.deletePFCategory(id);
            Utils.showToast('Categoría eliminada', 'success');
            await this.loadData();
            this.renderCategoriesTable();
            this.updateCategorySelectOptions();
        } catch (error) {
            console.error('Error deleting category:', error);
            Utils.showToast('Error al eliminar la categoría', 'error');
        } finally {
            App.showLoading(false);
        }
    },

    // ========================================
    // Financial Snapshots Logic
    // ========================================
    async saveCurrentSnapshot() {
        let totalAssets = 0;
        let totalLiabilities = 0;
        const details = {
            accounts: []
        };

        this.accounts.forEach(acc => {
            const balance = parseFloat(acc.balance || 0);
            if (acc.type === 'asset') {
                totalAssets += balance;
            } else if (acc.type === 'liability') {
                totalLiabilities += balance;
            }
            details.accounts.push({
                name: acc.name,
                type: acc.type,
                category: this.getCategoryDisplayName(acc.category),
                balance: balance,
                currency: acc.currency
            });
        });

        const inventoryVal = await this.calculateInventoryValue();
        const netWorth = totalAssets + inventoryVal - totalLiabilities;
        const date = new Date().toISOString().split('T')[0];

        // Prevent duplicates on same date by checking if one exists and letting user choose or confirm
        const duplicate = this.snapshots.find(s => s.date === date);
        if (duplicate) {
            if (!confirm(`Ya existe un reporte registrado con la fecha de hoy (${date}). ¿Deseas sobreescribirlo?`)) {
                return;
            }
            // If yes, delete the existing one first
            App.showLoading(true);
            try {
                await Database.deletePFSnapshot(duplicate.id);
            } catch (err) {
                console.error(err);
            }
        }

        App.showLoading(true);
        try {
            await Database.savePFSnapshot({
                date,
                total_assets: totalAssets,
                total_liabilities: totalLiabilities,
                net_worth: netWorth,
                inventory_value: inventoryVal,
                details
            });
            Utils.showToast('Reporte financiero guardado', 'success');
            await this.render();
        } catch (error) {
            console.error('Error saving snapshot:', error);
            Utils.showToast('Error al guardar reporte', 'error');
        } finally {
            App.showLoading(false);
        }
    },

    async deleteSnapshot(id) {
        if (!confirm('¿Seguro de eliminar este reporte del historial?')) return;

        App.showLoading(true);
        try {
            await Database.deletePFSnapshot(id);
            Utils.showToast('Reporte eliminado del historial', 'success');
            await this.render();
        } catch (error) {
            console.error('Error deleting snapshot:', error);
            Utils.showToast('Error al eliminar reporte', 'error');
        } finally {
            App.showLoading(false);
        }
    },

    renderSnapshotsTable() {
        const tbody = document.getElementById('pfSnapshotsTable');
        if (!tbody) return;

        if (this.snapshots.length === 0) {
            tbody.innerHTML = `<tr><td colspan="6" style="text-align: center; color: var(--text-muted); padding: 2rem;">No hay reportes históricos guardados. Haz clic en "Guardar Reporte Hoy" para registrar un corte.</td></tr>`;
            return;
        }

        tbody.innerHTML = this.snapshots.map(snap => {
            return `
                <tr>
                    <td><strong>${Utils.formatDate(snap.date)}</strong></td>
                    <td style="color: var(--success); font-weight: 500;">${Utils.formatCurrency(snap.total_assets)}</td>
                    <td style="color: var(--warning); font-weight: 500;">${Utils.formatCurrency(snap.inventory_value)}</td>
                    <td style="color: var(--danger); font-weight: 500;">${Utils.formatCurrency(snap.total_liabilities)}</td>
                    <td style="font-weight: 700; color: ${snap.net_worth < 0 ? 'var(--danger)' : 'var(--primary)'}">${Utils.formatCurrency(snap.net_worth)}</td>
                    <td>
                        <button class="btn btn-sm btn-secondary" title="Ver Detalle" onclick="FinanceModule.viewSnapshotDetails('${snap.id}')">
                            👁️ Detalle
                        </button>
                        <button class="btn btn-sm btn-icon" style="color: var(--danger);" title="Eliminar" onclick="FinanceModule.deleteSnapshot('${snap.id}')">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <polyline points="3 6 5 6 21 6"></polyline>
                                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                            </svg>
                        </button>
                    </td>
                </tr>
            `;
        }).join('');
    },

    viewSnapshotDetails(id) {
        const snap = this.snapshots.find(s => s.id === id);
        if (!snap) return;

        document.getElementById('pfSnapshotDetailTitle').textContent = `Reporte Financiero - ${Utils.formatDate(snap.date)}`;
        document.getElementById('pfSnapshotValAssets').textContent = Utils.formatCurrency(snap.total_assets);
        document.getElementById('pfSnapshotValInventory').textContent = Utils.formatCurrency(snap.inventory_value);
        document.getElementById('pfSnapshotValLiabilities').textContent = Utils.formatCurrency(snap.total_liabilities);
        document.getElementById('pfSnapshotValNetWorth').textContent = Utils.formatCurrency(snap.net_worth);

        const tbodyAssets = document.getElementById('pfSnapshotDetailAssetsTable');
        const tbodyLiabilities = document.getElementById('pfSnapshotDetailLiabilitiesTable');

        const details = snap.details || { accounts: [] };
        const assets = details.accounts.filter(a => a.type === 'asset');
        const liabilities = details.accounts.filter(a => a.type === 'liability');

        tbodyAssets.innerHTML = assets.map(a => `
            <tr>
                <td><strong>${Utils.escapeHtml(a.name)}</strong><br><small style="color: var(--text-muted);">${Utils.escapeHtml(a.category)}</small></td>
                <td style="color: var(--success); font-weight: 500;">${Utils.formatCurrency(a.balance)} ${a.currency}</td>
            </tr>
        `).join('');

        if (assets.length === 0) {
            tbodyAssets.innerHTML = `<tr><td colspan="2" style="text-align: center; color: var(--text-muted); padding: 1rem;">Sin cuentas registradas</td></tr>`;
        }

        tbodyLiabilities.innerHTML = liabilities.map(l => `
            <tr>
                <td><strong>${Utils.escapeHtml(l.name)}</strong><br><small style="color: var(--text-muted);">${Utils.escapeHtml(l.category)}</small></td>
                <td style="color: var(--danger); font-weight: 500;">${Utils.formatCurrency(l.balance)} ${l.currency}</td>
            </tr>
        `).join('');

        if (liabilities.length === 0) {
            tbodyLiabilities.innerHTML = `<tr><td colspan="2" style="text-align: center; color: var(--text-muted); padding: 1rem;">Sin deudas registradas</td></tr>`;
        }

        document.getElementById('modalPFSnapshotDetail').classList.add('active');
    },

    // ========================================
    // Charts rendering with Chart.js
    // ========================================
    async renderCharts() {
        if (typeof Chart === 'undefined') {
            console.warn('Chart.js is not loaded.');
            return;
        }

        // Calculate distribution totals
        let cashTotal = 0;
        let bankTotal = 0;
        let propertiesTotal = 0;
        let otherAssetsTotal = 0;
        let debtsTotal = 0;

        this.accounts.forEach(acc => {
            const balance = parseFloat(acc.balance || 0);
            if (acc.type === 'asset') {
                const name = this.getCategoryDisplayName(acc.category);
                if (name.includes('Efectivo')) cashTotal += balance;
                else if (name.includes('Bancaria')) bankTotal += balance;
                else if (name.includes('Bienes') || name.includes('Propiedades')) propertiesTotal += balance;
                else otherAssetsTotal += balance;
            } else {
                debtsTotal += balance;
            }
        });

        const inventoryVal = await this.calculateInventoryValue();

        // 1. Doughnut chart
        const distCanvas = document.getElementById('pfDistributionChart');
        if (distCanvas) {
            const distCtx = distCanvas.getContext('2d');
            if (this.distributionChart) {
                this.distributionChart.destroy();
            }

            this.distributionChart = new Chart(distCtx, {
                type: 'doughnut',
                data: {
                    labels: ['Banco', 'Efectivo', 'Bienes/Propiedades', 'Inventario', 'Otros Activos', 'Deudas'],
                    datasets: [{
                        data: [bankTotal, cashTotal, propertiesTotal, inventoryVal, otherAssetsTotal, debtsTotal],
                        backgroundColor: [
                            '#3b82f6', // Banco
                            '#10b981', // Efectivo
                            '#a855f7', // Bienes
                            '#f59e0b', // Inventario
                            '#64748b', // Otros Activos
                            '#ef4444'  // Deudas
                        ],
                        borderWidth: 1,
                        borderColor: '#2d2d44'
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: {
                            position: 'bottom',
                            labels: {
                                color: '#94a3b8',
                                font: { family: 'Inter', size: 10 }
                            }
                        }
                    }
                }
            });
        }

        // 2. Grouped-stacked Bar & Line chart for historical progress
        const evoCanvas = document.getElementById('pfEvolutionChart');
        if (evoCanvas) {
            const evoCtx = evoCanvas.getContext('2d');
            if (this.evolutionChart) {
                this.evolutionChart.destroy();
            }

            const history = [...this.snapshots].reverse();
            
            const labels = history.length > 0 ? history.map(h => Utils.formatDate(h.date)) : ['Hoy'];
            const netWorthData = history.length > 0 ? history.map(h => parseFloat(h.net_worth)) : [bankTotal + cashTotal + propertiesTotal + inventoryVal + otherAssetsTotal - debtsTotal];
            const inventoryData = history.length > 0 ? history.map(h => parseFloat(h.inventory_value)) : [inventoryVal];
            const assetsData = history.length > 0 ? history.map(h => parseFloat(h.total_assets)) : [bankTotal + cashTotal + propertiesTotal + otherAssetsTotal];
            const liabilitiesData = history.length > 0 ? history.map(h => parseFloat(h.total_liabilities)) : [debtsTotal];

            this.evolutionChart = new Chart(evoCtx, {
                type: 'bar',
                data: {
                    labels: labels,
                    datasets: [
                        {
                            type: 'line',
                            label: 'Patrimonio Neto',
                            data: netWorthData,
                            borderColor: '#6366f1',
                            backgroundColor: 'rgba(99, 102, 241, 0.08)',
                            fill: true,
                            tension: 0.3,
                            borderWidth: 3,
                            pointBackgroundColor: '#6366f1',
                            pointRadius: 4,
                            order: 1 // Drawn on top of the bars
                        },
                        {
                            type: 'bar',
                            label: 'Cuentas / Efectivo',
                            data: assetsData,
                            backgroundColor: '#10b981',
                            stack: 'assets',
                            barPercentage: 0.5,
                            categoryPercentage: 0.7,
                            order: 2
                        },
                        {
                            type: 'bar',
                            label: 'Inventario',
                            data: inventoryData,
                            backgroundColor: '#f59e0b',
                            stack: 'assets',
                            barPercentage: 0.5,
                            categoryPercentage: 0.7,
                            order: 2
                        },
                        {
                            type: 'bar',
                            label: 'Deudas',
                            data: liabilitiesData,
                            backgroundColor: '#ef4444',
                            stack: 'liabilities',
                            barPercentage: 0.5,
                            categoryPercentage: 0.7,
                            order: 2
                        }
                    ]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: {
                            position: 'bottom',
                            labels: {
                                color: '#94a3b8',
                                font: { family: 'Inter', size: 10 }
                            }
                        },
                        tooltip: {
                            mode: 'index',
                            intersect: false
                        }
                    },
                    scales: {
                        x: {
                            stacked: false, // Stack ID handles stacking of individual groups
                            grid: { color: 'rgba(255, 255, 255, 0.02)' },
                            ticks: { color: '#64748b', font: { size: 9 } }
                        },
                        y: {
                            stacked: false,
                            grid: { color: 'rgba(255, 255, 255, 0.02)' },
                            ticks: { color: '#64748b', font: { size: 9 } }
                        }
                    }
                }
            });
        }
    }
};

window.FinanceModule = FinanceModule;
