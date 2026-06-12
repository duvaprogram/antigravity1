// ========================================
// Personal Finance Module
// ========================================

const FinanceModule = {
    accounts: [],

    init() {
        this.bindEvents();
    },

    bindEvents() {
        // Buttons to open modals
        const btnNewPFAccount = document.getElementById('btnNewPFAccount');
        if (btnNewPFAccount) {
            btnNewPFAccount.addEventListener('click', () => this.openAccountModal());
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
    },

    async render() {
        App.showLoading(true);
        try {
            await this.loadData();
            this.updateDashboard();
            this.renderTables();
        } catch (error) {
            console.error('Error rendering finance module:', error);
            Utils.showToast('Error al cargar datos financieros', 'error');
        } finally {
            App.showLoading(false);
        }
    },

    async loadData() {
        try {
            this.accounts = await Database.getPFAccounts();
        } catch (error) {
            console.error('Error loading finance data:', error);
            this.accounts = [];
        }
    },

    updateDashboard() {
        let totalAssets = 0;
        let totalLiabilities = 0;

        this.accounts.forEach(acc => {
            if (acc.type === 'asset') {
                totalAssets += parseFloat(acc.balance || 0);
            } else if (acc.type === 'liability') {
                totalLiabilities += parseFloat(acc.balance || 0);
            }
        });

        const netWorth = totalAssets - totalLiabilities;

        const statAssets = document.getElementById('statTotalAssets');
        const statLiabilities = document.getElementById('statTotalLiabilities');
        const statNetWorth = document.getElementById('statNetWorth');

        if (statAssets) statAssets.textContent = Utils.formatCurrency(totalAssets);
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

        const categoryNames = {
            'bank': '🏦 Cta. Bancaria',
            'cash': '💵 Efectivo',
            'property': '🏠 Propiedad/Bienes',
            'credit_card': '💳 Tarjeta de Crédito',
            'loan': '📄 Préstamo',
            'other': '📦 Otro'
        };

        // Render Assets
        if (assets.length === 0) {
            assetsTable.innerHTML = `<tr><td colspan="4" style="text-align: center; color: var(--text-muted);">No hay activos registrados</td></tr>`;
        } else {
            assetsTable.innerHTML = assets.map(acc => `
                <tr>
                    <td><strong>${Utils.escapeHtml(acc.name)}</strong></td>
                    <td><span class="badge" style="background: var(--bg-secondary); color: var(--text-primary); border: 1px solid var(--border);">${categoryNames[acc.category] || acc.category}</span></td>
                    <td style="color: var(--success); font-weight: 600;">${Utils.formatCurrency(acc.balance)} ${acc.currency}</td>
                    <td>
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
                    <td><span class="badge" style="background: var(--bg-secondary); color: var(--text-primary); border: 1px solid var(--border);">${categoryNames[acc.category] || acc.category}</span></td>
                    <td style="color: var(--danger); font-weight: 600;">${Utils.formatCurrency(acc.balance)} ${acc.currency}</td>
                    <td>
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

    openAccountModal(accountId = null) {
        document.getElementById('formPFAccount').reset();
        document.getElementById('pfAccountId').value = '';
        document.getElementById('modalPFAccount').classList.add('active');
        document.getElementById('pfAccountName').focus();
    },

    async handleSaveAccount(e) {
        e.preventDefault();
        
        const account = {
            id: document.getElementById('pfAccountId').value || null,
            name: document.getElementById('pfAccountName').value,
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
            description: document.getElementById('pfTxDescription').value
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
    }
};

window.FinanceModule = FinanceModule;
