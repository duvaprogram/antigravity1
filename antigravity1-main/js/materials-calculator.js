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
    let batchSize = 300;
    let wastagePercent = 5;
    let threadLengthCm = 35;
    let isRotating = false;
    let initialized = false;

    // Gradientes SVG para renderizado fotorrealista
    const SVG_DEFS = `
        <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="1" dy="2" stdDeviation="1.5" flood-opacity="0.5" />
        </filter>

        <!-- Neopreno Negro (Mate con sombra interna suave) -->
        <radialGradient id="grad-neopreno_negro" cx="30%" cy="30%" r="70%">
            <stop offset="0%" stop-color="#4d4d4d" />
            <stop offset="60%" stop-color="#1e1e1e" />
            <stop offset="100%" stop-color="#080808" />
        </radialGradient>
        
        <!-- Neopreno Rojo (Mate con sombra interna suave) -->
        <radialGradient id="grad-neopreno_rojo" cx="30%" cy="30%" r="70%">
            <stop offset="0%" stop-color="#ff4f4f" />
            <stop offset="65%" stop-color="#bb1111" />
            <stop offset="100%" stop-color="#660000" />
        </radialGradient>

        <!-- Dorado No. 6 (Esférico Brillante Metálico) -->
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
            // Si ya se inicializó, solo actualizamos los cálculos y el preview
            updateCalculations();
            renderPreview();
            renderSequenceList();
            return;
        }

        console.log('Iniciando MaterialsCalculatorModule...');

        // Bindear controles del lote
        const inputBatch = document.getElementById('matCalcBatchSize');
        if (inputBatch) {
            inputBatch.value = batchSize;
            inputBatch.addEventListener('input', (e) => {
                batchSize = Math.max(1, parseInt(e.target.value) || 1);
                updateCalculations();
            });
        }

        const inputWastage = document.getElementById('matCalcWastage');
        if (inputWastage) {
            inputWastage.value = wastagePercent;
            inputWastage.addEventListener('input', (e) => {
                wastagePercent = Math.max(0, parseFloat(e.target.value) || 0);
                updateCalculations();
            });
        }

        const inputThread = document.getElementById('matCalcThreadPerBrac');
        if (inputThread) {
            inputThread.value = threadLengthCm;
            inputThread.addEventListener('input', (e) => {
                threadLengthCm = Math.max(1, parseInt(e.target.value) || 1);
                updateCalculations();
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
                    renderSequenceList();
                    renderPreview();
                    updateCalculations();
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
                    
                    // Añadir nuevo grupo de balines a la secuencia
                    sequence.push({ typeId, qty });
                    
                    renderSequenceList();
                    renderPreview();
                    updateCalculations();
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
    }

    /**
     * Retorna la cadena SVG formateada para un balín individual
     */
    function getBeadSVGString(beadType, cx, cy, r) {
        const gradId = `grad-${beadType.id}`;
        let overlay = '';

        if (beadType.type === 'metal_diamond') {
            // Dibujar líneas de facetas (efecto diamantado)
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
                <!-- Esfera con Degradado e Imputación de Sombra -->
                <circle cx="${cx}" cy="${cy}" r="${r}" fill="url(#${gradId})" filter="url(#shadow)" />
                <!-- Líneas diamantadas en caso de aplicar -->
                ${overlay}
                <!-- Contorno suave del balín -->
                <circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="rgba(0,0,0,0.18)" stroke-width="0.6" />
                <!-- Punto de brillo esférico (luz ambiental) -->
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

        // Limpiar lienzo dinámico y establecer definiciones de degradados
        svgEl.innerHTML = `<defs>${SVG_DEFS}</defs>`;

        // Si la secuencia está vacía
        if (sequence.length === 0) {
            svgEl.innerHTML += `
                <text x="150" y="150" text-anchor="middle" dominant-baseline="middle" fill="var(--text-muted)" font-size="13" font-weight="500">
                    Añade balines para armar tu pulsera
                </text>
            `;
            return;
        }

        // Aplanar la lista de balines respetando su cantidad
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

        // Calcular la circunferencia base sumando los diámetros en mm
        // Usamos una escala: 1mm = 3px de radio base (6px de diámetro base)
        let totalBaseDiameter = 0;
        flatBeads.forEach(bead => {
            totalBaseDiameter += (bead.sizeMm * 1.5) * 2; // pixel scale: radius = sizeMm * 1.5, diameter = sizeMm * 3
        });

        // Circunferencia = 2 * PI * R_base => R_base = Circunferencia / 2 * PI
        let R_base = totalBaseDiameter / (2 * Math.PI);

        // Escalamos dinámicamente para que quepa perfecto en la pantalla de 300x300
        // Queremos que el radio final R esté entre 55 y 105 px
        let R = R_base;
        const maxR = 100;
        const minR = 55;
        if (R_base > maxR) {
            R = maxR;
        } else if (R_base < minR) {
            R = minR;
        }

        const scale = R / R_base;

        // Dibujar el hilo elástico por debajo de los balines
        const threadCircle = `
            <circle cx="${cx}" cy="${cy}" r="${R}" fill="none" stroke="#111" stroke-width="2" stroke-dasharray="2 3" opacity="0.6" />
        `;

        // Renderizar balines
        let beadGroupsString = '';
        let currentAngle = 0;
        const rotationClass = isRotating ? 'rotating-bracelet' : '';

        flatBeads.forEach((bead, index) => {
            const nextBead = flatBeads[(index + 1) % flatBeads.length];
            
            // Radios escalados finales en píxeles
            const r_render = (bead.sizeMm * 1.5) * scale;
            const next_r_render = (nextBead.sizeMm * 1.5) * scale;

            // Calcular posición trigonométrica de la esfera
            const x = cx + R * Math.cos(currentAngle);
            const y = cy + R * Math.sin(currentAngle);

            beadGroupsString += getBeadSVGString(bead, x, y, r_render);

            // Determinar el paso angular para la siguiente esfera
            // Paso angular = (Radio_actual + Radio_siguiente) / R_del_circulo
            const angleStep = (r_render + next_r_render) / R;
            currentAngle += angleStep;
        });

        // Insertar elementos en el SVG
        svgEl.innerHTML += `
            <g class="${rotationClass}" style="transform-origin: 150px 150px;">
                ${threadCircle}
                ${beadGroupsString}
            </g>
        `;
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
                        <!-- Controles de Cantidad -->
                        <div class="bead-qty-controls">
                            <button type="button" class="bead-qty-btn" onclick="MaterialsCalculatorModule.updateBeadQty(${index}, -1)">−</button>
                            <span class="bead-qty-display">${item.qty}</span>
                            <button type="button" class="bead-qty-btn" onclick="MaterialsCalculatorModule.updateBeadQty(${index}, 1)">+</button>
                        </div>
                        
                        <!-- Controles de Orden y Acción -->
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
    }

    /**
     * Mueve un nodo de balines hacia arriba (-1) o abajo (+1) en la secuencia
     */
    function moveBead(index, direction) {
        const targetIndex = index + direction;
        if (targetIndex < 0 || targetIndex >= sequence.length) return;

        // Intercambiar elementos
        const temp = sequence[index];
        sequence[index] = sequence[targetIndex];
        sequence[targetIndex] = temp;

        renderSequenceList();
        renderPreview();
        updateCalculations();
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
        Utils.showToast('Grupo eliminado', 'info');
    }

    /**
     * Calcula los materiales totales y actualiza la tabla de resultados
     */
    function updateCalculations() {
        const tableBody = document.getElementById('matCalcResultsTable');
        const batchQtyHeader = document.getElementById('matCalcBatchQtyHeader');
        const wastageHeader = document.getElementById('matCalcWastageHeader');

        if (!tableBody) return;

        // Actualizar encabezados
        if (batchQtyHeader) batchQtyHeader.textContent = `Total (${batchSize} ud)`;
        if (wastageHeader) wastageHeader.textContent = `Total + Margen (${wastagePercent}%)`;

        // Si no hay balines en la secuencia
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

        // Agrupar y sumar cantidades unitarias por tipo de balín
        const aggregatedBeads = {};
        sequence.forEach(item => {
            if (aggregatedBeads[item.typeId]) {
                aggregatedBeads[item.typeId] += item.qty;
            } else {
                aggregatedBeads[item.typeId] = item.qty;
            }
        });

        let rowsHtml = '';

        // Renderizar filas de balines
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

        // Calcular Hilo Elástico
        // Largo unitario en metros
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
     * Genera y exporta los resultados de los cálculos a un libro de Excel
     */
    function exportToXlsx() {
        if (sequence.length === 0) {
            Utils.showToast('No hay datos para exportar', 'warning');
            return;
        }

        try {
            // Agrupar y sumar
            const aggregatedBeads = {};
            sequence.forEach(item => {
                if (aggregatedBeads[item.typeId]) {
                    aggregatedBeads[item.typeId] += item.qty;
                } else {
                    aggregatedBeads[item.typeId] = item.qty;
                }
            });

            // Preparar datos para Excel
            const data = [
                ['REPORTE DE MATERIALES DE PRODUCCIÓN - PULSERAS'],
                [],
                ['1. Configuración del Lote'],
                ['Cantidad de Pulseras a Fabricar', batchSize, 'unidades'],
                ['Margen de Desperdicio', wastagePercent / 100, ''], // formatted later
                ['Largo de Hilo por Pulsera', threadLengthCm, 'cm'],
                [],
                ['2. Desglose Físico de Materiales'],
                ['Material', 'Cant. por Pulsera', `Total (${batchSize} ud)`, `Total + Margen (${wastagePercent}%)`, 'Tipo'],
            ];

            // Formatear porcentaje en celda de desperdicio
            // Agregar balines
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

            // Agregar hilo
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

            // Generar libro de trabajo SheetJS
            const ws = XLSX.utils.aoa_to_sheet(data);
            
            // Ajustar anchos de columnas
            ws['!cols'] = [
                { wch: 35 }, // Material
                { wch: 18 }, // Cant. por Pulsera
                { wch: 18 }, // Total batch
                { wch: 22 }, // Total + Margen
                { wch: 12 }  // Tipo
            ];

            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, 'Materiales');
            
            // Descargar archivo
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
            const { jsPDF } = window.jspdf;
            const doc = new jsPDF();

            // Configurar fuentes y diseño
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(20);
            doc.setTextColor(33, 37, 41); // Gris oscuro
            doc.text('REPORTE DE MATERIALES DE PRODUCCIÓN', 105, 20, { align: 'center' });

            doc.setFontSize(13);
            doc.setFont('helvetica', 'normal');
            doc.setTextColor(108, 117, 125);
            doc.text('Cotización de insumos físicos para producción por lotes', 105, 28, { align: 'center' });

            // Dibujar línea separadora estética
            doc.setDrawColor(220, 224, 230);
            doc.setLineWidth(0.5);
            doc.line(20, 35, 190, 35);

            // 1. Detalles del lote
            doc.setFontSize(11);
            doc.setFont('helvetica', 'bold');
            doc.setTextColor(33, 37, 41);
            doc.text('1. PARÁMETROS DEL LOTE DE PRODUCCIÓN', 20, 45);

            doc.setFont('helvetica', 'normal');
            doc.setFontSize(10);
            doc.text(`• Cantidad de pulseras a fabricar: ${batchSize} unidades`, 25, 53);
            doc.text(`• Margen de desperdicio estimado: ${wastagePercent}%`, 25, 60);
            doc.text(`• Largo de hilo por pulsera: ${threadLengthCm} cm`, 25, 67);

            // 2. Tabla de desglose de materiales
            let yPos = 82;
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(11);
            doc.text('2. DESGLOSE FÍSICO DE MATERIALES REQUERIDOS', 20, yPos);
            yPos += 8;

            // Cabecera de la tabla
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

            // Agrupar secuenciador
            const aggregatedBeads = {};
            sequence.forEach(item => {
                if (aggregatedBeads[item.typeId]) {
                    aggregatedBeads[item.typeId] += item.qty;
                } else {
                    aggregatedBeads[item.typeId] = item.qty;
                }
            });

            // Listar balines en el PDF
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

                // Línea inferior
                doc.setDrawColor(240, 242, 245);
                doc.line(20, yPos + 3, 190, yPos + 3);

                yPos += 8;
            });

            // Listar hilo en el PDF
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
            doc.setTextColor(99, 102, 241); // Color primario
            doc.text(`${totalThreadWithWastageM.toFixed(2)} m`, 185, yPos, { align: 'right' });
            doc.setTextColor(33, 37, 41);

            // Dibujar recuadro de totales
            yPos += 15;
            doc.setDrawColor(99, 102, 241);
            doc.setFillColor(245, 246, 255);
            doc.rect(20, yPos, 170, 25);

            doc.setFontSize(10);
            doc.setFont('helvetica', 'bold');
            doc.text('RESUMEN DE PRODUCCIÓN EN LA ORDEN:', 25, yPos + 7);

            doc.setFont('helvetica', 'normal');
            doc.setFontSize(9);
            
            // Total de balines en la orden
            const totalSingleBeads = Object.values(aggregatedBeads).reduce((a, b) => a + b, 0);
            const totalBatchBeads = totalSingleBeads * batchSize;
            const totalBatchBeadsWithWastage = Object.entries(aggregatedBeads).reduce((acc, [typeId, singleQty]) => {
                return acc + Math.ceil(singleQty * batchSize * (1 + wastagePercent / 100));
            }, 0);

            doc.text(`- Cantidad de balines totales a ensamblar en lote: ${totalBatchBeads.toLocaleString()} unidades.`, 25, yPos + 14);
            doc.text(`- Total de balines a comprar (incluyendo margen): ${totalBatchBeadsWithWastage.toLocaleString()} unidades.`, 25, yPos + 20);

            // Pie de página
            doc.setFontSize(8);
            doc.setFont('helvetica', 'normal');
            doc.setTextColor(128, 128, 128);
            const dateStr = new Date().toLocaleDateString('es-EC', { hour: '2-digit', minute: '2-digit' });
            doc.text(`Generado por Sistema de Domicilios - Calculadora de Materiales · ${dateStr}`, 105, 282, { align: 'center' });

            // Guardar archivo
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
        removeBeadGroup
    };
})();

// Compartir módulo globalmente
window.MaterialsCalculatorModule = MaterialsCalculatorModule;
