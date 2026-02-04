// ========================================
// Accounts Module (Async - Supabase)
// ========================================

const AccountsModule = {
    accounts: [],
    categories: [],
    transactions: [],
    currentFilters: {
        dateFrom: null,
        dateTo: null,
        accountId: '',
        type: '',
        categoryId: ''
    },

    init() {
        this.bindEvents();
        this.setDefaultFilters();
    },

    bindEvents() {
        // Transaction form
        const formTransaction = document.getElementById('formTransaction');
        if (formTransaction) {
            formTransaction.addEventListener('submit', (e) => {
                e.preventDefault();
                this.saveTransaction();
            });
        }

        // Account form
        const formAccount = document.getElementById('formAccount');
        if (formAccount) {
            formAccount.addEventListener('submit', (e) => {
                e.preventDefault();
                this.saveAccount();
            });
        }

        // Modal close buttons
        document.querySelectorAll('[data-close="modalTransaction"]').forEach(btn => {
            btn.addEventListener('click', () => this.closeModal('modalTransaction'));
        });
        document.querySelectorAll('[data-close="modalAccount"]').forEach(btn => {
            btn.addEventListener('click', () => this.closeModal('modalAccount'));
        });
    },

    setDefaultFilters() {
        // Default: current month
        const now = new Date();
        const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

        const dateFrom = document.getElementById('accountsFilterDateFrom');
        const dateTo = document.getElementById('accountsFilterDateTo');

        if (dateFrom) dateFrom.value = firstDayOfMonth.toISOString().split('T')[0];
        if (dateTo) dateTo.value = now.toISOString().split('T')[0];

        this.currentFilters.dateFrom = firstDayOfMonth.toISOString().split('T')[0];
        this.currentFilters.dateTo = now.toISOString().split('T')[0];
    },

    async render() {
        await this.loadData();
        this.renderAccountsGrid();
        this.renderTransactionsTable();
        this.updateSummaryStats();
        this.populateFilters();
    },

    async loadData() {
        try {
            // Load accounts
            const { data: accounts, error: accountsError } = await supabaseClient
                .from('accounts')
                .select('*')
                .eq('active', true)
                .order('name');

            if (accountsError) throw accountsError;
            this.accounts = accounts || [];

            // Load categories
            const { data: categories, error: categoriesError } = await supabaseClient
                .from('transaction_categories')
                .select('*')
                .eq('active', true)
                .order('name');

            if (categoriesError) throw categoriesError;
            this.categories = categories || [];

            // Load transactions
            await this.loadTransactions();

        } catch (error) {
            console.error('Error loading accounts data:', error);
            Utils.showToast('Error al cargar datos de cuentas', 'error');
        }
    },

    async loadTransactions() {
        try {
            let query = supabaseClient
                .from('v_transactions_complete')
                .select('*')
                .order('transaction_date', { ascending: false });

            // Apply date filters
            if (this.currentFilters.dateFrom) {
                query = query.gte('transaction_date', this.currentFilters.dateFrom);
            }
            if (this.currentFilters.dateTo) {
                query = query.lte('transaction_date', this.currentFilters.dateTo);
            }
            if (this.currentFilters.accountId) {
                query = query.eq('account_id', this.currentFilters.accountId);
            }
            if (this.currentFilters.type) {
                query = query.eq('type', this.currentFilters.type);
            }
            if (this.currentFilters.categoryId) {
                query = query.eq('category_id', this.currentFilters.categoryId);
            }

            const { data, error } = await query.limit(100);

            if (error) throw error;
            this.transactions = data || [];

        } catch (error) {
            console.error('Error loading transactions:', error);
        }
    },

    renderAccountsGrid() {
        const grid = document.getElementById('accountsGrid');
        if (!grid) return;

        if (this.accounts.length === 0) {
            grid.innerHTML = `
                <div class="card" style="padding: 2rem; text-align: center; grid-column: 1 / -1;">
                    <p style="color: var(--text-muted);">No hay cuentas registradas</p>
                    <button class="btn btn-primary" onclick="AccountsModule.showAccountModal()" style="margin-top: 1rem;">
                        Crear Primera Cuenta
                    </button>
                </div>
            `;
            return;
        }

        grid.innerHTML = this.accounts.map(account => {
            const balance = parseFloat(account.current_balance) || 0;
            const isNegative = balance < 0;
            const formattedBalance = this.formatCurrencyWithSign(balance, account.currency);
            const typeLabels = {
                'billetera': 'Billetera Digital',
                'banco': 'Cuenta Bancaria',
                'efectivo': 'Efectivo'
            };

            return `
                <div class="card account-card" style="background: linear-gradient(135deg, ${account.color}22, ${account.color}11); border-left: 4px solid ${account.color};">
                    <div class="card-body">
                        <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 1rem;">
                            <div>
                                <h3 style="color: ${account.color}; margin: 0; font-size: 1.25rem;">${Utils.escapeHtml(account.name)}</h3>
                                <small style="color: var(--text-muted);">${typeLabels[account.type] || account.type}</small>
                            </div>
                            <div style="display: flex; gap: 0.5rem;">
                                <button class="btn btn-icon btn-secondary" onclick="AccountsModule.showAccountModal('${account.id}')" title="Editar">
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                                        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                                    </svg>
                                </button>
                            </div>
                        </div>
                        <div style="text-align: right;">
                            <div style="font-size: 2rem; font-weight: 700; color: ${isNegative ? 'var(--danger)' : 'var(--text-primary)'};">
                                ${formattedBalance}
                            </div>
                            <small style="color: var(--text-muted);">Saldo actual</small>
                        </div>
                    </div>
                </div>
            `;
        }).join('');
    },

    renderTransactionsTable() {
        const tbody = document.getElementById('transactionsTable');
        const recordCount = document.getElementById('transactionsRecordCount');
        if (!tbody) return;

        if (recordCount) {
            recordCount.textContent = `${this.transactions.length} registros`;
        }

        if (this.transactions.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="7" style="text-align: center; padding: 2rem; color: var(--text-muted);">
                        No hay transacciones registradas
                    </td>
                </tr>
            `;
            return;
        }

        tbody.innerHTML = this.transactions.map(t => {
            const isIncome = t.type === 'income';
            const isTransfer = t.type === 'transfer';
            let typeLabel = isIncome ? 'Ingreso' : (isTransfer ? 'Transferencia' : 'Gasto');
            let typeColor = isIncome ? 'var(--success)' : (isTransfer ? 'var(--primary)' : 'var(--danger)');
            let typeBadgeClass = isIncome ? 'entregado' : (isTransfer ? 'en-ruta' : 'cancelado');
            let amountPrefix = isIncome ? '+' : '-';

            // For transfers, show both accounts
            let accountDisplay = Utils.escapeHtml(t.account_name || '');
            if (isTransfer && t.target_account_name) {
                accountDisplay = `${Utils.escapeHtml(t.account_name)} → ${Utils.escapeHtml(t.target_account_name)}`;
                amountPrefix = '';
                typeColor = 'var(--primary)';
            }

            return `
                <tr>
                    <td>${Utils.formatDate(t.transaction_date)}</td>
                    <td>
                        <span style="display: inline-flex; align-items: center; gap: 0.5rem;">
                            <span style="width: 10px; height: 10px; border-radius: 50%; background: ${t.account_color || '#6366f1'};"></span>
                            ${accountDisplay}
                        </span>
                    </td>
                    <td>
                        <span style="display: inline-flex; align-items: center; gap: 0.5rem;">
                            <span style="width: 10px; height: 10px; border-radius: 50%; background: ${t.category_color || '#6366f1'};"></span>
                            ${Utils.escapeHtml(t.category_name || '')}
                        </span>
                    </td>
                    <td>${Utils.escapeHtml(t.description || '-')}</td>
                    <td>
                        <span class="status-badge ${typeBadgeClass}">${typeLabel}</span>
                    </td>
                    <td style="font-weight: 600; color: ${typeColor};">
                        ${amountPrefix}${this.formatCurrency(t.amount)}
                    </td>
                    <td>
                        <button class="btn btn-icon btn-secondary" onclick="AccountsModule.showTransactionModal('${t.id}')" title="Editar">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                            </svg>
                        </button>
                        <button class="btn btn-icon btn-secondary" onclick="AccountsModule.deleteTransaction('${t.id}')" title="Eliminar" style="color: var(--danger);">
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

    updateSummaryStats() {
        // Calculate totals for current month
        const totalIncome = this.transactions
            .filter(t => t.type === 'income')
            .reduce((sum, t) => sum + parseFloat(t.amount), 0);

        const totalExpenses = this.transactions
            .filter(t => t.type === 'expense')
            .reduce((sum, t) => sum + parseFloat(t.amount), 0);

        const balance = totalIncome - totalExpenses;

        // Total balance across all accounts
        const totalAccountsBalance = this.accounts
            .reduce((sum, a) => sum + parseFloat(a.current_balance || 0), 0);

        document.getElementById('accountsTotalIncome').textContent = this.formatCurrency(totalIncome);
        document.getElementById('accountsTotalExpenses').textContent = this.formatCurrency(totalExpenses);

        const balanceEl = document.getElementById('accountsBalance');
        balanceEl.textContent = this.formatCurrency(balance);
        balanceEl.style.color = balance >= 0 ? 'var(--success)' : 'var(--danger)';

        document.getElementById('accountsTotalBalance').textContent = this.formatCurrency(totalAccountsBalance);
    },

    populateFilters() {
        // Populate account filter
        const accountFilter = document.getElementById('accountsFilterAccount');
        if (accountFilter) {
            accountFilter.innerHTML = '<option value="">Todas</option>' +
                this.accounts.map(a => `<option value="${a.id}">${Utils.escapeHtml(a.name)}</option>`).join('');
        }

        // Populate category filter
        const categoryFilter = document.getElementById('accountsFilterCategory');
        if (categoryFilter) {
            categoryFilter.innerHTML = '<option value="">Todas</option>' +
                this.categories.map(c => `<option value="${c.id}">${Utils.escapeHtml(c.name)}</option>`).join('');
        }
    },

    applyFilters() {
        this.currentFilters.dateFrom = document.getElementById('accountsFilterDateFrom').value;
        this.currentFilters.dateTo = document.getElementById('accountsFilterDateTo').value;
        this.currentFilters.accountId = document.getElementById('accountsFilterAccount').value;
        this.currentFilters.type = document.getElementById('accountsFilterType').value;
        this.currentFilters.categoryId = document.getElementById('accountsFilterCategory').value;

        this.render();
    },

    clearFilters() {
        this.currentFilters = {
            dateFrom: null,
            dateTo: null,
            accountId: '',
            type: '',
            categoryId: ''
        };

        document.getElementById('accountsFilterDateFrom').value = '';
        document.getElementById('accountsFilterDateTo').value = '';
        document.getElementById('accountsFilterAccount').value = '';
        document.getElementById('accountsFilterType').value = '';
        document.getElementById('accountsFilterCategory').value = '';

        this.setDefaultFilters();
        this.render();
    },

    // Transaction Modal
    async showTransactionModal(id = null) {
        const modal = document.getElementById('modalTransaction');
        const title = document.getElementById('modalTransactionTitle');
        const form = document.getElementById('formTransaction');

        // Populate accounts dropdown
        const accountSelect = document.getElementById('transactionAccount');
        accountSelect.innerHTML = this.accounts.map(a =>
            `<option value="${a.id}">${Utils.escapeHtml(a.name)}</option>`
        ).join('');

        // Set default date
        document.getElementById('transactionDate').value = new Date().toISOString().split('T')[0];

        if (id) {
            title.textContent = 'Editar Transacción';
            // Load transaction data
            const { data, error } = await supabaseClient
                .from('transactions')
                .select('*')
                .eq('id', id)
                .single();

            if (data) {
                document.getElementById('transactionId').value = data.id;
                document.getElementById('transactionType').value = data.type;
                document.getElementById('transactionAccount').value = data.account_id;
                document.getElementById('transactionAmount').value = data.amount;
                document.getElementById('transactionDate').value = data.transaction_date;
                document.getElementById('transactionReference').value = data.reference || '';
                document.getElementById('transactionDescription').value = data.description || '';

                // Update categories based on type
                this.onTransactionTypeChange();

                // Set category after populating
                setTimeout(() => {
                    document.getElementById('transactionCategory').value = data.category_id;
                }, 100);
            }
        } else {
            title.textContent = 'Nueva Transacción';
            form.reset();
            document.getElementById('transactionId').value = '';
            document.getElementById('transactionDate').value = new Date().toISOString().split('T')[0];
            this.onTransactionTypeChange();
        }

        modal.classList.add('active');
        document.body.style.overflow = 'hidden';
    },

    onTransactionTypeChange() {
        const type = document.getElementById('transactionType').value;
        const categorySelect = document.getElementById('transactionCategory');
        const targetAccountGroup = document.getElementById('targetAccountGroup');
        const categoryGroup = document.getElementById('categoryGroup');
        const labelAccount = document.getElementById('labelTransactionAccount');
        const targetAccountSelect = document.getElementById('transactionTargetAccount');

        // Show/hide target account for transfers
        if (type === 'transfer') {
            targetAccountGroup.style.display = 'block';
            categoryGroup.style.display = 'none';
            labelAccount.textContent = 'Cuenta Origen *';

            // Populate target account dropdown
            targetAccountSelect.innerHTML = this.accounts.map(a =>
                `<option value="${a.id}">${Utils.escapeHtml(a.name)}</option>`
            ).join('');

            // Set transfer category automatically
            const transferCategory = this.categories.find(c => c.type === 'transfer');
            if (transferCategory) {
                categorySelect.innerHTML = `<option value="${transferCategory.id}" selected>${Utils.escapeHtml(transferCategory.name)}</option>`;
            }
        } else {
            targetAccountGroup.style.display = 'none';
            categoryGroup.style.display = 'block';
            labelAccount.textContent = 'Cuenta *';

            // Filter categories by type
            const filteredCategories = this.categories.filter(c => c.type === type);
            categorySelect.innerHTML = filteredCategories.map(c =>
                `<option value="${c.id}">${Utils.escapeHtml(c.name)}</option>`
            ).join('');
        }
    },

    async saveTransaction() {
        try {
            const id = document.getElementById('transactionId').value;
            const type = document.getElementById('transactionType').value;

            const transactionData = {
                account_id: document.getElementById('transactionAccount').value,
                category_id: document.getElementById('transactionCategory').value,
                type: type,
                amount: parseFloat(document.getElementById('transactionAmount').value),
                transaction_date: document.getElementById('transactionDate').value,
                reference: document.getElementById('transactionReference').value || null,
                description: document.getElementById('transactionDescription').value || null
            };

            // Add target account for transfers
            if (type === 'transfer') {
                const targetAccountId = document.getElementById('transactionTargetAccount').value;
                if (targetAccountId === transactionData.account_id) {
                    Utils.showToast('La cuenta origen y destino no pueden ser la misma', 'error');
                    return;
                }
                transactionData.target_account_id = targetAccountId;
            } else {
                transactionData.target_account_id = null;
            }

            if (id) {
                // Update
                const { error } = await supabaseClient
                    .from('transactions')
                    .update(transactionData)
                    .eq('id', id);

                if (error) throw error;
                Utils.showToast('Transacción actualizada', 'success');
            } else {
                // Insert
                const { error } = await supabaseClient
                    .from('transactions')
                    .insert(transactionData);

                if (error) throw error;

                const msgType = type === 'transfer' ? 'Transferencia realizada' : 'Transacción registrada';
                Utils.showToast(msgType, 'success');
            }

            this.closeModal('modalTransaction');
            await this.render();

        } catch (error) {
            console.error('Error saving transaction:', error);
            Utils.showToast('Error al guardar transacción', 'error');
        }
    },

    async deleteTransaction(id) {
        if (!confirm('¿Está seguro de eliminar esta transacción?')) return;

        try {
            const { error } = await supabaseClient
                .from('transactions')
                .delete()
                .eq('id', id);

            if (error) throw error;

            Utils.showToast('Transacción eliminada', 'success');
            await this.render();

        } catch (error) {
            console.error('Error deleting transaction:', error);
            Utils.showToast('Error al eliminar transacción', 'error');
        }
    },

    // Account Modal
    async showAccountModal(id = null) {
        const modal = document.getElementById('modalAccount');
        const title = document.getElementById('modalAccountTitle');
        const form = document.getElementById('formAccount');

        if (id) {
            title.textContent = 'Editar Cuenta';
            const account = this.accounts.find(a => a.id === id);
            if (account) {
                document.getElementById('accountId').value = account.id;
                document.getElementById('accountName').value = account.name;
                document.getElementById('accountType').value = account.type;
                document.getElementById('accountCurrency').value = account.currency || 'COP';
                document.getElementById('accountInitialBalance').value = account.initial_balance || 0;
                document.getElementById('accountColor').value = account.color || '#6366f1';
            }
        } else {
            title.textContent = 'Nueva Cuenta';
            form.reset();
            document.getElementById('accountId').value = '';
            document.getElementById('accountColor').value = '#6366f1';
        }

        modal.classList.add('active');
        document.body.style.overflow = 'hidden';
    },

    async saveAccount() {
        try {
            const id = document.getElementById('accountId').value;
            const initialBalance = parseFloat(document.getElementById('accountInitialBalance').value) || 0;

            const accountData = {
                name: document.getElementById('accountName').value,
                type: document.getElementById('accountType').value,
                currency: document.getElementById('accountCurrency').value,
                color: document.getElementById('accountColor').value,
                initial_balance: initialBalance
            };

            if (id) {
                // Update
                const { error } = await supabaseClient
                    .from('accounts')
                    .update(accountData)
                    .eq('id', id);

                if (error) throw error;
                Utils.showToast('Cuenta actualizada', 'success');
            } else {
                // Insert with initial balance as current balance
                accountData.current_balance = initialBalance;

                const { error } = await supabaseClient
                    .from('accounts')
                    .insert(accountData);

                if (error) throw error;
                Utils.showToast('Cuenta creada', 'success');
            }

            this.closeModal('modalAccount');
            await this.render();

        } catch (error) {
            console.error('Error saving account:', error);
            Utils.showToast('Error al guardar cuenta', 'error');
        }
    },

    closeModal(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.classList.remove('active');
            document.body.style.overflow = '';
        }
    },

    formatCurrency(amount) {
        return new Intl.NumberFormat('es-CO', {
            style: 'currency',
            currency: 'COP',
            minimumFractionDigits: 0,
            maximumFractionDigits: 0
        }).format(amount);
    },

    formatCurrencyWithSign(amount, currency = 'COP') {
        return new Intl.NumberFormat('es-CO', {
            style: 'currency',
            currency: currency,
            minimumFractionDigits: 0,
            maximumFractionDigits: 0
        }).format(amount);
    }
};

// Make module available globally
window.AccountsModule = AccountsModule;
