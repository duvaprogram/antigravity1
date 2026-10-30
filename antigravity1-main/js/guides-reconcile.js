// ========================================
// Guides Reconcile Module
// Conciliar las guías de Venezuela con el Excel de inventario (una hoja por mes)
// ========================================
//
// Cada fila de la hoja es una venta: FECHA, CLIENTES, INGRESO $ (dólares), BS (bolívares)
// y PM VENEZUELA REF BANCARIA. Todos los clientes de la hoja ya recibieron su pedido,
// salvo los que llevan la palabra "fallido" junto al nombre.
//
// Las columnas se buscan por el texto del encabezado y no por letra, porque en el libro
// cada mes termina en una columna distinta (CD / CE / CK) y las letras se corren.
//
// Nada se guarda hasta que el usuario revisa la vista previa y confirma.

const GuideReconcile = {
    MONTHS: ['ENERO', 'FEBRERO', 'MARZO', 'ABRIL', 'MAYO', 'JUNIO', 'JULIO', 'AGOSTO', 'SEPTIEMBRE', 'OCTUBRE', 'NOVIEMBRE', 'DICIEMBRE'],
    OPEN_STATUSES: ['Pendiente', 'En ruta', 'Novedad'],
    BLOCKED_STATUSES: ['Cancelado', 'Devolución'],
    USD_TOLERANCE: 0.01,
    BS_TOLERANCE: 1,

    workbook: null,
    rows: [],
    ignored: [],
    guides: [],
    applying: false,

    init() {
        document.getElementById('btnReconcileExcel')?.addEventListener('click', () => this.open());
        document.getElementById('reconcileFile')?.addEventListener('change', e => this.onFile(e.target.files[0]));
        document.getElementById('btnReconcileAnalyze')?.addEventListener('click', () => this.analyze());
        document.getElementById('btnReconcileApply')?.addEventListener('click', () => this.apply());

        const body = document.getElementById('reconcileResults');
        body?.addEventListener('change', e => this.onResultsChange(e));
    },

    open() {
        this.workbook = null;
        this.rows = [];
        this.ignored = [];
        document.getElementById('reconcileFile').value = '';
        document.getElementById('reconcileSheetRow').style.display = 'none';
        document.getElementById('reconcileResults').innerHTML = '';
        this.setStatus('Sube el Excel de inventario y elige la hoja del mes.');
        this.updateApplyButton();
        Utils.openModal('modalGuideReconcile');
    },

    setStatus(text) {
        const el = document.getElementById('reconcileStatus');
        if (el) el.textContent = text;
    },

    // ========================================
    // Lectura del Excel
    // ========================================
    onFile(file) {
        if (!file) return;
        if (typeof XLSX === 'undefined') {
            Utils.showToast('No se cargó la librería de Excel (SheetJS)', 'error');
            return;
        }
        const reader = new FileReader();
        reader.onload = e => {
            try {
                this.workbook = XLSX.read(new Uint8Array(e.target.result), { type: 'array' });
            } catch (err) {
                console.error(err);
                Utils.showToast('No se pudo leer el archivo. ¿Es un Excel válido?', 'error');
                return;
            }
            const names = this.workbook.SheetNames;
            const select = document.getElementById('reconcileSheet');
            select.innerHTML = names.map(n => `<option value="${Utils.escapeHtml(n)}">${Utils.escapeHtml(n)}</option>`).join('');
            const current = this.MONTHS[new Date().getMonth()];
            const preferred = names.find(n => n.trim().toUpperCase() === current);
            if (preferred) select.value = preferred;
            document.getElementById('reconcileSheetRow').style.display = 'flex';
            this.setStatus(`Archivo cargado (${names.length} hojas). Elige la hoja y pulsa "Analizar".`);
        };
        reader.readAsArrayBuffer(file);
    },

    normalize(text) {
        return String(text ?? '').toLowerCase()
            .normalize('NFD').replace(/[̀-ͯ]/g, '')
            .replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
    },

    toNumber(value) {
        if (value === null || value === undefined || value === '') return 0;
        if (typeof value === 'number') return value;
        let s = String(value).replace(/[^0-9.,-]/g, '');
        if (s.includes(',') && s.includes('.')) {
            // El último separador es el decimal
            s = s.lastIndexOf(',') > s.lastIndexOf('.') ? s.replace(/\./g, '').replace(',', '.') : s.replace(/,/g, '');
        } else if (s.includes(',')) {
            s = /,\d{1,2}$/.test(s) ? s.replace(',', '.') : s.replace(/,/g, '');
        }
        const n = parseFloat(s);
        return isNaN(n) ? 0 : n;
    },

    pad(n) { return String(n).padStart(2, '0'); },

    // Devuelve YYYY-MM-DD sin pasar por zonas horarias
    cellToIsoDate(cell) {
        if (!cell) return '';
        if (cell.t === 'n' && typeof cell.v === 'number') {
            const d = XLSX.SSF.parse_date_code(cell.v);
            return d ? `${d.y}-${this.pad(d.m)}-${this.pad(d.d)}` : '';
        }
        if (cell.v instanceof Date) {
            return `${cell.v.getFullYear()}-${this.pad(cell.v.getMonth() + 1)}-${this.pad(cell.v.getDate())}`;
        }
        const text = String(cell.w || cell.v || '');
        let m = text.match(/(\d{4})-(\d{1,2})-(\d{1,2})/);
        if (m) return `${m[1]}-${this.pad(m[2])}-${this.pad(m[3])}`;
        m = text.match(/(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})/);
        if (m) return `${m[3]}-${this.pad(m[2])}-${this.pad(m[1])}`;
        return '';
    },

    parseSheet(ws) {
        const range = XLSX.utils.decode_range(ws['!ref']);
        const text = (r, c) => {
            const cell = ws[XLSX.utils.encode_cell({ r, c })];
            return cell ? this.normalize(cell.v) : '';
        };

        // Fila de encabezado: la primera (en las 15 primeras) que tenga "clientes"
        let headerRow = -1;
        for (let r = range.s.r; r <= Math.min(range.e.r, 14) && headerRow < 0; r++) {
            for (let c = range.s.c; c <= range.e.c; c++) {
                if (text(r, c) === 'clientes') { headerRow = r; break; }
            }
        }
        if (headerRow < 0) throw new Error('No encontré la fila de encabezado (columna "CLIENTES") en esa hoja.');

        const cols = {};
        for (let c = range.s.c; c <= range.e.c; c++) {
            const h = text(headerRow, c);
            if (!h) continue;
            if (h === 'fecha') cols.date = c;
            else if (h === 'clientes') cols.client = c;
            else if (h.startsWith('ingreso')) cols.usd = c;
            else if (h === 'bs') cols.bs = c;
            else if (h.includes('ref') && (h.includes('banc') || h.includes('venezuela'))) cols.ref = c;
        }
        const missing = ['date', 'client', 'usd', 'bs'].filter(k => cols[k] === undefined);
        if (missing.length) {
            const names = { date: 'FECHA', client: 'CLIENTES', usd: 'INGRESO $', bs: 'BS' };
            throw new Error('Faltan columnas en esa hoja: ' + missing.map(k => names[k]).join(', '));
        }

        const rows = [];
        for (let r = headerRow + 1; r <= range.e.r; r++) {
            const nameCell = ws[XLSX.utils.encode_cell({ r, c: cols.client })];
            const rawName = nameCell ? String(nameCell.v ?? '').trim() : '';
            if (!rawName) continue;
            const val = c => { const cell = ws[XLSX.utils.encode_cell({ r, c })]; return cell ? cell.v : null; };
            rows.push({
                sheetRow: r + 1,
                date: this.cellToIsoDate(ws[XLSX.utils.encode_cell({ r, c: cols.date })]),
                name: rawName.replace(/^[:\s]+/, ''),
                usd: this.toNumber(val(cols.usd)),
                bs: this.toNumber(val(cols.bs)),
                ref: cols.ref !== undefined ? val(cols.ref) : null
            });
        }
        return rows;
    },

    // venta | fallido | cambio | movimiento | garantia
    classify(row) {
        const n = this.normalize(row.name);
        if (/ingreso de mercancia|retiro de mercancia|recoleccion/.test(n)) return 'movimiento';
        if (/garantia/.test(n)) return 'garantia';
        if (/^cambio\b/.test(n)) return 'cambio';
        if (/\bfallid[oa]s?\b/.test(n)) return 'fallido';
        return 'venta';
    },

    // ========================================
    // Cruce con las guías de la app
    // ========================================
    nameTokens(raw, dropPrefix) {
        let tokens = this.normalize(raw).split(' ').filter(Boolean)
            .filter(t => t !== 'fallido' && t !== 'fallida' && !(dropPrefix && t === dropPrefix));
        // Las guías terminan en " -W" / " -P" (canal de venta)
        if (tokens.length > 1 && (tokens[tokens.length - 1] === 'w' || tokens[tokens.length - 1] === 'p')) tokens.pop();
        return tokens.filter(t => t.length > 1);
    },

    nameScore(a, b) {
        if (!a.length || !b.length) return 0;
        if (a.join(' ') === b.join(' ')) return 1;
        const [short, long] = a.length <= b.length ? [a, b] : [b, a];
        const hits = short.filter(t => long.includes(t)).length;
        if (hits === short.length) return short.length >= 2 ? 0.9 : 0.6;
        return hits / Math.max(a.length, b.length);
    },

    dayDiff(a, b) {
        if (!a || !b) return 99;
        const [ya, ma, da] = a.split('-').map(Number);
        const [yb, mb, db] = b.split('-').map(Number);
        return Math.abs(Date.UTC(ya, ma - 1, da) - Date.UTC(yb, mb - 1, db)) / 864e5;
    },

    guideDate(guide) {
        const d = new Date(guide.createdAt);
        return isNaN(d) ? '' : `${d.getFullYear()}-${this.pad(d.getMonth() + 1)}-${this.pad(d.getDate())}`;
    },

    amountsMatch(row, guide) {
        const usdOk = row.usd > 0 && guide.amountUsd && Math.abs(guide.amountUsd - row.usd) < this.USD_TOLERANCE;
        const bsOk = row.bs > 0 && guide.paymentBs && Math.abs(guide.paymentBs - row.bs) < this.BS_TOLERANCE;
        return !!(usdOk || bsOk);
    },

    findCandidates(row, dropPrefix, used) {
        const tokens = this.nameTokens(row.name, dropPrefix);
        return this.guides
            .filter(g => !used || !used.has(g.id))
            .map(g => {
                const score = this.nameScore(tokens, this.nameTokens(g.clientName));
                const days = this.dayDiff(row.date, this.guideDate(g));
                const amount = this.amountsMatch(row, g);
                return { guide: g, score, days, amount, rank: score + (amount ? 0.1 : 0) - days * 0.01 };
            })
            .filter(c => c.score >= 0.6 && c.days <= 10)
            .sort((a, b) => b.rank - a.rank);
    },

    sameAmount(a, b, tolerance) {
        return Math.abs((a || 0) - (b || 0)) < tolerance;
    },

    // Qué cambiaría en la guía según lo que dice la hoja
    computeChanges(item) {
        const g = item.guide;
        const changes = { status: null, usd: null, bs: null };
        item.warnings = item.warnings.filter(w => w.sticky);
        if (!g) return changes;

        const row = item.row;
        if (item.kind === 'venta') {
            if (this.OPEN_STATUSES.includes(g.status)) changes.status = { from: g.status, to: 'Entregado' };
            else if (this.BLOCKED_STATUSES.includes(g.status)) item.warnings.push({ text: `La guía está en "${g.status}": no se cambia el estado.`, important: true });
        } else if (item.kind === 'fallido') {
            const action = item.failAction;
            if (action !== 'none') {
                if (g.status === action) { /* ya está así */ }
                else if (['Pagado', 'Entregado'].includes(g.status)) item.warnings.push({ text: `En la app figura "${g.status}", pero la hoja dice fallido.`, important: true });
                else if (this.BLOCKED_STATUSES.includes(g.status)) item.warnings.push({ text: `La guía ya está en "${g.status}".`, important: true });
                else changes.status = { from: g.status, to: action };
            }
        }

        // El pago aplica a ventas y a filas "cambio" que el usuario asignó a una guía
        if (item.kind === 'venta' || item.kind === 'cambio') {
            const wantUsd = row.usd > 0 ? row.usd : null;
            const wantBs = row.bs > 0 ? row.bs : null;
            if (wantUsd !== null || wantBs !== null) {
                if (!this.sameAmount(g.amountUsd, wantUsd, this.USD_TOLERANCE)) changes.usd = { from: g.amountUsd, to: wantUsd };
                if (!this.sameAmount(g.paymentBs, wantBs, this.BS_TOLERANCE)) changes.bs = { from: g.paymentBs, to: wantBs };
            } else if (item.kind === 'venta') {
                item.warnings.push({ text: 'Sin pago en la hoja: no se toca el pago.' });
            }
        }
        return changes;
    },

    hasChanges(item) {
        return !!(item.changes && (item.changes.status || item.changes.usd || item.changes.bs));
    },

    buildItems(sheetRows, guides) {
        this.guides = guides;
        const items = [];
        const ignored = [];
        const used = new Set();

        // Primero ventas y fallidos (consumen guía), después los "cambio" (solo sugieren)
        const order = { venta: 0, fallido: 0, cambio: 1 };
        const sorted = [...sheetRows].map(r => ({ row: r, kind: this.classify(r) }))
            .filter(x => {
                if (x.kind === 'movimiento' || x.kind === 'garantia') { ignored.push(x); return false; }
                return true;
            })
            .sort((a, b) => order[a.kind] - order[b.kind] || a.row.sheetRow - b.row.sheetRow);

        for (const x of sorted) {
            const item = { id: items.length, row: x.row, kind: x.kind, guide: null, candidates: [], warnings: [], changes: null, selected: false, failAction: 'Novedad', lowConfidence: false };
            const found = this.findCandidates(x.row, x.kind === 'cambio' ? 'cambio' : null, x.kind === 'cambio' ? null : used);
            item.candidates = found;

            if (x.kind === 'cambio') {
                // Decisión del usuario: ignorar o aplicar el pago a una guía
                item.guide = null;
            } else if (found.length) {
                const [best, second] = found;
                const tie = second && (best.rank - second.rank) < 0.05;
                if (tie) {
                    item.warnings.push({ text: 'Hay varias guías posibles: elige la correcta.', sticky: true });
                } else {
                    item.guide = best.guide;
                    used.add(best.guide.id);
                    item.lowConfidence = best.score < 0.9 && !best.amount;
                    if (item.lowConfidence) item.warnings.push({ text: 'Coincide solo parte del nombre: revísala antes de aplicar.', sticky: true });
                }
            }
            if (x.kind === 'fallido' && item.guide && ['Pagado', 'Entregado'].includes(item.guide.status)) item.failAction = 'none';

            item.changes = this.computeChanges(item);
            item.selected = this.hasChanges(item) && !item.lowConfidence && x.kind !== 'cambio';
            items.push(item);
        }
        return { items, ignored };
    },

    async analyze() {
        if (!this.workbook) { Utils.showToast('Primero sube el archivo de Excel', 'warning'); return; }
        const sheetName = document.getElementById('reconcileSheet').value;
        const city = document.getElementById('reconcileCity').value;
        const btn = document.getElementById('btnReconcileAnalyze');
        btn.disabled = true;
        this.setStatus('Analizando…');
        try {
            const sheetRows = this.parseSheet(this.workbook.Sheets[sheetName]);
            if (!sheetRows.length) throw new Error('Esa hoja no tiene filas con clientes.');

            const allGuides = await Database.getGuides();
            const dates = sheetRows.map(r => r.date).filter(Boolean).sort();
            const from = dates.length ? dates[0] : '';
            const guides = allGuides.filter(g => g.city === city && (!from || this.guideDate(g) >= this.shiftDate(from, -10)));

            const { items, ignored } = this.buildItems(sheetRows, guides);
            this.rows = items;
            this.ignored = ignored;
            this.render();
            this.setStatus(`Hoja ${sheetName}: ${sheetRows.length} filas con cliente · ${guides.length} guías de ${city} comparadas.`);
        } catch (err) {
            console.error(err);
            this.rows = [];
            document.getElementById('reconcileResults').innerHTML = '';
            this.setStatus('');
            Utils.showToast(err.message || 'No se pudo analizar la hoja', 'error');
        } finally {
            btn.disabled = false;
            this.updateApplyButton();
        }
    },

    shiftDate(iso, days) {
        const [y, m, d] = iso.split('-').map(Number);
        const dt = new Date(Date.UTC(y, m - 1, d + days));
        return `${dt.getUTCFullYear()}-${this.pad(dt.getUTCMonth() + 1)}-${this.pad(dt.getUTCDate())}`;
    },

    // ========================================
    // Vista previa
    // ========================================
    fmtBs(n) { return n == null ? '—' : Number(n).toLocaleString('es-VE', { maximumFractionDigits: 2 }) + ' Bs'; },
    fmtUsd(n) { return n == null ? '—' : '$' + Number(n).toLocaleString('en-US', { maximumFractionDigits: 2 }); },

    statusBadge(name) {
        return `<span class="status-badge ${Utils.getStatusClass(name)}">${Utils.escapeHtml(name)}</span>`;
    },

    paymentCell(item) {
        const g = item.guide;
        const c = item.changes || {};
        const row = item.row;
        if (!g) {
            if (item.kind !== 'cambio') return '<span style="color: var(--text-muted);">—</span>';
            const hoja = row.usd > 0 ? this.fmtUsd(row.usd) : row.bs > 0 ? this.fmtBs(row.bs) : 'sin pago';
            return `<span style="color: var(--text-muted);">En la hoja: ${hoja}</span>`;
        }
        const lines = [];
        if (c.usd) lines.push(`<div>${this.fmtUsd(c.usd.from)} → <strong style="color: var(--success);">${this.fmtUsd(c.usd.to)}</strong></div>`);
        if (c.bs) lines.push(`<div>${this.fmtBs(c.bs.from)} → <strong style="color: var(--info);">${this.fmtBs(c.bs.to)}</strong></div>`);
        if (!lines.length) {
            const hoja = row.usd > 0 ? this.fmtUsd(row.usd) : row.bs > 0 ? this.fmtBs(row.bs) : 'sin pago';
            return `<span style="color: var(--text-muted);">Igual (${hoja})</span>`;
        }
        return lines.join('');
    },

    statusCell(item) {
        if (item.kind === 'fallido') {
            const opt = (v, label) => `<option value="${v}" ${item.failAction === v ? 'selected' : ''}>${label}</option>`;
            return `<select data-action="fail" data-id="${item.id}" style="max-width: 150px;">
                ${opt('Novedad', 'Fallido → Novedad')}${opt('Devolución', 'Fallido → Devolución')}${opt('none', 'No cambiar')}
            </select>`;
        }
        const g = item.guide;
        if (!g) return '<span style="color: var(--text-muted);">—</span>';
        if (item.changes?.status) return `${this.statusBadge(item.changes.status.from)} → ${this.statusBadge(item.changes.status.to)}`;
        return `${this.statusBadge(g.status)} <span style="color: var(--text-muted); font-size: 0.8em;">sin cambio</span>`;
    },

    guideCell(item) {
        const g = item.guide;
        if (item.kind === 'cambio' || (!g && item.candidates.length > 1)) {
            const label = item.kind === 'cambio' ? 'Ignorar esta fila' : '— elegir guía —';
            const opts = item.candidates.map(c => {
                const sel = g && g.id === c.guide.id ? 'selected' : '';
                const text = `${c.guide.guideNumber} · ${c.guide.clientName.trim()} · ${c.guide.status}`;
                const prefix = item.kind === 'cambio' ? 'Aplicar el pago a ' : '';
                return `<option value="${Utils.escapeHtml(c.guide.id)}" ${sel}>${Utils.escapeHtml(prefix + text)}</option>`;
            }).join('');
            return `<select data-action="guide" data-id="${item.id}" style="max-width: 260px;"><option value="">${label}</option>${opts}</select>`;
        }
        if (!g) return '<span style="color: var(--danger);">Sin guía en la app</span>';
        return `<strong style="color: var(--primary);">${Utils.escapeHtml(g.guideNumber)}</strong><div style="font-size: 0.8em; color: var(--text-muted);">${Utils.escapeHtml(g.clientName.trim())}</div>`;
    },

    kindLabel(item) {
        if (item.kind === 'cambio') return '<span class="badge" style="font-size:0.7em;">CAMBIO</span> ';
        if (item.kind === 'fallido') return '<span class="badge" style="font-size:0.7em; background: var(--danger); color: #fff;">FALLIDO</span> ';
        return '';
    },

    render() {
        const results = document.getElementById('reconcileResults');
        const withChanges = this.rows.filter(i => this.hasChanges(i) || i.kind === 'cambio'
            || (!i.guide && i.candidates.length > 1) || i.warnings.some(w => w.important || w.sticky));
        const unchanged = this.rows.filter(i => !withChanges.includes(i) && i.guide);
        const noGuide = this.rows.filter(i => !i.guide && i.kind !== 'cambio' && i.candidates.length <= 1);

        const summary = `
            <div style="display: flex; flex-wrap: wrap; gap: 0.5rem; margin-bottom: 1rem;">
                <span class="badge">${withChanges.filter(i => this.hasChanges(i)).length} con cambios</span>
                <span class="badge">${unchanged.length} ya estaban al día</span>
                <span class="badge">${noGuide.length} sin guía en la app</span>
                <span class="badge">${this.ignored.length} ignoradas (mercancía / garantía)</span>
            </div>`;

        const tableRows = withChanges.map(item => `
            <tr data-row="${item.id}">
                <td><input type="checkbox" data-action="select" data-id="${item.id}" ${item.selected ? 'checked' : ''} ${this.hasChanges(item) ? '' : 'disabled'}></td>
                <td>${this.kindLabel(item)}<strong>${Utils.escapeHtml(item.row.name)}</strong>
                    <div style="font-size: 0.8em; color: var(--text-muted);">Fila ${item.row.sheetRow} · ${Utils.escapeHtml(item.row.date || 's/f')}${item.row.ref ? ' · Ref ' + Utils.escapeHtml(String(item.row.ref)) : ''}</div></td>
                <td>${this.guideCell(item)}</td>
                <td>${this.statusCell(item)}</td>
                <td>${this.paymentCell(item)}</td>
                <td style="font-size: 0.8em; color: var(--warning);">${item.warnings.map(w => Utils.escapeHtml(w.text)).join('<br>')}</td>
            </tr>`).join('');

        const table = withChanges.length ? `
            <div class="table-container"><table class="table">
                <thead><tr><th></th><th>Hoja (Excel)</th><th>Guía en la app</th><th>Estado</th><th>Pago</th><th>Notas</th></tr></thead>
                <tbody>${tableRows}</tbody>
            </table></div>` : '<p style="color: var(--text-muted);">No hay cambios que aplicar.</p>';

        const list = (title, entries) => entries.length ? `
            <details style="margin-top: 1rem;"><summary style="cursor: pointer;">${title} (${entries.length})</summary>
            <ul style="margin: 0.5rem 0 0 1.25rem; color: var(--text-secondary); font-size: 0.9em;">${entries.join('')}</ul></details>` : '';

        results.innerHTML = summary + table
            + list('Sin guía en la app', noGuide.map(i => `<li>${Utils.escapeHtml(i.row.name)} · ${Utils.escapeHtml(i.row.date)} · ${i.row.usd > 0 ? this.fmtUsd(i.row.usd) : this.fmtBs(i.row.bs)}</li>`))
            + list('Ya estaban al día', unchanged.map(i => `<li>${Utils.escapeHtml(i.row.name)} → ${Utils.escapeHtml(i.guide.guideNumber)} (${Utils.escapeHtml(i.guide.status)})</li>`))
            + list('Filas ignoradas', this.ignored.map(x => `<li>${Utils.escapeHtml(x.row.name)} (fila ${x.row.sheetRow})</li>`));
    },

    onResultsChange(e) {
        const el = e.target.closest('[data-action]');
        if (!el) return;
        const item = this.rows[Number(el.dataset.id)];
        if (!item) return;

        if (el.dataset.action === 'select') {
            item.selected = el.checked;
        } else if (el.dataset.action === 'fail') {
            item.failAction = el.value;
            item.changes = this.computeChanges(item);
            item.selected = this.hasChanges(item);
            this.render();
        } else if (el.dataset.action === 'guide') {
            const chosen = item.candidates.find(c => c.guide.id === el.value);
            item.guide = chosen ? chosen.guide : null;
            item.warnings = item.warnings.filter(w => !w.sticky || item.kind === 'cambio');
            if (item.kind === 'fallido' && item.guide && ['Pagado', 'Entregado'].includes(item.guide.status)) item.failAction = 'none';
            item.changes = this.computeChanges(item);
            item.selected = !!item.guide && this.hasChanges(item);
            this.render();
        }
        this.updateApplyButton();
    },

    selectedItems() {
        return this.rows.filter(i => i.selected && i.guide && this.hasChanges(i));
    },

    updateApplyButton() {
        const btn = document.getElementById('btnReconcileApply');
        if (!btn) return;
        const n = this.selectedItems().length;
        btn.textContent = n ? `Aplicar ${n} cambio${n === 1 ? '' : 's'}` : 'Aplicar cambios';
        btn.disabled = this.applying || n === 0;
    },

    // ========================================
    // Aplicar
    // ========================================
    async apply() {
        const items = this.selectedItems();
        if (!items.length || this.applying) return;
        this.applying = true;
        this.updateApplyButton();

        const done = [];
        const failed = [];
        for (const item of items) {
            const g = item.guide;
            const c = item.changes;
            try {
                if (c.usd || c.bs) {
                    const payment = {};
                    if (c.usd) payment.amountUsd = c.usd.to;
                    if (c.bs) payment.paymentBs = c.bs.to;
                    await Database.updateGuidePayment(g.id, payment);
                }
                if (c.status) {
                    // Devolución regresa el stock al inventario, igual que al cambiarla a mano
                    if (c.status.to === 'Devolución') await GuidesModule.returnGuideStock(g.id);
                    let deliveredAt = null;
                    if (c.status.to === 'Entregado' && item.row.date) {
                        const [y, m, d] = item.row.date.split('-').map(Number);
                        deliveredAt = new Date(y, m - 1, d, 12).toISOString();
                    }
                    await Database.updateGuideStatus(g.id, c.status.to, deliveredAt);
                }
                done.push(item);
            } catch (err) {
                console.error('Conciliar:', g.guideNumber, err);
                failed.push({ item, message: err.message || String(err) });
            }
        }

        this.applying = false;
        this.rows = this.rows.filter(i => !done.includes(i));
        const results = document.getElementById('reconcileResults');
        results.innerHTML = `
            <div style="padding: 1rem; border-radius: var(--radius-md); background: var(--surface); border: 1px solid var(--border);">
                <strong style="color: var(--success);">✔ ${done.length} guía${done.length === 1 ? '' : 's'} actualizada${done.length === 1 ? '' : 's'}.</strong>
                ${failed.length ? `<div style="color: var(--danger); margin-top: 0.5rem;">✖ ${failed.length} fallaron:
                    <ul style="margin: 0.25rem 0 0 1.25rem;">${failed.map(f => `<li>${Utils.escapeHtml(f.item.guide.guideNumber)}: ${Utils.escapeHtml(f.message)}</li>`).join('')}</ul></div>` : ''}
                <div style="margin-top: 0.75rem; color: var(--text-secondary);">Puedes volver a pulsar "Analizar" para ver qué queda pendiente.</div>
            </div>`;
        this.setStatus('');
        this.updateApplyButton();
        Utils.showToast(`${done.length} guía(s) actualizada(s)${failed.length ? `, ${failed.length} con error` : ''}`, failed.length ? 'warning' : 'success');
        if (typeof GuidesModule !== 'undefined') await GuidesModule.render();
    }
};

GuideReconcile.init();
