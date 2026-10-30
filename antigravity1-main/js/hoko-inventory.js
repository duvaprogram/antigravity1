/**
 * ============================================================
 *  MÓDULO INVENTARIO HOKO  –  v1.0
 *  Sistema de Gestión y Clasificación Inteligente de Inventario
 *  Integrado al Panel Domicilios v3.3.0
 * ============================================================
 *  Todos los IDs del DOM usan el prefijo "hoko_" para evitar
 *  conflictos con el inventario simple existente.
 * ============================================================
 */

const HokoInventory = (() => {

    // ==========================================
    // 1. ESTADO GLOBAL DEL MÓDULO
    // ==========================================
    let rawRows = [];
    let rawHeaders = [];
    let visibleRawColumns = new Set();
    let normalizedInventory = [];
    let filteredInventory = [];
    let columnMapping = {};
    let currentPage = 1;
    let pageSize = 15;
    let currentTab = 'hoko_tab-table';
    let currentWorkbook = null;

    // ==========================================
    // 2. DEFINICIÓN DE CAMPOS Y ALIASES
    // ==========================================
    const FIELD_DEFINITIONS = [
        { key: 'id',        label: 'ID Hoko / Ref.',     aliases: ['id hoko', 'id', 'referencia', 'ref', 'codigo', 'code'] },
        { key: 'sku',       label: 'SKU / Código',        aliases: ['sku', 'codigo producto', 'product code', 'item code', 'cod'] },
        { key: 'name',      label: 'Nombre del Producto', aliases: ['producto', 'nombre', 'name', 'descripcion', 'description', 'item', 'articulo'] },
        { key: 'category',  label: 'Categoría',           aliases: ['categoria', 'category', 'linea', 'line', 'tipo', 'type', 'familia'] },
        { key: 'warehouse', label: 'Bodega / Ciudad',     aliases: ['bodega', 'warehouse', 'ciudad', 'city', 'ubicacion', 'location', 'almacen', 'deposito'] },
        { key: 'stock',     label: 'Stock Disponible',    aliases: ['stock disponible', 'stock', 'existencias', 'disponible', 'cantidad', 'qty', 'quantity', 'units', 'unidades'] },
        { key: 'transit',   label: 'En Tránsito',         aliases: ['en transito', 'transito', 'transit', 'en camino', 'reservado', 'reserved', 'pedido'] },
        { key: 'cost',      label: 'Costo Unitario',      aliases: ['costo proveedor', 'costo', 'cost', 'precio costo', 'purchase price', 'precio compra', 'costo unitario'] },
        { key: 'price',     label: 'Precio de Venta',     aliases: ['precio venta', 'precio', 'price', 'sale price', 'pvp', 'precio publico'] },
        { key: 'status',    label: 'Estado',              aliases: ['estado', 'status', 'activo', 'active', 'condition'] },
    ];

    // ==========================================
    // 2.5 DATOS DE DEMO INICIALES
    // ==========================================
    const DEMO_DATA = [
        { "ID Hoko": "HK-90101", "SKU": "AURIC-BT-X7", "Producto": "Auriculares Bluetooth Inalámbricos Pro X7 ANC", "Categoría": "Tecnología y Audio", "Bodega": "Bogotá D.C. - Central", "Stock Disponible": 45, "En Tránsito": 20, "Costo Proveedor": 35000, "Precio Venta": 89900, "Estado": "Activo", "Proveedor": "TechImport Hoko" },
        { "ID Hoko": "HK-90102", "SKU": "MASAJ-CERV-6H", "Producto": "Masajeador Cervical Eléctrico 6 Cabezales Calor", "Categoría": "Salud y Bienestar", "Bodega": "Medellín - Antioquia", "Stock Disponible": 8, "En Tránsito": 15, "Costo Proveedor": 28000, "Precio Venta": 79900, "Estado": "Activo", "Proveedor": "BioWell Drop" },
        { "ID Hoko": "HK-90103", "SKU": "FREID-AIR-DIGIT", "Producto": "Freidora de Aire Digital 5.5L Sin Aceite", "Categoría": "Hogar y Cocina", "Bodega": "Cali - Valle", "Stock Disponible": 0, "En Tránsito": 30, "Costo Proveedor": 65000, "Precio Venta": 159900, "Estado": "Agotado", "Proveedor": "ElectroHogar Cali" },
        { "ID Hoko": "HK-90104", "SKU": "RELOJ-SPORT-GPS", "Producto": "Reloj Smartwatch Sport GPS Monitor Cardíaco", "Categoría": "Tecnología y Audio", "Bodega": "Bogotá D.C. - Central", "Stock Disponible": 22, "En Tránsito": 8, "Costo Proveedor": 45000, "Precio Venta": 119900, "Estado": "Activo", "Proveedor": "TechImport Hoko" },
        { "ID Hoko": "HK-90105", "SKU": "LAMP-LED-RGB", "Producto": "Lámpara LED Escritorio RGB Recargable USB-C", "Categoría": "Hogar y Cocina", "Bodega": "Barranquilla - Costa", "Stock Disponible": 67, "En Tránsito": 0, "Costo Proveedor": 18000, "Precio Venta": 49900, "Estado": "Activo", "Proveedor": "LightPro Drop" },
        { "ID Hoko": "HK-90106", "SKU": "TERM-CARN-WLESS", "Producto": "Termómetro Inalámbrico para Carne con App", "Categoría": "Hogar y Cocina", "Bodega": "Medellín - Antioquia", "Stock Disponible": 5, "En Tránsito": 18, "Costo Proveedor": 32000, "Precio Venta": 89900, "Estado": "Activo", "Proveedor": "KitchenPro" },
        { "ID Hoko": "HK-90107", "SKU": "LENTES-LUZ-AZUL", "Producto": "Lentes Gafas Filtro Luz Azul Anti-fatiga Gaming", "Categoría": "Salud y Bienestar", "Bodega": "Bogotá D.C. - Central", "Stock Disponible": 33, "En Tránsito": 10, "Costo Proveedor": 12000, "Precio Venta": 39900, "Estado": "Activo", "Proveedor": "OpticsDrop" },
        { "ID Hoko": "HK-90108", "SKU": "PURIF-AIRE-HEPA", "Producto": "Purificador de Aire HEPA H13 Silencioso 35dB", "Categoría": "Salud y Bienestar", "Bodega": "Bucaramanga - Oriente", "Stock Disponible": 0, "En Tránsito": 12, "Costo Proveedor": 95000, "Precio Venta": 219900, "Estado": "Agotado", "Proveedor": "AirClean Hoko" },
        { "ID Hoko": "HK-90109", "SKU": "CARG-INALAMB-4EN1", "Producto": "Cargador Inalámbrico 4 en 1 Para iPhone/Android/Watch", "Categoría": "Tecnología y Audio", "Bodega": "Cali - Valle", "Stock Disponible": 18, "En Tránsito": 5, "Costo Proveedor": 22000, "Precio Venta": 64900, "Estado": "Activo", "Proveedor": "TechImport Hoko" },
        { "ID Hoko": "HK-90110", "SKU": "BICI-FIJA-SMART", "Producto": "Bicicleta Fija Estática Magnética Smart Display", "Categoría": "Deportes y Fitness", "Bodega": "Bogotá D.C. - Central", "Stock Disponible": 3, "En Tránsito": 6, "Costo Proveedor": 280000, "Precio Venta": 549900, "Estado": "Activo", "Proveedor": "FitLife Distribuciones" },
        { "ID Hoko": "HK-90111", "SKU": "MOCH-IMPERME-USB", "Producto": "Mochila Impermeable Puerto USB + Anti-robo", "Categoría": "Accesorios y Viaje", "Bodega": "Medellín - Antioquia", "Stock Disponible": 54, "En Tránsito": 20, "Costo Proveedor": 38000, "Precio Venta": 99900, "Estado": "Activo", "Proveedor": "TravelDrop" },
        { "ID Hoko": "HK-90112", "SKU": "PEN-DISK-256GB", "Producto": "Pen Drive USB 3.2 Gen2 256GB Alta Velocidad", "Categoría": "Tecnología y Audio", "Bodega": "Barranquilla - Costa", "Stock Disponible": 10, "En Tránsito": 30, "Costo Proveedor": 15000, "Precio Venta": 44900, "Estado": "Activo", "Proveedor": "TechImport Hoko" },
        { "ID Hoko": "HK-90113", "SKU": "SET-CUCHI-CERÁMIC", "Producto": "Set Cuchillos Cerámica Profesional 6 Piezas + Tabla", "Categoría": "Hogar y Cocina", "Bodega": "Bogotá D.C. - Central", "Stock Disponible": 27, "En Tránsito": 0, "Costo Proveedor": 42000, "Precio Venta": 109900, "Estado": "Activo", "Proveedor": "ElectroHogar Cali" },
        { "ID Hoko": "HK-90114", "SKU": "SER-VITC-BIO", "Producto": "Kit Rutina Facial Serum Vitamina C + Ácido Hialurónico", "Categoría": "Belleza y Cuidado", "Bodega": "Cali - Valle", "Stock Disponible": 145, "En Tránsito": 40, "Costo Proveedor": 24000, "Precio Venta": 78900, "Estado": "Activo", "Proveedor": "BeautyGlow Drop" },
        { "ID Hoko": "HK-90115", "SKU": "HIDRO-PORT-24V", "Producto": "Hidrolavadora Inalámbrica Portátil Batería 24V Maletín", "Categoría": "Automotriz y Herramientas", "Bodega": "Bucaramanga - Oriente", "Stock Disponible": 6, "En Tránsito": 12, "Costo Proveedor": 82000, "Precio Venta": 189900, "Estado": "Activo", "Proveedor": "AutoParts Pro" },
        { "ID Hoko": "HK-90116", "SKU": "CERR-HUE-SMART", "Producto": "Cerradura Inteligente Biométrica Huella + Clave + App", "Categoría": "Seguridad y Smart Home", "Bodega": "Medellín - Antioquia", "Stock Disponible": 14, "En Tránsito": 4, "Costo Proveedor": 165000, "Precio Venta": 349900, "Estado": "Activo", "Proveedor": "Domótica Express" },
        { "ID Hoko": "HK-90117", "SKU": "CORR-POST-MAG", "Producto": "Corrector de Postura Espalda Magnético Ajustable", "Categoría": "Salud y Bienestar", "Bodega": "Barranquilla - Costa", "Stock Disponible": 0, "En Tránsito": 22, "Costo Proveedor": 16500, "Precio Venta": 59900, "Estado": "Activo", "Proveedor": "FitLife Distribuciones" },
        { "ID Hoko": "HK-90118", "SKU": "WAFF-MINI-RED", "Producto": "Mini Waflera Eléctrica Antiadherente Individual", "Categoría": "Hogar y Cocina", "Bodega": "Bogotá D.C. - Central", "Stock Disponible": 53, "En Tránsito": 9, "Costo Proveedor": 25000, "Precio Venta": 68900, "Estado": "Activo", "Proveedor": "ElectroHogar Cali" }
    ];

    // ==========================================
    // 3. INICIALIZACIÓN
    // ==========================================
    function init() {
        setupDragAndDrop();
        restoreDemoData(false);
    }

    function setupDragAndDrop() {
        const dropZone = document.getElementById('hoko_dropZone');
        if (!dropZone) return;
        ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(ev =>
            dropZone.addEventListener(ev, e => { e.preventDefault(); e.stopPropagation(); }, false)
        );
        ['dragenter', 'dragover'].forEach(ev =>
            dropZone.addEventListener(ev, () => dropZone.classList.add('hoko-dropzone-active'), false)
        );
        ['dragleave', 'drop'].forEach(ev =>
            dropZone.addEventListener(ev, () => dropZone.classList.remove('hoko-dropzone-active'), false)
        );
        dropZone.addEventListener('drop', e => {
            const files = e.dataTransfer.files;
            if (files && files.length > 0) processUploadedFile(files[0]);
        }, false);
    }

    // ==========================================
    // 4. LECTURA CON SHEETJS
    // ==========================================
    function handleFileSelect(event) {
        const file = event.target.files[0];
        if (file) processUploadedFile(file);
    }

    function processUploadedFile(file) {
        const ext = file.name.split('.').pop().toLowerCase();
        if (!['xlsx', 'xls', 'csv'].includes(ext)) {
            showToast('Formato no soportado. Sube .xlsx, .xls o .csv', 'error');
            return;
        }
        const reader = new FileReader();
        reader.onload = e => {
            try {
                const data = new Uint8Array(e.target.result);
                if (ext === 'csv') {
                    // SheetJS asume Windows-1252 en CSV: decodificamos nosotros (UTF-8, con respaldo 1252)
                    let text;
                    try { text = new TextDecoder('utf-8', { fatal: true }).decode(data); }
                    catch (_) { text = new TextDecoder('windows-1252').decode(data); }
                    currentWorkbook = XLSX.read(text.replace(/^﻿/, ''), { type: 'string' });
                } else {
                    currentWorkbook = XLSX.read(data, { type: 'array' });
                }
                const sheetNames = currentWorkbook.SheetNames;
                if (!sheetNames || sheetNames.length === 0) {
                    showToast('El archivo no contiene hojas válidas.', 'error');
                    return;
                }
                const sheetContainer = document.getElementById('hoko_sheetSelectorContainer');
                const sheetSelect   = document.getElementById('hoko_sheetSelector');
                sheetSelect.innerHTML = '';
                if (sheetNames.length > 1) {
                    sheetNames.forEach(name => {
                        const opt = document.createElement('option');
                        opt.value = name; opt.textContent = name;
                        sheetSelect.appendChild(opt);
                    });
                    sheetContainer.classList.remove('hidden');
                } else {
                    sheetContainer.classList.add('hidden');
                }
                loadWorksheetData(sheetNames[0], file.name);
            } catch (err) {
                console.error(err);
                showToast('Error al leer el archivo. Verifica que sea Excel/CSV válido.', 'error');
            }
        };
        reader.readAsArrayBuffer(file);
    }

    function handleSheetChange(sheetName) {
        if (!currentWorkbook) return;
        loadWorksheetData(sheetName, `Hoja: ${sheetName}`);
    }

    function loadWorksheetData(sheetName, sourceLabel) {
        const worksheet = currentWorkbook.Sheets[sheetName];
        const jsonData  = XLSX.utils.sheet_to_json(worksheet, { defval: '' });
        if (!jsonData || jsonData.length === 0) {
            showToast(`La hoja "${sheetName}" está vacía.`, 'warning');
            return;
        }
        rawRows    = jsonData;
        rawHeaders = Object.keys(jsonData[0]);
        visibleRawColumns = new Set(rawHeaders);
        autoDetectColumnMapping(rawHeaders);
        normalizeDataFromRaw();
        populateDynamicDropdowns();
        applyFilters();

        const badge = document.getElementById('hoko_dataSourceBadge');
        badge.className = 'hoko-badge hoko-badge-success';
        badge.innerHTML = `<span class="hoko-dot hoko-dot-success"></span> Archivo: ${escapeHtml(sourceLabel)}`;

        const fileInfo = document.getElementById('hoko_fileInfoText');
        fileInfo.textContent = `Cargado: ${sourceLabel} (${rawRows.length} filas, ${rawHeaders.length} cols)`;
        fileInfo.classList.remove('hidden');

        showToast(`Reporte cargado: ${rawRows.length} registros clasificados.`, 'success');
    }

    // ==========================================
    // 5. DETECCIÓN INTELIGENTE DE COLUMNAS
    // ==========================================
    function normalizeString(str) {
        return String(str || '').toLowerCase()
            .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
            .replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
    }

    function autoDetectColumnMapping(headers) {
        columnMapping = {};
        const used = new Set();
        FIELD_DEFINITIONS.forEach(field => {
            let matched = headers.find(h => !used.has(h) && field.aliases.includes(normalizeString(h)));
            if (!matched) {
                matched = headers.find(h => {
                    if (used.has(h)) return false;
                    const norm = normalizeString(h);
                    return field.aliases.some(a => norm.includes(a) || a.includes(norm));
                });
            }
            columnMapping[field.key] = matched || '';
            if (matched) used.add(matched);
        });
    }

    function parseCleanNumber(val) {
        if (typeof val === 'number') return isNaN(val) ? 0 : val;
        if (val === null || val === undefined || val === '') return 0;
        let s = String(val).trim().replace(/[^0-9.,-]/g, '');
        if (!s) return 0;
        const lc = s.lastIndexOf(','), ld = s.lastIndexOf('.');
        if (lc > -1 && ld > -1) {
            s = lc > ld ? s.replace(/\./g, '').replace(',', '.') : s.replace(/,/g, '');
        } else if (lc > -1) {
            const p = s.split(',');
            s = (p[p.length - 1].length === 3 && p.length > 1) ? s.replace(/,/g, '') : s.replace(',', '.');
        } else if (ld > -1) {
            const p = s.split('.');
            if (p[p.length - 1].length === 3 && p.length > 1) s = s.replace(/\./g, '');
        }
        const n = parseFloat(s);
        return isNaN(n) ? 0 : n;
    }

    function normalizeDataFromRaw() {
        normalizedInventory = rawRows.map((row, idx) => {
            const gv = key => { const c = columnMapping[key]; return c && row[c] !== undefined ? row[c] : ''; };
            const id  = String(gv('id')  || `HK-${1000 + idx + 1}`).trim();
            const sku = String(gv('sku') || `SKU-${1000 + idx + 1}`).trim();
            let name  = String(gv('name') || '').trim();
            if (!name && rawHeaders.length > 0) {
                const fb = rawHeaders.find(h => typeof row[h] === 'string' && row[h].trim().length > 2) || rawHeaders[0];
                name = String(row[fb] || `Producto #${idx + 1}`).trim();
            }
            const category  = String(gv('category')  || 'General / Sin Categoría').trim() || 'General / Sin Categoría';
            const warehouse = String(gv('warehouse') || 'Bodega Principal').trim() || 'Bodega Principal';
            const stock     = Math.max(0, Math.round(parseCleanNumber(gv('stock'))));
            const transit   = Math.max(0, Math.round(parseCleanNumber(gv('transit'))));
            const cost      = Math.max(0, parseCleanNumber(gv('cost')));
            let price       = Math.max(0, parseCleanNumber(gv('price')));
            if (price === 0 && cost > 0) price = Math.round(cost * 1.45);
            const status    = String(gv('status') || 'Activo').trim() || 'Activo';
            const totalCostValue = stock * cost;
            const totalSaleValue = stock * price;
            const marginPercent  = price > 0 ? ((price - cost) / price) * 100 : 0;
            let health = 'OPTIMAL';
            if (stock === 0) health = 'OUT';
            else if (stock <= 10) health = 'LOW';
            return { _rowIndex: idx, id, sku, name, category, warehouse, stock, transit, cost, price, status, totalCostValue, totalSaleValue, marginPercent, health, raw: row };
        });
    }

    // ==========================================
    // 6. FILTROS Y SELECTORES DINÁMICOS
    // ==========================================
    function populateDynamicDropdowns() {
        const warehouses = [...new Set(normalizedInventory.map(i => i.warehouse))].sort();
        const categories = [...new Set(normalizedInventory.map(i => i.category))].sort();
        const statuses   = [...new Set(normalizedInventory.map(i => i.status))].sort();

        const products   = [...new Set(normalizedInventory.map(i => i.name).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'es'));

        const whSel  = document.getElementById('hoko_filterWarehouse');
        const catSel = document.getElementById('hoko_filterCategory');
        const stSel  = document.getElementById('hoko_filterStatus');
        const prodList = document.getElementById('hoko_productList');

        if (prodList) {
            prodList.innerHTML = products.map(p => `<option value="${escapeHtml(p)}"></option>`).join('');
        }
        const prodLabel = document.getElementById('hoko_productCountLabel');
        if (prodLabel) prodLabel.textContent = `(${products.length})`;

        if (whSel) {
            const cur = whSel.value;
            whSel.innerHTML = `<option value="ALL">Todas las Bodegas (${warehouses.length})</option>` +
                warehouses.map(w => `<option value="${escapeHtml(w)}">${escapeHtml(w)}</option>`).join('');
            if (warehouses.includes(cur)) whSel.value = cur;
        }
        if (catSel) {
            const cur = catSel.value;
            catSel.innerHTML = `<option value="ALL">Todas las Categorías (${categories.length})</option>` +
                categories.map(c => `<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`).join('');
            if (categories.includes(cur)) catSel.value = cur;
        }
        if (stSel) {
            const cur = stSel.value;
            stSel.innerHTML = `<option value="ALL">Todos (${statuses.length})</option>` +
                statuses.map(s => `<option value="${escapeHtml(s)}">${escapeHtml(s)}</option>`).join('');
            if (statuses.includes(cur)) stSel.value = cur;
        }

        const rawColSel = document.getElementById('hoko_rawColumnFilterSelect');
        if (rawColSel) {
            rawColSel.innerHTML = `<option value="ALL">Todas las columnas (${rawHeaders.length})</option>` +
                rawHeaders.map(h => `<option value="${escapeHtml(h)}">${escapeHtml(h)}</option>`).join('');
        }
    }

    function applyFilters() {
        const search    = (document.getElementById('hoko_filterSearch')?.value || '').trim();
        const searchTokens = normalizeString(search).split(' ').filter(Boolean);
        const product   = normalizeString(document.getElementById('hoko_filterProduct')?.value || '');
        const productIsExact = product !== '' && normalizedInventory.some(i => normalizeString(i.name) === product);
        const warehouse = document.getElementById('hoko_filterWarehouse')?.value || 'ALL';
        const category  = document.getElementById('hoko_filterCategory')?.value  || 'ALL';
        const health    = document.getElementById('hoko_filterHealth')?.value    || 'ALL';
        const status    = document.getElementById('hoko_filterStatus')?.value    || 'ALL';
        const sortBy    = document.getElementById('hoko_filterSort')?.value      || 'STOCK_DESC';
        const minStockStr = document.getElementById('hoko_filterMinStock')?.value || '';
        const maxStockStr = document.getElementById('hoko_filterMaxStock')?.value || '';
        const minStock    = minStockStr !== '' ? parseFloat(minStockStr) : null;
        const maxStock    = maxStockStr !== '' ? parseFloat(maxStockStr) : null;

        const clearBtn = document.getElementById('hoko_btnClearSearch');
        if (clearBtn) clearBtn.classList.toggle('hidden', search.length === 0);

        filteredInventory = normalizedInventory.filter(item => {
            // La búsqueda solo mira producto / SKU / ID: bodega y categoría tienen su propio filtro
            // (si no, "reloj" traería todo lo de una bodega llamada "Relojería").
            if (searchTokens.length) {
                const haystack = normalizeString(`${item.name} ${item.sku} ${item.id}`);
                if (!searchTokens.every(t => haystack.includes(t))) return false;
            }
            if (product) {
                const itemName = normalizeString(item.name);
                if (productIsExact ? itemName !== product : !itemName.includes(product)) return false;
            }
            if (warehouse !== 'ALL' && item.warehouse !== warehouse) return false;
            if (category  !== 'ALL' && item.category  !== category)  return false;
            if (status    !== 'ALL' && item.status     !== status)    return false;
            if (health === 'OPTIMAL' && item.health !== 'OPTIMAL') return false;
            if (health === 'LOW'     && item.health !== 'LOW')     return false;
            if (health === 'OUT'     && item.health !== 'OUT')     return false;
            if (health === 'TRANSIT' && item.transit <= 0)         return false;
            if (minStock !== null && item.stock < minStock) return false;
            if (maxStock !== null && item.stock > maxStock) return false;
            return true;
        });

        filteredInventory.sort((a, b) => {
            switch (sortBy) {
                case 'STOCK_DESC':  return b.stock - a.stock;
                case 'STOCK_ASC':   return a.stock - b.stock;
                case 'VALUE_DESC':  return b.totalCostValue - a.totalCostValue;
                case 'MARGIN_DESC': return b.marginPercent  - a.marginPercent;
                case 'TRANSIT_DESC':return b.transit - a.transit;
                case 'NAME_ASC':    return a.name.localeCompare(b.name, 'es');
                default: return 0;
            }
        });

        currentPage = 1;
        updateActiveFilterPills();
        updateSemaphoreHighlight(health);
        updateDashboardKPIs();
        renderAllTabs();
    }

    function setHealthFilter(level) {
        const sel = document.getElementById('hoko_filterHealth');
        if (sel) sel.value = sel.value === level ? 'ALL' : level;
        applyFilters();
    }

    function updateSemaphoreHighlight(currentHealth) {
        const btnReset = document.getElementById('hoko_btnResetHealth');
        if (btnReset) btnReset.classList.toggle('hidden', currentHealth === 'ALL');

        ['OPTIMAL', 'LOW', 'OUT'].forEach(key => {
            const el = document.getElementById(`hoko_semCard${key.charAt(0) + key.slice(1).toLowerCase()}`);
            if (el) {
                el.classList.toggle('hoko-sem-active', currentHealth === key);
            }
        });
    }

    function filterByWarehouseQuick(name) {
        const sel = document.getElementById('hoko_filterWarehouse');
        if (sel) sel.value = name;
        applyFilters();
        switchTab('hoko_tab-table');
        showToast(`Filtrando bodega: ${name}`, 'info');
    }

    function filterByCategoryQuick(name) {
        const sel = document.getElementById('hoko_filterCategory');
        if (sel) sel.value = name;
        applyFilters();
        switchTab('hoko_tab-table');
        showToast(`Filtrando categoría: ${name}`, 'info');
    }

    function resetAllFilters() {
        ['hoko_filterSearch', 'hoko_filterProduct', 'hoko_filterMinStock', 'hoko_filterMaxStock'].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.value = '';
        });
        ['hoko_filterWarehouse', 'hoko_filterCategory', 'hoko_filterHealth', 'hoko_filterStatus'].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.value = 'ALL';
        });
        const sortEl = document.getElementById('hoko_filterSort');
        if (sortEl) sortEl.value = 'STOCK_DESC';
        applyFilters();
        showToast('Filtros restablecidos.', 'info');
    }

    function updateActiveFilterPills() {
        const container = document.getElementById('hoko_activeFilterPills');
        const badge     = document.getElementById('hoko_activeFiltersCountBadge');
        if (!container || !badge) return;

        const search = (document.getElementById('hoko_filterSearch')?.value || '').trim();
        const prod   = (document.getElementById('hoko_filterProduct')?.value || '').trim();
        const wh     = document.getElementById('hoko_filterWarehouse')?.value || 'ALL';
        const cat    = document.getElementById('hoko_filterCategory')?.value  || 'ALL';
        const health = document.getElementById('hoko_filterHealth')?.value    || 'ALL';
        const status = document.getElementById('hoko_filterStatus')?.value    || 'ALL';
        const minS   = document.getElementById('hoko_filterMinStock')?.value  || '';
        const maxS   = document.getElementById('hoko_filterMaxStock')?.value  || '';

        const pills = [];
        if (search) pills.push({ label: `Búsqueda: "${search}"`, clear: () => { document.getElementById('hoko_filterSearch').value = ''; applyFilters(); } });
        if (prod) pills.push({ label: `Producto: ${prod}`, clear: () => { document.getElementById('hoko_filterProduct').value = ''; applyFilters(); } });
        if (wh !== 'ALL') pills.push({ label: `Bodega: ${wh}`, clear: () => { document.getElementById('hoko_filterWarehouse').value = 'ALL'; applyFilters(); } });
        if (cat !== 'ALL') pills.push({ label: `Categoría: ${cat}`, clear: () => { document.getElementById('hoko_filterCategory').value = 'ALL'; applyFilters(); } });
        if (health !== 'ALL') {
            const lbl = { OPTIMAL: 'Salud: Óptimo', LOW: 'Salud: Bajo', OUT: 'Salud: Agotado', TRANSIT: 'En Tránsito > 0' };
            pills.push({ label: lbl[health] || health, clear: () => { document.getElementById('hoko_filterHealth').value = 'ALL'; applyFilters(); } });
        }
        if (status !== 'ALL') pills.push({ label: `Estado: ${status}`, clear: () => { document.getElementById('hoko_filterStatus').value = 'ALL'; applyFilters(); } });
        if (minS !== '' || maxS !== '') pills.push({ label: `Stock: ${minS || 0} - ${maxS || '∞'}`, clear: () => { document.getElementById('hoko_filterMinStock').value = ''; document.getElementById('hoko_filterMaxStock').value = ''; applyFilters(); } });

        if (pills.length > 0) {
            badge.textContent = `${pills.length} filtro${pills.length > 1 ? 's' : ''} activo${pills.length > 1 ? 's' : ''}`;
            badge.classList.remove('hidden');
        } else {
            badge.classList.add('hidden');
        }

        container.innerHTML = '';
        pills.forEach(p => {
            const btn = document.createElement('button');
            btn.className = 'hoko-pill';
            btn.innerHTML = `<span>${escapeHtml(p.label)}</span><i class="hoko-icon-x">✕</i>`;
            btn.onclick = p.clear;
            container.appendChild(btn);
        });

        const fc = document.getElementById('hoko_filteredCountText');
        const tc = document.getElementById('hoko_totalCountText');
        if (fc) fc.textContent = filteredInventory.length;
        if (tc) tc.textContent = normalizedInventory.length;
    }

    // ==========================================
    // 7. KPIs Y SEMÁFORO
    // ==========================================
    function updateDashboardKPIs() {
        const total     = filteredInventory.length;
        const uniqueWh  = new Set(filteredInventory.map(i => i.warehouse)).size;
        const uniqueCat = new Set(filteredInventory.map(i => i.category)).size;
        const totalU    = filteredInventory.reduce((a, i) => a + i.stock, 0);
        const totalT    = filteredInventory.reduce((a, i) => a + i.transit, 0);
        const avgStock  = total > 0 ? Math.round(totalU / total) : 0;
        const totalC    = filteredInventory.reduce((a, i) => a + i.totalCostValue, 0);
        const totalR    = filteredInventory.reduce((a, i) => a + i.totalSaleValue, 0);
        const margin    = totalR > 0 ? ((totalR - totalC) / totalR) * 100 : 0;
        const cOpt = filteredInventory.filter(i => i.health === 'OPTIMAL').length;
        const cLow = filteredInventory.filter(i => i.health === 'LOW').length;
        const cOut = filteredInventory.filter(i => i.health === 'OUT').length;

        setText('hoko_kpiTotalSkus',       total.toLocaleString('es-CO'));
        setText('hoko_kpiTotalWarehouses', uniqueWh);
        setText('hoko_kpiTotalCategories', uniqueCat);
        setText('hoko_kpiTotalUnits',      totalU.toLocaleString('es-CO'));
        setText('hoko_kpiTotalTransit',    totalT.toLocaleString('es-CO'));
        setText('hoko_kpiAvgStock',        avgStock.toLocaleString('es-CO'));
        setText('hoko_kpiTotalCost',       formatCurrency(totalC));
        setText('hoko_kpiTotalRevenue',    formatCurrency(totalR));
        setText('hoko_kpiMarginBadge',     `Margen: ${margin.toFixed(1)}%`);
        setText('hoko_semCountOptimal',    cOpt.toLocaleString('es-CO'));
        setText('hoko_semCountLow',        cLow.toLocaleString('es-CO'));
        setText('hoko_semCountOut',        cOut.toLocaleString('es-CO'));
        setText('hoko_badgeTabTable',      total);
        setText('hoko_badgeTabWarehouses', uniqueWh);
        setText('hoko_badgeTabCategories', uniqueCat);
        setText('hoko_badgeTabAlerts',     cLow + cOut);
    }

    // ==========================================
    // 8. RENDERIZADO DE PESTAÑAS
    // ==========================================
    function switchTab(tabId) {
        currentTab = tabId;
        document.querySelectorAll('.hoko-tab-pane').forEach(el => el.classList.add('hidden'));
        const pane = document.getElementById(tabId);
        if (pane) pane.classList.remove('hidden');
        document.querySelectorAll('.hoko-tab-btn').forEach(btn => {
            btn.classList.remove('hoko-tab-active');
        });
        const activeBtn = document.getElementById(`hoko_btn-${tabId}`);
        if (activeBtn) activeBtn.classList.add('hoko-tab-active');
    }

    function renderAllTabs() {
        renderDetailedTableTab();
        renderWarehousesTab();
        renderCategoriesTab();
        renderAlertsTab();
        renderRawExplorerTab();
    }

    // PESTAÑA 1: TABLA DETALLADA
    function renderDetailedTableTab() {
        const tbody = document.getElementById('hoko_inventoryTableBody');
        if (!tbody) return;
        const total = filteredInventory.length;
        if (total === 0) {
            tbody.innerHTML = `<tr><td colspan="11" class="hoko-empty-state"><div class="hoko-empty-icon">📦</div><p class="hoko-empty-title">Sin referencias con los filtros actuales</p><p class="hoko-empty-sub">Prueba ajustando o limpiando los filtros.</p></td></tr>`;
            setText('hoko_paginationRangeText', '0 resultados');
            const pc = document.getElementById('hoko_paginationControls');
            if (pc) pc.innerHTML = '';
            return;
        }
        const totalPages = Math.ceil(total / pageSize);
        if (currentPage > totalPages) currentPage = totalPages;
        const startIdx = (currentPage - 1) * pageSize;
        const endIdx   = Math.min(startIdx + pageSize, total);
        const pageItems = filteredInventory.slice(startIdx, endIdx);
        const maxStock  = Math.max(...normalizedInventory.map(i => i.stock), 50);

        tbody.innerHTML = pageItems.map(item => {
            let hBadge = '', barColor = '';
            if (item.health === 'OPTIMAL') {
                hBadge   = `<span class="hoko-badge-health hoko-health-ok"><span class="hoko-dot hoko-dot-ok"></span>Óptimo</span>`;
                barColor = '#10b981';
            } else if (item.health === 'LOW') {
                hBadge   = `<span class="hoko-badge-health hoko-health-low"><span class="hoko-dot hoko-dot-low"></span>Stock Bajo</span>`;
                barColor = '#f59e0b';
            } else {
                hBadge   = `<span class="hoko-badge-health hoko-health-out"><span class="hoko-dot hoko-dot-out hoko-dot-pulse"></span>Agotado</span>`;
                barColor = '#ef4444';
            }
            const stockPct = Math.min(100, Math.round((item.stock / maxStock) * 100));
            return `<tr class="hoko-tr-hover">
                <td class="hoko-td"><div class="hoko-sku">${escapeHtml(item.sku)}</div><div class="hoko-id-sub">ID: ${escapeHtml(item.id)}</div></td>
                <td class="hoko-td"><div class="hoko-name">${escapeHtml(item.name)}</div><div class="hoko-meta"><span class="hoko-cat-pill">${escapeHtml(item.category)}</span> <span class="hoko-status-dot ${item.status.toLowerCase() === 'activo' ? 'hoko-active' : 'hoko-inactive'}">● ${escapeHtml(item.status)}</span></div></td>
                <td class="hoko-td"><button onclick="HokoInventory.filterByWarehouseQuick('${escapeJs(item.warehouse)}')" class="hoko-wh-btn"><span>📍 ${escapeHtml(item.warehouse)}</span></button></td>
                <td class="hoko-td hoko-center">${hBadge}</td>
                <td class="hoko-td hoko-right"><div class="hoko-stock-val">${item.stock.toLocaleString('es-CO')} <span class="hoko-unit">u.</span></div><div class="hoko-bar-wrap"><div class="hoko-bar-fill" style="width:${stockPct}%;background:${barColor}"></div></div></td>
                <td class="hoko-td hoko-right">${item.transit > 0 ? `<span class="hoko-transit-badge">🚚 +${item.transit}</span>` : '<span class="hoko-dash">—</span>'}</td>
                <td class="hoko-td hoko-right hoko-cost">${formatCurrency(item.cost)}</td>
                <td class="hoko-td hoko-right hoko-price">${formatCurrency(item.price)}</td>
                <td class="hoko-td hoko-right"><span class="hoko-margin ${item.marginPercent >= 35 ? 'hoko-margin-good' : ''}">${item.marginPercent.toFixed(1)}%</span></td>
                <td class="hoko-td hoko-right hoko-total-val">${formatCurrency(item.totalCostValue)}</td>
                <td class="hoko-td hoko-center"><button onclick="HokoInventory.openEditProductModal(${item._rowIndex})" class="hoko-edit-btn" title="Editar">✏️</button></td>
            </tr>`;
        }).join('');

        setText('hoko_paginationRangeText', `Mostrando ${startIdx + 1} - ${endIdx} de ${total}`);
        renderPaginationButtons(totalPages);
    }

    function renderPaginationButtons(totalPages) {
        const container = document.getElementById('hoko_paginationControls');
        if (!container) return;
        if (totalPages <= 1) { container.innerHTML = ''; return; }
        let html = `<button onclick="HokoInventory.goToPage(${currentPage - 1})" ${currentPage === 1 ? 'disabled' : ''} class="hoko-pg-btn">‹</button>`;
        for (let p = 1; p <= totalPages; p++) {
            if (p === 1 || p === totalPages || Math.abs(p - currentPage) <= 1) {
                html += `<button onclick="HokoInventory.goToPage(${p})" class="hoko-pg-btn ${p === currentPage ? 'hoko-pg-active' : ''}">${p}</button>`;
            } else if (Math.abs(p - currentPage) === 2) {
                html += `<span class="hoko-pg-ellipsis">…</span>`;
            }
        }
        html += `<button onclick="HokoInventory.goToPage(${currentPage + 1})" ${currentPage === totalPages ? 'disabled' : ''} class="hoko-pg-btn">›</button>`;
        container.innerHTML = html;
    }

    function goToPage(page) { currentPage = page; renderDetailedTableTab(); }
    function changePageSize(size) { pageSize = parseInt(size, 10) || 15; currentPage = 1; renderDetailedTableTab(); }

    // PESTAÑA 2: BODEGAS
    function renderWarehousesTab() {
        const grid = document.getElementById('hoko_warehousesGrid');
        if (!grid) return;
        const totalUnitsAll = filteredInventory.reduce((a, i) => a + i.stock, 0) || 1;
        const totalCostAll  = filteredInventory.reduce((a, i) => a + i.totalCostValue, 0) || 1;
        const map = {};
        filteredInventory.forEach(item => {
            if (!map[item.warehouse]) map[item.warehouse] = { name: item.warehouse, skus: 0, units: 0, transit: 0, costValue: 0, saleValue: 0, optimal: 0, low: 0, out: 0 };
            const g = map[item.warehouse];
            g.skus++; g.units += item.stock; g.transit += item.transit;
            g.costValue += item.totalCostValue; g.saleValue += item.totalSaleValue;
            if (item.health === 'OPTIMAL') g.optimal++;
            else if (item.health === 'LOW') g.low++;
            else g.out++;
        });
        const warehouses = Object.values(map).sort((a, b) => b.costValue - a.costValue);
        if (warehouses.length === 0) { grid.innerHTML = '<div class="hoko-empty-card">No hay bodegas para mostrar.</div>'; return; }
        grid.innerHTML = warehouses.map(w => {
            const shareU = ((w.units / totalUnitsAll) * 100).toFixed(1);
            const shareV = ((w.costValue / totalCostAll) * 100).toFixed(1);
            return `<div class="hoko-wh-card">
                <div class="hoko-wh-card-header">
                    <div class="hoko-wh-icon">🏭</div>
                    <div><h4 class="hoko-wh-name">${escapeHtml(w.name)}</h4><span class="hoko-wh-sub">${w.skus} referencias</span></div>
                    <span class="hoko-wh-badge">${shareV}% del valor</span>
                </div>
                <div class="hoko-wh-bar-section">
                    <div class="hoko-wh-bar-label"><span>Participación unidades</span><span>${w.units.toLocaleString('es-CO')} u. (${shareU}%)</span></div>
                    <div class="hoko-bar-track"><div class="hoko-bar-fill hoko-bar-indigo" style="width:${Math.min(100, parseFloat(shareU))}%"></div></div>
                </div>
                <div class="hoko-wh-metrics">
                    <div class="hoko-metric-item"><span class="hoko-metric-label">Costo en Bodega</span><span class="hoko-metric-val">${formatCurrency(w.costValue)}</span></div>
                    <div class="hoko-metric-item hoko-metric-green"><span class="hoko-metric-label">Venta Proyectada</span><span class="hoko-metric-val">${formatCurrency(w.saleValue)}</span></div>
                </div>
                <div class="hoko-wh-semaphore">
                    <span class="hoko-sem-pill hoko-sem-ok">🟢 ${w.optimal}</span>
                    <span class="hoko-sem-pill hoko-sem-low">🟡 ${w.low}</span>
                    <span class="hoko-sem-pill hoko-sem-out">🔴 ${w.out}</span>
                    <span class="hoko-sem-pill hoko-sem-tr">🚚 ${w.transit}</span>
                </div>
                <button onclick="HokoInventory.filterByWarehouseQuick('${escapeJs(w.name)}')" class="hoko-wh-filter-btn">Ver en tabla →</button>
            </div>`;
        }).join('');
    }

    // PESTAÑA 3: CATEGORÍAS
    function renderCategoriesTab() {
        const grid = document.getElementById('hoko_categoriesGrid');
        if (!grid) return;
        const totalCostAll = filteredInventory.reduce((a, i) => a + i.totalCostValue, 0) || 1;
        const map = {};
        filteredInventory.forEach(item => {
            if (!map[item.category]) map[item.category] = { name: item.category, skus: 0, units: 0, transit: 0, costValue: 0, saleValue: 0 };
            const c = map[item.category];
            c.skus++; c.units += item.stock; c.transit += item.transit;
            c.costValue += item.totalCostValue; c.saleValue += item.totalSaleValue;
        });
        const categories = Object.values(map).sort((a, b) => b.costValue - a.costValue);
        if (categories.length === 0) { grid.innerHTML = '<div class="hoko-empty-card">No hay categorías para mostrar.</div>'; return; }
        grid.innerHTML = categories.map(c => {
            const margin     = c.saleValue > 0 ? ((c.saleValue - c.costValue) / c.saleValue) * 100 : 0;
            const capitalPct = ((c.costValue / totalCostAll) * 100).toFixed(1);
            const profit     = c.saleValue - c.costValue;
            return `<div class="hoko-cat-card">
                <div class="hoko-cat-header">
                    <div class="hoko-cat-icon">🏷️</div>
                    <div><h4 class="hoko-cat-name">${escapeHtml(c.name)}</h4><span class="hoko-cat-sub">${c.skus} SKUs · ${c.units.toLocaleString('es-CO')} unidades</span></div>
                    <span class="hoko-cat-margin">Margen ${margin.toFixed(1)}%</span>
                </div>
                <div class="hoko-cat-metrics">
                    <div><span class="hoko-metric-label">Capital Invertido</span><div class="hoko-metric-big">${formatCurrency(c.costValue)}</div><span class="hoko-metric-sub">${capitalPct}% del inventario</span></div>
                    <div><span class="hoko-metric-label">Utilidad Proyectada</span><div class="hoko-metric-big hoko-text-green">+${formatCurrency(profit)}</div><span class="hoko-metric-sub">Venta: ${formatCurrency(c.saleValue)}</span></div>
                </div>
                <button onclick="HokoInventory.filterByCategoryQuick('${escapeJs(c.name)}')" class="hoko-cat-filter-btn">Ver productos de ${escapeHtml(c.name)} →</button>
            </div>`;
        }).join('');
    }

    // PESTAÑA 4: ALERTAS
    function renderAlertsTab() {
        const targetStock = Math.max(1, parseInt(document.getElementById('hoko_targetStockInput')?.value || '25', 10));
        const tbody = document.getElementById('hoko_alertsTableBody');
        if (!tbody) return;
        const criticalItems = filteredInventory.filter(i => i.health === 'OUT' || i.health === 'LOW').sort((a, b) => a.stock - b.stock);
        let totalSug = 0, totalBudget = 0;
        criticalItems.forEach(item => {
            const sug = Math.max(0, targetStock - (item.stock + item.transit));
            totalSug += sug; totalBudget += sug * item.cost;
        });
        setText('hoko_alertTotalSkus',       `${criticalItems.length} SKUs`);
        setText('hoko_alertSuggestedUnits',  `${totalSug.toLocaleString('es-CO')} und`);
        setText('hoko_alertEstimatedBudget', formatCurrency(totalBudget));
        if (criticalItems.length === 0) {
            tbody.innerHTML = `<tr><td colspan="9" class="hoko-empty-state">✅ <strong>¡Excelente!</strong> No hay productos agotados ni con stock bajo en esta vista.</td></tr>`;
            return;
        }
        tbody.innerHTML = criticalItems.map(item => {
            const sug = Math.max(0, targetStock - (item.stock + item.transit));
            const pBadge = item.stock === 0
                ? `<span class="hoko-priority-urgent">🔥 URGENTE</span>`
                : `<span class="hoko-priority-low">⏳ Pronto Reabastecer</span>`;
            return `<tr class="hoko-alert-row">
                <td class="hoko-td">${pBadge}</td>
                <td class="hoko-td"><div class="hoko-sku">${escapeHtml(item.sku)}</div><div class="hoko-id-sub">${escapeHtml(item.id)}</div></td>
                <td class="hoko-td"><div class="hoko-name">${escapeHtml(item.name)}</div><div class="hoko-id-sub">${escapeHtml(item.category)}</div></td>
                <td class="hoko-td hoko-wh-name-cell">${escapeHtml(item.warehouse)}</td>
                <td class="hoko-td hoko-right ${item.stock === 0 ? 'hoko-text-danger' : 'hoko-text-warn'}">${item.stock} u.</td>
                <td class="hoko-td hoko-right hoko-text-info">${item.transit} u.</td>
                <td class="hoko-td hoko-right"><span class="hoko-sug-badge">+${sug} u.</span></td>
                <td class="hoko-td hoko-right">${formatCurrency(item.cost)}</td>
                <td class="hoko-td hoko-right hoko-total-val">${formatCurrency(sug * item.cost)}</td>
            </tr>`;
        }).join('');
    }

    // PESTAÑA 5: EXPLORADOR RAW
    function renderRawExplorerTab() {
        const toggleContainer = document.getElementById('hoko_rawColumnsToggleList');
        const thead           = document.getElementById('hoko_rawTableHead');
        const tbody           = document.getElementById('hoko_rawTableBody');
        if (!rawHeaders || rawHeaders.length === 0 || !thead || !tbody) return;
        if (toggleContainer) {
            toggleContainer.innerHTML = '<span class="hoko-cols-label">Columnas:</span>' +
                rawHeaders.map(h => {
                    const vis = visibleRawColumns.has(h);
                    return `<button onclick="HokoInventory.toggleRawColumn('${escapeJs(h)}')" class="hoko-col-toggle ${vis ? 'hoko-col-toggle-active' : ''}">${escapeHtml(h)}</button>`;
                }).join('');
        }
        const activeCols = rawHeaders.filter(h => visibleRawColumns.has(h));
        thead.innerHTML  = `<tr><th class="hoko-raw-th">#</th>${activeCols.map(h => `<th class="hoko-raw-th">${escapeHtml(h)}</th>`).join('')}</tr>`;
        const colFilter  = document.getElementById('hoko_rawColumnFilterSelect')?.value || 'ALL';
        const rawQuery   = (document.getElementById('hoko_rawSearchInput')?.value || '').trim().toLowerCase();
        const rows = filteredInventory.filter(item => {
            if (!rawQuery) return true;
            if (colFilter === 'ALL') return rawHeaders.some(h => String(item.raw[h] ?? '').toLowerCase().includes(rawQuery));
            return String(item.raw[colFilter] ?? '').toLowerCase().includes(rawQuery);
        });
        if (rows.length === 0) { tbody.innerHTML = `<tr><td colspan="${activeCols.length + 1}" class="hoko-empty-state">Sin coincidencias.</td></tr>`; return; }
        tbody.innerHTML = rows.slice(0, 200).map((item, idx) =>
            `<tr class="hoko-raw-row"><td class="hoko-raw-num">${idx + 1}</td>${activeCols.map(h => `<td class="hoko-raw-cell">${escapeHtml(String(item.raw[h] ?? ''))}</td>`).join('')}</tr>`
        ).join('');
    }

    function toggleRawColumn(colName) {
        if (visibleRawColumns.has(colName)) { if (visibleRawColumns.size > 1) visibleRawColumns.delete(colName); }
        else visibleRawColumns.add(colName);
        renderRawExplorerTab();
    }

    // ==========================================
    // 9. MODAL MAPEADOR DE COLUMNAS
    // ==========================================
    function openColumnMapperModal() {
        const container = document.getElementById('hoko_mapperFieldsContainer');
        if (!container) return;
        container.innerHTML = FIELD_DEFINITIONS.map(field => {
            const cur  = columnMapping[field.key] || '';
            const opts = `<option value="">-- Automático --</option>` +
                rawHeaders.map(h => `<option value="${escapeHtml(h)}" ${h === cur ? 'selected' : ''}>${escapeHtml(h)}</option>`).join('');
            return `<div class="hoko-mapper-field"><label class="hoko-mapper-label">${escapeHtml(field.label)}</label><select data-field-key="${field.key}" class="hoko-mapper-select hoko-mapper-sel-item">${opts}</select></div>`;
        }).join('');
        showModal('hoko_columnMapperModal');
    }

    function closeColumnMapperModal() { hideModal('hoko_columnMapperModal'); }

    function applyCustomColumnMapping() {
        document.querySelectorAll('.hoko-mapper-sel-item').forEach(sel => {
            columnMapping[sel.getAttribute('data-field-key')] = sel.value;
        });
        normalizeDataFromRaw();
        populateDynamicDropdowns();
        applyFilters();
        closeColumnMapperModal();
        showToast('Mapeo de columnas actualizado.', 'success');
    }

    // ==========================================
    // 10. MODAL EDICIÓN / CREACIÓN
    // ==========================================
    function openNewProductModal() {
        setText('hoko_productModalTitle', 'Agregar Nueva Referencia al Inventario');
        setVal('hoko_editRowIndex', '-1');
        setVal('hoko_formHokoId', `HK-${Math.floor(10000 + Math.random() * 90000)}`);
        ['hoko_formSku','hoko_formName'].forEach(id => setVal(id, ''));
        setVal('hoko_formCategory', 'Tecnología y Audio');
        setVal('hoko_formWarehouse', 'Bogotá D.C. - Central');
        setVal('hoko_formStock', '25');
        setVal('hoko_formTransit', '0');
        setVal('hoko_formCost', '35000');
        setVal('hoko_formPrice', '89900');
        setVal('hoko_formStatus', 'Activo');
        showModal('hoko_productModal');
    }

    function openEditProductModal(rowIndex) {
        const item = normalizedInventory.find(i => i._rowIndex === rowIndex);
        if (!item) return;
        setText('hoko_productModalTitle', `Editar: ${item.sku}`);
        setVal('hoko_editRowIndex', String(rowIndex));
        setVal('hoko_formHokoId',   item.id);
        setVal('hoko_formSku',      item.sku);
        setVal('hoko_formName',     item.name);
        setVal('hoko_formCategory', item.category);
        setVal('hoko_formWarehouse',item.warehouse);
        setVal('hoko_formStock',    item.stock);
        setVal('hoko_formTransit',  item.transit);
        setVal('hoko_formCost',     item.cost);
        setVal('hoko_formPrice',    item.price);
        setVal('hoko_formStatus',   item.status);
        showModal('hoko_productModal');
    }

    function closeProductModal() { hideModal('hoko_productModal'); }

    function saveProductForm(e) {
        e.preventDefault();
        const rowIndex = parseInt(document.getElementById('hoko_editRowIndex').value, 10);
        const u = {
            id:        document.getElementById('hoko_formHokoId').value.trim(),
            sku:       document.getElementById('hoko_formSku').value.trim(),
            name:      document.getElementById('hoko_formName').value.trim(),
            category:  document.getElementById('hoko_formCategory').value.trim(),
            warehouse: document.getElementById('hoko_formWarehouse').value.trim(),
            stock:     parseInt(document.getElementById('hoko_formStock').value, 10) || 0,
            transit:   parseInt(document.getElementById('hoko_formTransit').value, 10) || 0,
            cost:      parseFloat(document.getElementById('hoko_formCost').value) || 0,
            price:     parseFloat(document.getElementById('hoko_formPrice').value) || 0,
            status:    document.getElementById('hoko_formStatus').value
        };
        if (rowIndex >= 0 && rawRows[rowIndex]) {
            FIELD_DEFINITIONS.forEach(f => {
                const col = columnMapping[f.key] || f.label;
                if (!rawHeaders.includes(col)) rawHeaders.push(col);
                rawRows[rowIndex][col] = u[f.key];
            });
            showToast(`Referencia ${u.sku} actualizada.`, 'success');
        } else {
            const newRow = {};
            FIELD_DEFINITIONS.forEach(f => {
                const col = columnMapping[f.key] || f.label;
                if (!rawHeaders.includes(col)) { rawHeaders.push(col); visibleRawColumns.add(col); columnMapping[f.key] = col; }
                newRow[col] = u[f.key];
            });
            rawRows.unshift(newRow);
            showToast(`Referencia ${u.sku} agregada.`, 'success');
        }
        normalizeDataFromRaw();
        populateDynamicDropdowns();
        applyFilters();
        closeProductModal();
    }

    // ==========================================
    // 11. EXPORTACIÓN A EXCEL
    // ==========================================
    function exportFilteredToExcel() {
        if (filteredInventory.length === 0) { showToast('No hay registros para exportar.', 'warning'); return; }
        const data = filteredInventory.map(item => ({
            "ID Hoko": item.id, "SKU": item.sku, "Producto": item.name,
            "Categoría": item.category, "Bodega": item.warehouse,
            "Salud": item.health === 'OPTIMAL' ? 'Óptimo' : (item.health === 'LOW' ? 'Stock Bajo' : 'Agotado'),
            "Stock Disponible": item.stock, "En Tránsito": item.transit,
            "Costo Unit.": item.cost, "Precio Venta": item.price,
            "Margen (%)": +item.marginPercent.toFixed(2),
            "Costo Total Bodega": item.totalCostValue, "Venta Total Proy.": item.totalSaleValue,
            "Estado": item.status
        }));
        const ws = XLSX.utils.json_to_sheet(data);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Inventario Hoko');
        XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(filteredInventory.map(i => i.raw)), 'Datos Originales');
        XLSX.writeFile(wb, `Inventario_Hoko_${new Date().toISOString().slice(0, 10)}.xlsx`);
        showToast(`Exportados ${filteredInventory.length} productos.`, 'success');
    }

    function exportRestockOrderToExcel() {
        const targetStock = Math.max(1, parseInt(document.getElementById('hoko_targetStockInput')?.value || '25', 10));
        const items = filteredInventory.filter(i => i.health === 'OUT' || i.health === 'LOW').sort((a, b) => a.stock - b.stock);
        if (items.length === 0) { showToast('No hay referencias críticas.', 'warning'); return; }
        const rows = items.map(item => {
            const sug = Math.max(0, targetStock - (item.stock + item.transit));
            return { "Prioridad": item.stock === 0 ? 'URGENTE' : 'STOCK BAJO', "ID Hoko": item.id, "SKU": item.sku, "Producto": item.name, "Categoría": item.category, "Bodega": item.warehouse, "Stock Actual": item.stock, "En Tránsito": item.transit, "Meta Stock": targetStock, "A Pedir": sug, "Costo Unit.": item.cost, "Subtotal": sug * item.cost };
        });
        const ws = XLSX.utils.json_to_sheet(rows);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Orden Reposición');
        XLSX.writeFile(wb, `Orden_Reposicion_Hoko_${new Date().toISOString().slice(0, 10)}.xlsx`);
        showToast('Orden de compra descargada.', 'success');
    }

    function downloadTemplateExcel() {
        const ws = XLSX.utils.json_to_sheet(DEMO_DATA.slice(0, 8));
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Reporte Hoko');
        XLSX.writeFile(wb, 'Plantilla_Reporte_Inventario_Hoko.xlsx');
        showToast('Plantilla descargada.', 'info');
    }

    // ==========================================
    // 12. RESTAURAR DEMO / LIMPIAR
    // ==========================================
    function restoreDemoData(notify = true) {
        rawRows           = JSON.parse(JSON.stringify(DEMO_DATA));
        rawHeaders        = Object.keys(rawRows[0]);
        visibleRawColumns = new Set(rawHeaders);
        autoDetectColumnMapping(rawHeaders);
        normalizeDataFromRaw();
        populateDynamicDropdowns();
        resetAllFiltersSilent();
        const badge = document.getElementById('hoko_dataSourceBadge');
        if (badge) {
            badge.className = 'hoko-badge hoko-badge-demo';
            badge.innerHTML = '<span class="hoko-dot hoko-dot-pulse hoko-dot-indigo"></span> Datos Demo';
        }
        const fi = document.getElementById('hoko_fileInfoText');
        if (fi) fi.classList.add('hidden');
        const sc = document.getElementById('hoko_sheetSelectorContainer');
        if (sc) sc.classList.add('hidden');
        const fInput = document.getElementById('hoko_fileInput');
        if (fInput) fInput.value = '';
        if (notify) showToast('Datos de demostración restaurados.', 'info');
    }

    function clearAllInventory() {
        rawRows = []; normalizedInventory = []; filteredInventory = [];
        populateDynamicDropdowns();
        applyFilters();
        const badge = document.getElementById('hoko_dataSourceBadge');
        if (badge) { badge.className = 'hoko-badge hoko-badge-empty'; badge.textContent = 'Inventario Vacío'; }
        showToast('Tabla vaciada. Sube tu archivo Excel/CSV.', 'warning');
    }

    function resetAllFiltersSilent() {
        ['hoko_filterSearch','hoko_filterMinStock','hoko_filterMaxStock'].forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
        ['hoko_filterWarehouse','hoko_filterCategory','hoko_filterHealth','hoko_filterStatus'].forEach(id => { const el = document.getElementById(id); if (el) el.value = 'ALL'; });
        const se = document.getElementById('hoko_filterSort'); if (se) se.value = 'STOCK_DESC';
        applyFilters();
    }

    function toggleUploadZone() {
        const sec = document.getElementById('hoko_uploadSection');
        if (sec) sec.classList.toggle('hidden');
    }

    // ==========================================
    // 13. UTILIDADES
    // ==========================================
    function formatCurrency(val) {
        return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(val || 0);
    }
    function escapeHtml(str) {
        return String(str ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#039;');
    }
    function escapeJs(str) { return String(str ?? '').replace(/\\/g, '\\\\').replace(/'/g, "\\'"); }
    function setText(id, val) { const el = document.getElementById(id); if (el) el.textContent = val; }
    function setVal(id, val) { const el = document.getElementById(id); if (el) el.value = val; }
    function showModal(id) { const m = document.getElementById(id); if (m) { m.classList.remove('hidden'); m.classList.add('hoko-modal-open'); } }
    function hideModal(id) { const m = document.getElementById(id); if (m) { m.classList.add('hidden'); m.classList.remove('hoko-modal-open'); } }

    function showToast(message, type = 'info') {
        // Usa el sistema de toasts del panel principal si existe, sino crea uno propio
        if (window.showNotification) { window.showNotification(message, type); return; }
        const container = document.getElementById('toastContainer') || document.getElementById('hoko_toastContainer');
        if (!container) return;
        const toast = document.createElement('div');
        const styles = { success: 'hoko-toast-success', error: 'hoko-toast-error', warning: 'hoko-toast-warning', info: 'hoko-toast-info' };
        toast.className = `hoko-toast ${styles[type] || styles.info}`;
        toast.innerHTML = `<span>${escapeHtml(message)}</span><button onclick="this.parentElement.remove()">✕</button>`;
        container.appendChild(toast);
        setTimeout(() => { toast.style.opacity = '0'; setTimeout(() => toast.remove(), 300); }, 4000);
    }

    // ==========================================
    // API PÚBLICA
    // ==========================================
    return {
        init,
        handleFileSelect,
        handleSheetChange,
        toggleUploadZone,
        applyFilters,
        setHealthFilter,
        filterByWarehouseQuick,
        filterByCategoryQuick,
        resetAllFilters,
        switchTab,
        goToPage,
        changePageSize,
        openColumnMapperModal,
        closeColumnMapperModal,
        applyCustomColumnMapping,
        openNewProductModal,
        openEditProductModal,
        closeProductModal,
        saveProductForm,
        exportFilteredToExcel,
        exportRestockOrderToExcel,
        downloadTemplateExcel,
        restoreDemoData,
        clearAllInventory,
        toggleRawColumn,
        renderAlertsTab,
        renderRawExplorerTab
    };
})();
