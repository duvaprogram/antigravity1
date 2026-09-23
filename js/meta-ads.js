// ========================================
// Meta Ads Module — Conexión en vivo con Facebook / Meta Marketing API
// Permite: pegar token → elegir cuenta publicitaria → elegir campaña → sincronizar métricas
// ========================================

const MetaAdsModule = {
    // ---- Configuración ----
    API_VERSION: 'v21.0',
    GRAPH: 'https://graph.facebook.com',
    LS: {
        token: 'metaads_token',
        account: 'metaads_account',
        accountCurrency: 'metaads_account_currency',
        campaign: 'metaads_campaign',
        period: 'metaads_period'
    },

    // ---- Estado en memoria ----
    _initialized: false,
    token: '',
    accounts: [],           // [{id, account_id, name, currency, account_status}]
    selectedAccount: '',    // ej: act_1234567890
    currency: 'USD',
    campaigns: [],          // [{id, name, status, objective}]
    selectedCampaign: 'all',
    period: 'last_30d',
    rows: [],               // filas de insights por campaña
    loading: false,

    // Tipos de acción que contamos como "lead" (mensajes iniciados, leads, compras)
    LEAD_ACTION_TYPES: [
        'lead',
        'onsite_conversion.lead_grouped',
        'offsite_conversion.fb_pixel_lead',
        'onsite_conversion.messaging_conversation_started_7d',
        'onsite_conversion.total_messaging_connection'
    ],

    init() {
        if (this._initialized) return;
        this._initialized = true;

        // Restaurar estado persistido
        try {
            this.token = localStorage.getItem(this.LS.token) || '';
            this.selectedAccount = localStorage.getItem(this.LS.account) || '';
            this.currency = localStorage.getItem(this.LS.accountCurrency) || 'USD';
            this.selectedCampaign = localStorage.getItem(this.LS.campaign) || 'all';
            this.period = localStorage.getItem(this.LS.period) || 'last_30d';
        } catch (e) { /* localStorage no disponible */ }

        this.bind();
        this.render();

        // Si ya hay token guardado, cargar cuentas automáticamente
        if (this.token) {
            this.loadAdAccounts({ silent: true });
        }
    },

    bind() {
        const tokenInput = document.getElementById('metaTokenInput');
        if (tokenInput && !tokenInput.dataset.bound) {
            tokenInput.dataset.bound = '1';
            tokenInput.value = this.token || '';
        }

        const periodSel = document.getElementById('metaPeriodSelect');
        if (periodSel && !periodSel.dataset.bound) {
            periodSel.dataset.bound = '1';
            periodSel.value = this.period;
            periodSel.addEventListener('change', (e) => {
                this.period = e.target.value;
                try { localStorage.setItem(this.LS.period, this.period); } catch (e2) {}
                this.render();
            });
        }

        const accSel = document.getElementById('metaAccountSelect');
        if (accSel && !accSel.dataset.bound) {
            accSel.dataset.bound = '1';
            accSel.addEventListener('change', (e) => this.onAccountChange(e.target.value));
        }

        const campSel = document.getElementById('metaCampaignSelect');
        if (campSel && !campSel.dataset.bound) {
            campSel.dataset.bound = '1';
            campSel.addEventListener('change', (e) => {
                this.selectedCampaign = e.target.value;
                try { localStorage.setItem(this.LS.campaign, this.selectedCampaign); } catch (e2) {}
                this.render();
            });
        }
    },

    // Llamado por el router al entrar a la sección
    render() {
        this.renderConnectionState();
        this.renderControls();
        this.renderKpis();
        this.renderTable();
    },

    // ---------------- Conexión ----------------
    async saveToken() {
        const input = document.getElementById('metaTokenInput');
        const token = (input?.value || '').trim();
        if (!token) {
            this.setConnStatus('Pega un token de acceso primero.', 'warning');
            return;
        }
        this.token = token;
        try { localStorage.setItem(this.LS.token, token); } catch (e) {}
        this.setConnStatus('Token guardado. Verificando con Meta…', 'info');
        await this.loadAdAccounts();
    },

    disconnect() {
        this.token = '';
        this.accounts = [];
        this.selectedAccount = '';
        this.campaigns = [];
        this.selectedCampaign = 'all';
        this.rows = [];
        try {
            localStorage.removeItem(this.LS.token);
            localStorage.removeItem(this.LS.account);
            localStorage.removeItem(this.LS.accountCurrency);
            localStorage.removeItem(this.LS.campaign);
        } catch (e) {}
        const input = document.getElementById('metaTokenInput');
        if (input) input.value = '';
        this.setConnStatus('Desconectado de Meta.', 'muted');
        this.render();
        if (window.Utils) Utils.showToast('Conexión con Meta eliminada', 'info');
    },

    toggleTokenVisibility() {
        const input = document.getElementById('metaTokenInput');
        if (!input) return;
        input.type = input.type === 'password' ? 'text' : 'password';
    },

    isConnected() {
        return !!this.token && this.accounts.length > 0;
    },

    // ---------------- Llamadas a la Graph API ----------------
    async graphGet(path, params = {}) {
        const url = new URL(`${this.GRAPH}/${this.API_VERSION}/${path}`);
        Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
        url.searchParams.set('access_token', this.token);
        const res = await fetch(url.toString());
        const json = await res.json().catch(() => ({}));
        if (!res.ok || json.error) {
            const msg = json.error?.message || `HTTP ${res.status}`;
            const err = new Error(msg);
            err.fbError = json.error;
            throw err;
        }
        return json;
    },

    // Sigue la paginación hasta un máximo de páginas
    async graphGetAll(path, params = {}, maxPages = 10) {
        let out = [];
        let json = await this.graphGet(path, params);
        out = out.concat(json.data || []);
        let next = json.paging?.next;
        let pages = 1;
        while (next && pages < maxPages) {
            const res = await fetch(next);
            json = await res.json().catch(() => ({}));
            if (json.error) break;
            out = out.concat(json.data || []);
            next = json.paging?.next;
            pages++;
        }
        return out;
    },

    async loadAdAccounts({ silent = false } = {}) {
        if (!this.token) return;
        this.setConnStatus('Cargando tus cuentas publicitarias…', 'info');
        try {
            const data = await this.graphGetAll('me/adaccounts', {
                fields: 'account_id,name,currency,account_status',
                limit: 100
            });
            this.accounts = data.map(a => ({
                id: a.id,                       // act_XXXX
                account_id: a.account_id,
                name: a.name || a.account_id,
                currency: a.currency || 'USD',
                account_status: a.account_status
            }));

            if (this.accounts.length === 0) {
                this.setConnStatus('El token es válido pero no tiene cuentas publicitarias asociadas.', 'warning');
                this.render();
                return;
            }

            // Restaurar selección previa si sigue existiendo
            if (!this.selectedAccount || !this.accounts.find(a => a.id === this.selectedAccount)) {
                this.selectedAccount = this.accounts[0].id;
            }
            const acc = this.accounts.find(a => a.id === this.selectedAccount);
            if (acc) {
                this.currency = acc.currency;
                try {
                    localStorage.setItem(this.LS.account, this.selectedAccount);
                    localStorage.setItem(this.LS.accountCurrency, this.currency);
                } catch (e) {}
            }

            this.setConnStatus(`✅ Conectado — ${this.accounts.length} cuenta(s) publicitaria(s) encontrada(s).`, 'success');
            this.render();
            // Cargar campañas de la cuenta seleccionada
            await this.loadCampaigns();
        } catch (err) {
            console.error('Meta loadAdAccounts:', err);
            this.accounts = [];
            const hint = /expired|session|OAuth|token|190/i.test(err.message)
                ? ' El token pudo expirar — genera uno nuevo y pégalo de nuevo.'
                : '';
            this.setConnStatus(`❌ Error de Meta: ${err.message}.${hint}`, 'danger');
            this.render();
        }
    },

    async onAccountChange(accountId) {
        this.selectedAccount = accountId;
        const acc = this.accounts.find(a => a.id === accountId);
        this.currency = acc ? acc.currency : 'USD';
        this.selectedCampaign = 'all';
        this.campaigns = [];
        this.rows = [];
        try {
            localStorage.setItem(this.LS.account, accountId);
            localStorage.setItem(this.LS.accountCurrency, this.currency);
            localStorage.setItem(this.LS.campaign, 'all');
        } catch (e) {}
        this.render();
        await this.loadCampaigns();
    },

    async loadCampaigns() {
        if (!this.selectedAccount) return;
        try {
            const data = await this.graphGetAll(`${this.selectedAccount}/campaigns`, {
                fields: 'name,status,objective',
                limit: 200
            });
            this.campaigns = data.map(c => ({
                id: c.id,
                name: c.name || c.id,
                status: c.status || '—',
                objective: c.objective || ''
            }));
            // Validar selección previa de campaña
            if (this.selectedCampaign !== 'all' && !this.campaigns.find(c => c.id === this.selectedCampaign)) {
                this.selectedCampaign = 'all';
            }
            this.renderControls();
        } catch (err) {
            console.error('Meta loadCampaigns:', err);
            this.campaigns = [];
            this.renderControls();
            if (window.Utils) Utils.showToast('No se pudieron cargar las campañas: ' + err.message, 'error');
        }
    },

    async sync() {
        if (!this.token) {
            this.setConnStatus('Conéctate primero: pega tu token de acceso.', 'warning');
            return;
        }
        if (!this.selectedAccount) {
            if (window.Utils) Utils.showToast('Selecciona una cuenta publicitaria primero', 'warning');
            return;
        }
        this.loading = true;
        this.renderTable();
        this.setSyncBtn(true);
        try {
            // Asegurar que tenemos las campañas (para estado y nombres)
            if (this.campaigns.length === 0) {
                await this.loadCampaigns();
            }

            const insights = await this.graphGetAll(`${this.selectedAccount}/insights`, {
                level: 'campaign',
                fields: 'campaign_id,campaign_name,spend,impressions,clicks,ctr,cpc,actions',
                date_preset: this.period,
                limit: 500
            });

            const statusById = {};
            this.campaigns.forEach(c => { statusById[c.id] = c.status; });

            this.rows = insights.map(r => {
                const leads = this.countLeads(r.actions);
                const spend = parseFloat(r.spend || 0);
                return {
                    campaign_id: r.campaign_id,
                    name: r.campaign_name || r.campaign_id,
                    status: statusById[r.campaign_id] || '—',
                    spend,
                    impressions: parseInt(r.impressions || 0, 10),
                    clicks: parseInt(r.clicks || 0, 10),
                    ctr: parseFloat(r.ctr || 0),
                    leads,
                    costPerLead: leads > 0 ? spend / leads : null
                };
            });

            // Ordenar por gasto descendente
            this.rows.sort((a, b) => b.spend - a.spend);

            this.loading = false;
            this.render();
            const totalSpend = this.rows.reduce((s, r) => s + r.spend, 0);
            if (window.Utils) {
                Utils.showToast(`Meta sincronizado: ${this.rows.length} campaña(s), ${this.fmtMoney(totalSpend)} de gasto`, 'success');
            }
        } catch (err) {
            console.error('Meta sync:', err);
            this.loading = false;
            this.renderTable();
            const hint = /expired|session|OAuth|token|190/i.test(err.message)
                ? ' El token pudo expirar — vuelve a conectarte.'
                : '';
            this.setConnStatus(`❌ Error al sincronizar: ${err.message}.${hint}`, 'danger');
            if (window.Utils) Utils.showToast('Error al sincronizar con Meta: ' + err.message, 'error');
        } finally {
            this.setSyncBtn(false);
        }
    },

    countLeads(actions) {
        if (!Array.isArray(actions)) return 0;
        let total = 0;
        actions.forEach(a => {
            if (this.LEAD_ACTION_TYPES.includes(a.action_type)) {
                total += parseFloat(a.value || 0);
            }
        });
        return Math.round(total);
    },

    // Filas visibles según campaña seleccionada
    visibleRows() {
        if (this.selectedCampaign === 'all') return this.rows;
        return this.rows.filter(r => r.campaign_id === this.selectedCampaign);
    },

    // ---------------- Renderizado ----------------
    setConnStatus(msg, type = 'info') {
        const el = document.getElementById('metaConnStatus');
        if (!el) return;
        const colors = {
            info: 'var(--text-secondary)',
            muted: 'var(--text-muted)',
            success: 'var(--success)',
            warning: 'var(--warning)',
            danger: 'var(--danger)'
        };
        el.style.display = 'block';
        el.style.color = colors[type] || 'var(--text-secondary)';
        el.textContent = msg;
    },

    renderConnectionState() {
        const badge = document.getElementById('metaConnBadge');
        if (badge) {
            if (this.isConnected()) {
                badge.textContent = '● Conectado';
                badge.style.color = 'var(--success)';
            } else if (this.token) {
                badge.textContent = '● Token guardado (sin verificar)';
                badge.style.color = 'var(--warning)';
            } else {
                badge.textContent = '○ Sin conectar';
                badge.style.color = 'var(--text-muted)';
            }
        }
    },

    renderControls() {
        // Selector de cuentas
        const accSel = document.getElementById('metaAccountSelect');
        if (accSel) {
            if (this.accounts.length === 0) {
                accSel.innerHTML = `<option value="">— Conecta para ver tus cuentas —</option>`;
                accSel.disabled = true;
            } else {
                accSel.disabled = false;
                accSel.innerHTML = this.accounts.map(a =>
                    `<option value="${a.id}" ${a.id === this.selectedAccount ? 'selected' : ''}>${this.esc(a.name)} · ${a.account_id} (${a.currency})</option>`
                ).join('');
            }
        }

        // Selector de campañas
        const campSel = document.getElementById('metaCampaignSelect');
        if (campSel) {
            if (!this.selectedAccount) {
                campSel.innerHTML = `<option value="all">— Selecciona una cuenta —</option>`;
                campSel.disabled = true;
            } else {
                campSel.disabled = false;
                const opts = [`<option value="all" ${this.selectedCampaign === 'all' ? 'selected' : ''}>Todas las campañas (${this.campaigns.length})</option>`];
                this.campaigns.forEach(c => {
                    const dot = c.status === 'ACTIVE' ? '🟢' : (c.status === 'PAUSED' ? '⏸️' : '⚪');
                    opts.push(`<option value="${c.id}" ${c.id === this.selectedCampaign ? 'selected' : ''}>${dot} ${this.esc(c.name)}</option>`);
                });
                campSel.innerHTML = opts.join('');
            }
        }

        // Contador de cuentas + período en el sub-header
        const meta = document.getElementById('metaPeriodMeta');
        if (meta) {
            const n = this.accounts.length;
            meta.textContent = `PERÍODO · ${n} CUENTA${n === 1 ? '' : 'S'}`;
        }

        // Habilitar/deshabilitar botón sincronizar
        const syncBtn = document.getElementById('metaSyncBtn');
        if (syncBtn) syncBtn.disabled = !this.selectedAccount;
    },

    renderKpis() {
        const rows = this.visibleRows();
        const totalSpend = rows.reduce((s, r) => s + r.spend, 0);
        const totalImpr = rows.reduce((s, r) => s + r.impressions, 0);
        const totalClicks = rows.reduce((s, r) => s + r.clicks, 0);
        const totalLeads = rows.reduce((s, r) => s + r.leads, 0);
        const cpl = totalLeads > 0 ? totalSpend / totalLeads : null;

        this.setText('metaKpiSpend', this.fmtMoney(totalSpend));
        this.setText('metaKpiImpr', this.fmtNum(totalImpr));
        this.setText('metaKpiClicks', this.fmtNum(totalClicks));
        this.setText('metaKpiLeads', this.fmtNum(totalLeads));
        this.setText('metaKpiCpl', cpl === null ? '—' : this.fmtMoney(cpl));
    },

    renderTable() {
        const tbody = document.getElementById('metaAdsTableBody');
        if (!tbody) return;

        if (this.loading) {
            tbody.innerHTML = `<tr><td colspan="8" style="text-align:center; padding:2rem; color:var(--text-muted);">Sincronizando con Meta… ⏳</td></tr>`;
            return;
        }

        const rows = this.visibleRows();
        if (rows.length === 0) {
            const msg = this.selectedAccount
                ? 'Sin datos todavía — dale a "Sincronizar ahora". La primera carga puede tardar un momento.'
                : 'Conéctate y elige una cuenta publicitaria para empezar.';
            tbody.innerHTML = `<tr><td colspan="8" style="text-align:center; padding:2rem; color:var(--text-muted);">${msg}</td></tr>`;
            return;
        }

        tbody.innerHTML = rows.map(r => {
            const badge = this.statusBadge(r.status);
            return `
                <tr>
                    <td style="font-weight:600;">${this.esc(r.name)}</td>
                    <td>${badge}</td>
                    <td style="text-align:right;">${this.fmtMoney(r.spend)}</td>
                    <td style="text-align:right;">${this.fmtNum(r.impressions)}</td>
                    <td style="text-align:right;">${this.fmtNum(r.clicks)}</td>
                    <td style="text-align:right;">${r.ctr ? r.ctr.toFixed(2) + '%' : '—'}</td>
                    <td style="text-align:right; color:var(--success); font-weight:600;">${this.fmtNum(r.leads)}</td>
                    <td style="text-align:right;">${r.costPerLead === null ? '—' : this.fmtMoney(r.costPerLead)}</td>
                </tr>`;
        }).join('');
    },

    statusBadge(status) {
        const map = {
            ACTIVE: ['Activa', 'var(--success)', 'var(--success-light)'],
            PAUSED: ['Pausada', 'var(--warning)', 'var(--warning-light)'],
            ARCHIVED: ['Archivada', 'var(--text-muted)', 'var(--surface-hover)'],
            DELETED: ['Eliminada', 'var(--danger)', 'var(--danger-light)']
        };
        const [label, color, bg] = map[status] || [status || '—', 'var(--text-muted)', 'var(--surface-hover)'];
        return `<span style="display:inline-block; padding:2px 10px; border-radius:var(--radius-full); font-size:0.72rem; font-weight:600; color:${color}; background:${bg};">${label}</span>`;
    },

    setSyncBtn(loading) {
        const btn = document.getElementById('metaSyncBtn');
        if (!btn) return;
        btn.disabled = loading || !this.selectedAccount;
        btn.innerHTML = loading
            ? '⏳ Sincronizando…'
            : '↻ Sincronizar ahora';
    },

    // ---------------- Utilidades ----------------
    fmtMoney(n) {
        try {
            return new Intl.NumberFormat('es-EC', {
                style: 'currency', currency: this.currency || 'USD',
                minimumFractionDigits: 2, maximumFractionDigits: 2
            }).format(n || 0);
        } catch (e) {
            return `$${(n || 0).toFixed(2)}`;
        }
    },

    fmtNum(n) {
        return new Intl.NumberFormat('es-EC').format(n || 0);
    },

    esc(s) {
        if (window.Utils && typeof Utils.escapeHtml === 'function') return Utils.escapeHtml(s);
        return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({
            '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
        }[c]));
    },

    setText(id, val) {
        const el = document.getElementById(id);
        if (el) el.textContent = val;
    }
};

window.MetaAdsModule = MetaAdsModule;
