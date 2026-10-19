/* ========================================
   Calculadora de Liquidaciones y Precios
   Módulo Avanzado Multicanal (COD & Marketplace)
   Con Soporte para Costeo en Dólares (USD) y Moneda Local (COP)
   ======================================== */

const CalculatorModule = (() => {
    // Estado interno del módulo
    let currentChannel = 'cod'; // 'cod' | 'marketplace'
    let pricingMode = 'fixed_price'; // 'fixed_price' (por defecto: colocar precio de venta) | 'target_margin'
    let currentCurrency = 'COP'; // 'COP' | 'USD'
    let exchangeRate = 4000; // Tasa de cambio (TRM)
    let currentLiquidationId = null;
    let savedLiquidations = [];
    let productsCatalog = [];
    let initialized = false;

    // Costos landed dinámicos: el usuario puede quitar los estándar y añadir los suyos
    let extraCosts = [];      // [{ id, label, amount, scope: 'batch'|'unit' }]
    let hiddenCosts = [];     // claves de STANDARD_COSTS ocultadas por el usuario
    let extraSeq = 0;

    // Ofertas / Combos multi-unidad: un solo envío y un solo CPA por pedido
    let offers = [];           // [{ id, units, price }]
    let offersSeq = 0;
    let offersPackOnce = true; // el empaque/picking se cobra una sola vez por pedido

    // Costos estándar que se pueden quitar/restaurar (el costo de compra siempre permanece)
    const STANDARD_COSTS = {
        shipping_main:  { input: 'calcCostShippingMain',  label: 'Flete Principal / Int.' },
        customs:        { input: 'calcCostCustoms',       label: 'Arancel / Aduana' },
        shipping_local: { input: 'calcCostShippingLocal', label: 'Acarreo / Flete Local' },
        packaging:      { input: 'calcCostPackaging',     label: 'Empaque y Embalaje' },
        fulfillment:    { input: 'calcCostFulfillment',   label: 'Picking & Bodegaje' },
        other:          { input: 'calcCostOther',         label: 'Otros Gastos Directos' }
    };

    // Presets de Marketplace
    const MP_PRESETS = {
        'ml_clasica': { fee: 14.0, fixed: 2000, shipping: 0, tax: 1.5, ads: 0 },
        'ml_premium': { fee: 18.5, fixed: 2000, shipping: 0, tax: 1.5, ads: 0 },
        'amazon': { fee: 15.0, fixed: 0, shipping: 0, tax: 2.0, ads: 0 },
        'falabella': { fee: 15.0, fixed: 1500, shipping: 0, tax: 1.5, ads: 0 },
        'custom': null
    };

    /**
     * Formateador de moneda adaptable (USD o COP)
     */
    function formatMoney(amount, currency = currentCurrency) {
        const val = isNaN(amount) ? 0 : amount;
        if (currency === 'USD') {
            return new Intl.NumberFormat('en-US', {
                style: 'currency',
                currency: 'USD',
                minimumFractionDigits: 2,
                maximumFractionDigits: 2
            }).format(val);
        } else {
            return new Intl.NumberFormat('es-CO', {
                style: 'currency',
                currency: 'COP',
                maximumFractionDigits: 0
            }).format(val);
        }
    }

    /**
     * Inicializar módulo
     */
    async function init() {
        console.log('Iniciando CalculatorModule avanzado con costeo multimoneda...');
        bindEvents();
        await loadProductsCatalog();
        await loadSavedLiquidations();
        applyHiddenCosts();
        renderExtraCosts();
        if (!offers.length) offers = defaultOffers();
        updateCurrencyUI();
        switchPricingMode(pricingMode);
        calculate();
        initialized = true;
    }

    /**
     * Vincular eventos del DOM
     */
    function bindEvents() {
        if (initialized) return;

        // Pestañas principales (Calculadora vs Guardadas)
        const tabBtnActive = document.getElementById('calcTabBtnActive');
        const tabBtnSaved = document.getElementById('calcTabBtnSaved');
        if (tabBtnActive) tabBtnActive.addEventListener('click', () => switchMainTab('active'));
        if (tabBtnSaved) tabBtnSaved.addEventListener('click', () => switchMainTab('saved'));

        // Botones de acción del header
        const btnNew = document.getElementById('btnCalcNew');
        if (btnNew) btnNew.addEventListener('click', resetCalculator);

        const btnSave = document.getElementById('btnCalcSave');
        if (btnSave) btnSave.addEventListener('click', saveCurrentLiquidation);

        const btnSaveBottom = document.getElementById('btnCalcSaveBottom');
        if (btnSaveBottom) btnSaveBottom.addEventListener('click', saveCurrentLiquidation);

        // Selector de catálogo de productos
        const selectProduct = document.getElementById('calcProductSelect');
        if (selectProduct) {
            selectProduct.addEventListener('change', handleProductSelect);
        }

        // Selector de moneda (COP vs USD)
        const selectCurrency = document.getElementById('calcCurrency');
        if (selectCurrency) {
            selectCurrency.addEventListener('change', (e) => switchCurrency(e.target.value));
        }

        // Tasa de cambio (TRM)
        const inputRate = document.getElementById('calcExchangeRate');
        if (inputRate) {
            inputRate.addEventListener('input', () => {
                const trm = Math.max(1, getNum('calcExchangeRate', 4000));
                exchangeRate = trm;
                updateTrmBadge();
                calculate();
            });
        }

        // Cerrar modal de detalles con tecla Escape
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                closeLiquidationDetail();
            }
        });

        // Modo de costeo (unit vs batch)
        const costMode = document.getElementById('calcCostMode');
        if (costMode) {
            costMode.addEventListener('change', () => {
                const batchGroup = document.getElementById('calcBatchGroup');
                if (batchGroup) {
                    batchGroup.style.display = costMode.value === 'batch' ? 'block' : 'none';
                }
                updateCostLabels(costMode.value === 'batch');
                calculate();
            });
        }

        // Tabs de canal (COD vs Marketplace)
        const tabCod = document.getElementById('tabChannelCod');
        const tabMp = document.getElementById('tabChannelMarketplace');
        if (tabCod) tabCod.addEventListener('click', () => switchChannel('cod'));
        if (tabMp) tabMp.addEventListener('click', () => switchChannel('marketplace'));

        // Preset de Marketplace
        const mpPreset = document.getElementById('calcMpPreset');
        if (mpPreset) {
            mpPreset.addEventListener('change', () => {
                const preset = MP_PRESETS[mpPreset.value];
                if (preset) {
                    setVal('calcMpFeePercent', preset.fee);
                    // Ajustar cargo fijo según moneda
                    const fixedVal = currentCurrency === 'USD' ? (preset.fixed / exchangeRate).toFixed(2) : preset.fixed;
                    setVal('calcMpFixedFee', fixedVal);
                    setVal('calcMpShipping', 0);
                    setVal('calcMpTaxPercent', preset.tax);
                    setVal('calcMpAdsPercent', preset.ads);
                    calculate();
                }
            });
        }

        // Toggle de modo de fijación de precio
        const btnTargetMargin = document.getElementById('btnModeTargetMargin');
        const btnFixedPrice = document.getElementById('btnModeFixedPrice');
        if (btnTargetMargin) btnTargetMargin.addEventListener('click', () => switchPricingMode('target_margin'));
        if (btnFixedPrice) btnFixedPrice.addEventListener('click', () => switchPricingMode('fixed_price'));

        // Tipo de margen objetivo
        const marginTypeSelect = document.getElementById('calcTargetMarginType');
        if (marginTypeSelect) {
            marginTypeSelect.addEventListener('change', () => {
                const label = document.getElementById('labelTargetMarginValue');
                const val = marginTypeSelect.value;
                if (label) {
                    if (val === 'margin_percent') label.textContent = '% Margen Neto sobre Venta';
                    else if (val === 'markup_percent') label.textContent = '% Markup sobre Costo Landed';
                    else label.textContent = `Ganancia Neta Deseada ($ ${currentCurrency})`;
                }
                calculate();
            });
        }

        // Escuchar cambios en todos los inputs numéricos y de texto para cálculo en tiempo real
        const allInputIds = [
            'calcProductName', 'calcProductSku', 'calcBatchUnits',
            'calcCostPurchase', 'calcCostShippingMain', 'calcCostCustoms',
            'calcCostShippingLocal', 'calcCostPackaging', 'calcCostFulfillment', 'calcCostOther',
            'calcCpa', 'calcCancelacion', 'calcDevolucion', 'calcFlete', 'calcFleteRetorno', 'calcRecaudoPercent', 'calcAdmin',
            'calcMpFeePercent', 'calcMpFixedFee', 'calcMpShipping', 'calcMpTaxPercent', 'calcMpAdsPercent',
            'calcTargetMarginValue', 'calcVenta', 'calcBatchUnitsResult'
        ];

        allInputIds.forEach(id => {
            const el = document.getElementById(id);
            if (el) {
                el.addEventListener('input', Utils.debounce(calculate, 80));
            }
        });

        // Sincronizar unidades del lote entre quickbar y tarjeta de proyección
        const inputBatchQuick = document.getElementById('calcBatchUnits');
        const inputBatchResult = document.getElementById('calcBatchUnitsResult');
        if (inputBatchQuick && inputBatchResult) {
            inputBatchQuick.addEventListener('input', () => {
                inputBatchResult.value = inputBatchQuick.value;
                calculate();
            });
            inputBatchResult.addEventListener('input', () => {
                inputBatchQuick.value = inputBatchResult.value;
                calculate();
            });
        }

        // Costos landed dinámicos (quitar / añadir líneas de costo)
        bindLandedCostEvents();

        // Ofertas / combos multi-unidad
        bindOfferEvents();

        // Búsqueda y filtros de liquidaciones guardadas
        const searchSaved = document.getElementById('searchSavedLiquidations');
        if (searchSaved) {
            searchSaved.addEventListener('input', Utils.debounce(renderSavedTable, 200));
        }
        const filterChannel = document.getElementById('filterSavedChannel');
        if (filterChannel) {
            filterChannel.addEventListener('change', renderSavedTable);
        }
    }

    /**
     * Aplica los valores ingresados en el Asistente en Dólares (USD)
     */
    function applyUsdHelper() {
        const usdPurchase = getNum('calcUsdHelperPurchase', 0);
        const usdShipping = getNum('calcUsdHelperShipping', 0);
        const usdCustoms = getNum('calcUsdHelperCustoms', 0);

        if (usdPurchase <= 0 && usdShipping <= 0 && usdCustoms <= 0) {
            Utils.showToast('Ingresa al menos un costo en USD para convertir', 'warning');
            return;
        }

        const rate = Math.max(1, getNum('calcExchangeRate', exchangeRate));

        if (currentCurrency === 'COP') {
            // Convertir de USD a COP
            if (usdPurchase > 0) setVal('calcCostPurchase', Math.round(usdPurchase * rate));
            if (usdShipping > 0) setVal('calcCostShippingMain', Math.round(usdShipping * rate));
            if (usdCustoms > 0) setVal('calcCostCustoms', Math.round(usdCustoms * rate));
            Utils.showToast(`Costos en USD convertidos a COP (TRM ${formatMoney(rate, 'COP')})`, 'success');
        } else {
            // Moneda ya es USD
            if (usdPurchase > 0) setVal('calcCostPurchase', usdPurchase);
            if (usdShipping > 0) setVal('calcCostShippingMain', usdShipping);
            if (usdCustoms > 0) setVal('calcCostCustoms', usdCustoms);
            Utils.showToast('Costos en USD aplicados directamente', 'success');
        }

        calculate();
    }

    /**
     * Actualiza el badge de la TRM
     */
    function updateTrmBadge() {
        const badge = document.getElementById('labelCurrentTrmBadge');
        if (badge) {
            badge.textContent = `1 USD = ${formatMoney(exchangeRate, 'COP')}`;
        }
    }

    /**
     * Alterna la moneda principal entre COP y USD
     */
    function switchCurrency(newCurrency) {
        if (newCurrency === currentCurrency) return;
        const oldCurrency = currentCurrency;
        currentCurrency = newCurrency;
        const rate = Math.max(1, getNum('calcExchangeRate', exchangeRate));

        // Actualizar inputs monetarios para convertir los valores actuales a la nueva moneda
        const moneyFields = [
            'calcCostPurchase', 'calcCostShippingMain', 'calcCostCustoms',
            'calcCostShippingLocal', 'calcCostPackaging', 'calcCostFulfillment', 'calcCostOther',
            'calcCpa', 'calcFlete', 'calcFleteRetorno', 'calcAdmin',
            'calcMpFixedFee', 'calcMpShipping', 'calcVenta'
        ];

        moneyFields.forEach(id => {
            const el = document.getElementById(id);
            if (el) {
                const currentVal = parseFloat(el.value) || 0;
                if (currentVal > 0) {
                    if (newCurrency === 'USD') {
                        // De COP a USD: dividir por TRM
                        el.value = (currentVal / rate).toFixed(2);
                        el.step = '0.01';
                    } else {
                        // De USD a COP: multiplicar por TRM
                        el.value = Math.round(currentVal * rate);
                        el.step = '1';
                    }
                } else {
                    el.step = newCurrency === 'USD' ? '0.01' : '1';
                }
            }
        });

        // Convertir también los costos personalizados añadidos por el usuario
        extraCosts.forEach(c => {
            const cur = Number(c.amount) || 0;
            if (cur > 0) {
                c.amount = newCurrency === 'USD'
                    ? parseFloat((cur / rate).toFixed(2))
                    : Math.round(cur * rate);
            }
        });
        renderExtraCosts();

        // Convertir también los precios de las ofertas / combos
        offers.forEach(o => {
            const cur = Number(o.price) || 0;
            if (cur > 0) {
                o.price = newCurrency === 'USD'
                    ? parseFloat((cur / rate).toFixed(2))
                    : Math.round(cur * rate);
            }
        });

        // Si el margen objetivo es fijo en dinero, convertirlo también
        const marginType = getText('calcTargetMarginType', 'margin_percent');
        if (marginType === 'fixed_profit') {
            const elMargin = document.getElementById('calcTargetMarginValue');
            if (elMargin) {
                const cur = parseFloat(elMargin.value) || 0;
                if (cur > 0) {
                    elMargin.value = newCurrency === 'USD' ? (cur / rate).toFixed(2) : Math.round(cur * rate);
                }
            }
        }

        updateCurrencyUI();
        calculate();
        Utils.showToast(`Moneda cambiada a ${newCurrency === 'USD' ? 'Dólares (USD)' : 'Pesos (COP)'}`, 'info');
    }

    /**
     * Actualiza textos de etiquetas e interfaz según la moneda activa
     */
    function updateCurrencyUI() {
        const symbol = currentCurrency === 'USD' ? '($ USD)' : '($ COP)';
        const currSelect = document.getElementById('calcCurrency');
        if (currSelect) currSelect.value = currentCurrency;

        updateTrmBadge();

        // Actualizar labels con el símbolo de la moneda
        const labelPurchase = document.getElementById('labelCostPurchase');
        const isBatch = getText('calcCostMode', 'unit') === 'batch';
        if (labelPurchase) {
            labelPurchase.textContent = isBatch ? `Costo Total Lote Compra ${symbol}` : `Costo de Compra ${symbol}`;
        }

        const labelTarget = document.getElementById('labelTargetMarginValue');
        const marginType = getText('calcTargetMarginType', 'margin_percent');
        if (labelTarget && marginType === 'fixed_profit') {
            labelTarget.textContent = `Ganancia Neta Deseada ${symbol}`;
        }

        const labelSalePrice = document.getElementById('labelSalePriceCurrency');
        if (labelSalePrice) {
            labelSalePrice.textContent = symbol;
        }

        const inputVenta = document.getElementById('calcVenta');
        if (inputVenta) {
            inputVenta.placeholder = currentCurrency === 'USD' ? 'Ej: 50' : 'Ej: 50000';
        }
    }

    /**
     * Actualiza etiquetas según modo unitario o por lote
     */
    function updateCostLabels(isBatch) {
        const symbol = currentCurrency === 'USD' ? '($ USD)' : '($ COP)';
        const pLabel = document.getElementById('labelCostPurchase');
        const sLabel = document.getElementById('labelCostShippingMain');
        const cLabel = document.getElementById('labelCostCustoms');
        const lLabel = document.getElementById('labelCostShippingLocal');

        if (pLabel) pLabel.textContent = isBatch ? `Costo Total Lote Compra ${symbol}` : `Costo de Compra ${symbol}`;
        if (sLabel) sLabel.textContent = isBatch ? `Flete Total Principal Lote ${symbol}` : `Flete Principal / Int. ${symbol}`;
        if (cLabel) cLabel.textContent = isBatch ? `Aranceles Total Lote ${symbol}` : `Arancel / Aduana ${symbol}`;
        if (lLabel) lLabel.textContent = isBatch ? `Acarreo Total Lote a Bodega ${symbol}` : `Acarreo / Flete Local ${symbol}`;

        // Los costos personalizados muestran el selector de alcance solo en modo lote
        document.querySelectorAll('#landedCostGrid .calc-cost-scope').forEach(sel => {
            sel.style.display = isBatch ? 'block' : 'none';
        });
    }

    /* ========================================
       COSTOS LANDED DINÁMICOS (quitar / añadir)
       ======================================== */

    function isBatchMode() {
        return getText('calcCostMode', 'unit') === 'batch';
    }

    /**
     * Oculta un costo estándar y pone su valor en cero
     */
    function removeStandardCost(key) {
        if (!STANDARD_COSTS[key]) return;
        if (!hiddenCosts.includes(key)) hiddenCosts.push(key);
        setVal(STANDARD_COSTS[key].input, 0);
        applyHiddenCosts();
        calculate();
    }

    /**
     * Devuelve a la vista un costo estándar previamente quitado
     */
    function restoreStandardCost(key) {
        hiddenCosts = hiddenCosts.filter(k => k !== key);
        applyHiddenCosts();
        const el = document.getElementById(STANDARD_COSTS[key] ? STANDARD_COSTS[key].input : '');
        if (el) el.focus();
        calculate();
    }

    /**
     * Sincroniza la visibilidad de los costos estándar y los chips de restauración
     */
    function applyHiddenCosts() {
        Object.keys(STANDARD_COSTS).forEach(key => {
            const row = document.querySelector(`#landedCostGrid [data-cost-key="${key}"]`);
            if (row) row.style.display = hiddenCosts.includes(key) ? 'none' : '';
        });

        const chips = document.getElementById('landedRemovedChips');
        if (!chips) return;
        chips.innerHTML = hiddenCosts.map(key => {
            const def = STANDARD_COSTS[key];
            if (!def) return '';
            return `<button type="button" class="calc-cost-chip" data-cost-restore="${key}" title="Volver a incluir este costo">+ ${Utils.escapeHtml ? Utils.escapeHtml(def.label) : def.label}</button>`;
        }).join('');
    }

    /**
     * Añade una línea de costo personalizada
     */
    function addExtraCost(label = '', amount = 0, scope = 'batch', skipFocus = false) {
        const item = {
            id: 'ec_' + (++extraSeq) + '_' + Math.random().toString(36).substr(2, 4),
            label: label || '',
            amount: Number(amount) || 0,
            scope: scope === 'unit' ? 'unit' : 'batch'
        };
        extraCosts.push(item);
        renderExtraCosts();
        if (!skipFocus) {
            const el = document.querySelector(`[data-extra-name="${item.id}"]`);
            if (el) el.focus();
        }
        calculate();
        return item;
    }

    function removeExtraCost(id) {
        extraCosts = extraCosts.filter(c => c.id !== id);
        renderExtraCosts();
        calculate();
    }

    /**
     * Dibuja las líneas de costo personalizadas dentro de la grilla de costeo
     */
    function renderExtraCosts() {
        const grid = document.getElementById('landedCostGrid');
        if (!grid) return;

        grid.querySelectorAll('.calc-cost-extra').forEach(el => el.remove());

        const symbol = currentCurrency === 'USD' ? '($ USD)' : '($ COP)';
        const step = currentCurrency === 'USD' ? '0.01' : '1';
        const showScope = isBatchMode() ? 'block' : 'none';
        const esc = (s) => (Utils.escapeHtml ? Utils.escapeHtml(String(s)) : String(s).replace(/"/g, '&quot;'));

        extraCosts.forEach(c => {
            const row = document.createElement('div');
            row.className = 'form-group calc-cost-item calc-cost-extra';
            row.dataset.extraId = c.id;
            row.innerHTML = `
                <input type="text" class="calc-cost-name" data-extra-name="${c.id}" value="${esc(c.label)}" placeholder="Nombre del costo ${symbol}" title="Escribe el nombre de este costo">
                <button type="button" class="calc-cost-remove" data-extra-remove="${c.id}" title="Quitar este costo" aria-label="Quitar costo">&times;</button>
                <input type="number" class="calc-cost-amount" data-extra-amount="${c.id}" value="${c.amount}" step="${step}" min="0">
                <select class="calc-cost-scope" data-extra-scope="${c.id}" style="display:${showScope}" title="¿Este valor es del lote completo o de cada unidad?">
                    <option value="batch"${c.scope === 'batch' ? ' selected' : ''}>Total del lote</option>
                    <option value="unit"${c.scope === 'unit' ? ' selected' : ''}>Por unidad</option>
                </select>
            `;
            grid.appendChild(row);
        });
    }

    /**
     * Suma unitaria de los costos personalizados
     */
    function getExtraCostsUnit(isBatch, batchUnits) {
        const units = Math.max(1, batchUnits || 1);
        return extraCosts.reduce((sum, c) => {
            const amount = Number(c.amount) || 0;
            if (isBatch && c.scope === 'batch') return sum + (amount / units);
            return sum + amount;
        }, 0);
    }

    function getExtraCostsRawTotal() {
        return extraCosts.reduce((sum, c) => sum + (Number(c.amount) || 0), 0);
    }

    /* ======================================================
       OFERTAS / COMBOS MULTI-UNIDAD (2x, 3x, ...)
       Regla de negocio: un pedido = un solo CPA y un solo envío,
       sin importar cuántas unidades lleve el combo.
       ====================================================== */

    function defaultOffers() {
        offersSeq = 0;
        return [
            { id: 'of_' + (++offersSeq), units: 2, price: 0 },
            { id: 'of_' + (++offersSeq), units: 3, price: 0 }
        ];
    }

    function addOffer(units = 2, price = 0, skipFocus = false) {
        const item = {
            id: 'of_' + (++offersSeq) + '_' + Math.random().toString(36).substr(2, 4),
            units: Math.max(1, Math.round(Number(units) || 1)),
            price: Math.max(0, Number(price) || 0)
        };
        offers.push(item);
        calculate();
        if (!skipFocus) {
            const el = document.querySelector(`[data-offer-price="${item.id}"]`);
            if (el) el.focus();
        }
        return item;
    }

    function removeOffer(id) {
        offers = offers.filter(o => o.id !== id);
        calculate();
    }

    /**
     * Pone en la oferta el precio que mantiene el mismo margen neto % de la venta unitaria
     */
    function applySuggestedOfferPrice(id) {
        const data = calculate();
        const row = (data && data.offers) ? data.offers.find(o => o.id === id) : null;
        const item = offers.find(o => o.id === id);
        if (!row || !item) return;
        item.price = currentCurrency === 'USD'
            ? parseFloat(row.suggestedPrice.toFixed(2))
            : Math.round(row.suggestedPrice);
        calculate();
    }

    /**
     * Calcula la rentabilidad de una oferta de N unidades a un precio de combo.
     * El CPA, el flete y el costo administrativo se cobran UNA sola vez (un pedido).
     */
    function computeOffer(offer, ctx) {
        const units = Math.max(1, Math.round(Number(offer.units) || 1));
        const price = Math.max(0, Number(offer.price) || 0);

        // Mercancía: el costo landed sí se multiplica por cada unidad del combo.
        // Si el empaque va una sola vez por pedido, se descuenta el excedente.
        const packSaving = ctx.packOnce ? ctx.packPerUnit * (units - 1) : 0;
        const goodsCost = Math.max(0, (ctx.landedCost * units) - packSaving);

        // Costos que no se repiten aunque el pedido lleve 2 o 3 unidades
        const fixedPerOrder = ctx.channel === 'cod'
            ? (ctx.realCpa + ctx.realFreight + ctx.adminCost)
            : (ctx.mpFixedFee + ctx.mpShipping);
        const variableRate = ctx.channel === 'cod' ? ctx.recaudoRate : ctx.mpPercentTotal;

        const totalFixed = goodsCost + fixedPerOrder;
        const variableCost = price * variableRate;
        const profit = price - variableCost - totalFixed;
        const margin = price > 0 ? (profit / price) * 100 : 0;
        const roi = goodsCost > 0 ? (profit / goodsCost) * 100 : 0;
        const breakEvenPrice = (1 - variableRate) > 0 ? totalFixed / (1 - variableRate) : totalFixed;

        // Precio de combo que mantiene el mismo margen neto % de la venta unitaria
        const targetMargin = Math.max(0, Math.min(80, ctx.unitMargin || 0)) / 100;
        const den = 1 - variableRate - targetMargin;
        const suggestedPrice = den > 0 ? totalFixed / den : breakEvenPrice;

        // CPA máximo que soporta el combo (un solo CPA por pedido)
        const maxCpa = ctx.channel === 'cod'
            ? Math.max(0, ((price * (1 - variableRate)) - goodsCost - ctx.realFreight - ctx.adminCost) * (1 - ctx.ineffectiveness))
            : 0;
        const roas = (ctx.channel === 'cod' && ctx.realCpa > 0) ? price / ctx.realCpa : 0;

        const unitPriceEff = price / units;
        const profitPerUnit = profit / units;
        const discountPercent = ctx.unitPrice > 0 ? (1 - (unitPriceEff / ctx.unitPrice)) * 100 : 0;

        // Comparación: las mismas unidades vendidas en pedidos individuales
        const separateProfit = (ctx.unitProfit || 0) * units;
        const upliftVsSeparate = profit - separateProfit;

        return {
            id: offer.id,
            units,
            price,
            goodsCost,
            fixedPerOrder,
            variableCost,
            profit,
            margin,
            roi,
            breakEvenPrice,
            suggestedPrice,
            maxCpa,
            roas,
            unitPriceEff,
            profitPerUnit,
            discountPercent,
            separateProfit,
            upliftVsSeparate,
            isViable: profit > 0
        };
    }

    function offerMarginBadgeClass(marginPercent) {
        if (marginPercent >= 22) return 'badge-success';
        if (marginPercent >= 10) return 'badge-warning';
        return 'badge-danger';
    }

    /**
     * Estructura HTML de una fila de oferta (se construye una sola vez por combo)
     */
    function offerRowHtml(r, step) {
        return `
                <div class="calc-offer-row" data-offer-row="${r.id}">
                    <div class="calc-offer-head">
                        <div class="calc-offer-qty">
                            <input type="number" class="calc-offer-units" data-offer-units="${r.id}" value="${r.units}" min="1" step="1" title="Unidades que lleva el combo">
                            <span class="calc-offer-x">por</span>
                            <input type="number" class="calc-offer-price" data-offer-price="${r.id}" value="${r.price}" min="0" step="${step}" title="Precio total del combo">
                        </div>
                        <div class="calc-offer-sub" data-offer-field="sub"></div>
                        <div class="calc-offer-actions">
                            <button type="button" class="calc-offer-suggest" data-offer-apply="${r.id}" data-offer-field="suggest" title="Usar el precio que mantiene tu mismo margen neto"></button>
                            <button type="button" class="calc-offer-remove" data-offer-remove="${r.id}" title="Quitar esta oferta" aria-label="Quitar oferta">&times;</button>
                        </div>
                    </div>
                    <div class="calc-offer-metrics">
                        <div class="calc-offer-metric is-main">
                            <span>Ganancia por pedido</span>
                            <strong data-offer-field="profit"></strong>
                        </div>
                        <div class="calc-offer-metric">
                            <span>Ganancia por unidad</span>
                            <strong data-offer-field="profitUnit"></strong>
                        </div>
                        <div class="calc-offer-metric">
                            <span>ROI sobre mercancía</span>
                            <strong data-offer-field="roi"></strong>
                        </div>
                        <div class="calc-offer-metric">
                            <span>Precio equilibrio</span>
                            <strong data-offer-field="be"></strong>
                        </div>
                        <div class="calc-offer-metric">
                            <span>CPA máximo del pedido</span>
                            <strong data-offer-field="maxCpa"></strong>
                        </div>
                        <div class="calc-offer-metric">
                            <span>ROAS del combo</span>
                            <strong data-offer-field="roas"></strong>
                        </div>
                        <div class="calc-offer-metric">
                            <span data-offer-field="goodsLabel">Mercancía</span>
                            <strong data-offer-field="goods"></strong>
                        </div>
                        <div class="calc-offer-metric">
                            <span data-offer-field="fixedLabel">Costos por pedido</span>
                            <strong data-offer-field="fixed"></strong>
                        </div>
                    </div>
                    <div class="calc-offer-foot">
                        <span data-offer-field="vsSeparate"></span>
                        <span data-offer-field="projection"></span>
                    </div>
                </div>`;
    }

    /**
     * Refresca los valores calculados de una fila sin tocar los inputs (no pierde el foco)
     */
    function updateOfferRow(el, r, orders) {
        el.classList.toggle('is-loss', !r.isViable && r.price > 0);
        const f = (name) => el.querySelector(`[data-offer-field="${name}"]`);
        const set = (name, html) => { const n = f(name); if (n) n.innerHTML = html; };

        set('sub', `${formatMoney(r.unitPriceEff)} / unid. · ${r.discountPercent >= 0 ? '-' : '+'}${Math.abs(r.discountPercent).toFixed(0)}% vs unitario`);
        set('suggest', `Sugerido: ${formatMoney(r.suggestedPrice)}`);
        set('profit', `${formatMoney(r.profit)} <em class="result-badge ${offerMarginBadgeClass(r.margin)}">${r.margin.toFixed(1)}%</em>`);
        set('profitUnit', formatMoney(r.profitPerUnit));
        set('roi', `${r.roi.toFixed(1)}%`);
        set('be', formatMoney(r.breakEvenPrice));
        set('maxCpa', currentChannel === 'cod' ? formatMoney(r.maxCpa) : 'N/A');
        set('roas', currentChannel === 'cod' ? `${r.roas.toFixed(2)}x` : 'N/A');
        set('goodsLabel', `Mercancía (${r.units} unid.)`);
        set('goods', formatMoney(r.goodsCost));
        set('fixedLabel', currentChannel === 'cod' ? 'CPA + flete + admin (1 pedido)' : 'Cargo fijo + envío (1 pedido)');
        set('fixed', formatMoney(r.fixedPerOrder));

        const upliftColor = r.upliftVsSeparate >= 0 ? '#10b981' : '#ef4444';
        const upliftSign = r.upliftVsSeparate >= 0 ? '+' : '';
        set('vsSeparate', `vs. ${r.units} pedidos individuales (${formatMoney(r.separateProfit)}): <strong style="color:${upliftColor}">${upliftSign}${formatMoney(r.upliftVsSeparate)}</strong>`);
        set('projection', `${orders} pedidos: <strong>${formatMoney(r.profit * orders)}</strong> · ${r.units * orders} unid.`);
    }

    /**
     * Dibuja la tarjeta de ofertas con la rentabilidad de cada combo
     */
    function renderOffers(data) {
        const list = document.getElementById('offersList');
        if (!list) return;

        const rows = (data && data.offers) ? data.offers : [];
        const step = currentCurrency === 'USD' ? '0.01' : '1';
        const orders = Math.max(1, getNum('calcOfferOrders', 10));

        // Solo se reconstruye el DOM cuando cambian las filas o la moneda,
        // así no se pierde el foco mientras se escribe un precio.
        const signature = rows.map(r => r.id).join('|') + '#' + currentCurrency;
        if (list.dataset.offersSig !== signature) {
            list.innerHTML = rows.length
                ? rows.map(r => offerRowHtml(r, step)).join('')
                : '<div class="calc-offer-empty">Aún no hay ofertas. Añade un combo (ej: 2 por 100) para ver su rentabilidad.</div>';
            list.dataset.offersSig = signature;
        }

        rows.forEach(r => {
            const el = list.querySelector(`[data-offer-row="${r.id}"]`);
            if (!el) return;
            const unitsEl = el.querySelector(`[data-offer-units="${r.id}"]`);
            const priceEl = el.querySelector(`[data-offer-price="${r.id}"]`);
            if (unitsEl && document.activeElement !== unitsEl) unitsEl.value = r.units;
            if (priceEl && document.activeElement !== priceEl) priceEl.value = r.price;
            updateOfferRow(el, r, orders);
        });

        // Resumen: mejor oferta por ganancia de pedido y por ganancia por unidad
        const sumBest = document.getElementById('offersBestSummary');
        if (sumBest) {
            const viable = rows.filter(r => r.price > 0);
            if (!viable.length) {
                sumBest.innerHTML = '<span class="calc-offer-hint">Escribe el precio de cada combo (o usa el precio sugerido) para comparar.</span>';
            } else {
                const bestOrder = viable.reduce((a, b) => (b.profit > a.profit ? b : a));
                const bestUnit = viable.reduce((a, b) => (b.profitPerUnit > a.profitPerUnit ? b : a));
                sumBest.innerHTML = `
                    <span>🏆 Mejor por pedido: <strong>${bestOrder.units} por ${formatMoney(bestOrder.price)}</strong> → ${formatMoney(bestOrder.profit)}</span>
                    <span>⚖️ Mejor por unidad: <strong>${bestUnit.units} por ${formatMoney(bestUnit.price)}</strong> → ${formatMoney(bestUnit.profitPerUnit)}/unid.</span>`;
            }
        }

        const noteUnit = document.getElementById('offersUnitRef');
        if (noteUnit && data) {
            noteUnit.textContent = `Venta unitaria: ${formatMoney(data.finalSalePrice)} · ganancia ${formatMoney(data.netProfit)} (${data.netMarginPercent.toFixed(1)}%)`;
        }
    }

    /**
     * Listeners delegados de la tarjeta de ofertas
     */
    function bindOfferEvents() {
        const list = document.getElementById('offersList');
        const btnAdd = document.getElementById('btnAddOffer');
        const packToggle = document.getElementById('calcOfferPackOnce');
        const inputOrders = document.getElementById('calcOfferOrders');

        document.querySelectorAll('[data-offer-preset]').forEach(btn => {
            btn.addEventListener('click', () => {
                const units = Math.max(1, parseInt(btn.dataset.offerPreset, 10) || 2);
                addOffer(units, 0);
            });
        });

        if (btnAdd) {
            btnAdd.addEventListener('click', () => {
                const nextUnits = offers.length ? offers[offers.length - 1].units + 1 : 2;
                addOffer(nextUnits, 0);
            });
        }

        if (packToggle) {
            packToggle.checked = offersPackOnce;
            packToggle.addEventListener('change', () => {
                offersPackOnce = packToggle.checked;
                calculate();
            });
        }

        if (inputOrders) inputOrders.addEventListener('input', Utils.debounce(calculate, 80));

        if (!list) return;

        list.addEventListener('click', (e) => {
            const rm = e.target.closest('[data-offer-remove]');
            if (rm) { removeOffer(rm.dataset.offerRemove); return; }
            const ap = e.target.closest('[data-offer-apply]');
            if (ap) applySuggestedOfferPrice(ap.dataset.offerApply);
        });

        const debouncedCalc = Utils.debounce(calculate, 300);

        list.addEventListener('input', (e) => {
            const unitsEl = e.target.closest('[data-offer-units]');
            if (unitsEl) {
                const item = offers.find(o => o.id === unitsEl.dataset.offerUnits);
                if (item) item.units = Math.max(1, Math.round(parseFloat(unitsEl.value) || 1));
                debouncedCalc();
                return;
            }
            const priceEl = e.target.closest('[data-offer-price]');
            if (priceEl) {
                const item = offers.find(o => o.id === priceEl.dataset.offerPrice);
                if (item) item.price = Math.max(0, parseFloat(priceEl.value) || 0);
                debouncedCalc();
            }
        });
    }

    /**
     * Listeners delegados de la grilla de costos dinámicos
     */
    function bindLandedCostEvents() {
        const grid = document.getElementById('landedCostGrid');
        const btnAdd = document.getElementById('btnAddLandedCost');
        const chips = document.getElementById('landedRemovedChips');

        if (btnAdd) btnAdd.addEventListener('click', () => addExtraCost());

        if (chips) {
            chips.addEventListener('click', (e) => {
                const btn = e.target.closest('[data-cost-restore]');
                if (btn) restoreStandardCost(btn.dataset.costRestore);
            });
        }

        if (!grid) return;

        grid.addEventListener('click', (e) => {
            const removeStd = e.target.closest('[data-cost-remove]');
            if (removeStd) {
                removeStandardCost(removeStd.dataset.costRemove);
                return;
            }
            const removeExtra = e.target.closest('[data-extra-remove]');
            if (removeExtra) removeExtraCost(removeExtra.dataset.extraRemove);
        });

        const debouncedCalc = Utils.debounce(calculate, 80);

        grid.addEventListener('input', (e) => {
            const nameEl = e.target.closest('[data-extra-name]');
            if (nameEl) {
                const item = extraCosts.find(c => c.id === nameEl.dataset.extraName);
                if (item) item.label = nameEl.value;
                return;
            }
            const amountEl = e.target.closest('[data-extra-amount]');
            if (amountEl) {
                const item = extraCosts.find(c => c.id === amountEl.dataset.extraAmount);
                if (item) item.amount = parseFloat(amountEl.value) || 0;
                debouncedCalc();
            }
        });

        grid.addEventListener('change', (e) => {
            const scopeEl = e.target.closest('[data-extra-scope]');
            if (scopeEl) {
                const item = extraCosts.find(c => c.id === scopeEl.dataset.extraScope);
                if (item) item.scope = scopeEl.value;
                calculate();
            }
        });
    }

    /**
     * Cambia de pestaña principal (Calculadora vs Guardadas)
     */
    function switchMainTab(tab) {
        const viewActive = document.getElementById('calcViewActive');
        const viewSaved = document.getElementById('calcViewSaved');
        const btnActive = document.getElementById('calcTabBtnActive');
        const btnSaved = document.getElementById('calcTabBtnSaved');

        if (tab === 'active') {
            if (viewActive) viewActive.style.display = 'block';
            if (viewSaved) viewSaved.style.display = 'none';
            if (btnActive) btnActive.classList.add('active');
            if (btnSaved) btnSaved.classList.remove('active');
        } else {
            if (viewActive) viewActive.style.display = 'none';
            if (viewSaved) viewSaved.style.display = 'block';
            if (btnActive) btnActive.classList.remove('active');
            if (btnSaved) btnSaved.classList.add('active');
            renderSavedTable();
        }
    }

    /**
     * Cambia el canal de venta activo (COD vs Marketplace)
     */
    function switchChannel(channel) {
        currentChannel = channel;
        const tabCod = document.getElementById('tabChannelCod');
        const tabMp = document.getElementById('tabChannelMarketplace');
        const panelCod = document.getElementById('panelChannelCod');
        const panelMp = document.getElementById('panelChannelMarketplace');

        if (channel === 'cod') {
            if (tabCod) tabCod.classList.add('active');
            if (tabMp) tabMp.classList.remove('active');
            if (panelCod) panelCod.classList.add('active');
            if (panelMp) panelMp.classList.remove('active');
        } else {
            if (tabCod) tabCod.classList.remove('active');
            if (tabMp) tabMp.classList.add('active');
            if (panelCod) panelCod.classList.remove('active');
            if (panelMp) panelMp.classList.add('active');
        }

        calculate();
    }

    /**
     * Cambia el modo de fijación (Margen Deseado vs Precio Fijado)
     */
    function switchPricingMode(mode) {
        pricingMode = mode;
        const btnTarget = document.getElementById('btnModeTargetMargin');
        const btnFixed = document.getElementById('btnModeFixedPrice');
        const groupTarget = document.getElementById('groupTargetMargin');
        const groupFixed = document.getElementById('groupFixedPrice');

        if (mode === 'target_margin') {
            if (btnTarget) btnTarget.classList.add('active');
            if (btnFixed) btnFixed.classList.remove('active');
            if (groupTarget) groupTarget.style.display = 'grid';
            if (groupFixed) groupFixed.style.display = 'none';
        } else {
            if (btnTarget) btnTarget.classList.remove('active');
            if (btnFixed) btnFixed.classList.add('active');
            if (groupTarget) groupTarget.style.display = 'none';
            if (groupFixed) groupFixed.style.display = 'grid';
        }

        calculate();
    }

    /**
     * Cargar productos desde Database para el catálogo rápido
     */
    async function loadProductsCatalog() {
        const select = document.getElementById('calcProductSelect');
        if (!select) return;

        try {
            if (typeof Database !== 'undefined' && Database.getProducts) {
                productsCatalog = await Database.getProducts();
            } else if (typeof ProductsModule !== 'undefined' && ProductsModule.products) {
                productsCatalog = ProductsModule.products;
            }
        } catch (e) {
            console.warn('Error loading products for calculator:', e);
            productsCatalog = [];
        }

        // Llenar select
        select.innerHTML = '<option value="">-- Producto Nuevo / Personalizado --</option>';
        if (Array.isArray(productsCatalog) && productsCatalog.length > 0) {
            productsCatalog.forEach(p => {
                const opt = document.createElement('option');
                opt.value = p.id;
                opt.textContent = `${p.name || 'Sin nombre'} (${p.sku || 'S/SKU'})`;
                select.appendChild(opt);
            });
        }
    }

    /**
     * Autollenar al seleccionar un producto del catálogo
     */
    function handleProductSelect(e) {
        const productId = e.target.value;
        if (!productId) return;

        const prod = productsCatalog.find(p => p.id === productId);
        if (!prod) return;

        setVal('calcProductName', prod.name || '');
        setVal('calcProductSku', prod.sku || '');

        let cost = 0;
        if (typeof ProductsModule !== 'undefined' && ProductsModule.getRealCost) {
            cost = ProductsModule.getRealCost(prod);
        } else {
            cost = parseFloat(prod.cost) || 0;
        }

        const rate = Math.max(1, getNum('calcExchangeRate', exchangeRate));
        if (cost > 0) {
            const costVal = currentCurrency === 'USD' ? (cost / rate).toFixed(2) : cost;
            setVal('calcCostPurchase', costVal);
        }

        if (prod.price && parseFloat(prod.price) > 0) {
            const priceVal = currentCurrency === 'USD' ? (parseFloat(prod.price) / rate).toFixed(2) : parseFloat(prod.price);
            setVal('calcVenta', priceVal);
        }

        calculate();
    }

    /**
     * Helpers para leer y escribir valores del DOM
     */
    function getNum(id, fallback = 0) {
        const el = document.getElementById(id);
        if (!el) return fallback;
        const val = parseFloat(el.value);
        return isNaN(val) ? fallback : val;
    }

    function getText(id, fallback = '') {
        const el = document.getElementById(id);
        return el ? el.value.trim() : fallback;
    }

    function setVal(id, val) {
        const el = document.getElementById(id);
        if (el) el.value = val;
    }

    /**
     * Calcula precio psicológico comercial
     */
    function computePsychologicalPrice(price) {
        if (price <= 0) return 0;
        if (currentCurrency === 'USD') {
            // En dólares: ej: 19.99, 24.90, 29.99
            const intPart = Math.floor(price);
            const decimal = price - intPart;
            if (decimal < 0.5) return intPart + 0.49;
            return intPart + 0.99;
        } else {
            // En pesos (COP): ej: redondeo a 900 o 990
            const base = Math.floor(price / 1000) * 1000;
            if (price <= base + 900) {
                return base + 900;
            } else {
                return base + 1900;
            }
        }
    }

    /**
     * MOTOR MATEMÁTICO PRINCIPAL
     */
    function calculate() {
        const isBatch = getText('calcCostMode', 'unit') === 'batch';
        const batchUnits = Math.max(1, getNum('calcBatchUnits', 1));
        const rate = Math.max(1, getNum('calcExchangeRate', exchangeRate));
        exchangeRate = rate;

        // 1. Costeo Landed (Unitario)
        let purchaseRaw = getNum('calcCostPurchase', 0);
        let shippingMainRaw = getNum('calcCostShippingMain', 0);
        let customsRaw = getNum('calcCostCustoms', 0);
        let shippingLocalRaw = getNum('calcCostShippingLocal', 0);
        let packaging = getNum('calcCostPackaging', 0);
        let fulfillment = getNum('calcCostFulfillment', 0);
        let other = getNum('calcCostOther', 0);

        let purchaseU = isBatch ? purchaseRaw / batchUnits : purchaseRaw;
        let shippingMainU = isBatch ? shippingMainRaw / batchUnits : shippingMainRaw;
        let customsU = isBatch ? customsRaw / batchUnits : customsRaw;
        let shippingLocalU = isBatch ? shippingLocalRaw / batchUnits : shippingLocalRaw;
        let otherU = isBatch ? other / batchUnits : other;
        const extrasU = getExtraCostsUnit(isBatch, batchUnits);

        const landedCost = purchaseU + shippingMainU + customsU + shippingLocalU + packaging + fulfillment + otherU + extrasU;

        // Actualizar Badge de Landed
        const badgeLanded = document.getElementById('badgeLandedCost');
        if (badgeLanded) {
            badgeLanded.textContent = `Landed: ${formatMoney(landedCost)}`;
        }

        // 2. Variables de Canal
        // --- COD ---
        const cpa = getNum('calcCpa', 0);
        const pCancel = Math.min(90, Math.max(0, getNum('calcCancelacion', 0))) / 100;
        const pReturn = Math.min(90, Math.max(0, getNum('calcDevolucion', 0))) / 100;
        const fleteOut = getNum('calcFlete', 0);
        const fleteRet = getNum('calcFleteRetorno', fleteOut);
        const recaudoRate = Math.min(25, Math.max(0, getNum('calcRecaudoPercent', 0))) / 100;
        const adminCost = getNum('calcAdmin', 0);

        // Fórmulas COD
        const ineffectiveness = Math.min(0.92, pCancel + pReturn);
        const realCpa = ineffectiveness < 1 ? cpa / (1 - ineffectiveness) : cpa;
        const realFreight = pReturn < 1 ? (fleteOut + (pReturn * fleteRet)) / (1 - pReturn) : fleteOut;
        const codFixedCosts = landedCost + realCpa + realFreight + adminCost;

        // --- Marketplace ---
        const mpFeeRate = Math.min(50, Math.max(0, getNum('calcMpFeePercent', 0))) / 100;
        const mpFixedFee = getNum('calcMpFixedFee', 0);
        const mpShipping = getNum('calcMpShipping', 0);
        const mpTaxRate = Math.min(25, Math.max(0, getNum('calcMpTaxPercent', 0))) / 100;
        const mpAdsRate = Math.min(30, Math.max(0, getNum('calcMpAdsPercent', 0))) / 100;

        const mpPercentTotal = mpFeeRate + mpTaxRate + mpAdsRate;
        const mpFixedCosts = landedCost + mpFixedFee + mpShipping;

        // 3. Fijación de Precios según el canal activo
        let finalSalePrice = 0;
        let recommendedPrice = 0;
        let netProfit = 0;
        let netMarginPercent = 0;
        let roiPercent = 0;
        let breakEvenPrice = 0;
        let breakEvenCpa = 0;
        let channelOperationalCost = 0;
        let minRoas = 0;

        const targetMarginType = getText('calcTargetMarginType', 'margin_percent');
        const targetMarginVal = getNum('calcTargetMarginValue', 25);
        const proposedPrice = getNum('calcVenta', 0);

        if (currentChannel === 'cod') {
            if (targetMarginType === 'margin_percent') {
                const targetM = Math.min(80, Math.max(1, targetMarginVal)) / 100;
                const denominator = 1 - recaudoRate - targetM;
                recommendedPrice = denominator > 0 ? codFixedCosts / denominator : codFixedCosts * 1.5;
            } else if (targetMarginType === 'markup_percent') {
                const markup = targetMarginVal / 100;
                const desiredProfit = landedCost * markup;
                const denominator = 1 - recaudoRate;
                recommendedPrice = denominator > 0 ? (codFixedCosts + desiredProfit) / denominator : codFixedCosts * 1.5;
            } else {
                // Fixed profit $
                const denominator = 1 - recaudoRate;
                recommendedPrice = denominator > 0 ? (codFixedCosts + targetMarginVal) / denominator : codFixedCosts * 1.5;
            }

            finalSalePrice = pricingMode === 'target_margin' ? recommendedPrice : proposedPrice;

            const codRecaudoCost = finalSalePrice * recaudoRate;
            channelOperationalCost = realCpa + realFreight + adminCost + codRecaudoCost;
            netProfit = finalSalePrice - codRecaudoCost - codFixedCosts;
            netMarginPercent = finalSalePrice > 0 ? (netProfit / finalSalePrice) * 100 : 0;
            roiPercent = landedCost > 0 ? (netProfit / landedCost) * 100 : 0;

            breakEvenPrice = (1 - recaudoRate) > 0 ? codFixedCosts / (1 - recaudoRate) : codFixedCosts;
            const remainingForAds = (finalSalePrice * (1 - recaudoRate)) - landedCost - realFreight - adminCost;
            breakEvenCpa = Math.max(0, remainingForAds * (1 - ineffectiveness));
            minRoas = realCpa > 0 && finalSalePrice > 0 ? (finalSalePrice / realCpa) : 0;

        } else {
            // Marketplace
            if (targetMarginType === 'margin_percent') {
                const targetM = Math.min(80, Math.max(1, targetMarginVal)) / 100;
                const denominator = 1 - mpPercentTotal - targetM;
                recommendedPrice = denominator > 0 ? mpFixedCosts / denominator : mpFixedCosts * 1.5;
            } else if (targetMarginType === 'markup_percent') {
                const markup = targetMarginVal / 100;
                const desiredProfit = landedCost * markup;
                const denominator = 1 - mpPercentTotal;
                recommendedPrice = denominator > 0 ? (mpFixedCosts + desiredProfit) / denominator : mpFixedCosts * 1.5;
            } else {
                const denominator = 1 - mpPercentTotal;
                recommendedPrice = denominator > 0 ? (mpFixedCosts + targetMarginVal) / denominator : mpFixedCosts * 1.5;
            }

            finalSalePrice = pricingMode === 'target_margin' ? recommendedPrice : proposedPrice;

            const mpVariableCost = finalSalePrice * mpPercentTotal;
            channelOperationalCost = mpVariableCost + mpFixedFee + mpShipping;
            netProfit = finalSalePrice - mpVariableCost - mpFixedCosts;
            netMarginPercent = finalSalePrice > 0 ? (netProfit / finalSalePrice) * 100 : 0;
            roiPercent = landedCost > 0 ? (netProfit / landedCost) * 100 : 0;

            breakEvenPrice = (1 - mpPercentTotal) > 0 ? mpFixedCosts / (1 - mpPercentTotal) : mpFixedCosts;
            breakEvenCpa = 0;
            minRoas = 0;
        }

        // 4. Simulación comparativa simultánea de ambos canales
        const simCodProfit = finalSalePrice - (finalSalePrice * recaudoRate) - codFixedCosts;
        const simCodMargin = finalSalePrice > 0 ? (simCodProfit / finalSalePrice) * 100 : 0;

        const simMpProfit = (finalSalePrice * (1 - mpPercentTotal)) - mpFixedCosts;
        const simMpMargin = finalSalePrice > 0 ? (simMpProfit / finalSalePrice) * 100 : 0;

        // 5. Cálculos de Rentabilidad Total del Lote
        const batchUnitsTotal = Math.max(1, getNum('calcBatchUnitsResult', getNum('calcBatchUnits', 100)));
        const totalBatchProfit = netProfit * batchUnitsTotal;
        const totalBatchRevenue = finalSalePrice * batchUnitsTotal;
        const totalBatchCost = landedCost * batchUnitsTotal;

        // 5.b Ofertas / combos multi-unidad
        // El CPA, el flete y el costo administrativo se cobran una sola vez por pedido.
        const offersCtx = {
            channel: currentChannel,
            landedCost,
            packPerUnit: packaging + fulfillment,
            packOnce: offersPackOnce,
            realCpa,
            realFreight,
            adminCost,
            recaudoRate,
            ineffectiveness,
            mpPercentTotal,
            mpFixedFee,
            mpShipping,
            unitPrice: finalSalePrice,
            unitProfit: netProfit,
            unitMargin: netMarginPercent
        };
        const offersData = offers.map(o => computeOffer(o, offersCtx));

        // 6. Actualizar UI en vivo
        const calcResult = {
            landedCost,
            finalSalePrice,
            recommendedPrice,
            psychologicalPrice: computePsychologicalPrice(finalSalePrice),
            netProfit,
            netMarginPercent,
            roiPercent,
            breakEvenPrice,
            breakEvenCpa,
            minRoas,
            channelOperationalCost,
            realCpa,
            realFreight,
            simCodProfit,
            simCodMargin,
            simMpProfit,
            simMpMargin,
            rate,
            batchUnitsTotal,
            totalBatchProfit,
            totalBatchRevenue,
            totalBatchCost,
            offers: offersData
        };

        updateUI(calcResult);
        return calcResult;
    }

    /**
     * Renderizar métricas en la interfaz
     */
    function updateUI(data) {
        // Utilidad Neta y Badge
        const resProfit = document.getElementById('resUtilidadNeta');
        const resMargin = document.getElementById('resUtilidadNetaPercent');
        if (resProfit) resProfit.textContent = formatMoney(data.netProfit);
        if (resMargin) {
            resMargin.textContent = `${data.netMarginPercent.toFixed(1)}%`;
            resMargin.className = 'result-badge';
            if (data.netMarginPercent >= 22) {
                resMargin.classList.add('badge-success');
            } else if (data.netMarginPercent >= 10) {
                resMargin.classList.add('badge-warning');
            } else {
                resMargin.classList.add('badge-danger');
            }
        }

        // Precios
        const resPriceLabel = document.getElementById('resPriceLabel');
        const resPriceValue = document.getElementById('resPriceValue');
        const resPsych = document.getElementById('resPsychologicalPrice');
        if (resPriceLabel) {
            resPriceLabel.textContent = pricingMode === 'target_margin' ? 'Precio de Venta Recomendado' : 'Precio de Venta Fijado';
        }
        if (resPriceValue) {
            resPriceValue.textContent = formatMoney(data.finalSalePrice);
        }
        if (resPsych) {
            resPsych.textContent = `Sugerido Comercial: ${formatMoney(data.psychologicalPrice)}`;
        }

        // Fila de Conversión Dual de Moneda
        const dualRow = document.getElementById('resDualCurrencyRow');
        const dualLabel = document.getElementById('resDualCurrencyLabel');
        const dualValue = document.getElementById('resDualCurrencyValue');
        if (dualRow && dualLabel && dualValue) {
            const rate = data.rate || exchangeRate;
            if (currentCurrency === 'COP') {
                const usdPrice = data.finalSalePrice / rate;
                const usdProfit = data.netProfit / rate;
                dualLabel.textContent = `Equivalente en USD (TRM ${formatMoney(rate, 'COP')}):`;
                dualValue.textContent = `P. Venta: ${formatMoney(usdPrice, 'USD')} | Ganancia: ${formatMoney(usdProfit, 'USD')}`;
            } else {
                const copPrice = data.finalSalePrice * rate;
                const copProfit = data.netProfit * rate;
                dualLabel.textContent = `Equivalente en Moneda Local (TRM ${formatMoney(rate, 'COP')}):`;
                dualValue.textContent = `P. Venta: ${formatMoney(copPrice, 'COP')} | Ganancia: ${formatMoney(copProfit, 'COP')}`;
            }
        }

        // Proyección y Ganancia Total del Lote
        const resBatchProfit = document.getElementById('resBatchTotalProfit');
        const resBatchRevenue = document.getElementById('resBatchTotalRevenue');
        const resBatchCost = document.getElementById('resBatchTotalCost');
        if (resBatchProfit) resBatchProfit.textContent = formatMoney(data.totalBatchProfit);
        if (resBatchRevenue) resBatchRevenue.textContent = formatMoney(data.totalBatchRevenue);
        if (resBatchCost) resBatchCost.textContent = formatMoney(data.totalBatchCost);

        // KPIs
        const resLanded = document.getElementById('resLandedTotal');
        const resChannelCost = document.getElementById('resChannelTotalCost');
        const resBePrice = document.getElementById('resBreakEvenPrice');
        const resBeCpa = document.getElementById('resBreakEvenCpa');
        const labelBeCpa = document.getElementById('labelBreakEvenCpa');
        const resRoi = document.getElementById('resRoi');
        const resMinRoas = document.getElementById('resMinRoas');

        if (resLanded) resLanded.textContent = formatMoney(data.landedCost);
        if (resChannelCost) resChannelCost.textContent = formatMoney(data.channelOperationalCost);
        if (resBePrice) resBePrice.textContent = formatMoney(data.breakEvenPrice);
        if (resRoi) resRoi.textContent = `${data.roiPercent.toFixed(1)}%`;

        if (resBeCpa && labelBeCpa) {
            if (currentChannel === 'cod') {
                labelBeCpa.textContent = 'CPA Máximo Permitido';
                resBeCpa.textContent = formatMoney(data.breakEvenCpa);
            } else {
                labelBeCpa.textContent = 'Ahorro s/ Publicidad';
                resBeCpa.textContent = 'Sin CPA ext.';
            }
        }

        if (resMinRoas) {
            resMinRoas.textContent = currentChannel === 'cod' ? `${data.minRoas.toFixed(2)}x` : 'N/A (Orgánico)';
        }

        // Segmented Breakdown Bar
        const totalPrice = Math.max(0.01, data.finalSalePrice);
        const pLanded = Math.max(0, Math.min(100, (data.landedCost / totalPrice) * 100));
        const pFreight = Math.max(0, Math.min(100, (currentChannel === 'cod' ? (data.realFreight / totalPrice) * 100 : 0)));
        const pAds = Math.max(0, Math.min(100, (currentChannel === 'cod' ? (data.realCpa / totalPrice) * 100 : (data.channelOperationalCost / totalPrice) * 100)));
        const pProfit = Math.max(0, Math.min(100, (Math.max(0, data.netProfit) / totalPrice) * 100));

        const segLanded = document.getElementById('segLanded');
        const segFreight = document.getElementById('segFreight');
        const segAds = document.getElementById('segAds');
        const segProfit = document.getElementById('segProfit');

        if (segLanded) segLanded.style.width = `${pLanded}%`;
        if (segFreight) segFreight.style.width = `${pFreight}%`;
        if (segAds) segAds.style.width = `${pAds}%`;
        if (segProfit) segProfit.style.width = `${pProfit}%`;

        // Legend
        const landedUnit = data.landedCost;
        const freightUnit = currentChannel === 'cod' ? data.realFreight : getNum('calcMpShipping', 0);
        const adsUnit = currentChannel === 'cod' ? data.realCpa : data.channelOperationalCost;
        const profitUnit = data.netProfit;

        const batchUnits = data.batchUnitsTotal || 1;
        const landedBatch = landedUnit * batchUnits;
        const freightBatch = freightUnit * batchUnits;
        const adsBatch = adsUnit * batchUnits;
        const profitBatch = profitUnit * batchUnits;

        const legLanded = document.getElementById('legLanded');
        const legFreight = document.getElementById('legFreight');
        const legAds = document.getElementById('legAds');
        const legProfit = document.getElementById('legProfit');

        if (legLanded) legLanded.textContent = `${formatMoney(landedUnit)} (${pLanded.toFixed(0)}%)`;
        if (legFreight) legFreight.textContent = `${formatMoney(freightUnit)} (${pFreight.toFixed(0)}%)`;
        if (legAds) legAds.textContent = `${formatMoney(adsUnit)} (${pAds.toFixed(0)}%)`;
        if (legProfit) legProfit.textContent = `${formatMoney(profitUnit)} (${pProfit.toFixed(0)}%)`;

        const legLandedBatch = document.getElementById('legLandedBatch');
        const legFreightBatch = document.getElementById('legFreightBatch');
        const legAdsBatch = document.getElementById('legAdsBatch');
        const legProfitBatch = document.getElementById('legProfitBatch');

        if (legLandedBatch) legLandedBatch.textContent = `Lote: ${formatMoney(landedBatch)}`;
        if (legFreightBatch) legFreightBatch.textContent = `Lote: ${formatMoney(freightBatch)}`;
        if (legAdsBatch) legAdsBatch.textContent = `Lote: ${formatMoney(adsBatch)}`;
        if (legProfitBatch) legProfitBatch.textContent = `Lote: ${formatMoney(profitBatch)}`;

        const legBatchBadge = document.getElementById('legBatchBadge');
        if (legBatchBadge) legBatchBadge.textContent = `Lote: ${batchUnits} unid.`;

        // Channel Comparison Card
        const colCod = document.getElementById('colCompareCod');
        const colMp = document.getElementById('colCompareMp');
        const bCod = document.getElementById('badgeCompareCod');
        const bMp = document.getElementById('badgeCompareMp');
        const cCodProfit = document.getElementById('compareCodProfit');
        const cCodMargin = document.getElementById('compareCodMargin');
        const cMpProfit = document.getElementById('compareMpProfit');
        const cMpMargin = document.getElementById('compareMpMargin');

        if (colCod) colCod.classList.toggle('is-active', currentChannel === 'cod');
        if (colMp) colMp.classList.toggle('is-active', currentChannel === 'marketplace');
        if (bCod) bCod.textContent = currentChannel === 'cod' ? 'Activo' : 'Simulado';
        if (bMp) bMp.textContent = currentChannel === 'marketplace' ? 'Activo' : 'Simulado';

        if (cCodProfit) cCodProfit.textContent = formatMoney(data.simCodProfit);
        if (cCodMargin) cCodMargin.textContent = `${data.simCodMargin.toFixed(1)}%`;
        if (cMpProfit) cMpProfit.textContent = formatMoney(data.simMpProfit);
        if (cMpMargin) cMpMargin.textContent = `${data.simMpMargin.toFixed(1)}%`;

        // Ofertas / combos multi-unidad
        renderOffers(data);
    }

    /**
     * Limpiar y comenzar una nueva liquidación
     */
    function resetCalculator() {
        currentLiquidationId = null;
        setVal('calcProductName', 'Nueva Liquidación');
        setVal('calcProductSku', '');
        setVal('calcCostMode', 'unit');
        const batchGroup = document.getElementById('calcBatchGroup');
        if (batchGroup) batchGroup.style.display = 'none';
        updateCostLabels(false);

        const isUsd = currentCurrency === 'USD';
        setVal('calcCostPurchase', isUsd ? 5.00 : 20000);
        setVal('calcCostShippingMain', isUsd ? 0.50 : 2000);
        setVal('calcCostCustoms', 0);
        setVal('calcCostShippingLocal', isUsd ? 0.15 : 500);
        setVal('calcCostPackaging', isUsd ? 0.25 : 1000);
        setVal('calcCostFulfillment', isUsd ? 0.40 : 1500);
        setVal('calcCostOther', 0);

        // Restaurar todos los costos estándar y limpiar los personalizados
        hiddenCosts = [];
        extraCosts = [];
        applyHiddenCosts();
        renderExtraCosts();
        offers = defaultOffers();
        offersPackOnce = true;
        const packChk = document.getElementById('calcOfferPackOnce');
        if (packChk) packChk.checked = true;

        setVal('calcCpa', isUsd ? 3.75 : 15000);
        setVal('calcCancelacion', 10);
        setVal('calcDevolucion', 20);
        setVal('calcFlete', isUsd ? 4.00 : 16500);
        setVal('calcFleteRetorno', isUsd ? 2.50 : 10000);
        setVal('calcRecaudoPercent', 3.5);
        setVal('calcAdmin', isUsd ? 0.50 : 2000);

        setVal('calcMpPreset', 'ml_clasica');
        setVal('calcMpFeePercent', 14.0);
        setVal('calcMpFixedFee', isUsd ? 0.50 : 2000);
        setVal('calcMpShipping', 0);
        setVal('calcMpTaxPercent', 1.5);
        setVal('calcMpAdsPercent', 0);

        setVal('calcTargetMarginType', 'margin_percent');
        setVal('calcTargetMarginValue', 25);
        setVal('calcVenta', isUsd ? 50 : 50000);

        switchChannel('cod');
        switchPricingMode('fixed_price');
        calculate();

        Utils.showToast('Calculadora lista para nueva liquidación', 'info');
    }

    /**
     * Guardar la liquidación actual (Supabase + LocalStorage)
     */
    async function saveCurrentLiquidation() {
        const name = getText('calcProductName', 'Liquidación sin nombre');
        const sku = getText('calcProductSku', '');

        // Recalcular para asegurar valores actuales exactos (números puros sin formateo)
        const calcData = calculate();

        // Extraer valores para guardar
        const isBatch = getText('calcCostMode', 'unit') === 'batch';
        const batchUnits = Math.max(1, getNum('calcBatchUnits', 1));
        const purchaseRaw = getNum('calcCostPurchase', 0);
        const shippingMainRaw = getNum('calcCostShippingMain', 0);
        const customsRaw = getNum('calcCostCustoms', 0);
        const shippingLocalRaw = getNum('calcCostShippingLocal', 0);
        const packaging = getNum('calcCostPackaging', 0);
        const fulfillment = getNum('calcCostFulfillment', 0);
        const other = getNum('calcCostOther', 0);

        const landedCost = calcData ? calcData.landedCost : ((isBatch ? (purchaseRaw + shippingMainRaw + customsRaw + shippingLocalRaw + other) / batchUnits : (purchaseRaw + shippingMainRaw + customsRaw + shippingLocalRaw + other)) + packaging + fulfillment + getExtraCostsUnit(isBatch, batchUnits));

        const salePrice = calcData ? calcData.finalSalePrice : (pricingMode === 'fixed_price' ? getNum('calcVenta', 0) : 0);
        const netProfit = calcData ? calcData.netProfit : 0;
        const netMargin = calcData ? calcData.netMarginPercent : 0;
        const codProfit = calcData ? calcData.simCodProfit : 0;
        const codMargin = calcData ? calcData.simCodMargin : 0;
        const mpProfit = calcData ? calcData.simMpProfit : 0;
        const mpMargin = calcData ? calcData.simMpMargin : 0;

        const isCodBetter = codProfit >= mpProfit;

        const payload = {
            id: currentLiquidationId || ('liq_' + Date.now().toString(36) + Math.random().toString(36).substr(2, 4)),
            name,
            sku,
            channel: currentChannel,
            currency: currentCurrency,
            exchange_rate: exchangeRate,
            cost_mode: isBatch ? 'batch' : 'unit',
            batch_units: batchUnits,
            cost_purchase: purchaseRaw,
            cost_shipping_main: shippingMainRaw,
            cost_customs: customsRaw,
            cost_shipping_local: shippingLocalRaw,
            cost_packaging: packaging,
            cost_fulfillment: fulfillment,
            cost_other: other,

            // Costos landed personalizados y estándar ocultados por el usuario
            cost_extra_items: extraCosts.map(c => ({
                label: c.label || 'Costo adicional',
                amount: Number(c.amount) || 0,
                scope: c.scope === 'unit' ? 'unit' : 'batch'
            })),
            cost_extra_total: getExtraCostsRawTotal(),
            cost_hidden_fields: [...hiddenCosts],

            // Ofertas / combos multi-unidad (un envío y un CPA por pedido)
            offers_pack_once: offersPackOnce,
            offer_items: ((calcData && calcData.offers) ? calcData.offers : []).map(o => ({
                units: o.units,
                price: o.price,
                unit_price_eff: o.unitPriceEff,
                profit: o.profit,
                margin_percent: o.margin,
                profit_per_unit: o.profitPerUnit,
                roi_percent: o.roi,
                break_even_price: o.breakEvenPrice,
                max_cpa: o.maxCpa,
                uplift_vs_separate: o.upliftVsSeparate
            })),

            total_landed_cost: landedCost,

            // Parámetros Canal 1: Contra Entrega (COD)
            sale_cpa: getNum('calcCpa', 0),
            cancel_rate: getNum('calcCancelacion', 0),
            return_rate: getNum('calcDevolucion', 0),
            freight_out: getNum('calcFlete', 0),
            freight_return: getNum('calcFleteRetorno', 0),
            cod_fee_percent: getNum('calcRecaudoPercent', 0),
            cost_admin: getNum('calcAdmin', 0),

            // Parámetros Canal 2: Marketplace
            marketplace_name: getText('calcMpPreset', 'ml_clasica'),
            marketplace_fee_percent: getNum('calcMpFeePercent', 0),
            marketplace_fixed_fee: getNum('calcMpFixedFee', 0),
            marketplace_shipping_cost: getNum('calcMpShipping', 0),
            marketplace_tax_percent: getNum('calcMpTaxPercent', 0),
            marketplace_ads_percent: getNum('calcMpAdsPercent', 0),

            // Pricing Global / Canal Activo
            pricing_mode: pricingMode,
            target_margin_type: getText('calcTargetMarginType', 'margin_percent'),
            target_margin_value: getNum('calcTargetMarginValue', 25),
            sale_price: salePrice,
            recommended_price: calcData ? calcData.recommendedPrice : 0,
            net_profit: netProfit,
            net_margin_percent: netMargin,
            roi_percent: calcData ? calcData.roiPercent : 0,
            break_even_price: calcData ? calcData.breakEvenPrice : 0,
            break_even_cpa: calcData ? calcData.breakEvenCpa : 0,
            total_batch_profit: netProfit * batchUnits,
            total_batch_revenue: salePrice * batchUnits,

            // Resultados Específicos Contra Entrega (COD)
            cod_sale_price: (currentChannel === 'cod' ? salePrice : (calcData ? calcData.recommendedPrice : salePrice)),
            cod_net_profit: codProfit,
            cod_net_margin_percent: codMargin,
            cod_total_batch_profit: codProfit * batchUnits,

            // Resultados Específicos Marketplace
            mp_sale_price: (currentChannel === 'marketplace' ? salePrice : (calcData ? calcData.recommendedPrice : salePrice)),
            mp_net_profit: mpProfit,
            mp_net_margin_percent: mpMargin,
            mp_total_batch_profit: mpProfit * batchUnits,

            // Comparativa de Canales
            best_channel: isCodBetter ? 'cod' : 'marketplace',
            profit_diff: Math.abs(codProfit - mpProfit),

            updated_at: new Date().toISOString()
        };

        const btnSaveTop = document.getElementById('btnCalcSave');
        const btnSaveBottom = document.getElementById('btnCalcSaveBottom');
        const origTopHtml = btnSaveTop ? btnSaveTop.innerHTML : '';
        const origBottomHtml = btnSaveBottom ? btnSaveBottom.innerHTML : '';

        if (btnSaveTop) btnSaveTop.innerHTML = '⏳ Guardando...';
        if (btnSaveBottom) btnSaveBottom.innerHTML = '⏳ Guardando...';

        try {
            let res;
            if (typeof Database !== 'undefined' && Database.saveProductLiquidation) {
                res = await Database.saveProductLiquidation(payload);
            } else {
                const localKey = 'antigravity_product_liquidations';
                let local = [];
                try { local = JSON.parse(localStorage.getItem(localKey) || '[]'); } catch (e) {}
                const idx = local.findIndex(l => l.id === payload.id);
                if (idx >= 0) local[idx] = payload;
                else local.unshift(payload);
                localStorage.setItem(localKey, JSON.stringify(local));
                res = payload;
            }

            currentLiquidationId = payload.id;

            if (btnSaveTop) btnSaveTop.innerHTML = '✅ ¡Guardada!';
            if (btnSaveBottom) btnSaveBottom.innerHTML = '✅ ¡Liquidación Guardada!';
            setTimeout(() => {
                if (btnSaveTop && origTopHtml) btnSaveTop.innerHTML = origTopHtml;
                if (btnSaveBottom && origBottomHtml) btnSaveBottom.innerHTML = origBottomHtml;
            }, 2500);

            if (res && res._synced) {
                Utils.showToast(`Liquidación "${name}" guardada en la nube y localmente`, 'success');
            } else {
                Utils.showToast(`Liquidación "${name}" guardada con éxito`, 'success');
            }

            await loadSavedLiquidations();
        } catch (err) {
            console.error('Error saving liquidation:', err);
            if (btnSaveTop && origTopHtml) btnSaveTop.innerHTML = origTopHtml;
            if (btnSaveBottom && origBottomHtml) btnSaveBottom.innerHTML = origBottomHtml;
            Utils.showToast('Error al guardar la liquidación: ' + (err.message || err), 'error');
        }
    }

    /**
     * Cargar lista de liquidaciones guardadas
     */
    async function loadSavedLiquidations() {
        try {
            if (typeof Database !== 'undefined' && Database.getProductLiquidations) {
                savedLiquidations = await Database.getProductLiquidations();
            } else {
                const localKey = 'antigravity_product_liquidations';
                savedLiquidations = JSON.parse(localStorage.getItem(localKey) || '[]');
            }
        } catch (e) {
            console.warn('Error reading liquidations:', e);
            savedLiquidations = [];
        }

        const badge = document.getElementById('calcSavedBadge');
        if (badge) badge.textContent = savedLiquidations.length;

        renderSavedTable();
    }

    /**
     * Renderizar tabla de liquidaciones guardadas
     */
    function renderSavedTable() {
        const tbody = document.getElementById('savedLiquidationsTbody');
        const emptyState = document.getElementById('savedEmptyState');
        const kpiTotal = document.getElementById('kpiSavedTotal');
        const kpiAvgMargin = document.getElementById('kpiSavedAvgMargin');

        if (!tbody) return;

        const search = (document.getElementById('searchSavedLiquidations')?.value || '').toLowerCase();
        const filterChannel = document.getElementById('filterSavedChannel')?.value || 'all';

        let filtered = savedLiquidations.filter(item => {
            const matchesSearch = !search ||
                (item.name && item.name.toLowerCase().includes(search)) ||
                (item.sku && item.sku.toLowerCase().includes(search));
            const best = item.best_channel || item.channel || 'cod';
            const matchesChannel = filterChannel === 'all' || best === filterChannel || item.channel === filterChannel;
            return matchesSearch && matchesChannel;
        });

        const kpiBestChannel = document.getElementById('kpiSavedBestChannel');

        if (kpiTotal) kpiTotal.textContent = savedLiquidations.length;
        if (kpiAvgMargin) {
            if (savedLiquidations.length > 0) {
                const avg = savedLiquidations.reduce((acc, curr) => acc + (parseFloat(curr.net_margin_percent) || 0), 0) / savedLiquidations.length;
                kpiAvgMargin.textContent = `${avg.toFixed(1)}%`;
            } else {
                kpiAvgMargin.textContent = '0%';
            }
        }

        if (kpiBestChannel) {
            if (savedLiquidations.length > 0) {
                const codWins = savedLiquidations.filter(item => {
                    const cod = item.cod_net_profit !== undefined ? item.cod_net_profit : (item.channel === 'cod' ? item.net_profit : 0);
                    const mp = item.mp_net_profit !== undefined ? item.mp_net_profit : (item.channel === 'marketplace' ? item.net_profit : 0);
                    return cod >= mp;
                }).length;
                const mpWins = savedLiquidations.length - codWins;
                kpiBestChannel.textContent = codWins >= mpWins ? 'Contra Entrega' : 'Marketplace';
            } else {
                kpiBestChannel.textContent = '---';
            }
        }

        if (filtered.length === 0) {
            tbody.innerHTML = '';
            if (emptyState) emptyState.style.display = 'block';
            return;
        }

        if (emptyState) emptyState.style.display = 'none';

        tbody.innerHTML = filtered.map(item => {
            const itemCurr = item.currency || 'COP';
            const currBadge = itemCurr === 'USD'
                ? '<span style="font-size: 0.72rem; padding: 2px 6px; background: rgba(59, 130, 246, 0.15); color: #60a5fa; border-radius: 4px; font-weight: 700; margin-left: 4px;">USD</span>'
                : '<span style="font-size: 0.72rem; padding: 2px 6px; background: rgba(16, 185, 129, 0.15); color: #34d399; border-radius: 4px; font-weight: 700; margin-left: 4px;">COP</span>';

            let codProfit = item.cod_net_profit !== undefined ? item.cod_net_profit : (item.channel === 'cod' ? item.net_profit : 0);
            if (itemCurr === 'COP' && Math.abs(codProfit) > 0 && Math.abs(codProfit) < 1000 && ((item.cost_purchase && item.cost_purchase > 1000) || (item.total_landed_cost && item.total_landed_cost > 1000))) {
                codProfit = codProfit * 1000;
            }
            const codMargin = item.cod_net_margin_percent !== undefined ? item.cod_net_margin_percent : (item.channel === 'cod' ? item.net_margin_percent : 0);
            const codBatch = item.cod_total_batch_profit !== undefined ? item.cod_total_batch_profit : (codProfit * (item.batch_units || 100));

            let mpProfit = item.mp_net_profit !== undefined ? item.mp_net_profit : (item.channel === 'marketplace' ? item.net_profit : 0);
            if (itemCurr === 'COP' && Math.abs(mpProfit) > 0 && Math.abs(mpProfit) < 1000 && ((item.cost_purchase && item.cost_purchase > 1000) || (item.total_landed_cost && item.total_landed_cost > 1000))) {
                mpProfit = mpProfit * 1000;
            }
            const mpMargin = item.mp_net_margin_percent !== undefined ? item.mp_net_margin_percent : (item.channel === 'marketplace' ? item.net_margin_percent : 0);
            const mpBatch = item.mp_total_batch_profit !== undefined ? item.mp_total_batch_profit : (mpProfit * (item.batch_units || 100));

            const isCodBetter = codProfit >= mpProfit;
            const diff = Math.abs(codProfit - mpProfit);
            const bestBadge = isCodBetter
                ? `<span class="calc-channel-pill cod" style="font-size: 0.75rem; padding: 3px 8px; white-space: nowrap;" title="Contra Entrega deja más ganancia">🚚 COD (+${formatMoney(diff, itemCurr)})</span>`
                : `<span class="calc-channel-pill marketplace" style="font-size: 0.75rem; padding: 3px 8px; white-space: nowrap;" title="Marketplace deja más ganancia">🛒 MP (+${formatMoney(diff, itemCurr)})</span>`;

            const dateFormatted = item.updated_at ? Utils.formatDate(item.updated_at) : 'Reciente';

            return `
                <tr>
                    <td>
                        <div style="display: flex; align-items: center;">
                            <strong style="color: var(--text-primary); font-size: 0.95rem;">${Utils.escapeHtml(item.name || 'Sin nombre')}</strong>
                            ${currBadge}
                        </div>
                        ${item.sku ? `<div style="font-size: 0.78rem; color: var(--text-muted); font-family: monospace;">SKU: ${Utils.escapeHtml(item.sku)}</div>` : ''}
                    </td>
                    <td>
                        <strong style="color: var(--text-primary);">${formatMoney(item.total_landed_cost || 0, itemCurr)}</strong>
                    </td>
                    <td>
                        <div style="font-weight: 700; color: ${codProfit > 0 ? '#10b981' : '#ef4444'}; font-size: 0.9rem;">
                            ${formatMoney(codProfit, itemCurr)}
                            <span style="font-size: 0.75rem; font-weight: 600; color: var(--text-muted);">(${codMargin.toFixed(1)}%)</span>
                        </div>
                        <div style="font-size: 0.74rem; color: var(--text-muted);">Lote: ${formatMoney(codBatch, itemCurr)}</div>
                    </td>
                    <td>
                        <div style="font-weight: 700; color: ${mpProfit > 0 ? '#60a5fa' : '#ef4444'}; font-size: 0.9rem;">
                            ${formatMoney(mpProfit, itemCurr)}
                            <span style="font-size: 0.75rem; font-weight: 600; color: var(--text-muted);">(${mpMargin.toFixed(1)}%)</span>
                        </div>
                        <div style="font-size: 0.74rem; color: var(--text-muted);">Lote: ${formatMoney(mpBatch, itemCurr)}</div>
                    </td>
                    <td>${bestBadge}</td>
                    <td style="color: var(--text-muted); font-size: 0.85rem;">${dateFormatted}</td>
                    <td style="text-align: right;">
                        <div class="calc-table-actions" style="justify-content: flex-end; display: flex; gap: 0.4rem; align-items: center;">
                            <button type="button" class="btn-detail-lupa" onclick="CalculatorModule.showLiquidationDetail('${item.id}')" title="Ver Gráficas y Análisis Detallado (Lupa)">
                                🔍 Detalles
                            </button>
                            <button type="button" class="btn btn-secondary btn-sm" onclick="CalculatorModule.loadLiquidation('${item.id}')" title="Cargar en la calculadora para editar">
                                ✏️ Cargar
                            </button>
                            <button type="button" class="btn btn-secondary btn-sm" onclick="CalculatorModule.exportPdf('${item.id}')" title="Descargar PDF Comparativo">
                                📄 PDF
                            </button>
                            <button type="button" class="btn btn-danger btn-sm" onclick="CalculatorModule.deleteLiquidation('${item.id}')" title="Eliminar liquidación">
                                🗑️
                            </button>
                        </div>
                    </td>
                </tr>
            `;
        }).join('');
    }

    /**
     * Abrir Modal con Gráficas y Detalle Completo de la Liquidación (Imagen 3)
     */
    function showLiquidationDetail(id) {
        const item = savedLiquidations.find(l => l.id === id);
        if (!item) return;

        const modal = document.getElementById('modalLiquidationDetail');
        if (!modal) return;

        const itemCurr = item.currency || 'COP';
        const itemRate = Math.max(1, item.exchange_rate || 4000);
        const batchUnits = item.batch_units || 100;
        const landedCost = item.total_landed_cost || 0;
        let salePrice = item.sale_price || 0;
        if (itemCurr === 'COP' && salePrice > 0 && salePrice < 1000 && ((item.cost_purchase && item.cost_purchase > 1000) || (landedCost > 1000))) {
            salePrice = salePrice * 1000;
        }
        let netProfit = item.net_profit || 0;
        if (itemCurr === 'COP' && Math.abs(netProfit) > 0 && Math.abs(netProfit) < 1000 && ((item.cost_purchase && item.cost_purchase > 1000) || (landedCost > 1000))) {
            netProfit = netProfit * 1000;
        }
        const netMargin = item.net_margin_percent || (salePrice > 0 ? (netProfit / salePrice) * 100 : 0);

        // Métricas Contra Entrega (COD)
        let codProfit = item.cod_net_profit !== undefined ? item.cod_net_profit : (item.channel === 'cod' ? netProfit : 0);
        if (itemCurr === 'COP' && Math.abs(codProfit) > 0 && Math.abs(codProfit) < 1000 && ((item.cost_purchase && item.cost_purchase > 1000) || (landedCost > 1000))) {
            codProfit = codProfit * 1000;
        }
        const codMargin = item.cod_net_margin_percent !== undefined ? item.cod_net_margin_percent : (item.channel === 'cod' ? netMargin : 0);
        const codBatch = item.cod_total_batch_profit !== undefined ? item.cod_total_batch_profit : (codProfit * batchUnits);

        // Métricas Marketplace
        let mpProfit = item.mp_net_profit !== undefined ? item.mp_net_profit : (item.channel === 'marketplace' ? netProfit : 0);
        if (itemCurr === 'COP' && Math.abs(mpProfit) > 0 && Math.abs(mpProfit) < 1000 && ((item.cost_purchase && item.cost_purchase > 1000) || (landedCost > 1000))) {
            mpProfit = mpProfit * 1000;
        }
        const mpMargin = item.mp_net_margin_percent !== undefined ? item.mp_net_margin_percent : (item.channel === 'marketplace' ? netMargin : 0);
        const mpBatch = item.mp_total_batch_profit !== undefined ? item.mp_total_batch_profit : (mpProfit * batchUnits);

        const isCodActive = item.channel !== 'marketplace';
        const bestChannel = item.best_channel || (codProfit >= mpProfit ? 'cod' : 'marketplace');

        // Textos del Encabezado
        const titleEl = document.getElementById('modalDetailTitle');
        const currBadgeEl = document.getElementById('modalDetailCurrencyBadge');
        const channelBadgeEl = document.getElementById('modalDetailChannelBadge');
        const subTitleEl = document.getElementById('modalDetailSubtitle');

        if (titleEl) titleEl.textContent = item.name || 'Sin nombre';
        if (currBadgeEl) {
            currBadgeEl.textContent = itemCurr;
            currBadgeEl.style.background = itemCurr === 'USD' ? 'rgba(59, 130, 246, 0.15)' : 'rgba(16, 185, 129, 0.15)';
            currBadgeEl.style.color = itemCurr === 'USD' ? '#60a5fa' : '#34d399';
        }
        if (channelBadgeEl) {
            channelBadgeEl.className = isCodActive ? 'calc-channel-pill cod' : 'calc-channel-pill marketplace';
            channelBadgeEl.textContent = isCodActive ? '🚚 Contra Entrega' : '🛒 Marketplace';
        }
        if (subTitleEl) {
            subTitleEl.textContent = `${item.sku ? `SKU: ${item.sku} | ` : ''}Liquidado el ${Utils.formatDate(item.updated_at || new Date().toISOString())} | Mejor canal: ${bestChannel === 'cod' ? '🚚 Contra Entrega' : '🛒 Marketplace'}`;
        }

        // Resultados Principales (Top de Imagen 3)
        const resNetProfitEl = document.getElementById('modalResNetProfit');
        const resMarginBadgeEl = document.getElementById('modalResNetMarginBadge');
        const resPriceAmountEl = document.getElementById('modalResPriceAmount');
        const resPriceLabelEl = document.getElementById('modalResPriceLabel');
        const resPsychologicalEl = document.getElementById('modalResPsychological');
        const resDualLabelEl = document.getElementById('modalResDualLabel');
        const resDualValueEl = document.getElementById('modalResDualValue');

        if (resNetProfitEl) {
            resNetProfitEl.textContent = formatMoney(netProfit, itemCurr);
            resNetProfitEl.style.color = netProfit >= 0 ? '#ffffff' : '#ef4444';
        }
        if (resMarginBadgeEl) {
            resMarginBadgeEl.textContent = `${netMargin.toFixed(1)}%`;
            resMarginBadgeEl.className = `result-badge ${netMargin >= 22 ? 'badge-success' : (netMargin >= 10 ? 'badge-warning' : 'badge-danger')}`;
        }
        if (resPriceAmountEl) resPriceAmountEl.textContent = formatMoney(salePrice, itemCurr);
        if (resPriceLabelEl) resPriceLabelEl.textContent = item.pricing_mode === 'fixed_price' ? 'Precio de Venta Fijado' : 'Precio de Venta Sugerido';

        // Sugerido Comercial / Psicológico
        if (resPsychologicalEl) {
            let psych = salePrice;
            if (itemCurr === 'USD') {
                psych = Math.ceil(salePrice) - 0.01;
                if (psych <= 0) psych = salePrice;
            } else {
                psych = Math.ceil(salePrice / 1000) * 1000 - 100;
                if (psych <= 0) psych = salePrice;
            }
            resPsychologicalEl.textContent = `Sugerido Comercial: ${formatMoney(psych, itemCurr)}`;
        }

        // Fila Bimoneda
        if (resDualLabelEl && resDualValueEl) {
            if (itemCurr === 'USD') {
                const copPrice = Math.round(salePrice * itemRate);
                const copProfit = Math.round(netProfit * itemRate);
                resDualLabelEl.textContent = `Equivalente en Moneda Local (TRM ${formatMoney(itemRate, 'COP')}):`;
                resDualValueEl.textContent = `P. Venta: ${formatMoney(copPrice, 'COP')} | Ganancia: ${formatMoney(copProfit, 'COP')}`;
            } else {
                const usdPrice = (salePrice / itemRate).toFixed(2);
                const usdProfit = (netProfit / itemRate).toFixed(2);
                resDualLabelEl.textContent = `Equivalente en Dólares (TRM ${formatMoney(itemRate, 'COP')}):`;
                resDualValueEl.textContent = `P. Venta: $${usdPrice} USD | Ganancia: $${usdProfit} USD`;
            }
        }

        // Proyección Total del Lote (Imagen 3)
        const batchProfit = item.total_batch_profit || (netProfit * batchUnits);
        const batchRevenue = item.total_batch_revenue || (salePrice * batchUnits);
        const batchCost = landedCost * batchUnits;

        const resBatchUnitsEl = document.getElementById('modalResBatchUnits');
        const resBatchProfitEl = document.getElementById('modalResBatchProfit');
        const resBatchRevenueEl = document.getElementById('modalResBatchRevenue');
        const resBatchCostEl = document.getElementById('modalResBatchCost');

        if (resBatchUnitsEl) resBatchUnitsEl.textContent = batchUnits;
        if (resBatchProfitEl) {
            resBatchProfitEl.textContent = formatMoney(batchProfit, itemCurr);
            resBatchProfitEl.style.color = batchProfit >= 0 ? '#10b981' : '#ef4444';
        }
        if (resBatchRevenueEl) resBatchRevenueEl.textContent = formatMoney(batchRevenue, itemCurr);
        if (resBatchCostEl) resBatchCostEl.textContent = formatMoney(batchCost, itemCurr);

        // 6 KPIs (Imagen 3)
        const kpiLandedEl = document.getElementById('modalKpiLanded');
        const kpiChannelCostEl = document.getElementById('modalKpiChannelCost');
        const kpiBreakEvenEl = document.getElementById('modalKpiBreakEven');
        const kpiMaxCpaEl = document.getElementById('modalKpiMaxCpa');
        const labelMaxCpaEl = document.getElementById('modalLabelMaxCpa');
        const kpiRoiEl = document.getElementById('modalKpiRoi');
        const kpiRoasEl = document.getElementById('modalKpiRoas');

        if (kpiLandedEl) kpiLandedEl.textContent = formatMoney(landedCost, itemCurr);

        // Costo Operativo
        let operCost = 0;
        if (isCodActive) {
            const pCancel = Math.min(0.9, (item.cancel_rate || 0) / 100);
            const pReturn = Math.min(0.9, (item.return_rate || 0) / 100);
            const ineff = Math.min(0.92, pCancel + pReturn);
            const realCpa = ineff < 1 ? (item.sale_cpa || 0) / (1 - ineff) : (item.sale_cpa || 0);
            const realFreight = pReturn < 1 ? ((item.freight_out || 0) + (pReturn * (item.freight_return || item.freight_out || 0))) / (1 - pReturn) : (item.freight_out || 0);
            const recaudo = salePrice * ((item.cod_fee_percent || 0) / 100);
            operCost = realCpa + realFreight + (item.cost_admin || 0) + recaudo;
        } else {
            const mpFee = salePrice * ((item.marketplace_fee_percent || 0) / 100);
            const mpTax = salePrice * ((item.marketplace_tax_percent || 0) / 100);
            const mpAds = salePrice * ((item.marketplace_ads_percent || 0) / 100);
            operCost = mpFee + mpTax + mpAds + (item.marketplace_fixed_fee || 0) + (item.marketplace_shipping_cost || 0);
        }

        if (kpiChannelCostEl) kpiChannelCostEl.textContent = formatMoney(operCost, itemCurr);
        if (kpiBreakEvenEl) kpiBreakEvenEl.textContent = formatMoney(item.break_even_price || (landedCost + operCost), itemCurr);

        if (isCodActive) {
            if (labelMaxCpaEl) labelMaxCpaEl.textContent = 'CPA Máximo Permitido';
            if (kpiMaxCpaEl) kpiMaxCpaEl.textContent = formatMoney(item.break_even_cpa || 0, itemCurr);
            if (kpiRoasEl) {
                const cpa = item.sale_cpa || 0;
                kpiRoasEl.textContent = (cpa > 0 && salePrice > 0 ? (salePrice / cpa).toFixed(2) : '0.00') + 'x';
            }
        } else {
            if (labelMaxCpaEl) labelMaxCpaEl.textContent = 'Comisión Total Plataforma';
            const totalMpComm = salePrice * (((item.marketplace_fee_percent || 0) + (item.marketplace_tax_percent || 0) + (item.marketplace_ads_percent || 0)) / 100);
            if (kpiMaxCpaEl) kpiMaxCpaEl.textContent = formatMoney(totalMpComm, itemCurr);
            if (kpiRoasEl) kpiRoasEl.textContent = 'N/A (Orgánico)';
        }

        const roi = landedCost > 0 ? (netProfit / landedCost) * 100 : 0;
        if (kpiRoiEl) {
            kpiRoiEl.textContent = `${roi.toFixed(1)}%`;
            kpiRoiEl.style.color = roi >= 0 ? '#10b981' : '#ef4444';
        }

        // Distribución del Precio de Venta (Barra segmentada de Imagen 3)
        let freightCost = 0;
        let adsCost = 0;
        if (isCodActive) {
            const pReturn = Math.min(0.9, (item.return_rate || 0) / 100);
            freightCost = pReturn < 1 ? ((item.freight_out || 0) + (pReturn * (item.freight_return || item.freight_out || 0))) / (1 - pReturn) : (item.freight_out || 0);
            const ineff = Math.min(0.92, ((item.cancel_rate || 0) + (item.return_rate || 0)) / 100);
            adsCost = ineff < 1 ? (item.sale_cpa || 0) / (1 - ineff) : (item.sale_cpa || 0);
        } else {
            freightCost = (item.marketplace_shipping_cost || 0);
            adsCost = (salePrice * (((item.marketplace_fee_percent || 0) + (item.marketplace_tax_percent || 0) + (item.marketplace_ads_percent || 0)) / 100)) + (item.marketplace_fixed_fee || 0);
        }

        const safePrice = Math.max(1, salePrice);
        const pLanded = Math.max(0, Math.min(100, (landedCost / safePrice) * 100));
        const pFreight = Math.max(0, Math.min(100, (freightCost / safePrice) * 100));
        const pAds = Math.max(0, Math.min(100, (adsCost / safePrice) * 100));
        const pProfit = Math.max(0, Math.min(100, (Math.max(0, netProfit) / safePrice) * 100));

        const segLanded = document.getElementById('modalSegLanded');
        const segFreight = document.getElementById('modalSegFreight');
        const segAds = document.getElementById('modalSegAds');
        const segProfit = document.getElementById('modalSegProfit');

        if (segLanded) segLanded.style.width = `${pLanded}%`;
        if (segFreight) segFreight.style.width = `${pFreight}%`;
        if (segAds) segAds.style.width = `${pAds}%`;
        if (segProfit) segProfit.style.width = `${pProfit}%`;

        const landedBatch = landedCost * batchUnits;
        const freightBatch = freightCost * batchUnits;
        const adsBatch = adsCost * batchUnits;
        const profitBatch = netProfit * batchUnits;

        const legLanded = document.getElementById('modalLegLanded');
        const legFreight = document.getElementById('modalLegFreight');
        const legAds = document.getElementById('modalLegAds');
        const legProfit = document.getElementById('modalLegProfit');

        if (legLanded) legLanded.textContent = `${formatMoney(landedCost, itemCurr)} (${pLanded.toFixed(0)}%)`;
        if (legFreight) legFreight.textContent = `${formatMoney(freightCost, itemCurr)} (${pFreight.toFixed(0)}%)`;
        if (legAds) legAds.textContent = `${formatMoney(adsCost, itemCurr)} (${pAds.toFixed(0)}%)`;
        if (legProfit) legProfit.textContent = `${formatMoney(netProfit, itemCurr)} (${pProfit.toFixed(0)}%)`;

        const modalLegLandedBatch = document.getElementById('modalLegLandedBatch');
        const modalLegFreightBatch = document.getElementById('modalLegFreightBatch');
        const modalLegAdsBatch = document.getElementById('modalLegAdsBatch');
        const modalLegProfitBatch = document.getElementById('modalLegProfitBatch');

        if (modalLegLandedBatch) modalLegLandedBatch.textContent = `Lote: ${formatMoney(landedBatch, itemCurr)}`;
        if (modalLegFreightBatch) modalLegFreightBatch.textContent = `Lote: ${formatMoney(freightBatch, itemCurr)}`;
        if (modalLegAdsBatch) modalLegAdsBatch.textContent = `Lote: ${formatMoney(adsBatch, itemCurr)}`;
        if (modalLegProfitBatch) modalLegProfitBatch.textContent = `Lote: ${formatMoney(profitBatch, itemCurr)}`;

        const modalLegBatchBadge = document.getElementById('modalLegBatchBadge');
        if (modalLegBatchBadge) modalLegBatchBadge.textContent = `Lote: ${batchUnits} unid.`;

        // Comparativa Instantánea de Canales (Imagen 3)
        const colCod = document.getElementById('modalColCod');
        const colMp = document.getElementById('modalColMp');
        const badgeCod = document.getElementById('modalBadgeCodStatus');
        const badgeMp = document.getElementById('modalBadgeMpStatus');

        if (colCod) colCod.className = `calc-compare-col ${isCodActive ? 'is-active' : ''}`;
        if (colMp) colMp.className = `calc-compare-col ${!isCodActive ? 'is-active' : ''}`;

        if (badgeCod) {
            badgeCod.textContent = isCodActive ? 'ACTIVO' : (bestChannel === 'cod' ? 'MÁS RENTABLE' : 'SIMULADO');
            badgeCod.className = `badge ${isCodActive ? 'badge-primary' : (bestChannel === 'cod' ? 'badge-success' : '')}`;
        }
        if (badgeMp) {
            badgeMp.textContent = !isCodActive ? 'ACTIVO' : (bestChannel === 'marketplace' ? 'MÁS RENTABLE' : 'SIMULADO');
            badgeMp.className = `badge ${!isCodActive ? 'badge-primary' : (bestChannel === 'marketplace' ? 'badge-success' : '')}`;
        }

        const cmpCodProfit = document.getElementById('modalCompareCodProfit');
        const cmpCodMargin = document.getElementById('modalCompareCodMargin');
        const cmpMpProfit = document.getElementById('modalCompareMpProfit');
        const cmpMpMargin = document.getElementById('modalCompareMpMargin');

        if (cmpCodProfit) {
            cmpCodProfit.textContent = formatMoney(codProfit, itemCurr);
            cmpCodProfit.style.color = codProfit >= 0 ? '#10b981' : '#ef4444';
        }
        if (cmpCodMargin) cmpCodMargin.textContent = `${codMargin.toFixed(1)}%`;

        if (cmpMpProfit) {
            cmpMpProfit.textContent = formatMoney(mpProfit, itemCurr);
            cmpMpProfit.style.color = mpProfit >= 0 ? '#60a5fa' : '#ef4444';
        }
        if (cmpMpMargin) cmpMpMargin.textContent = `${mpMargin.toFixed(1)}%`;

        // Ofertas y combos guardados de esta liquidación
        const modalOffersCard = document.getElementById('modalOffersCard');
        const modalOffersBody = document.getElementById('modalOffersBody');
        let detailOffers = item.offer_items;
        if (typeof detailOffers === 'string') {
            try { detailOffers = JSON.parse(detailOffers); } catch (e) { detailOffers = []; }
        }
        if (modalOffersCard && modalOffersBody) {
            if (Array.isArray(detailOffers) && detailOffers.length) {
                modalOffersCard.style.display = '';
                modalOffersBody.innerHTML = detailOffers.map(o => {
                    const profit = Number(o.profit) || 0;
                    const margin = Number(o.margin_percent) || 0;
                    return `<tr>
                        <td><strong>${Number(o.units) || 1} por ${formatMoney(Number(o.price) || 0, itemCurr)}</strong></td>
                        <td>${formatMoney(Number(o.unit_price_eff) || 0, itemCurr)}</td>
                        <td style="color: ${profit >= 0 ? '#10b981' : '#ef4444'}; font-weight: 700;">${formatMoney(profit, itemCurr)}</td>
                        <td>${margin.toFixed(1)}%</td>
                        <td>${formatMoney(Number(o.profit_per_unit) || 0, itemCurr)}</td>
                        <td>${formatMoney(Number(o.max_cpa) || 0, itemCurr)}</td>
                    </tr>`;
                }).join('');
            } else {
                modalOffersCard.style.display = 'none';
                modalOffersBody.innerHTML = '';
            }
        }

        // Acciones del Footer del Modal
        const btnLoad = document.getElementById('btnModalLoadCalculator');
        const btnPdf = document.getElementById('btnModalExportPdf');

        if (btnLoad) {
            btnLoad.onclick = () => {
                closeLiquidationDetail();
                loadLiquidation(item.id);
            };
        }
        if (btnPdf) {
            btnPdf.onclick = () => {
                exportPdf(item.id);
            };
        }

        // Mostrar modal con animación
        modal.style.display = 'flex';
        setTimeout(() => {
            modal.classList.add('is-open');
        }, 10);
        document.body.style.overflow = 'hidden';
    }

    /**
     * Cerrar Modal de Detalles
     */
    function closeLiquidationDetail() {
        const modal = document.getElementById('modalLiquidationDetail');
        if (!modal) return;

        modal.classList.remove('is-open');
        setTimeout(() => {
            modal.style.display = 'none';
            document.body.style.overflow = '';
        }, 220);
    }

    /**
     * Cargar una liquidación guardada en la calculadora
     */
    function loadLiquidation(id) {
        const item = savedLiquidations.find(l => l.id === id);
        if (!item) return;

        currentLiquidationId = item.id;
        currentCurrency = item.currency || 'COP';
        exchangeRate = item.exchange_rate != null ? Number(item.exchange_rate) : 4000;

        setVal('calcProductName', item.name || '');
        setVal('calcProductSku', item.sku || '');
        setVal('calcCurrency', currentCurrency);
        setVal('calcExchangeRate', exchangeRate);

        const isBatch = item.cost_mode === 'batch';
        setVal('calcCostMode', item.cost_mode || 'unit');
        const batchUnits = item.batch_units != null ? Number(item.batch_units) : 100;
        setVal('calcBatchUnits', batchUnits);
        setVal('calcBatchUnitsResult', batchUnits);
        const batchGroup = document.getElementById('calcBatchGroup');
        if (batchGroup) batchGroup.style.display = isBatch ? 'block' : 'none';
        updateCostLabels(isBatch);

        setVal('calcCostPurchase', item.cost_purchase != null ? item.cost_purchase : 0);
        setVal('calcCostShippingMain', item.cost_shipping_main != null ? item.cost_shipping_main : 0);
        setVal('calcCostCustoms', item.cost_customs != null ? item.cost_customs : 0);
        setVal('calcCostShippingLocal', item.cost_shipping_local != null ? item.cost_shipping_local : 0);
        setVal('calcCostPackaging', item.cost_packaging != null ? item.cost_packaging : 0);
        setVal('calcCostFulfillment', item.cost_fulfillment != null ? item.cost_fulfillment : 0);
        setVal('calcCostOther', item.cost_other != null ? item.cost_other : 0);

        // Costos estándar ocultados y costos personalizados guardados
        let savedHidden = item.cost_hidden_fields;
        if (typeof savedHidden === 'string') {
            try { savedHidden = JSON.parse(savedHidden); } catch (e) { savedHidden = []; }
        }
        hiddenCosts = Array.isArray(savedHidden)
            ? savedHidden.filter(k => STANDARD_COSTS[k])
            : [];
        applyHiddenCosts();

        extraCosts = [];
        let savedExtras = item.cost_extra_items;
        if (typeof savedExtras === 'string') {
            try { savedExtras = JSON.parse(savedExtras); } catch (e) { savedExtras = []; }
        }
        if (Array.isArray(savedExtras)) {
            savedExtras.forEach(c => {
                extraCosts.push({
                    id: 'ec_' + (++extraSeq) + '_' + Math.random().toString(36).substr(2, 4),
                    label: c.label || '',
                    amount: Number(c.amount) || 0,
                    scope: c.scope === 'unit' ? 'unit' : 'batch'
                });
            });
        }
        renderExtraCosts();

        // Ofertas / combos guardados
        offersPackOnce = item.offers_pack_once !== false;
        const packChkLoad = document.getElementById('calcOfferPackOnce');
        if (packChkLoad) packChkLoad.checked = offersPackOnce;

        let savedOffers = item.offer_items;
        if (typeof savedOffers === 'string') {
            try { savedOffers = JSON.parse(savedOffers); } catch (e) { savedOffers = []; }
        }
        offers = Array.isArray(savedOffers) && savedOffers.length
            ? savedOffers.map(o => ({
                id: 'of_' + (++offersSeq) + '_' + Math.random().toString(36).substr(2, 4),
                units: Math.max(1, Math.round(Number(o.units) || 1)),
                price: Math.max(0, Number(o.price) || 0)
            }))
            : [];

        // COD
        setVal('calcCpa', item.sale_cpa != null ? item.sale_cpa : 0);
        setVal('calcCancelacion', item.cancel_rate != null ? item.cancel_rate : 0);
        setVal('calcDevolucion', item.return_rate != null ? item.return_rate : 0);
        setVal('calcFlete', item.freight_out != null ? item.freight_out : 0);
        setVal('calcFleteRetorno', item.freight_return != null ? item.freight_return : 0);
        setVal('calcRecaudoPercent', item.cod_fee_percent != null ? item.cod_fee_percent : 0);
        setVal('calcAdmin', item.cost_admin != null ? item.cost_admin : 0);

        // Marketplace
        if (item.marketplace_name) setVal('calcMpPreset', item.marketplace_name);
        setVal('calcMpFeePercent', item.marketplace_fee_percent != null ? item.marketplace_fee_percent : 0);
        setVal('calcMpFixedFee', item.marketplace_fixed_fee != null ? item.marketplace_fixed_fee : 0);
        setVal('calcMpShipping', item.marketplace_shipping_cost != null ? item.marketplace_shipping_cost : 0);
        setVal('calcMpTaxPercent', item.marketplace_tax_percent != null ? item.marketplace_tax_percent : 0);
        setVal('calcMpAdsPercent', item.marketplace_ads_percent != null ? item.marketplace_ads_percent : 0);

        // Pricing
        setVal('calcTargetMarginType', item.target_margin_type || 'margin_percent');
        setVal('calcTargetMarginValue', item.target_margin_value != null ? item.target_margin_value : 25);

        let salePrice = item.sale_price != null ? item.sale_price : 0;
        // Auto-corrección si se guardó anteriormente truncado por el bug de formato de miles (ej: 50 en lugar de 50000)
        if (currentCurrency === 'COP' && salePrice > 0 && salePrice < 1000 && ((item.cost_purchase && item.cost_purchase > 1000) || (item.total_landed_cost && item.total_landed_cost > 1000))) {
            salePrice = salePrice * 1000;
        }
        setVal('calcVenta', salePrice);

        updateCurrencyUI();
        switchChannel(item.channel || 'cod');
        switchPricingMode(item.pricing_mode || 'fixed_price');

        // Ir a la pestaña de calculadora activa
        switchMainTab('active');
        calculate();

        Utils.showToast(`Liquidación "${item.name}" cargada en ${currentCurrency}`, 'success');
    }

    /**
     * Duplicar una liquidación existente
     */
    async function duplicateLiquidation(id) {
        const item = savedLiquidations.find(l => l.id === id);
        if (!item) return;

        const copy = {
            ...item,
            id: 'liq_' + Date.now().toString(36) + Math.random().toString(36).substr(2, 4),
            name: `${item.name} (Copia)`,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
        };

        if (typeof Database !== 'undefined' && Database.saveProductLiquidation) {
            await Database.saveProductLiquidation(copy);
        } else {
            savedLiquidations.unshift(copy);
            localStorage.setItem('antigravity_product_liquidations', JSON.stringify(savedLiquidations));
        }

        Utils.showToast(`Liquidación clonada como "${copy.name}"`, 'info');
        await loadSavedLiquidations();
    }

    /**
     * Eliminar una liquidación
     */
    async function deleteLiquidation(id) {
        const item = savedLiquidations.find(l => l.id === id);
        const name = item ? item.name : 'esta liquidación';

        if (!confirm(`¿Estás seguro de que deseas eliminar permanentemente "${name}"?`)) {
            return;
        }

        try {
            if (typeof Database !== 'undefined' && Database.deleteProductLiquidation) {
                await Database.deleteProductLiquidation(id);
            } else {
                savedLiquidations = savedLiquidations.filter(l => l.id !== id);
                localStorage.setItem('antigravity_product_liquidations', JSON.stringify(savedLiquidations));
            }

            if (currentLiquidationId === id) {
                currentLiquidationId = null;
            }

            Utils.showToast(`Liquidación "${name}" eliminada`, 'warning');
            await loadSavedLiquidations();
        } catch (e) {
            console.error('Error deleting liquidation:', e);
            Utils.showToast('Error al eliminar la liquidación', 'error');
        }
    }

    /**
     * Exportar reporte detallado en PDF
     */
    function exportPdf(id) {
        const item = savedLiquidations.find(l => l.id === id);
        if (!item) return;

        if (!window.jspdf || !window.jspdf.jsPDF) {
            alert('La librería jsPDF no está disponible en este momento.');
            return;
        }

        const { jsPDF } = window.jspdf;
        const doc = new jsPDF();
        const itemCurr = item.currency || 'COP';
        const itemRate = item.exchange_rate || 4000;

        // Encabezado
        doc.setFillColor(30, 30, 56);
        doc.rect(0, 0, 210, 34, 'F');
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(18);
        doc.setFont('helvetica', 'bold');
        doc.text('HOJA DE LIQUIDACIÓN Y COSTEO', 14, 16);
        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
        doc.text(`Fecha: ${Utils.formatDate(item.updated_at || new Date().toISOString())} | Canal: ${item.channel === 'marketplace' ? 'Marketplace' : 'Pago Contra Entrega'} | Moneda: ${itemCurr} (TRM: ${formatMoney(itemRate, 'COP')})`, 14, 26);

        // Datos del Producto
        doc.setTextColor(30, 30, 30);
        doc.setFontSize(13);
        doc.setFont('helvetica', 'bold');
        doc.text(`Producto: ${item.name || 'Sin nombre'}`, 14, 45);
        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
        if (item.sku) doc.text(`SKU / Ref: ${item.sku}`, 14, 52);

        // Tabla de Costos Landed
        let y = 64;
        doc.setFont('helvetica', 'bold');
        doc.setFillColor(240, 240, 248);
        doc.rect(14, y - 5, 182, 8, 'F');
        doc.text(`1. DESGLOSE DE COSTO PUESTO EN BODEGA (${itemCurr})`, 16, y);
        y += 8;

        doc.setFont('helvetica', 'normal');
        const hiddenPdf = Array.isArray(item.cost_hidden_fields) ? item.cost_hidden_fields : [];
        const landedRows = [
            ['Costo Base de Compra / Proveedor', formatMoney(item.cost_purchase || 0, itemCurr)],
            ['Transporte / Flete Principal', formatMoney(item.cost_shipping_main || 0, itemCurr), 'shipping_main'],
            ['Arancel / Aduana / Impuestos Importación', formatMoney(item.cost_customs || 0, itemCurr), 'customs'],
            ['Transporte Local / Acarreo a Bodega', formatMoney(item.cost_shipping_local || 0, itemCurr), 'shipping_local'],
            ['Empaque y Embalaje de Despacho', formatMoney(item.cost_packaging || 0, itemCurr), 'packaging'],
            ['Picking, Packing y Almacenamiento', formatMoney(item.cost_fulfillment || 0, itemCurr), 'fulfillment'],
            ['Otros Gastos Directos', formatMoney(item.cost_other || 0, itemCurr), 'other'],
        ].filter(row => !row[2] || !hiddenPdf.includes(row[2]));

        // Añadir los costos personalizados definidos para este producto
        let pdfExtras = item.cost_extra_items;
        if (typeof pdfExtras === 'string') {
            try { pdfExtras = JSON.parse(pdfExtras); } catch (e) { pdfExtras = []; }
        }
        if (Array.isArray(pdfExtras)) {
            pdfExtras.forEach(c => {
                const scopeTag = (item.cost_mode === 'batch' && c.scope !== 'unit') ? ' (total lote)' : '';
                landedRows.push([`${c.label || 'Costo adicional'}${scopeTag}`, formatMoney(Number(c.amount) || 0, itemCurr)]);
            });
        }

        landedRows.forEach(([concept, val]) => {
            doc.text(concept, 16, y);
            doc.text(val, 190, y, { align: 'right' });
            y += 6;
        });

        doc.setFont('helvetica', 'bold');
        doc.text('TOTAL COSTO LANDED UNITARIO:', 16, y + 2);
        doc.text(formatMoney(item.total_landed_cost || 0, itemCurr), 190, y + 2, { align: 'right' });
        y += 14;

        // Variables Canal 1: Contra Entrega (COD)
        doc.setFillColor(240, 240, 248);
        doc.rect(14, y - 5, 182, 8, 'F');
        doc.text(`2. CANAL PAGO CONTRA ENTREGA (COD)`, 16, y);
        y += 8;

        const codProfit = item.cod_net_profit !== undefined ? item.cod_net_profit : (item.channel === 'cod' ? item.net_profit : 0);
        const codMargin = item.cod_net_margin_percent !== undefined ? item.cod_net_margin_percent : (item.channel === 'cod' ? item.net_margin_percent : 0);
        const batchUnitsForPdf = item.batch_units || 100;
        const codBatchProfit = item.cod_total_batch_profit !== undefined ? item.cod_total_batch_profit : (codProfit * batchUnitsForPdf);

        doc.setFont('helvetica', 'normal');
        const codRows = [
            ['Publicidad CPA (Meta / TikTok)', formatMoney(item.sale_cpa || 0, itemCurr)],
            ['Tasa Cancelación / Devolución', `${item.cancel_rate || 0}% canc. / ${item.return_rate || 0}% dev.`],
            ['Fletes (Entrega / Retorno)', `${formatMoney(item.freight_out || 0, itemCurr)} / ${formatMoney(item.freight_return || 0, itemCurr)}`],
            ['Comisión Recaudo + Costo Operativo', `${item.cod_fee_percent || 0}% + ${formatMoney(item.cost_admin || 0, itemCurr)}`],
            ['Utilidad Neta Unitaria COD', `${formatMoney(codProfit, itemCurr)} (${codMargin.toFixed(1)}% margen)`],
            ['Ganancia Total Lote COD (' + batchUnitsForPdf + ' unid.)', formatMoney(codBatchProfit, itemCurr)]
        ];

        codRows.forEach(([concept, val]) => {
            doc.text(concept, 16, y);
            doc.text(val, 190, y, { align: 'right' });
            y += 6;
        });

        y += 4;

        // Variables Canal 2: Marketplace
        doc.setFont('helvetica', 'bold');
        doc.setFillColor(240, 240, 248);
        doc.rect(14, y - 5, 182, 8, 'F');
        doc.text(`3. CANAL MARKETPLACE (${item.marketplace_name || 'Estándar'})`, 16, y);
        y += 8;

        const mpProfit = item.mp_net_profit !== undefined ? item.mp_net_profit : (item.channel === 'marketplace' ? item.net_profit : 0);
        const mpMargin = item.mp_net_margin_percent !== undefined ? item.mp_net_margin_percent : (item.channel === 'marketplace' ? item.net_margin_percent : 0);
        const mpBatchProfit = item.mp_total_batch_profit !== undefined ? item.mp_total_batch_profit : (mpProfit * batchUnitsForPdf);

        doc.setFont('helvetica', 'normal');
        const mpRows = [
            ['Comisión Plataforma + Retenciones', `${item.marketplace_fee_percent || 0}% + ${item.marketplace_tax_percent || 0}% imp.`],
            ['Cargo Fijo por Venta', formatMoney(item.marketplace_fixed_fee || 0, itemCurr)],
            ['Envío Gratis Asumido Vendedor', formatMoney(item.marketplace_shipping_cost || 0, itemCurr)],
            ['Utilidad Neta Unitaria Marketplace', `${formatMoney(mpProfit, itemCurr)} (${mpMargin.toFixed(1)}% margen)`],
            ['Ganancia Total Lote Marketplace (' + batchUnitsForPdf + ' unid.)', formatMoney(mpBatchProfit, itemCurr)]
        ];

        mpRows.forEach(([concept, val]) => {
            doc.text(concept, 16, y);
            doc.text(val, 190, y, { align: 'right' });
            y += 6;
        });

        y += 5;

        // 4. Cuadro Comparativo & Canal Ganador
        doc.setFillColor(30, 30, 56);
        doc.rect(14, y - 5, 182, 8, 'F');
        doc.setTextColor(255, 255, 255);
        doc.setFont('helvetica', 'bold');
        doc.text('4. COMPARATIVA ENTRE CANALES Y CANAL RECOMENDADO', 16, y);
        y += 10;
        doc.setTextColor(30, 30, 30);

        doc.setFontSize(10);
        doc.text('Precio de Venta Base:', 16, y);
        doc.text(formatMoney(item.sale_price || 0, itemCurr), 190, y, { align: 'right' });
        y += 6;

        const isCodWin = codProfit >= mpProfit;
        const profitDiff = Math.abs(codProfit - mpProfit);
        const batchDiff = Math.abs(codBatchProfit - mpBatchProfit);

        doc.text('Ganancia Unitaria: Contra Entrega vs Marketplace:', 16, y);
        doc.text(`${formatMoney(codProfit, itemCurr)} vs ${formatMoney(mpProfit, itemCurr)}`, 190, y, { align: 'right' });
        y += 6;

        doc.text(`Ganancia Total Lote (${batchUnitsForPdf} unid.): COD vs MP:`, 16, y);
        doc.text(`${formatMoney(codBatchProfit, itemCurr)} vs ${formatMoney(mpBatchProfit, itemCurr)}`, 190, y, { align: 'right' });
        y += 7;

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(11);
        doc.text('CANAL MÁS RENTABLE:', 16, y);
        doc.setTextColor(16, 185, 129);
        const winChannelText = isCodWin
            ? `PAGO CONTRA ENTREGA (+${formatMoney(profitDiff, itemCurr)}/u | +${formatMoney(batchDiff, itemCurr)} en el lote)`
            : `MARKETPLACE (+${formatMoney(profitDiff, itemCurr)}/u | +${formatMoney(batchDiff, itemCurr)} en el lote)`;
        doc.text(winChannelText, 190, y, { align: 'right' });
        doc.setTextColor(30, 30, 30);
        doc.setFont('helvetica', 'normal');

        // 5. Ofertas y combos multi-unidad
        let pdfOffers = item.offer_items;
        if (typeof pdfOffers === 'string') {
            try { pdfOffers = JSON.parse(pdfOffers); } catch (e) { pdfOffers = []; }
        }
        if (Array.isArray(pdfOffers) && pdfOffers.length) {
            y += 12;
            if (y > 235) { doc.addPage(); y = 25; }
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(10);
            doc.setFillColor(240, 240, 248);
            doc.rect(14, y - 5, 182, 8, 'F');
            doc.text('5. OFERTAS Y COMBOS (UN ENVIO Y UN CPA POR PEDIDO)', 16, y);
            y += 8;

            doc.setFont('helvetica', 'normal');
            doc.setFontSize(9);
            doc.text('Oferta', 16, y);
            doc.text('Precio', 86, y, { align: 'right' });
            doc.text('$/unid.', 112, y, { align: 'right' });
            doc.text('Ganancia', 146, y, { align: 'right' });
            doc.text('Margen', 168, y, { align: 'right' });
            doc.text('CPA máx.', 196, y, { align: 'right' });
            y += 5;

            pdfOffers.forEach(o => {
                if (y > 275) { doc.addPage(); y = 25; }
                const units = Number(o.units) || 1;
                doc.text(units + ' x 1 pedido', 16, y);
                doc.text(formatMoney(Number(o.price) || 0, itemCurr), 86, y, { align: 'right' });
                doc.text(formatMoney(Number(o.unit_price_eff) || 0, itemCurr), 112, y, { align: 'right' });
                doc.text(formatMoney(Number(o.profit) || 0, itemCurr), 146, y, { align: 'right' });
                doc.text((Number(o.margin_percent) || 0).toFixed(1) + '%', 168, y, { align: 'right' });
                doc.text(formatMoney(Number(o.max_cpa) || 0, itemCurr), 196, y, { align: 'right' });
                y += 5.5;
            });
            doc.setFontSize(10);
        }

        // Guardar archivo
        const safeName = (item.name || 'producto').replace(/[^a-zA-Z0-9_-]/g, '_');
        doc.save(`Liquidacion_Comparativa_${safeName}_${itemCurr}.pdf`);
        Utils.showToast('PDF comparativo de ambos canales generado con éxito', 'success');
    }

    function resetInit() {
        initialized = false;
    }

    return {
        init,
        resetInit,
        calculate,
        addOffer,
        removeOffer,
        resetCalculator,
        saveCurrentLiquidation,
        loadLiquidation,
        duplicateLiquidation,
        deleteLiquidation,
        exportPdf,
        switchMainTab,
        switchChannel,
        switchPricingMode,
        switchCurrency,
        showLiquidationDetail,
        closeLiquidationDetail
    };
})();

// Exponer globalmente
window.CalculatorModule = CalculatorModule;
