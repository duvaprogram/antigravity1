/* ==========================================================================
   Módulo: Calculadora de Materiales y Visualizador Interactivo de Pulseras
   ========================================================================== */

const MaterialsCalculatorModule = (() => {
    // Definición de tipos de balines
    const BEAD_TYPES = {
        neopreno_negro: { id: 'neopreno_negro', name: 'Balín Neopreno Negro', sizeName: 'No. 8', sizeMm: 8, type: 'neopreno', displayColor: '#1a1a1a' },
        neopreno_rojo: { id: 'neopreno_rojo', name: 'Balín Neopreno Rojo', sizeName: 'No. 8', sizeMm: 8, type: 'neopreno', displayColor: '#cc1111' },
        dorado_no6: { id: 'dorado_no6', name: 'Balín No. 6 Dorado', sizeName: 'No. 6', sizeMm: 6, type: 'metal_shiny', displayColor: '#ffd700' },
        diamantado_dorado_no8: { id: 'diamantado_dorado_no8', name: 'Balín No. 8 Diamantado Dorado', sizeName: 'No. 8', sizeMm: 8, type: 'metal_diamond', displayColor: '#e5a93b' },
        diamantado_plata_no8: { id: 'diamantado_plata_no8', name: 'Balín No. 8 Diamantado Plata', sizeName: 'No. 8', sizeMm: 8, type: 'metal_diamond', displayColor: '#d0d0d0' },
        diamantado_ororosa_no8: { id: 'diamantado_ororosa_no8', name: 'Balín No. 8 Diamantado Oro Rosa', sizeName: 'No. 8', sizeMm: 8, type: 'metal_diamond', displayColor: '#e09085' }
    };

    // Presets de diseños
    const PRESETS = {
        san_benito: [
            { typeId: 'neopreno_negro', qty: 6 },
            { typeId: 'dorado_no6', qty: 2 },
            { typeId: 'diamantado_dorado_no8', qty: 1 },
            { typeId: 'diamantado_plata_no8', qty: 1 },
            { typeId: 'diamantado_ororosa_no8', qty: 1 },
            { typeId: 'neopreno_negro', qty: 6 },
            { typeId: 'dorado_no6', qty: 2 },
            { typeId: 'diamantado_dorado_no8', qty: 1 },
            { typeId: 'diamantado_plata_no8', qty: 1 },
            { typeId: 'diamantado_ororosa_no8', qty: 1 }
        ],
        empty: []
    };

    // Estado inicial
    let sequence = JSON.parse(JSON.stringify(PRESETS.san_benito));
    let batchNegro = 150;
    let batchRojo = 150;
    let wastagePercent = 5;
    let threadLengthCm = 35;
    let isRotating = false;
    let initialized = false;
    
    // Pestaña activa
    let activeTab = 'direct'; // 'direct', 'inverse' o 'stock'

    // Material disponible (compartido por la calculadora inversa y el inventario).
    // Claves: typeId de balín -> unidades, 'thread' -> metros.
    let stockInputs = {};

    // Dijes (colgantes): catálogo con su propio stock
    let dijes = []; // { id, name, shape, color, stock }
    let selectedDijeId = ''; // dije del diseño actual ('' = sin dije)

    // Diseños ya comprometidos a producción (descuentan del material disponible)
    let productions = []; // { id, name, color, qty, sequence, dijeId, threadCm }

    // Biblioteca de diseños guardados
    let designs = []; // { id, name, sequence, dijeId, threadCm }
    let currentDesignId = ''; // diseño abierto en el editor ('' = sin guardar)

    const STORAGE_KEY = 'antigravity_materials_stock_v1';

    // Tablas de Supabase (ver supabase_bracelets_schema.sql)
    const TABLES = {
        designs: 'bracelet_designs',
        charms: 'bracelet_charms',
        stock: 'bracelet_material_stock',
        productions: 'bracelet_productions'
    };

    const CHARM_SHAPES = {
        medalla: 'Medalla',
        cruz: 'Cruz',
        corazon: 'Corazón',
        estrella: 'Estrella'
    };

    const CHARM_COLORS = {
        dorado: { name: 'Dorado', fill: '#e5b93b', stroke: '#8a6a10' },
        plata: { name: 'Plata', fill: '#d4d4d4', stroke: '#777' },
        ororosa: { name: 'Oro Rosa', fill: '#e09085', stroke: '#8a4a40' },
        negro: { name: 'Negro', fill: '#2a2a2a', stroke: '#000' }
    };

    function esc(str) {
        return String(str).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    }

    function newId(prefix) {
        return `${prefix}${Date.now().toString(36)}${Math.floor(Math.random() * 100000).toString(36)}`;
    }

    /* ---------- Persistencia: Supabase con respaldo en localStorage ---------- */

    function sb() {
        return (typeof supabaseClient !== 'undefined' && supabaseClient) ? supabaseClient : null;
    }

    function loadLocalState() {
        try {
            const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
            if (!saved) return;
            stockInputs = saved.stock || {};
            dijes = Array.isArray(saved.dijes) ? saved.dijes : [];
            productions = Array.isArray(saved.productions) ? saved.productions : [];
            designs = Array.isArray(saved.designs) ? saved.designs : [];
        } catch (e) {
            console.warn('No se pudo leer el inventario guardado:', e);
        }
    }

    /** Guarda siempre en local (instantáneo); Supabase se sincroniza aparte */
    function saveState() {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify({ stock: stockInputs, dijes, productions, designs }));
        } catch (e) {
            console.warn('No se pudo guardar el inventario:', e);
        }
    }

    /** Trae todo desde Supabase; si falla, se queda con lo local */
    async function loadFromCloud() {
        const client = sb();
        if (!client) return false;

        try {
            const [resDesigns, resCharms, resStock, resProds] = await Promise.all([
                client.from(TABLES.designs).select('*').order('created_at', { ascending: true }),
                client.from(TABLES.charms).select('*').order('created_at', { ascending: true }),
                client.from(TABLES.stock).select('*'),
                client.from(TABLES.productions).select('*').order('created_at', { ascending: true })
            ]);

            const firstError = [resDesigns, resCharms, resStock, resProds].find(r => r.error);
            if (firstError) throw firstError.error;

            designs = (resDesigns.data || []).map(r => ({
                id: r.id,
                name: r.name,
                sequence: r.sequence || [],
                dijeId: r.dije_id || '',
                threadCm: r.thread_cm || 35
            }));
            dijes = (resCharms.data || []).map(r => ({
                id: r.id, name: r.name, shape: r.shape, color: r.color, stock: Number(r.stock) || 0
            }));
            stockInputs = {};
            (resStock.data || []).forEach(r => { stockInputs[r.material_key] = Number(r.quantity) || 0; });
            productions = (resProds.data || []).map(r => ({
                id: r.id,
                name: r.name,
                color: r.color,
                qty: Number(r.qty) || 1,
                sequence: r.sequence || [],
                dijeId: r.dije_id || '',
                threadCm: r.thread_cm || 35
            }));

            saveState();
            return true;
        } catch (e) {
            console.warn('No se pudo cargar desde Supabase, se usa el respaldo local:', e.message || e);
            return false;
        }
    }

    /** Envía un cambio a Supabase sin bloquear la interfaz */
    function cloudUpsert(table, row) {
        const client = sb();
        if (!client) return;
        client.from(table).upsert(row).then(({ error }) => {
            if (error) console.warn(`No se pudo guardar en ${table}:`, error.message);
        });
    }

    function cloudDelete(table, id, column = 'id') {
        const client = sb();
        if (!client) return;
        client.from(table).delete().eq(column, id).then(({ error }) => {
            if (error) console.warn(`No se pudo eliminar de ${table}:`, error.message);
        });
    }

    const designRow = d => ({ id: d.id, name: d.name, sequence: d.sequence, dije_id: d.dijeId || null, thread_cm: d.threadCm });
    const charmRow = d => ({ id: d.id, name: d.name, shape: d.shape, color: d.color, stock: d.stock || 0 });
    const productionRow = p => ({ id: p.id, name: p.name, color: p.color, qty: p.qty, sequence: p.sequence, dije_id: p.dijeId || null, thread_cm: p.threadCm });

    function getDije(id) {
        return dijes.find(d => d.id === id) || null;
    }

    // Gradientes SVG para renderizado fotorrealista
    const SVG_DEFS = `
        <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="1" dy="2" stdDeviation="1.5" flood-opacity="0.5" />
        </filter>

        <!-- Neopreno Negro (Mate) -->
        <radialGradient id="grad-neopreno_negro" cx="30%" cy="30%" r="70%">
            <stop offset="0%" stop-color="#4d4d4d" />
            <stop offset="60%" stop-color="#1e1e1e" />
            <stop offset="100%" stop-color="#080808" />
        </radialGradient>
        
        <!-- Neopreno Rojo (Mate) -->
        <radialGradient id="grad-neopreno_rojo" cx="30%" cy="30%" r="70%">
            <stop offset="0%" stop-color="#ff4f4f" />
            <stop offset="65%" stop-color="#bb1111" />
            <stop offset="100%" stop-color="#660000" />
        </radialGradient>

        <!-- Dorado No. 6 -->
        <radialGradient id="grad-dorado_no6" cx="30%" cy="30%" r="70%">
            <stop offset="0%" stop-color="#fffae6" />
            <stop offset="25%" stop-color="#ffd700" />
            <stop offset="70%" stop-color="#cca300" />
            <stop offset="100%" stop-color="#665200" />
        </radialGradient>

        <!-- Dorado Diamantado No. 8 -->
        <radialGradient id="grad-diamantado_dorado_no8" cx="30%" cy="30%" r="70%">
            <stop offset="0%" stop-color="#fff5cc" />
            <stop offset="30%" stop-color="#ffa500" />
            <stop offset="75%" stop-color="#b37400" />
            <stop offset="100%" stop-color="#4d3200" />
        </radialGradient>

        <!-- Plata Diamantado No. 8 -->
        <radialGradient id="grad-diamantado_plata_no8" cx="30%" cy="30%" r="70%">
            <stop offset="0%" stop-color="#ffffff" />
            <stop offset="35%" stop-color="#c8c8c8" />
            <stop offset="75%" stop-color="#8c8c8c" />
            <stop offset="100%" stop-color="#4a4a4a" />
        </radialGradient>

        <!-- Oro Rosa Diamantado No. 8 -->
        <radialGradient id="grad-diamantado_ororosa_no8" cx="30%" cy="30%" r="70%">
            <stop offset="0%" stop-color="#fff0ec" />
            <stop offset="30%" stop-color="#f4aea2" />
            <stop offset="75%" stop-color="#c76d5e" />
            <stop offset="100%" stop-color="#6b3026" />
        </radialGradient>
    `;

    /**
     * Inicializa el módulo, bindea eventos de la UI y gatilla primer renderizado.
     */
    function init() {
        if (initialized) {
            updateCalculations();
            renderPreview();
            renderSequenceList();
            renderDijeSelect();
            renderDesignSelect();
            if (activeTab === 'inverse') {
                renderInverseTable();
            } else if (activeTab === 'stock') {
                renderStockTab();
            }
            return;
        }

        console.log('Iniciando MaterialsCalculatorModule...');
        loadLocalState();

        // Bindear controles del lote
        const inputBatchNegro = document.getElementById('matCalcBatchNegro');
        if (inputBatchNegro) {
            inputBatchNegro.value = batchNegro;
            inputBatchNegro.addEventListener('input', (e) => {
                batchNegro = Math.max(0, parseInt(e.target.value) || 0);
                updateCalculations();
                if (activeTab === 'inverse') {
                    updateInverseCapacity();
                }
            });
        }

        const inputBatchRojo = document.getElementById('matCalcBatchRojo');
        if (inputBatchRojo) {
            inputBatchRojo.value = batchRojo;
            inputBatchRojo.addEventListener('input', (e) => {
                batchRojo = Math.max(0, parseInt(e.target.value) || 0);
                updateCalculations();
                if (activeTab === 'inverse') {
                    updateInverseCapacity();
                }
            });
        }

        const inputWastage = document.getElementById('matCalcWastage');
        if (inputWastage) {
            inputWastage.value = wastagePercent;
            inputWastage.addEventListener('input', (e) => {
                wastagePercent = Math.max(0, parseFloat(e.target.value) || 0);
                updateCalculations();
                if (activeTab === 'inverse') {
                    updateInverseCapacity();
                }
            });
        }

        const inputThread = document.getElementById('matCalcThreadPerBrac');
        if (inputThread) {
            inputThread.value = threadLengthCm;
            inputThread.addEventListener('input', (e) => {
                threadLengthCm = Math.max(1, parseInt(e.target.value) || 1);
                updateCalculations();
                if (activeTab === 'inverse') {
                    renderInverseTable();
                }
            });
        }

        // Poblar selector de tipos de balines
        const selectBeadType = document.getElementById('matCalcBeadTypeSelect');
        if (selectBeadType) {
            selectBeadType.innerHTML = Object.values(BEAD_TYPES).map(type => `
                <option value="${type.id}">${type.name} (${type.sizeName})</option>
            `).join('');
        }

        // Preset selector
        const selectPreset = document.getElementById('matCalcPresetSelect');
        if (selectPreset) {
            selectPreset.value = 'san_benito';
            selectPreset.addEventListener('change', (e) => {
                const val = e.target.value;
                if (PRESETS[val]) {
                    sequence = JSON.parse(JSON.stringify(PRESETS[val]));
                    currentDesignId = '';
                    renderDesignSelect();
                    renderSequenceList();
                    renderPreview();
                    updateCalculations();
                    if (activeTab === 'inverse') {
                        renderInverseTable();
                    }
                }
            });
        }

        // Restablecer Preset
        const btnReset = document.getElementById('btnMatCalcResetPreset');
        if (btnReset) {
            btnReset.addEventListener('click', () => {
                const selectPreset = document.getElementById('matCalcPresetSelect');
                const val = selectPreset ? selectPreset.value : 'san_benito';
                if (PRESETS[val]) {
                    sequence = JSON.parse(JSON.stringify(PRESETS[val]));
                    renderSequenceList();
                    renderPreview();
                    updateCalculations();
                    if (activeTab === 'inverse') {
                        renderInverseTable();
                    }
                    Utils.showToast('Secuencia restablecida', 'info');
                }
            });
        }

        // Botón añadir balín
        const btnAdd = document.getElementById('btnMatCalcAddBead');
        if (btnAdd) {
            btnAdd.addEventListener('click', () => {
                const typeSelect = document.getElementById('matCalcBeadTypeSelect');
                const qtyInput = document.getElementById('matCalcBeadQtyInput');
                if (typeSelect && qtyInput) {
                    const typeId = typeSelect.value;
                    const qty = Math.max(1, parseInt(qtyInput.value) || 1);
                    
                    sequence.push({ typeId, qty });
                    
                    renderSequenceList();
                    renderPreview();
                    updateCalculations();
                    if (activeTab === 'inverse') {
                        renderInverseTable();
                    }
                    Utils.showToast('Balines añadidos al diseño', 'success');
                }
            });
        }

        // Activar Rotación
        const btnToggleRotation = document.getElementById('btnMatCalcToggleRotation');
        if (btnToggleRotation) {
            btnToggleRotation.addEventListener('click', () => {
                isRotating = !isRotating;
                const svgContent = document.getElementById('matCalcSvgPreview').querySelector('g');
                if (svgContent) {
                    if (isRotating) {
                        svgContent.classList.add('rotating-bracelet');
                        btnToggleRotation.classList.add('btn-primary');
                        btnToggleRotation.classList.remove('btn-secondary');
                    } else {
                        svgContent.classList.remove('rotating-bracelet');
                        btnToggleRotation.classList.remove('btn-primary');
                        btnToggleRotation.classList.add('btn-secondary');
                    }
                }
            });
        }

        // Selector de fondos
        const bgBtns = document.querySelectorAll('.bg-select-btn');
        bgBtns.forEach(btn => {
            btn.addEventListener('click', (e) => {
                bgBtns.forEach(b => b.classList.remove('active'));
                const targetBtn = e.currentTarget;
                targetBtn.classList.add('active');
                
                const bgType = targetBtn.dataset.bg;
                const wrapper = document.getElementById('matCalcPreviewWrapper');
                if (wrapper) {
                    wrapper.className = `preview-wrapper ${bgType}`;
                }
            });
        });

        // Bindeo de pestañas
        const tabs = {
            direct: { btn: 'btnTabDirect', box: 'containerDirectCalc' },
            inverse: { btn: 'btnTabInverse', box: 'containerInverseCalc' },
            stock: { btn: 'btnTabStock', box: 'containerStockCalc' }
        };
        Object.entries(tabs).forEach(([name, ids]) => {
            const btn = document.getElementById(ids.btn);
            if (!btn) return;
            btn.addEventListener('click', () => {
                activeTab = name;
                Object.entries(tabs).forEach(([other, otherIds]) => {
                    const b = document.getElementById(otherIds.btn);
                    const box = document.getElementById(otherIds.box);
                    if (b) b.classList.toggle('active', other === name);
                    if (box) box.style.display = other === name ? 'block' : 'none';
                });
                if (name === 'direct') updateCalculations();
                else if (name === 'inverse') renderInverseTable();
                else renderStockTab();
            });
        });

        // Escuchar cambios de inputs de stock en la tabla inversa
        const inverseTableBody = document.getElementById('matCalcInverseTable');
        if (inverseTableBody) {
            inverseTableBody.addEventListener('input', (e) => {
                if (e.target.classList.contains('mat-stock-input')) {
                    const typeId = e.target.dataset.typeId;
                    const val = parseFloat(e.target.value) || 0;
                    if (typeId.startsWith('dije:')) {
                        const dije = getDije(typeId.slice(5));
                        if (dije) {
                            dije.stock = val;
                            cloudUpsert(TABLES.charms, charmRow(dije));
                        }
                    } else {
                        stockInputs[typeId] = val;
                        cloudUpsert(TABLES.stock, { material_key: typeId, quantity: val });
                    }
                    saveState();
                    updateInverseCapacity();
                }
            });
        }

        bindStockControls();
        bindDesignControls();

        // Exportar PDF
        const btnPdf = document.getElementById('btnMatCalcExportPdf');
        if (btnPdf) {
            btnPdf.addEventListener('click', exportToPdf);
        }

        // Exportar Excel
        const btnXlsx = document.getElementById('btnMatCalcExportXlsx');
        if (btnXlsx) {
            btnXlsx.addEventListener('click', exportToXlsx);
        }

        initialized = true;
        renderSequenceList();
        renderPreview();
        updateCalculations();

        // Sincronizar con Supabase y repintar con los datos de la nube
        loadFromCloud().then(ok => {
            if (!ok) return;
            renderDijeSelect();
            renderDesignSelect();
            renderSequenceList();
            renderPreview();
            updateCalculations();
            if (activeTab === 'inverse') renderInverseTable();
            else if (activeTab === 'stock') renderStockTab();
        });
    }

    /**
     * Retorna la cadena SVG formateada para un balín individual
     */
    function getBeadSVGString(beadType, cx, cy, r) {
        const gradId = `grad-${beadType.id}`;
        let overlay = '';

        if (beadType.type === 'metal_diamond') {
            let lines = '';
            const numFacets = 8;
            for (let i = 0; i < numFacets; i++) {
                const angle = (i * 2 * Math.PI) / numFacets;
                const x2 = cx + r * Math.cos(angle);
                const y2 = cy + r * Math.sin(angle);
                lines += `<line x1="${cx}" y1="${cy}" x2="${x2}" y2="${y2}" stroke="rgba(255,255,255,0.35)" stroke-width="0.7" />`;
            }
            overlay = `
                ${lines}
                <circle cx="${cx}" cy="${cy}" r="${r * 0.5}" fill="none" stroke="rgba(255,255,255,0.25)" stroke-width="0.5" stroke-dasharray="1 1" />
                <circle cx="${cx}" cy="${cy}" r="${r * 0.75}" fill="none" stroke="rgba(0,0,0,0.12)" stroke-width="0.5" />
            `;
        }

        return `
            <g class="bead-group">
                <circle cx="${cx}" cy="${cy}" r="${r}" fill="url(#${gradId})" filter="url(#shadow)" />
                ${overlay}
                <circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="rgba(0,0,0,0.18)" stroke-width="0.6" />
                <circle cx="${cx - r * 0.35}" cy="${cy - r * 0.35}" r="${r * 0.16}" fill="rgba(255,255,255,0.55)" filter="blur(0.5px)" />
            </g>
        `;
    }

    /**
     * Renderiza la vista previa interactiva circular de la pulsera usando matemáticas trigonométricas
     */
    function renderPreview() {
        const svgEl = document.getElementById('matCalcSvgPreview');
        if (!svgEl) return;

        svgEl.innerHTML = `<defs>${SVG_DEFS}</defs>`;

        if (sequence.length === 0) {
            svgEl.innerHTML += `
                <text x="150" y="150" text-anchor="middle" dominant-baseline="middle" fill="var(--text-muted)" font-size="13" font-weight="500">
                    Añade balines para armar tu pulsera
                </text>
            `;
            return;
        }

        const flatBeads = [];
        sequence.forEach(item => {
            const beadType = BEAD_TYPES[item.typeId];
            if (beadType) {
                for (let i = 0; i < item.qty; i++) {
                    flatBeads.push(beadType);
                }
            }
        });

        const cx = 150;
        const cy = 150;

        let totalBaseDiameter = 0;
        flatBeads.forEach(bead => {
            totalBaseDiameter += (bead.sizeMm * 1.5) * 2;
        });

        let R_base = totalBaseDiameter / (2 * Math.PI);

        let R = R_base;
        const maxR = 100;
        const minR = 55;
        if (R_base > maxR) {
            R = maxR;
        } else if (R_base < minR) {
            R = minR;
        }

        const scale = R / R_base;

        const threadCircle = `
            <circle cx="${cx}" cy="${cy}" r="${R}" fill="none" stroke="#111" stroke-width="2" stroke-dasharray="2 3" opacity="0.6" />
        `;

        let beadGroupsString = '';
        let currentAngle = 0;
        const rotationClass = isRotating ? 'rotating-bracelet' : '';

        flatBeads.forEach((bead, index) => {
            const nextBead = flatBeads[(index + 1) % flatBeads.length];
            const r_render = (bead.sizeMm * 1.5) * scale;
            const next_r_render = (nextBead.sizeMm * 1.5) * scale;

            const x = cx + R * Math.cos(currentAngle);
            const y = cy + R * Math.sin(currentAngle);

            beadGroupsString += getBeadSVGString(bead, x, y, r_render);

            const angleStep = (r_render + next_r_render) / R;
            currentAngle += angleStep;
        });

        // Dije colgando de la parte inferior (fijo, no gira con las cuentas)
        let charmString = '';
        const dije = getDije(selectedDijeId);
        if (dije) {
            const charmSize = 13;
            const hangY = cy + R + (12 * scale) + 3;
            const charmCy = Math.min(hangY + charmSize + 4, 300 - charmSize - 2);
            charmString = `
                <line x1="${cx}" y1="${cy + R}" x2="${cx}" y2="${charmCy - charmSize}" stroke="#999" stroke-width="1.2" />
                ${getCharmSVGString(dije, cx, charmCy, charmSize)}
            `;
        }

        svgEl.innerHTML += `
            <g class="${rotationClass}" style="transform-origin: 150px 150px;">
                ${threadCircle}
                ${beadGroupsString}
            </g>
            ${charmString}
        `;
    }

    /**
     * Retorna el SVG de un dije centrado en (cx, cy) con "s" como radio aproximado
     */
    function getCharmSVGString(dije, cx, cy, s) {
        const c = CHARM_COLORS[dije.color] || CHARM_COLORS.dorado;
        const common = `fill="${c.fill}" stroke="${c.stroke}" stroke-width="1" filter="url(#shadow)"`;
        let shape = '';

        if (dije.shape === 'cruz') {
            const a = s * 0.3;
            shape = `<path ${common} d="M${cx - a} ${cy - s} h${2 * a} v${s - a} h${s - a} v${2 * a} h${-(s - a)} v${s - a} h${-2 * a} v${-(s - a)} h${-(s - a)} v${-2 * a} h${s - a} z" />`;
        } else if (dije.shape === 'corazon') {
            shape = `<path ${common} d="M${cx} ${cy + s} C${cx - s * 1.6} ${cy - s * 0.1} ${cx - s * 0.7} ${cy - s * 1.1} ${cx} ${cy - s * 0.35} C${cx + s * 0.7} ${cy - s * 1.1} ${cx + s * 1.6} ${cy - s * 0.1} ${cx} ${cy + s} z" />`;
        } else if (dije.shape === 'estrella') {
            const pts = [];
            for (let i = 0; i < 10; i++) {
                const rad = i % 2 === 0 ? s : s * 0.45;
                const ang = -Math.PI / 2 + (i * Math.PI) / 5;
                pts.push(`${(cx + rad * Math.cos(ang)).toFixed(2)},${(cy + rad * Math.sin(ang)).toFixed(2)}`);
            }
            shape = `<polygon ${common} points="${pts.join(' ')}" />`;
        } else {
            shape = `
                <circle cx="${cx}" cy="${cy}" r="${s}" ${common} />
                <circle cx="${cx}" cy="${cy}" r="${s * 0.68}" fill="none" stroke="${c.stroke}" stroke-width="0.7" opacity="0.7" />
            `;
        }

        return `<g class="charm-group"><title>${esc(dije.name)}</title>${shape}<circle cx="${cx - s * 0.3}" cy="${cy - s * 0.3}" r="${s * 0.14}" fill="rgba(255,255,255,0.55)" /></g>`;
    }

    /**
     * Renderiza la lista del editor de secuencias con botones interactivos de control
     */
    function renderSequenceList() {
        const container = document.getElementById('matCalcBeadSequenceList');
        if (!container) return;

        if (sequence.length === 0) {
            container.innerHTML = `
                <div style="text-align: center; padding: 2rem; color: var(--text-muted); font-style: italic;">
                    No hay balines en el diseño. Añade algunos arriba.
                </div>
            `;
            return;
        }

        container.innerHTML = sequence.map((item, index) => {
            const bead = BEAD_TYPES[item.typeId];
            if (!bead) return '';

            return `
                <div class="bead-sequence-item" data-index="${index}">
                    <div class="bead-info-col">
                        <div class="bead-color-dot" style="background: ${bead.displayColor};"></div>
                        <div class="bead-name-text">
                            ${bead.name} <span style="font-size: 0.75rem; color: var(--text-muted);">(${bead.sizeName})</span>
                        </div>
                    </div>
                    <div style="display: flex; align-items: center;">
                        <div class="bead-qty-controls">
                            <button type="button" class="bead-qty-btn" onclick="MaterialsCalculatorModule.updateBeadQty(${index}, -1)">−</button>
                            <span class="bead-qty-display">${item.qty}</span>
                            <button type="button" class="bead-qty-btn" onclick="MaterialsCalculatorModule.updateBeadQty(${index}, 1)">+</button>
                        </div>
                        
                        <div class="bead-action-controls">
                            <button type="button" class="bead-action-btn" onclick="MaterialsCalculatorModule.moveBead(${index}, -1)" title="Subir orden" ${index === 0 ? 'disabled style="opacity: 0.3;"' : ''}>
                                ▲
                            </button>
                            <button type="button" class="bead-action-btn" onclick="MaterialsCalculatorModule.moveBead(${index}, 1)" title="Bajar orden" ${index === sequence.length - 1 ? 'disabled style="opacity: 0.3;"' : ''}>
                                ▼
                            </button>
                            <button type="button" class="bead-action-btn delete-btn" onclick="MaterialsCalculatorModule.removeBeadGroup(${index})" title="Eliminar grupo">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                    <line x1="18" y1="6" x2="6" y2="18"></line>
                                    <line x1="6" y1="6" x2="18" y2="18"></line>
                                </svg>
                            </button>
                        </div>
                    </div>
                </div>
            `;
        }).join('');
    }

    /**
     * Ajusta la cantidad de balines en un nodo de la secuencia
     */
    function updateBeadQty(index, delta) {
        if (index < 0 || index >= sequence.length) return;
        
        sequence[index].qty = Math.max(1, sequence[index].qty + delta);
        
        renderSequenceList();
        renderPreview();
        updateCalculations();
        if (activeTab === 'inverse') {
            renderInverseTable();
        }
    }

    /**
     * Mueve un nodo de balines hacia arriba o abajo en la secuencia
     */
    function moveBead(index, direction) {
        const targetIndex = index + direction;
        if (targetIndex < 0 || targetIndex >= sequence.length) return;

        const temp = sequence[index];
        sequence[index] = sequence[targetIndex];
        sequence[targetIndex] = temp;

        renderSequenceList();
        renderPreview();
        updateCalculations();
        if (activeTab === 'inverse') {
            renderInverseTable();
        }
    }

    /**
     * Remueve un grupo de la secuencia
     */
    function removeBeadGroup(index) {
        if (index < 0 || index >= sequence.length) return;
        sequence.splice(index, 1);
        
        renderSequenceList();
        renderPreview();
        updateCalculations();
        if (activeTab === 'inverse') {
            renderInverseTable();
        }
        Utils.showToast('Grupo eliminado', 'info');
    }

    /**
     * Calcula los materiales totales (modo directo)
     */
    function updateCalculations() {
        const tableBody = document.getElementById('matCalcResultsTable');
        const batchQtyHeader = document.getElementById('matCalcBatchQtyHeader');
        const wastageHeader = document.getElementById('matCalcWastageHeader');

        if (!tableBody) return;

        // La pestaña de inventario depende del diseño actual
        if (activeTab === 'stock') renderStockTab();

        const batchSize = batchNegro + batchRojo;

        if (batchQtyHeader) batchQtyHeader.textContent = `Total (${batchSize} ud)`;
        if (wastageHeader) wastageHeader.textContent = `Total + Margen (${wastagePercent}%)`;

        if (sequence.length === 0) {
            tableBody.innerHTML = `
                <tr>
                    <td colspan="4" style="text-align: center; color: var(--text-muted); padding: 1.5rem;">
                        No hay materiales que calcular. Configura tu diseño.
                    </td>
                </tr>
            `;
            return;
        }

        const aggregatedBeads = {};
        let neoprenosPerBracelet = 0;

        sequence.forEach(item => {
            if (item.typeId.includes('neopreno')) {
                neoprenosPerBracelet += item.qty;
            } else {
                if (aggregatedBeads[item.typeId]) {
                    aggregatedBeads[item.typeId] += item.qty;
                } else {
                    aggregatedBeads[item.typeId] = item.qty;
                }
            }
        });

        let rowsHtml = '';

        if (neoprenosPerBracelet > 0) {
            if (batchNegro > 0) {
                const totalQty = neoprenosPerBracelet * batchNegro;
                const totalWithWastage = Math.ceil(totalQty * (1 + wastagePercent / 100));
                const beadType = BEAD_TYPES['neopreno_negro'];
                rowsHtml += `
                    <tr>
                        <td>
                            <div style="display: flex; align-items: center; gap: 0.5rem;">
                                <div class="bead-color-dot" style="width: 12px; height: 12px; background: ${beadType.displayColor}; flex-shrink: 0;"></div>
                                <strong>${beadType.name}</strong>
                            </div>
                        </td>
                        <td style="text-align: center; font-weight: 500;">${neoprenosPerBracelet} (en negras)</td>
                        <td style="text-align: center; font-weight: 500;">${totalQty.toLocaleString()} ud</td>
                        <td style="text-align: center; font-weight: 700; color: var(--primary);">${totalWithWastage.toLocaleString()} ud</td>
                    </tr>
                `;
            }
            if (batchRojo > 0) {
                const totalQty = neoprenosPerBracelet * batchRojo;
                const totalWithWastage = Math.ceil(totalQty * (1 + wastagePercent / 100));
                const beadType = BEAD_TYPES['neopreno_rojo'];
                rowsHtml += `
                    <tr>
                        <td>
                            <div style="display: flex; align-items: center; gap: 0.5rem;">
                                <div class="bead-color-dot" style="width: 12px; height: 12px; background: ${beadType.displayColor}; flex-shrink: 0;"></div>
                                <strong>${beadType.name}</strong>
                            </div>
                        </td>
                        <td style="text-align: center; font-weight: 500;">${neoprenosPerBracelet} (en rojas)</td>
                        <td style="text-align: center; font-weight: 500;">${totalQty.toLocaleString()} ud</td>
                        <td style="text-align: center; font-weight: 700; color: var(--primary);">${totalWithWastage.toLocaleString()} ud</td>
                    </tr>
                `;
            }
        }

        Object.entries(aggregatedBeads).forEach(([typeId, singleQty]) => {
            const beadType = BEAD_TYPES[typeId];
            if (!beadType) return;

            const totalQty = singleQty * batchSize;
            const totalWithWastage = Math.ceil(totalQty * (1 + wastagePercent / 100));

            rowsHtml += `
                <tr>
                    <td>
                        <div style="display: flex; align-items: center; gap: 0.5rem;">
                            <div class="bead-color-dot" style="width: 12px; height: 12px; background: ${beadType.displayColor}; flex-shrink: 0;"></div>
                            <strong>${beadType.name}</strong>
                        </div>
                    </td>
                    <td style="text-align: center; font-weight: 500;">${singleQty} ud</td>
                    <td style="text-align: center; font-weight: 500;">${totalQty.toLocaleString()} ud</td>
                    <td style="text-align: center; font-weight: 700; color: var(--primary);">${totalWithWastage.toLocaleString()} ud</td>
                </tr>
            `;
        });

        const charm = getDije(selectedDijeId);
        if (charm) {
            const charmColor = CHARM_COLORS[charm.color] || CHARM_COLORS.dorado;
            rowsHtml += `
                <tr>
                    <td>
                        <div style="display: flex; align-items: center; gap: 0.5rem;">
                            <div class="bead-color-dot" style="width: 12px; height: 12px; background: ${charmColor.fill}; flex-shrink: 0;"></div>
                            <strong>Dije: ${esc(charm.name)}</strong>
                        </div>
                    </td>
                    <td style="text-align: center; font-weight: 500;">1 ud</td>
                    <td style="text-align: center; font-weight: 500;">${batchSize.toLocaleString()} ud</td>
                    <td style="text-align: center; font-weight: 700; color: var(--primary);">${Math.ceil(batchSize * (1 + wastagePercent / 100)).toLocaleString()} ud</td>
                </tr>
            `;
        }

        const singleThreadM = threadLengthCm / 100;
        const totalThreadM = singleThreadM * batchSize;
        const totalThreadWithWastageM = totalThreadM * (1 + wastagePercent / 100);

        rowsHtml += `
            <tr style="border-top: 2px solid var(--border-light); background: rgba(99, 102, 241, 0.02);">
                <td>
                    <div style="display: flex; align-items: center; gap: 0.5rem;">
                        <span style="font-size: 1.1rem; flex-shrink: 0;">🧵</span>
                        <strong>Hilo / Cordón Elástico</strong>
                    </div>
                </td>
                <td style="text-align: center; font-weight: 500;">${threadLengthCm} cm</td>
                <td style="text-align: center; font-weight: 500;">${totalThreadM.toFixed(2)} m</td>
                <td style="text-align: center; font-weight: 700; color: var(--primary);">${totalThreadWithWastageM.toFixed(2)} m</td>
            </tr>
        `;

        tableBody.innerHTML = rowsHtml;
    }

    /**
     * RENDERIZA la tabla del Calculador Inverso de Capacidad
     */
    function renderInverseTable() {
        const tableBody = document.getElementById('matCalcInverseTable');
        if (!tableBody) return;

        if (sequence.length === 0) {
            tableBody.innerHTML = `
                <tr>
                    <td colspan="4" style="text-align: center; color: var(--text-muted); padding: 1.5rem;">
                        Añade balines para habilitar la calculadora inversa.
                    </td>
                </tr>
            `;
            document.getElementById('inverseResultCard').innerHTML = '';
            return;
        }

        const aggregatedBeads = {};
        let neoprenosPerBracelet = 0;
        sequence.forEach(item => {
            if (item.typeId.includes('neopreno')) {
                neoprenosPerBracelet += item.qty;
            } else {
                if (aggregatedBeads[item.typeId]) {
                    aggregatedBeads[item.typeId] += item.qty;
                } else {
                    aggregatedBeads[item.typeId] = item.qty;
                }
            }
        });

        let rowsHtml = '';

        if (neoprenosPerBracelet > 0) {
            ['neopreno_negro', 'neopreno_rojo'].forEach(typeId => {
                const beadType = BEAD_TYPES[typeId];
                const savedStock = stockInputs[typeId] !== undefined ? stockInputs[typeId] : '';
                rowsHtml += `
                    <tr class="inverse-calc-row" data-type-id="${typeId}" data-single-qty="${neoprenosPerBracelet}">
                        <td>
                            <div style="display: flex; align-items: center; gap: 0.5rem;">
                                <div class="bead-color-dot" style="width: 12px; height: 12px; background: ${beadType.displayColor}; flex-shrink: 0;"></div>
                                <strong>${beadType.name}</strong>
                            </div>
                        </td>
                        <td style="text-align: center; font-weight: 500;">${neoprenosPerBracelet} ud</td>
                        <td style="text-align: center;">
                            <input type="number" 
                                   class="mat-stock-input form-control input-sm" 
                                   data-type-id="${typeId}" 
                                   value="${savedStock}" 
                                   min="0" 
                                   placeholder="Ej. 100" 
                                   style="width: 100%; text-align: center; padding: 0.25rem 0.5rem; background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius-sm); color: var(--text-primary);">
                        </td>
                        <td style="text-align: center; font-weight: 700; color: var(--primary);" class="row-capacity" id="cap-${typeId}">0 pulseras</td>
                    </tr>
                `;
            });
        }

        // Filas para balines
        Object.entries(aggregatedBeads).forEach(([typeId, singleQty]) => {
            const beadType = BEAD_TYPES[typeId];
            if (!beadType) return;

            const savedStock = stockInputs[typeId] !== undefined ? stockInputs[typeId] : '';

            rowsHtml += `
                <tr class="inverse-calc-row" data-type-id="${typeId}" data-single-qty="${singleQty}">
                    <td>
                        <div style="display: flex; align-items: center; gap: 0.5rem;">
                            <div class="bead-color-dot" style="width: 12px; height: 12px; background: ${beadType.displayColor}; flex-shrink: 0;"></div>
                            <strong>${beadType.name}</strong>
                        </div>
                    </td>
                    <td style="text-align: center; font-weight: 500;">${singleQty} ud</td>
                    <td style="text-align: center;">
                        <input type="number" 
                               class="mat-stock-input form-control input-sm" 
                               data-type-id="${typeId}" 
                               value="${savedStock}" 
                               min="0" 
                               placeholder="Ej. 100" 
                               style="width: 100%; text-align: center; padding: 0.25rem 0.5rem; background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius-sm); color: var(--text-primary);">
                    </td>
                    <td style="text-align: center; font-weight: 700; color: var(--primary);" class="row-capacity" id="cap-${typeId}">0 pulseras</td>
                </tr>
            `;
        });

        // Fila para el dije del diseño
        const charm = getDije(selectedDijeId);
        if (charm) {
            const charmColor = CHARM_COLORS[charm.color] || CHARM_COLORS.dorado;
            rowsHtml += `
                <tr class="inverse-calc-row" data-type-id="dije:${charm.id}" data-single-qty="1">
                    <td>
                        <div style="display: flex; align-items: center; gap: 0.5rem;">
                            <div class="bead-color-dot" style="width: 12px; height: 12px; background: ${charmColor.fill}; flex-shrink: 0;"></div>
                            <strong>Dije: ${esc(charm.name)}</strong>
                        </div>
                    </td>
                    <td style="text-align: center; font-weight: 500;">1 ud</td>
                    <td style="text-align: center;">
                        <input type="number"
                               class="mat-stock-input form-control input-sm"
                               data-type-id="dije:${charm.id}"
                               value="${charm.stock || ''}"
                               min="0"
                               placeholder="Ej. 100"
                               style="width: 100%; text-align: center; padding: 0.25rem 0.5rem; background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius-sm); color: var(--text-primary);">
                    </td>
                    <td style="text-align: center; font-weight: 700; color: var(--primary);" class="row-capacity" id="cap-dije">0 pulseras</td>
                </tr>
            `;
        }

        // Fila para el hilo
        const savedThreadStock = stockInputs.thread !== undefined ? stockInputs.thread : '';
        rowsHtml += `
            <tr class="inverse-calc-row" data-type-id="thread" data-single-qty="${threadLengthCm}">
                <td>
                    <div style="display: flex; align-items: center; gap: 0.5rem;">
                        <span style="font-size: 1.1rem; flex-shrink: 0;">🧵</span>
                        <strong>Hilo / Cordón Elástico</strong>
                    </div>
                </td>
                <td style="text-align: center; font-weight: 500;">${threadLengthCm} cm</td>
                <td style="text-align: center; display: flex; align-items: center; gap: 0.25rem;">
                    <input type="number" 
                           class="mat-stock-input form-control input-sm" 
                           data-type-id="thread" 
                           value="${savedThreadStock}" 
                           min="0" 
                           step="0.1"
                           placeholder="Ej. 10" 
                           style="flex: 1; text-align: center; padding: 0.25rem 0.5rem; background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius-sm); color: var(--text-primary);">
                    <span style="font-size: 0.75rem; color: var(--text-muted); font-weight: 600;">metros</span>
                </td>
                <td style="text-align: center; font-weight: 700; color: var(--primary);" class="row-capacity" id="cap-thread">0 pulseras</td>
            </tr>
        `;

        tableBody.innerHTML = rowsHtml;
        updateInverseCapacity();
    }

    /**
     * REALIZA los cálculos de capacidad en base a las entradas de stock provistas
     */
    function updateInverseCapacity() {
        const tableBody = document.getElementById('matCalcInverseTable');
        if (!tableBody) return;

        const batchSize = batchNegro + batchRojo;

        const aggregatedBeads = {};
        let neoprenosPerBracelet = 0;
        sequence.forEach(item => {
            if (item.typeId.includes('neopreno')) {
                neoprenosPerBracelet += item.qty;
            } else {
                if (aggregatedBeads[item.typeId]) {
                    aggregatedBeads[item.typeId] += item.qty;
                } else {
                    aggregatedBeads[item.typeId] = item.qty;
                }
            }
        });

        const capacities = [];
        const materialDetails = [];
        let totalNeopreneCap = 0;

        // 1. Calcular para balines
        if (neoprenosPerBracelet > 0) {
            ['neopreno_negro', 'neopreno_rojo'].forEach(typeId => {
                const stock = parseFloat(stockInputs[typeId]) || 0;
                const cap = Math.floor(stock / neoprenosPerBracelet);
                
                const cell = document.getElementById(`cap-${typeId}`);
                if (cell) cell.textContent = `${cap.toLocaleString()} pulseras`;
                
                totalNeopreneCap += cap;
                materialDetails.push({
                    id: typeId,
                    name: BEAD_TYPES[typeId].name,
                    singleQty: neoprenosPerBracelet,
                    stock: stock,
                    capacity: cap,
                    unitName: 'balines'
                });
            });
            capacities.push(totalNeopreneCap);
        }

        Object.entries(aggregatedBeads).forEach(([typeId, singleQty]) => {
            const stock = parseFloat(stockInputs[typeId]) || 0;
            const cap = Math.floor(stock / singleQty);
            
            const cell = document.getElementById(`cap-${typeId}`);
            if (cell) cell.textContent = `${cap.toLocaleString()} pulseras`;
            
            capacities.push(cap);
            materialDetails.push({
                id: typeId,
                name: BEAD_TYPES[typeId].name,
                singleQty: singleQty,
                stock: stock,
                capacity: cap,
                unitName: 'balines'
            });
        });

        // Dije del diseño (1 por pulsera)
        const charm = getDije(selectedDijeId);
        if (charm) {
            const charmStock = parseFloat(charm.stock) || 0;
            const charmCap = Math.floor(charmStock);
            const cellCharm = document.getElementById('cap-dije');
            if (cellCharm) cellCharm.textContent = `${charmCap.toLocaleString()} pulseras`;
            capacities.push(charmCap);
            materialDetails.push({
                id: 'dije',
                name: `Dije: ${charm.name}`,
                singleQty: 1,
                stock: charmStock,
                capacity: charmCap,
                unitName: 'dijes'
            });
        }

        // 2. Calcular para hilo (ingresado en metros)
        const threadStockM = parseFloat(stockInputs.thread) || 0;
        const threadStockCm = threadStockM * 100;
        const threadCap = Math.floor(threadStockCm / threadLengthCm);
        
        const cellThread = document.getElementById('cap-thread');
        if (cellThread) cellThread.textContent = `${threadCap.toLocaleString()} pulseras`;

        capacities.push(threadCap);
        materialDetails.push({
            id: 'thread',
            name: 'Hilo / Cordón Elástico',
            singleQty: threadLengthCm,
            stock: threadStockM,
            capacity: threadCap,
            unitName: 'metros'
        });

        // 3. Obtener el límite máximo y el cuello de botella
        const minCapacity = sequence.length > 0 ? Math.min(...capacities) : 0;
        
        // Identificar cuáles son los materiales limitantes
        const limitingMaterials = materialDetails.filter(m => m.capacity === minCapacity);
        
        // Renderizar tarjeta de resumen
        const resultCard = document.getElementById('inverseResultCard');
        if (!resultCard) return;

        // Si todos los stocks ingresados son 0
        const totalStock = Object.values(stockInputs).reduce((sum, val) => sum + (val || 0), 0);
        if (totalStock === 0) {
            resultCard.innerHTML = `
                <div style="font-size: 0.9rem; color: var(--text-muted); font-weight: 500;">
                    ⚠️ Ingrese las cantidades disponibles en stock arriba para calcular.
                </div>
            `;
            return;
        }

        let limitingHtml = '';
        if (minCapacity === 0) {
            const lackingList = limitingMaterials.map(m => `<strong>${m.name}</strong>`).join(', ');
            limitingHtml = `
                <p style="color: var(--danger); font-size: 0.85rem; margin-top: 0.5rem; line-height: 1.4;">
                    No puedes fabricar ninguna pulsera porque tienes stock en 0 de: ${lackingList}.
                </p>
            `;
        } else {
            const limitingNames = limitingMaterials.map(m => m.name).join(' y ');
            limitingHtml = `
                <p style="font-size: 0.85rem; color: var(--text-muted); margin-top: 0.5rem; line-height: 1.4;">
                    El material que limita tu producción es: <strong style="color: var(--text-primary);">${limitingNames}</strong>.
                </p>
            `;
        }

        // Sugerencias inteligentes: ¿Cuánto necesito para completar el lote objetivo (ej. 300)?
        let suggestionHtml = '';
        if (minCapacity < batchSize) {
            const missingInsumos = [];
            materialDetails.forEach(m => {
                let requiredTotal = 0;
                if (m.id === 'thread') {
                    requiredTotal = (m.singleQty * batchSize) / 100; // en metros
                } else {
                    requiredTotal = m.singleQty * batchSize;
                }
                
                // Con desperdicio
                const requiredWithWastage = m.id === 'thread' 
                    ? requiredTotal * (1 + wastagePercent / 100)
                    : Math.ceil(requiredTotal * (1 + wastagePercent / 100));

                if (m.stock < requiredWithWastage) {
                    const diff = requiredWithWastage - m.stock;
                    missingInsumos.push(`
                        <li style="margin-bottom: 0.25rem;">
                            Faltan <strong>${m.id === 'thread' ? diff.toFixed(2) : Math.ceil(diff).toLocaleString()} ${m.unitName}</strong> de ${m.name} (necesitas ${m.id === 'thread' ? requiredWithWastage.toFixed(2) : requiredWithWastage.toLocaleString()} para el lote de ${batchSize}).
                        </li>
                    `);
                }
            });

            if (missingInsumos.length > 0) {
                suggestionHtml = `
                    <div style="text-align: left; margin-top: 1rem; padding-top: 0.75rem; border-top: 1px dashed var(--border); font-size: 0.8rem;">
                        <span style="font-weight: 600; color: var(--text-primary); display: block; margin-bottom: 0.4rem;">📝 Para completar el lote objetivo de ${batchSize} unidades:</span>
                        <ul style="padding-left: 1.2rem; margin: 0; color: var(--text-secondary); line-height: 1.4;">
                            ${missingInsumos.join('')}
                        </ul>
                    </div>
                `;
            }
        } else {
            suggestionHtml = `
                <div style="margin-top: 1rem; padding: 0.5rem; background: rgba(16, 185, 129, 0.1); color: var(--success); border-radius: var(--radius-sm); font-size: 0.8rem; font-weight: 600;">
                    🎉 ¡Tienes suficiente material en stock para completar tu lote objetivo de ${batchSize} pulseras!
                </div>
            `;
        }

        resultCard.innerHTML = `
            <span style="display: block; font-size: 0.8rem; text-transform: uppercase; color: var(--text-muted); font-weight: 600; letter-spacing: 0.05em;">
                Capacidad de Fabricación Máxima
            </span>
            <span style="display: block; font-size: 2.2rem; font-weight: 800; color: var(--primary); margin: 0.25rem 0; line-height: 1.1;">
                ${minCapacity.toLocaleString()} pulseras
            </span>
            ${limitingHtml}
            ${suggestionHtml}
        `;
    }

    /* ======================================================================
       Inventario disponible, dijes y diseños en producción
       ====================================================================== */

    /**
     * Materiales por pulsera de un diseño. El neopreno se asigna al color elegido.
     * Retorna { clave: cantidad }, donde la clave es typeId de balín.
     */
    function designRequirements(seq, neoColor) {
        const beads = {};
        seq.forEach(item => {
            const id = item.typeId.includes('neopreno') ? `neopreno_${neoColor}` : item.typeId;
            beads[id] = (beads[id] || 0) + item.qty;
        });
        return beads;
    }

    function getStockValue(key) {
        if (key.startsWith('dije:')) {
            const dije = getDije(key.slice(5));
            return dije ? (parseFloat(dije.stock) || 0) : 0;
        }
        return parseFloat(stockInputs[key]) || 0;
    }

    function keyLabel(key) {
        if (key === 'thread') return 'Hilo / Cordón Elástico';
        if (key.startsWith('dije:')) {
            const dije = getDije(key.slice(5));
            return `Dije: ${dije ? dije.name : '(eliminado)'}`;
        }
        return BEAD_TYPES[key] ? BEAD_TYPES[key].name : key;
    }

    function keyUnit(key) {
        if (key === 'thread') return 'm';
        return 'ud';
    }

    function formatAmount(key, value) {
        const rounded = key === 'thread' ? Math.round(value * 100) / 100 : Math.round(value);
        return `${rounded.toLocaleString()} ${keyUnit(key)}`;
    }

    /** Material consumido por todos los diseños en producción */
    function computeUsage() {
        const used = {};
        const add = (key, n) => { used[key] = (used[key] || 0) + n; };
        productions.forEach(p => {
            Object.entries(designRequirements(p.sequence, p.color)).forEach(([id, n]) => add(id, n * p.qty));
            add('thread', (p.threadCm * p.qty) / 100);
            if (p.dijeId) add(`dije:${p.dijeId}`, p.qty);
        });
        return used;
    }

    /** Claves de materiales que muestra la tabla de inventario */
    function stockKeys() {
        return [...Object.keys(BEAD_TYPES), 'thread', ...dijes.map(d => `dije:${d.id}`)];
    }

    /* ---------------------- Biblioteca de diseños ---------------------- */

    function getDesign(id) {
        return designs.find(d => d.id === id) || null;
    }

    /** Rellena el selector del catálogo, el de producción y la insignia de estado */
    function renderDesignSelect() {
        if (!getDesign(currentDesignId)) currentDesignId = '';
        const options = designs.map(d => `<option value="${d.id}">${esc(d.name)}</option>`).join('');

        const editorSelect = document.getElementById('matCalcDesignSelect');
        if (editorSelect) {
            editorSelect.innerHTML = `<option value="">— Diseño nuevo (sin guardar) —</option>` + options;
            editorSelect.value = currentDesignId;
        }

        const prodSelect = document.getElementById('matCalcProdDesignSelect');
        if (prodSelect) {
            const previous = prodSelect.value;
            prodSelect.innerHTML = `<option value="">Diseño actual del visor</option>` + options;
            prodSelect.value = getDesign(previous) ? previous : '';
        }

        const badge = document.getElementById('matCalcDesignStatusBadge');
        if (badge) {
            const open = getDesign(currentDesignId);
            const total = designs.length === 1 ? '1 diseño' : `${designs.length} diseños`;
            badge.textContent = open
                ? `Editando «${open.name}» · ${total} en catálogo`
                : `Diseño sin guardar · ${total} en catálogo`;
        }

        const nameInput = document.getElementById('matCalcDesignNameInput');
        if (nameInput && !nameInput.matches(':focus')) {
            const open = getDesign(currentDesignId);
            nameInput.value = open ? open.name : '';
        }
    }

    function snapshotOfEditor(name) {
        return {
            id: newId('dsg'),
            name,
            sequence: JSON.parse(JSON.stringify(sequence)),
            dijeId: selectedDijeId || '',
            threadCm: threadLengthCm
        };
    }

    function persistDesign(design, message) {
        saveState();
        cloudUpsert(TABLES.designs, designRow(design));
        renderDesignSelect();
        if (activeTab === 'stock') renderStockTab();
        Utils.showToast(message, 'success');
    }

    /** 💾 Guardar: actualiza el diseño abierto, o crea uno si no hay ninguno */
    function saveCurrentDesign() {
        if (sequence.length === 0) {
            Utils.showToast('Arma un diseño antes de guardarlo', 'warning');
            return;
        }
        const nameInput = document.getElementById('matCalcDesignNameInput');
        const typed = nameInput ? nameInput.value.trim() : '';
        const open = getDesign(currentDesignId);

        if (open) {
            open.name = typed || open.name;
            open.sequence = JSON.parse(JSON.stringify(sequence));
            open.dijeId = selectedDijeId || '';
            open.threadCm = threadLengthCm;
            persistDesign(open, `Diseño «${open.name}» actualizado`);
        } else {
            const design = snapshotOfEditor(typed || `Diseño ${designs.length + 1}`);
            designs.push(design);
            currentDesignId = design.id;
            persistDesign(design, `Diseño «${design.name}» guardado en el catálogo`);
        }
    }

    /** + Copia: siempre crea una entrada nueva en el catálogo */
    function saveDesignAsNew() {
        if (sequence.length === 0) {
            Utils.showToast('Arma un diseño antes de guardarlo', 'warning');
            return;
        }
        const nameInput = document.getElementById('matCalcDesignNameInput');
        const typed = nameInput ? nameInput.value.trim() : '';
        const open = getDesign(currentDesignId);
        const name = typed && (!open || typed !== open.name)
            ? typed
            : `${open ? open.name : 'Diseño'} (copia)`;

        const design = snapshotOfEditor(name);
        designs.push(design);
        currentDesignId = design.id;
        persistDesign(design, `Copia guardada como «${design.name}»`);
    }

    /** Carga un diseño guardado en el visor */
    function openDesign(id, { silent = false } = {}) {
        if (!id) {
            currentDesignId = '';
            renderDesignSelect();
            return;
        }
        const design = getDesign(id);
        if (!design) return;

        currentDesignId = design.id;
        sequence = JSON.parse(JSON.stringify(design.sequence));
        selectedDijeId = getDije(design.dijeId) ? design.dijeId : '';
        threadLengthCm = design.threadCm || threadLengthCm;

        const threadInput = document.getElementById('matCalcThreadPerBrac');
        if (threadInput) threadInput.value = threadLengthCm;

        renderDijeSelect();
        renderDesignSelect();
        renderSequenceList();
        refreshDesignViews();
        if (!silent) Utils.showToast(`Diseño «${design.name}» cargado en el visor`, 'info');
    }

    /** + Nuevo Diseño: deja el visor en blanco */
    function newDesign() {
        sequence = [];
        currentDesignId = '';
        selectedDijeId = '';
        const nameInput = document.getElementById('matCalcDesignNameInput');
        if (nameInput) nameInput.value = '';
        renderDijeSelect();
        renderDesignSelect();
        renderSequenceList();
        refreshDesignViews();
        Utils.showToast('Visor en blanco para un diseño nuevo', 'info');
    }

    function deleteCurrentDesign() {
        const design = getDesign(currentDesignId);
        if (!design) {
            Utils.showToast('Elige un diseño del catálogo para eliminarlo', 'warning');
            return;
        }
        designs = designs.filter(d => d.id !== design.id);
        currentDesignId = '';
        saveState();
        cloudDelete(TABLES.designs, design.id);
        renderDesignSelect();
        if (activeTab === 'stock') renderStockTab();
        Utils.showToast(`Diseño «${design.name}» eliminado del catálogo`, 'info');
    }

    function bindDesignControls() {
        const select = document.getElementById('matCalcDesignSelect');
        if (select) select.addEventListener('change', (e) => openDesign(e.target.value));

        const btnSave = document.getElementById('btnMatCalcSaveDesign');
        if (btnSave) btnSave.addEventListener('click', saveCurrentDesign);

        const btnSaveAs = document.getElementById('btnMatCalcSaveAsNew');
        if (btnSaveAs) btnSaveAs.addEventListener('click', saveDesignAsNew);

        const btnDelete = document.getElementById('btnMatCalcDeleteDesign');
        if (btnDelete) btnDelete.addEventListener('click', deleteCurrentDesign);

        const btnNew = document.getElementById('btnMatCalcNewDesign');
        if (btnNew) btnNew.addEventListener('click', newDesign);

        // "👁️ Ver en visor": carga el diseño elegido en la sección de producción
        const btnLoadToEditor = document.getElementById('btnMatCalcLoadSelectedToEditor');
        if (btnLoadToEditor) {
            btnLoadToEditor.addEventListener('click', () => {
                const prodSelect = document.getElementById('matCalcProdDesignSelect');
                const id = prodSelect ? prodSelect.value : '';
                if (!id) {
                    Utils.showToast('Elige un diseño guardado para verlo', 'warning');
                    return;
                }
                openDesign(id);
            });
        }

        renderDesignSelect();
    }

    function renderDijeSelect() {
        const select = document.getElementById('matCalcDijeSelect');
        if (!select) return;
        if (!getDije(selectedDijeId)) selectedDijeId = '';
        select.innerHTML = `<option value="">Sin dije</option>` + dijes.map(d => `
            <option value="${d.id}">${esc(d.name)} (${CHARM_SHAPES[d.shape] || d.shape}, ${(CHARM_COLORS[d.color] || {}).name || d.color})</option>
        `).join('');
        select.value = selectedDijeId;
    }

    function refreshDesignViews() {
        renderPreview();
        updateCalculations();
        if (activeTab === 'inverse') renderInverseTable();
    }

    function bindStockControls() {
        const dijeSelect = document.getElementById('matCalcDijeSelect');
        if (dijeSelect) {
            dijeSelect.addEventListener('change', (e) => {
                selectedDijeId = e.target.value;
                refreshDesignViews();
            });
        }
        renderDijeSelect();

        const shapeSelect = document.getElementById('matCalcDijeShape');
        if (shapeSelect) {
            shapeSelect.innerHTML = Object.entries(CHARM_SHAPES).map(([k, v]) => `<option value="${k}">${v}</option>`).join('');
        }
        const colorSelect = document.getElementById('matCalcDijeColor');
        if (colorSelect) {
            colorSelect.innerHTML = Object.entries(CHARM_COLORS).map(([k, v]) => `<option value="${k}">${v.name}</option>`).join('');
        }

        const btnAddDije = document.getElementById('btnMatCalcAddDije');
        if (btnAddDije) {
            btnAddDije.addEventListener('click', () => {
                const nameInput = document.getElementById('matCalcDijeName');
                const stockInput = document.getElementById('matCalcDijeStock');
                const name = nameInput ? nameInput.value.trim() : '';
                if (!name) {
                    Utils.showToast('Escribe el nombre del dije', 'warning');
                    return;
                }
                const dije = {
                    id: newId('dij'),
                    name,
                    shape: shapeSelect ? shapeSelect.value : 'medalla',
                    color: colorSelect ? colorSelect.value : 'dorado',
                    stock: Math.max(0, parseInt(stockInput && stockInput.value) || 0)
                };
                dijes.push(dije);
                if (nameInput) nameInput.value = '';
                if (stockInput) stockInput.value = '';
                saveState();
                cloudUpsert(TABLES.charms, charmRow(dije));
                renderDijeSelect();
                renderStockTab();
                Utils.showToast('Dije agregado al inventario', 'success');
            });
        }

        const stockTable = document.getElementById('matCalcStockTable');
        if (stockTable) {
            stockTable.addEventListener('input', (e) => {
                const key = e.target.dataset && e.target.dataset.stockKey;
                if (!key) return;
                const val = Math.max(0, parseFloat(e.target.value) || 0);
                if (key.startsWith('dije:')) {
                    const dije = getDije(key.slice(5));
                    if (dije) {
                        dije.stock = val;
                        cloudUpsert(TABLES.charms, charmRow(dije));
                    }
                } else {
                    stockInputs[key] = val;
                    cloudUpsert(TABLES.stock, { material_key: key, quantity: val });
                }
                saveState();
                refreshStockCells();
                renderStockSummary();
            });
        }

        const btnAddProd = document.getElementById('btnMatCalcAddProduction');
        if (btnAddProd) {
            btnAddProd.addEventListener('click', addCurrentDesignToProduction);
        }

        const prodColor = document.getElementById('matCalcProdColor');
        if (prodColor) {
            prodColor.addEventListener('change', renderStockSummary);
        }
    }

    function addCurrentDesignToProduction() {
        const designSelect = document.getElementById('matCalcProdDesignSelect');
        const nameInput = document.getElementById('matCalcProdName');
        const colorSelect = document.getElementById('matCalcProdColor');
        const qtyInput = document.getElementById('matCalcProdQty');

        // Diseño guardado elegido en la lista, o el que está en el visor
        const chosen = designSelect ? getDesign(designSelect.value) : null;
        const source = chosen || {
            name: getDesign(currentDesignId) ? getDesign(currentDesignId).name : `Diseño ${productions.length + 1}`,
            sequence,
            dijeId: selectedDijeId || '',
            threadCm: threadLengthCm
        };

        if (!source.sequence || source.sequence.length === 0) {
            Utils.showToast('Arma o elige un diseño antes de agregarlo a producción', 'warning');
            return;
        }

        const orderName = nameInput ? nameInput.value.trim() : '';
        if (nameInput) nameInput.value = '';

        const production = {
            id: newId('prd'),
            name: orderName || source.name,
            color: colorSelect ? colorSelect.value : 'negro',
            qty: Math.max(1, parseInt(qtyInput && qtyInput.value) || 1),
            sequence: JSON.parse(JSON.stringify(source.sequence)),
            dijeId: source.dijeId || '',
            threadCm: source.threadCm || threadLengthCm
        };
        productions.push(production);
        saveState();
        cloudUpsert(TABLES.productions, productionRow(production));
        renderStockTab();

        const short = Object.entries(computeUsage())
            .filter(([key, used]) => used > getStockValue(key) + 1e-9)
            .map(([key]) => keyLabel(key));
        if (short.length > 0) {
            Utils.showToast(`Diseño agregado, pero falta material: ${short.join(', ')}`, 'warning');
        } else {
            Utils.showToast('Diseño agregado. Material descontado del disponible', 'success');
        }
    }

    function changeProductionQty(id, delta) {
        const prod = productions.find(p => p.id === id);
        if (!prod) return;
        prod.qty = Math.max(1, prod.qty + delta);
        saveState();
        cloudUpsert(TABLES.productions, productionRow(prod));
        renderStockTab();
    }

    function removeProduction(id) {
        productions = productions.filter(p => p.id !== id);
        saveState();
        cloudDelete(TABLES.productions, id);
        renderStockTab();
        Utils.showToast('Diseño quitado. Material devuelto al disponible', 'info');
    }

    function loadProduction(id) {
        const prod = productions.find(p => p.id === id);
        if (!prod) return;
        sequence = JSON.parse(JSON.stringify(prod.sequence));
        selectedDijeId = getDije(prod.dijeId) ? prod.dijeId : '';
        threadLengthCm = prod.threadCm;
        const threadInput = document.getElementById('matCalcThreadPerBrac');
        if (threadInput) threadInput.value = threadLengthCm;
        renderDijeSelect();
        renderSequenceList();
        refreshDesignViews();
        Utils.showToast('Diseño cargado en el editor', 'info');
    }

    function removeDije(id) {
        if (productions.some(p => p.dijeId === id)) {
            Utils.showToast('Ese dije se usa en un diseño en producción. Quita el diseño primero', 'warning');
            return;
        }
        dijes = dijes.filter(d => d.id !== id);
        if (selectedDijeId === id) selectedDijeId = '';
        saveState();
        cloudDelete(TABLES.charms, id);
        renderDijeSelect();
        refreshDesignViews();
        renderStockTab();
    }

    function renderStockTab() {
        const tableBody = document.getElementById('matCalcStockTable');
        if (!tableBody) return;

        const rows = stockKeys().map(key => {
            let dot = '';
            let label = '';
            if (key === 'thread') {
                dot = `<span style="font-size: 1.1rem; flex-shrink: 0;">🧵</span>`;
                label = `<strong>${keyLabel(key)}</strong> <span style="font-size: 0.75rem; color: var(--text-muted);">(metros)</span>`;
            } else if (key.startsWith('dije:')) {
                const dije = getDije(key.slice(5));
                const c = CHARM_COLORS[dije.color] || CHARM_COLORS.dorado;
                dot = `<div class="bead-color-dot" style="width: 12px; height: 12px; background: ${c.fill}; flex-shrink: 0;"></div>`;
                label = `<strong>Dije: ${esc(dije.name)}</strong> <span style="font-size: 0.75rem; color: var(--text-muted);">(${CHARM_SHAPES[dije.shape] || ''})</span>
                    <button type="button" class="bead-action-btn delete-btn" title="Eliminar dije" onclick="MaterialsCalculatorModule.removeDije('${dije.id}')" style="margin-left: 0.25rem;">✕</button>`;
            } else {
                const bead = BEAD_TYPES[key];
                dot = `<div class="bead-color-dot" style="width: 12px; height: 12px; background: ${bead.displayColor}; flex-shrink: 0;"></div>`;
                label = `<strong>${bead.name}</strong>`;
            }
            const current = getStockValue(key);
            return `
                <tr>
                    <td><div style="display: flex; align-items: center; gap: 0.5rem;">${dot}<span>${label}</span></div></td>
                    <td style="text-align: center;">
                        <input type="number" class="form-control input-sm" data-stock-key="${key}" value="${current || ''}" min="0" ${key === 'thread' ? 'step="0.1"' : ''} placeholder="0"
                               style="width: 100px; text-align: center; padding: 0.25rem 0.5rem; background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius-sm); color: var(--text-primary);">
                    </td>
                    <td style="text-align: center;" id="stk-used-${key}">0</td>
                    <td style="text-align: center; font-weight: 700;" id="stk-avail-${key}">0</td>
                </tr>
            `;
        }).join('');
        tableBody.innerHTML = rows;

        refreshStockCells();
        renderProductionList();
        renderStockSummary();
    }

    /** Actualiza las columnas "Usado" y "Disponible" sin tocar los inputs (conserva el foco) */
    function refreshStockCells() {
        const used = computeUsage();
        stockKeys().forEach(key => {
            const u = used[key] || 0;
            const avail = getStockValue(key) - u;
            const usedCell = document.getElementById(`stk-used-${key}`);
            const availCell = document.getElementById(`stk-avail-${key}`);
            if (usedCell) usedCell.textContent = formatAmount(key, u);
            if (availCell) {
                availCell.textContent = formatAmount(key, avail);
                availCell.style.color = avail < -1e-9 ? 'var(--danger)' : (u > 0 ? 'var(--primary)' : 'var(--text-primary)');
            }
        });
    }

    function renderProductionList() {
        const list = document.getElementById('matCalcProductionList');
        if (!list) return;

        if (productions.length === 0) {
            list.innerHTML = `
                <div style="text-align: center; padding: 1rem; color: var(--text-muted); font-style: italic; font-size: 0.85rem;">
                    Aún no has agregado diseños. Arma uno arriba y agrégalo para descontar su material.
                </div>
            `;
            return;
        }

        list.innerHTML = productions.map(p => {
            const dije = getDije(p.dijeId);
            const neo = BEAD_TYPES[`neopreno_${p.color}`];
            const beadCount = p.sequence.reduce((sum, i) => sum + i.qty, 0);
            return `
                <div class="bead-sequence-item">
                    <div class="bead-info-col">
                        <div class="bead-color-dot" style="background: ${neo ? neo.displayColor : '#888'};"></div>
                        <div class="bead-name-text">
                            ${esc(p.name)}
                            <span style="font-size: 0.75rem; color: var(--text-muted);">
                                (${beadCount} balines · neopreno ${p.color}${dije ? ` · dije ${esc(dije.name)}` : ''} · ${p.threadCm} cm hilo)
                            </span>
                        </div>
                    </div>
                    <div style="display: flex; align-items: center;">
                        <div class="bead-qty-controls">
                            <button type="button" class="bead-qty-btn" onclick="MaterialsCalculatorModule.changeProductionQty('${p.id}', -1)">−</button>
                            <span class="bead-qty-display">${p.qty}</span>
                            <button type="button" class="bead-qty-btn" onclick="MaterialsCalculatorModule.changeProductionQty('${p.id}', 1)">+</button>
                        </div>
                        <div class="bead-action-controls">
                            <button type="button" class="bead-action-btn" title="Cargar en el editor" onclick="MaterialsCalculatorModule.loadProduction('${p.id}')">✎</button>
                            <button type="button" class="bead-action-btn delete-btn" title="Quitar de producción" onclick="MaterialsCalculatorModule.removeProduction('${p.id}')">✕</button>
                        </div>
                    </div>
                </div>
            `;
        }).join('');
    }

    /** Resumen: total en producción y cuántas pulseras más del diseño actual alcanzan */
    function renderStockSummary() {
        const box = document.getElementById('matCalcStockSummary');
        if (!box) return;

        const totalBracelets = productions.reduce((sum, p) => sum + p.qty, 0);
        const used = computeUsage();
        const deficits = Object.entries(used)
            .filter(([key, u]) => u > getStockValue(key) + 1e-9)
            .map(([key, u]) => `<li>Faltan <strong>${formatAmount(key, u - getStockValue(key))}</strong> de ${esc(keyLabel(key))}</li>`);

        let html = `
            <span style="display: block; font-size: 0.8rem; text-transform: uppercase; color: var(--text-muted); font-weight: 600; letter-spacing: 0.05em;">
                Pulseras en producción
            </span>
            <span style="display: block; font-size: 2rem; font-weight: 800; color: var(--primary); line-height: 1.2;">
                ${totalBracelets.toLocaleString()}
            </span>
        `;

        if (deficits.length > 0) {
            html += `
                <div style="text-align: left; margin-top: 0.75rem; font-size: 0.8rem; color: var(--danger);">
                    <strong>⚠️ Material insuficiente para lo planeado:</strong>
                    <ul style="padding-left: 1.2rem; margin: 0.25rem 0 0; line-height: 1.4;">${deficits.join('')}</ul>
                </div>
            `;
        }

        // Capacidad restante con el diseño que está en el editor
        if (sequence.length > 0) {
            const colorSelect = document.getElementById('matCalcProdColor');
            const color = colorSelect ? colorSelect.value : 'negro';
            const perBracelet = designRequirements(sequence, color);
            perBracelet.thread = threadLengthCm / 100;
            if (selectedDijeId) perBracelet[`dije:${selectedDijeId}`] = 1;

            let maxMore = Infinity;
            let limiting = [];
            Object.entries(perBracelet).forEach(([key, per]) => {
                const remaining = getStockValue(key) - (used[key] || 0);
                const cap = Math.max(0, Math.floor((remaining + 1e-9) / per));
                if (cap < maxMore) {
                    maxMore = cap;
                    limiting = [key];
                } else if (cap === maxMore) {
                    limiting.push(key);
                }
            });

            html += `
                <div style="margin-top: 0.75rem; padding-top: 0.75rem; border-top: 1px dashed var(--border); font-size: 0.85rem; color: var(--text-secondary); line-height: 1.4;">
                    Con lo que queda disponible aún puedes hacer
                    <strong style="color: var(--text-primary);">${maxMore.toLocaleString()} pulseras</strong> más del diseño actual
                    ${maxMore === 0 || limiting.length ? `(limita: ${limiting.map(k => esc(keyLabel(k))).join(', ')})` : ''}.
                </div>
            `;
        }

        box.innerHTML = html;
    }

    /**
     * Genera y exporta los resultados de los cálculos a un libro de Excel
     */
    function exportToXlsx() {
        if (sequence.length === 0) {
            Utils.showToast('No hay datos para exportar', 'warning');
            return;
        }

        try {
            const batchSize = batchNegro + batchRojo;
            const aggregatedBeads = {};
            let neoprenosPerBracelet = 0;

            sequence.forEach(item => {
                if (item.typeId.includes('neopreno')) {
                    neoprenosPerBracelet += item.qty;
                } else {
                    if (aggregatedBeads[item.typeId]) {
                        aggregatedBeads[item.typeId] += item.qty;
                    } else {
                        aggregatedBeads[item.typeId] = item.qty;
                    }
                }
            });

            const data = [
                ['REPORTE DE MATERIALES DE PRODUCCIÓN - PULSERAS'],
                [],
                ['1. Configuración del Lote'],
                ['Cantidad de Pulseras Negras', batchNegro, 'unidades'],
                ['Cantidad de Pulseras Rojas', batchRojo, 'unidades'],
                ['Total Pulseras a Fabricar', batchSize, 'unidades'],
                ['Margen de Desperdicio', wastagePercent / 100, ''],
                ['Largo de Hilo por Pulsera', threadLengthCm, 'cm'],
                [],
                ['2. Desglose Físico de Materiales'],
                ['Material', 'Cant. por Pulsera', `Total (${batchSize} ud)`, `Total + Margen (${wastagePercent}%)`, 'Tipo'],
            ];

            if (neoprenosPerBracelet > 0) {
                if (batchNegro > 0) {
                    const totalQty = neoprenosPerBracelet * batchNegro;
                    const totalWithWastage = Math.ceil(totalQty * (1 + wastagePercent / 100));
                    data.push([
                        BEAD_TYPES['neopreno_negro'].name,
                        neoprenosPerBracelet + ' (en negras)',
                        totalQty,
                        totalWithWastage,
                        BEAD_TYPES['neopreno_negro'].sizeName
                    ]);
                }
                if (batchRojo > 0) {
                    const totalQty = neoprenosPerBracelet * batchRojo;
                    const totalWithWastage = Math.ceil(totalQty * (1 + wastagePercent / 100));
                    data.push([
                        BEAD_TYPES['neopreno_rojo'].name,
                        neoprenosPerBracelet + ' (en rojas)',
                        totalQty,
                        totalWithWastage,
                        BEAD_TYPES['neopreno_rojo'].sizeName
                    ]);
                }
            }

            Object.entries(aggregatedBeads).forEach(([typeId, singleQty]) => {
                const beadType = BEAD_TYPES[typeId];
                if (!beadType) return;

                const totalQty = singleQty * batchSize;
                const totalWithWastage = Math.ceil(totalQty * (1 + wastagePercent / 100));

                data.push([
                    beadType.name,
                    singleQty,
                    totalQty,
                    totalWithWastage,
                    beadType.sizeName
                ]);
            });

            const charm = getDije(selectedDijeId);
            if (charm) {
                data.push([
                    `Dije: ${charm.name}`,
                    1,
                    batchSize,
                    Math.ceil(batchSize * (1 + wastagePercent / 100)),
                    `${CHARM_SHAPES[charm.shape] || ''} ${(CHARM_COLORS[charm.color] || {}).name || ''}`.trim()
                ]);
            }

            const singleThreadM = threadLengthCm / 100;
            const totalThreadM = singleThreadM * batchSize;
            const totalThreadWithWastageM = totalThreadM * (1 + wastagePercent / 100);

            data.push([
                'Hilo / Cordón Elástico',
                `${threadLengthCm} cm`,
                `${totalThreadM.toFixed(2)} m`,
                `${totalThreadWithWastageM.toFixed(2)} m`,
                'Hilo'
            ]);

            const ws = XLSX.utils.aoa_to_sheet(data);
            
            ws['!cols'] = [
                { wch: 35 },
                { wch: 18 },
                { wch: 18 },
                { wch: 22 },
                { wch: 12 }
            ];

            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, 'Materiales');
            
            XLSX.writeFile(wb, `calculo_materiales_${batchSize}_pulseras.xlsx`);
            Utils.showToast('Excel generado correctamente', 'success');
        } catch (error) {
            console.error('Error al exportar a Excel:', error);
            Utils.showToast('Error al exportar a Excel', 'error');
        }
    }

    /**
     * Genera y exporta un documento PDF detallado con el diseño y desglose de materiales
     */
    function exportToPdf() {
        if (sequence.length === 0) {
            Utils.showToast('No hay datos para exportar', 'warning');
            return;
        }

        try {
            const batchSize = batchNegro + batchRojo;
            const { jsPDF } = window.jspdf;
            const doc = new jsPDF();

            doc.setFont('helvetica', 'bold');
            doc.setFontSize(20);
            doc.setTextColor(33, 37, 41);
            doc.text('REPORTE DE MATERIALES DE PRODUCCIÓN', 105, 20, { align: 'center' });

            doc.setFontSize(13);
            doc.setFont('helvetica', 'normal');
            doc.setTextColor(108, 117, 125);
            doc.text('Cotización de insumos físicos para producción por lotes', 105, 28, { align: 'center' });

            doc.setDrawColor(220, 224, 230);
            doc.setLineWidth(0.5);
            doc.line(20, 35, 190, 35);

            doc.setFontSize(11);
            doc.setFont('helvetica', 'bold');
            doc.setTextColor(33, 37, 41);
            doc.text('1. PARÁMETROS DEL LOTE DE PRODUCCIÓN', 20, 45);

            doc.setFont('helvetica', 'normal');
            doc.setFontSize(10);
            doc.text(`• Cantidad de pulseras negras: ${batchNegro} unidades`, 25, 53);
            doc.text(`• Cantidad de pulseras rojas: ${batchRojo} unidades`, 25, 60);
            doc.text(`• Total de pulseras: ${batchSize} unidades`, 25, 67);
            doc.text(`• Margen de desperdicio estimado: ${wastagePercent}%`, 25, 74);
            doc.text(`• Largo de hilo por pulsera: ${threadLengthCm} cm`, 25, 81);

            let yPos = 96;
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(11);
            doc.text('2. DESGLOSE FÍSICO DE MATERIALES REQUERIDOS', 20, yPos);
            yPos += 8;

            doc.setFillColor(242, 244, 248);
            doc.rect(20, yPos - 5, 170, 8, 'F');
            doc.setFontSize(9);
            doc.setFont('helvetica', 'bold');
            doc.text('Insumo / Material', 23, yPos);
            doc.text('Por Pulsera', 100, yPos, { align: 'right' });
            doc.text(`Total (${batchSize} ud)`, 140, yPos, { align: 'right' });
            doc.text(`Total + Margen (${wastagePercent}%)`, 185, yPos, { align: 'right' });
            
            yPos += 8;
            doc.setFont('helvetica', 'normal');

            const aggregatedBeads = {};
            let neoprenosPerBracelet = 0;
            sequence.forEach(item => {
                if (item.typeId.includes('neopreno')) {
                    neoprenosPerBracelet += item.qty;
                } else {
                    if (aggregatedBeads[item.typeId]) {
                        aggregatedBeads[item.typeId] += item.qty;
                    } else {
                        aggregatedBeads[item.typeId] = item.qty;
                    }
                }
            });

            let totalNeopreneWastage = 0;
            if (neoprenosPerBracelet > 0) {
                if (batchNegro > 0) {
                    const beadType = BEAD_TYPES['neopreno_negro'];
                    const totalQty = neoprenosPerBracelet * batchNegro;
                    const totalWithWastage = Math.ceil(totalQty * (1 + wastagePercent / 100));
                    totalNeopreneWastage += totalWithWastage;

                    doc.text(beadType.name, 23, yPos);
                    doc.text(`${neoprenosPerBracelet} (en negras)`, 100, yPos, { align: 'right' });
                    doc.text(`${totalQty.toLocaleString()} ud`, 140, yPos, { align: 'right' });
                    doc.setFont('helvetica', 'bold');
                    doc.text(`${totalWithWastage.toLocaleString()} ud`, 185, yPos, { align: 'right' });
                    doc.setFont('helvetica', 'normal');
                    doc.setDrawColor(240, 242, 245);
                    doc.line(20, yPos + 3, 190, yPos + 3);
                    yPos += 8;
                }
                if (batchRojo > 0) {
                    const beadType = BEAD_TYPES['neopreno_rojo'];
                    const totalQty = neoprenosPerBracelet * batchRojo;
                    const totalWithWastage = Math.ceil(totalQty * (1 + wastagePercent / 100));
                    totalNeopreneWastage += totalWithWastage;

                    doc.text(beadType.name, 23, yPos);
                    doc.text(`${neoprenosPerBracelet} (en rojas)`, 100, yPos, { align: 'right' });
                    doc.text(`${totalQty.toLocaleString()} ud`, 140, yPos, { align: 'right' });
                    doc.setFont('helvetica', 'bold');
                    doc.text(`${totalWithWastage.toLocaleString()} ud`, 185, yPos, { align: 'right' });
                    doc.setFont('helvetica', 'normal');
                    doc.setDrawColor(240, 242, 245);
                    doc.line(20, yPos + 3, 190, yPos + 3);
                    yPos += 8;
                }
            }

            Object.entries(aggregatedBeads).forEach(([typeId, singleQty]) => {
                const beadType = BEAD_TYPES[typeId];
                if (!beadType) return;

                const totalQty = singleQty * batchSize;
                const totalWithWastage = Math.ceil(totalQty * (1 + wastagePercent / 100));

                doc.text(beadType.name, 23, yPos);
                doc.text(`${singleQty} ud`, 100, yPos, { align: 'right' });
                doc.text(`${totalQty.toLocaleString()} ud`, 140, yPos, { align: 'right' });
                
                doc.setFont('helvetica', 'bold');
                doc.text(`${totalWithWastage.toLocaleString()} ud`, 185, yPos, { align: 'right' });
                doc.setFont('helvetica', 'normal');

                doc.setDrawColor(240, 242, 245);
                doc.line(20, yPos + 3, 190, yPos + 3);

                yPos += 8;
            });

            const charm = getDije(selectedDijeId);
            if (charm) {
                doc.text(`Dije: ${charm.name}`, 23, yPos);
                doc.text('1 ud', 100, yPos, { align: 'right' });
                doc.text(`${batchSize.toLocaleString()} ud`, 140, yPos, { align: 'right' });
                doc.setFont('helvetica', 'bold');
                doc.text(`${Math.ceil(batchSize * (1 + wastagePercent / 100)).toLocaleString()} ud`, 185, yPos, { align: 'right' });
                doc.setFont('helvetica', 'normal');
                doc.setDrawColor(240, 242, 245);
                doc.line(20, yPos + 3, 190, yPos + 3);
                yPos += 8;
            }

            const singleThreadM = threadLengthCm / 100;
            const totalThreadM = singleThreadM * batchSize;
            const totalThreadWithWastageM = totalThreadM * (1 + wastagePercent / 100);

            doc.setFillColor(247, 248, 252);
            doc.rect(20, yPos - 5, 170, 7, 'F');
            doc.setFont('helvetica', 'bold');
            doc.text('Hilo / Cordón Elástico', 23, yPos);
            doc.setFont('helvetica', 'normal');
            doc.text(`${threadLengthCm} cm`, 100, yPos, { align: 'right' });
            doc.text(`${totalThreadM.toFixed(2)} m`, 140, yPos, { align: 'right' });
            doc.setFont('helvetica', 'bold');
            doc.setTextColor(99, 102, 241);
            doc.text(`${totalThreadWithWastageM.toFixed(2)} m`, 185, yPos, { align: 'right' });
            doc.setTextColor(33, 37, 41);

            yPos += 15;
            doc.setDrawColor(99, 102, 241);
            doc.setFillColor(245, 246, 255);
            doc.rect(20, yPos, 170, 25);

            doc.setFontSize(10);
            doc.setFont('helvetica', 'bold');
            doc.text('RESUMEN DE PRODUCCIÓN EN LA ORDEN:', 25, yPos + 7);

            doc.setFont('helvetica', 'normal');
            doc.setFontSize(9);
            
            const totalSingleBeads = Object.values(aggregatedBeads).reduce((a, b) => a + b, 0);
            const totalBatchBeads = (totalSingleBeads * batchSize) + (neoprenosPerBracelet * batchSize);
            const totalBatchBeadsWithWastage = Object.entries(aggregatedBeads).reduce((acc, [typeId, singleQty]) => {
                return acc + Math.ceil(singleQty * batchSize * (1 + wastagePercent / 100));
            }, totalNeopreneWastage);

            doc.text(`- Cantidad de balines totales a ensamblar en lote: ${totalBatchBeads.toLocaleString()} unidades.`, 25, yPos + 14);
            doc.text(`- Total de balines a comprar (incluyendo margen): ${totalBatchBeadsWithWastage.toLocaleString()} unidades.`, 25, yPos + 20);

            doc.setFontSize(8);
            doc.setFont('helvetica', 'normal');
            doc.setTextColor(128, 128, 128);
            const dateStr = new Date().toLocaleDateString('es-EC', { hour: '2-digit', minute: '2-digit' });
            doc.text(`Generado por Sistema de Domicilios - Calculadora de Materiales · ${dateStr}`, 105, 282, { align: 'center' });

            doc.save(`reporte_materiales_${batchSize}_pulseras.pdf`);
            Utils.showToast('PDF generado correctamente', 'success');
        } catch (error) {
            console.error('Error al generar PDF:', error);
            Utils.showToast('Error al generar PDF', 'error');
        }
    }

    return {
        init,
        updateBeadQty,
        moveBead,
        removeBeadGroup,
        changeProductionQty,
        removeProduction,
        loadProduction,
        removeDije,
        openDesign,
        saveCurrentDesign,
        saveDesignAsNew,
        deleteCurrentDesign,
        newDesign
    };
})();

window.MaterialsCalculatorModule = MaterialsCalculatorModule;
