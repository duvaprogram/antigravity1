/* ========================================
   Calculadora de Liquidaciones y Precios
   Módulo Avanzado Multicanal (COD & Marketplace)
   ======================================== */

const CalculatorModule = (() => {
    // Estado interno del módulo
    let currentChannel = 'cod'; // 'cod' | 'marketplace'
    let pricingMode = 'target_margin'; // 'target_margin' | 'fixed_price'
    let currentLiquidationId = null;
    let savedLiquidations = [];
    let productsCatalog = [];
    let initialized = false;

    // Presets de Marketplace
    const MP_PRESETS = {
        'ml_clasica': { fee: 14.0, fixed: 2000, shipping: 0, tax: 1.5, ads: 0 },
        'ml_premium': { fee: 18.5, fixed: 2000, shipping: 0, tax: 1.5, ads: 0 },
        'amazon': { fee: 15.0, fixed: 0, shipping: 0, tax: 2.0, ads: 0 },
        'falabella': { fee: 15.0, fixed: 1500, shipping: 0, tax: 1.5, ads: 0 },
        'custom': null
    };

    /**
     * Inicializar módulo
     */
    async function init() {
        console.log('Iniciando CalculatorModule avanzado...');
        bindEvents();
        await loadProductsCatalog();
        await loadSavedLiquidations();
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

        // Selector de catálogo de productos
        const selectProduct = document.getElementById('calcProductSelect');
        if (selectProduct) {
            selectProduct.addEventListener('change', handleProductSelect);
        }

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
                    setVal('calcMpFixedFee', preset.fixed);
                    setVal('calcMpShipping', preset.shipping);
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
                    else label.textContent = 'Ganancia Neta Deseada ($)';
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
            'calcTargetMarginValue', 'calcVenta'
        ];

        allInputIds.forEach(id => {
            const el = document.getElementById(id);
            if (el) {
                el.addEventListener('input', Utils.debounce(calculate, 80));
            }
        });

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
     * Actualiza etiquetas según modo unitario o por lote
     */
    function updateCostLabels(isBatch) {
        const pLabel = document.getElementById('labelCostPurchase');
        const sLabel = document.getElementById('labelCostShippingMain');
        const cLabel = document.getElementById('labelCostCustoms');
        const lLabel = document.getElementById('labelCostShippingLocal');

        if (pLabel) pLabel.textContent = isBatch ? 'Costo Total Lote Compra ($)' : 'Costo de Compra ($)';
        if (sLabel) sLabel.textContent = isBatch ? 'Flete Total Principal Lote ($)' : 'Flete Principal / Int. ($)';
        if (cLabel) cLabel.textContent = isBatch ? 'Aranceles / Aduana Total Lote ($)' : 'Arancel / Aduana ($)';
        if (lLabel) lLabel.textContent = isBatch ? 'Acarreo Total Lote a Bodega ($)' : 'Acarreo / Flete Local ($)';
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

        // Obtener costo real si está codificado
        let cost = 0;
        if (typeof ProductsModule !== 'undefined' && ProductsModule.getRealCost) {
            cost = ProductsModule.getRealCost(prod);
        } else {
            cost = parseFloat(prod.cost) || 0;
        }

        if (cost > 0) {
            setVal('calcCostPurchase', cost);
        }

        if (prod.price && parseFloat(prod.price) > 0) {
            setVal('calcVenta', parseFloat(prod.price));
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
     * Calcula precio psicológico (ej: redondear a 900 o 990 o entero)
     */
    function computePsychologicalPrice(price) {
        if (price <= 0) return 0;
        if (price > 1000) {
            // Moneda tipo COP o escala de miles (redondea a múltiplos de 900)
            const base = Math.floor(price / 1000) * 1000;
            if (price <= base + 900) {
                return base + 900;
            } else {
                return base + 1900;
            }
        } else {
            // Moneda tipo USD con centavos (ej: 19.99 o 24.90)
            const intPart = Math.floor(price);
            return intPart + 0.99;
        }
    }

    /**
     * MOTOR MATEMÁTICO PRINCIPAL
     */
    function calculate() {
        const isBatch = getText('calcCostMode', 'unit') === 'batch';
        const batchUnits = Math.max(1, getNum('calcBatchUnits', 1));

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

        const landedCost = purchaseU + shippingMainU + customsU + shippingLocalU + packaging + fulfillment + otherU;

        // Actualizar Badge de Landed
        const badgeLanded = document.getElementById('badgeLandedCost');
        if (badgeLanded) {
            badgeLanded.textContent = `Landed: ${Utils.formatCurrency(landedCost)}`;
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
            // Calcular precio recomendado para COD
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

            // Cálculos con finalSalePrice
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
            breakEvenCpa = 0; // Sin CPA en marketplace
            minRoas = 0;
        }

        // 4. Simulación comparativa simultánea de ambos canales al mismo precio
        const simCodProfit = finalSalePrice - (finalSalePrice * recaudoRate) - codFixedCosts;
        const simCodMargin = finalSalePrice > 0 ? (simCodProfit / finalSalePrice) * 100 : 0;

        const simMpProfit = (finalSalePrice * (1 - mpPercentTotal)) - mpFixedCosts;
        const simMpMargin = finalSalePrice > 0 ? (simMpProfit / finalSalePrice) * 100 : 0;

        // 5. Actualizar UI en vivo
        updateUI({
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
            simMpMargin
        });
    }

    /**
     * Renderizar métricas en la interfaz
     */
    function updateUI(data) {
        // Utilidad Neta y Badge
        const resProfit = document.getElementById('resUtilidadNeta');
        const resMargin = document.getElementById('resUtilidadNetaPercent');
        if (resProfit) resProfit.textContent = Utils.formatCurrency(data.netProfit);
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
            resPriceValue.textContent = Utils.formatCurrency(data.finalSalePrice);
        }
        if (resPsych) {
            resPsych.textContent = `Sugerido Comercial: ${Utils.formatCurrency(data.psychologicalPrice)}`;
        }

        // KPIs
        const resLanded = document.getElementById('resLandedTotal');
        const resChannelCost = document.getElementById('resChannelTotalCost');
        const resBePrice = document.getElementById('resBreakEvenPrice');
        const resBeCpa = document.getElementById('resBreakEvenCpa');
        const labelBeCpa = document.getElementById('labelBreakEvenCpa');
        const resRoi = document.getElementById('resRoi');
        const resMinRoas = document.getElementById('resMinRoas');

        if (resLanded) resLanded.textContent = Utils.formatCurrency(data.landedCost);
        if (resChannelCost) resChannelCost.textContent = Utils.formatCurrency(data.channelOperationalCost);
        if (resBePrice) resBePrice.textContent = Utils.formatCurrency(data.breakEvenPrice);
        if (resRoi) resRoi.textContent = `${data.roiPercent.toFixed(1)}%`;

        if (resBeCpa && labelBeCpa) {
            if (currentChannel === 'cod') {
                labelBeCpa.textContent = 'CPA Máximo Permitido';
                resBeCpa.textContent = Utils.formatCurrency(data.breakEvenCpa);
            } else {
                labelBeCpa.textContent = 'Ahorro s/ Publicidad';
                resBeCpa.textContent = 'Sin CPA ext.';
            }
        }

        if (resMinRoas) {
            resMinRoas.textContent = currentChannel === 'cod' ? `${data.minRoas.toFixed(2)}x` : 'N/A (Orgánico)';
        }

        // Segmented Breakdown Bar
        const totalPrice = Math.max(1, data.finalSalePrice);
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
        const legLanded = document.getElementById('legLanded');
        const legFreight = document.getElementById('legFreight');
        const legAds = document.getElementById('legAds');
        const legProfit = document.getElementById('legProfit');

        if (legLanded) legLanded.textContent = `${Utils.formatCurrency(data.landedCost)} (${pLanded.toFixed(0)}%)`;
        if (legFreight) legFreight.textContent = `${Utils.formatCurrency(currentChannel === 'cod' ? data.realFreight : 0)} (${pFreight.toFixed(0)}%)`;
        if (legAds) legAds.textContent = `${Utils.formatCurrency(currentChannel === 'cod' ? data.realCpa : data.channelOperationalCost)} (${pAds.toFixed(0)}%)`;
        if (legProfit) legProfit.textContent = `${Utils.formatCurrency(data.netProfit)} (${pProfit.toFixed(0)}%)`;

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

        if (cCodProfit) cCodProfit.textContent = Utils.formatCurrency(data.simCodProfit);
        if (cCodMargin) cCodMargin.textContent = `${data.simCodMargin.toFixed(1)}%`;
        if (cMpProfit) cMpProfit.textContent = Utils.formatCurrency(data.simMpProfit);
        if (cMpMargin) cMpMargin.textContent = `${data.simMpMargin.toFixed(1)}%`;
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

        setVal('calcCostPurchase', 20000);
        setVal('calcCostShippingMain', 2000);
        setVal('calcCostCustoms', 0);
        setVal('calcCostShippingLocal', 500);
        setVal('calcCostPackaging', 1000);
        setVal('calcCostFulfillment', 1500);
        setVal('calcCostOther', 0);

        setVal('calcCpa', 15000);
        setVal('calcCancelacion', 10);
        setVal('calcDevolucion', 20);
        setVal('calcFlete', 16500);
        setVal('calcFleteRetorno', 10000);
        setVal('calcRecaudoPercent', 3.5);
        setVal('calcAdmin', 2000);

        setVal('calcTargetMarginType', 'margin_percent');
        setVal('calcTargetMarginValue', 25);
        setVal('calcVenta', 89900);

        switchChannel('cod');
        switchPricingMode('target_margin');
        calculate();

        Utils.showToast('Calculadora lista para nueva liquidación', 'info');
    }

    /**
     * Guardar la liquidación actual (Supabase + LocalStorage)
     */
    async function saveCurrentLiquidation() {
        const name = getText('calcProductName', 'Liquidación sin nombre');
        const sku = getText('calcProductSku', '');

        // Recalcular para asegurar valores actuales
        calculate();

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

        const landedCost = (isBatch ? (purchaseRaw + shippingMainRaw + customsRaw + shippingLocalRaw + other) / batchUnits : (purchaseRaw + shippingMainRaw + customsRaw + shippingLocalRaw + other)) + packaging + fulfillment;

        const resProfitEl = document.getElementById('resUtilidadNeta');
        const resMarginEl = document.getElementById('resUtilidadNetaPercent');
        const resPriceEl = document.getElementById('resPriceValue');

        const netProfit = resProfitEl ? parseFloat(resProfitEl.textContent.replace(/[^0-9.-]+/g, '')) || 0 : 0;
        const netMargin = resMarginEl ? parseFloat(resMarginEl.textContent) || 0 : 0;
        const salePrice = resPriceEl ? parseFloat(resPriceEl.textContent.replace(/[^0-9.-]+/g, '')) || 0 : 0;

        const payload = {
            id: currentLiquidationId || ('liq_' + Date.now().toString(36) + Math.random().toString(36).substr(2, 4)),
            name,
            sku,
            channel: currentChannel,
            cost_mode: isBatch ? 'batch' : 'unit',
            batch_units: batchUnits,
            cost_purchase: purchaseRaw,
            cost_shipping_main: shippingMainRaw,
            cost_customs: customsRaw,
            cost_shipping_local: shippingLocalRaw,
            cost_packaging: packaging,
            cost_fulfillment: fulfillment,
            cost_other: other,
            total_landed_cost: landedCost,

            // COD
            sale_cpa: getNum('calcCpa', 0),
            cancel_rate: getNum('calcCancelacion', 0),
            return_rate: getNum('calcDevolucion', 0),
            freight_out: getNum('calcFlete', 0),
            freight_return: getNum('calcFleteRetorno', 0),
            cod_fee_percent: getNum('calcRecaudoPercent', 0),
            cost_admin: getNum('calcAdmin', 0),

            // Marketplace
            marketplace_name: getText('calcMpPreset', 'ml_clasica'),
            marketplace_fee_percent: getNum('calcMpFeePercent', 0),
            marketplace_fixed_fee: getNum('calcMpFixedFee', 0),
            marketplace_shipping_cost: getNum('calcMpShipping', 0),
            marketplace_tax_percent: getNum('calcMpTaxPercent', 0),

            // Pricing
            pricing_mode: pricingMode,
            target_margin_type: getText('calcTargetMarginType', 'margin_percent'),
            target_margin_value: getNum('calcTargetMarginValue', 25),
            sale_price: salePrice,
            net_profit: netProfit,
            net_margin_percent: netMargin,
            updated_at: new Date().toISOString()
        };

        try {
            if (typeof Database !== 'undefined' && Database.saveProductLiquidation) {
                await Database.saveProductLiquidation(payload);
            } else {
                // Fallback directo a localStorage
                const localKey = 'antigravity_product_liquidations';
                let local = [];
                try { local = JSON.parse(localStorage.getItem(localKey) || '[]'); } catch (e) {}
                const idx = local.findIndex(l => l.id === payload.id);
                if (idx >= 0) local[idx] = payload;
                else local.unshift(payload);
                localStorage.setItem(localKey, JSON.stringify(local));
            }

            currentLiquidationId = payload.id;
            Utils.showToast(`Liquidación "${name}" guardada correctamente`, 'success');
            await loadSavedLiquidations();
        } catch (err) {
            console.error('Error saving liquidation:', err);
            Utils.showToast('Error al guardar la liquidación', 'error');
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

        // Actualizar contador del badge
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
            const matchesChannel = filterChannel === 'all' || item.channel === filterChannel;
            return matchesSearch && matchesChannel;
        });

        if (kpiTotal) kpiTotal.textContent = savedLiquidations.length;
        if (kpiAvgMargin) {
            if (savedLiquidations.length > 0) {
                const avg = savedLiquidations.reduce((acc, curr) => acc + (parseFloat(curr.net_margin_percent) || 0), 0) / savedLiquidations.length;
                kpiAvgMargin.textContent = `${avg.toFixed(1)}%`;
            } else {
                kpiAvgMargin.textContent = '0%';
            }
        }

        if (filtered.length === 0) {
            tbody.innerHTML = '';
            if (emptyState) emptyState.style.display = 'block';
            return;
        }

        if (emptyState) emptyState.style.display = 'none';

        tbody.innerHTML = filtered.map(item => {
            const channelBadge = item.channel === 'marketplace'
                ? '<span class="calc-channel-pill marketplace">🛒 Marketplace</span>'
                : '<span class="calc-channel-pill cod">🚚 Contra Entrega</span>';

            const marginNum = parseFloat(item.net_margin_percent) || 0;
            const marginBadgeClass = marginNum >= 22 ? 'badge-success' : (marginNum >= 10 ? 'badge-warning' : 'badge-danger');

            const dateFormatted = item.updated_at ? Utils.formatDate(item.updated_at) : 'Reciente';

            return `
                <tr>
                    <td>
                        <strong style="color: var(--text-primary); font-size: 0.95rem;">${Utils.escapeHtml(item.name || 'Sin nombre')}</strong>
                        ${item.sku ? `<div style="font-size: 0.78rem; color: var(--text-muted); font-family: monospace;">SKU: ${Utils.escapeHtml(item.sku)}</div>` : ''}
                    </td>
                    <td>${channelBadge}</td>
                    <td><strong>${Utils.formatCurrency(item.total_landed_cost || 0)}</strong></td>
                    <td><strong style="color: #60a5fa;">${Utils.formatCurrency(item.sale_price || 0)}</strong></td>
                    <td><strong style="color: #10b981;">${Utils.formatCurrency(item.net_profit || 0)}</strong></td>
                    <td><span class="badge ${marginBadgeClass}">${marginNum.toFixed(1)}%</span></td>
                    <td style="color: var(--text-muted); font-size: 0.85rem;">${dateFormatted}</td>
                    <td style="text-align: right;">
                        <div class="calc-table-actions" style="justify-content: flex-end;">
                            <button type="button" class="btn btn-secondary btn-sm" onclick="CalculatorModule.loadLiquidation('${item.id}')" title="Cargar en la calculadora para editar">
                                ✏️ Cargar
                            </button>
                            <button type="button" class="btn btn-secondary btn-sm" onclick="CalculatorModule.duplicateLiquidation('${item.id}')" title="Duplicar liquidación">
                                📋 Clonar
                            </button>
                            <button type="button" class="btn btn-secondary btn-sm" onclick="CalculatorModule.exportPdf('${item.id}')" title="Descargar PDF de Costos">
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
     * Cargar una liquidación guardada en la calculadora
     */
    function loadLiquidation(id) {
        const item = savedLiquidations.find(l => l.id === id);
        if (!item) return;

        currentLiquidationId = item.id;
        setVal('calcProductName', item.name || '');
        setVal('calcProductSku', item.sku || '');

        const isBatch = item.cost_mode === 'batch';
        setVal('calcCostMode', item.cost_mode || 'unit');
        setVal('calcBatchUnits', item.batch_units || 100);
        const batchGroup = document.getElementById('calcBatchGroup');
        if (batchGroup) batchGroup.style.display = isBatch ? 'block' : 'none';
        updateCostLabels(isBatch);

        setVal('calcCostPurchase', item.cost_purchase || 0);
        setVal('calcCostShippingMain', item.cost_shipping_main || 0);
        setVal('calcCostCustoms', item.cost_customs || 0);
        setVal('calcCostShippingLocal', item.cost_shipping_local || 0);
        setVal('calcCostPackaging', item.cost_packaging || 0);
        setVal('calcCostFulfillment', item.cost_fulfillment || 0);
        setVal('calcCostOther', item.cost_other || 0);

        // COD
        setVal('calcCpa', item.sale_cpa || 0);
        setVal('calcCancelacion', item.cancel_rate || 10);
        setVal('calcDevolucion', item.return_rate || 20);
        setVal('calcFlete', item.freight_out || 16500);
        setVal('calcFleteRetorno', item.freight_return || 10000);
        setVal('calcRecaudoPercent', item.cod_fee_percent || 3.5);
        setVal('calcAdmin', item.cost_admin || 2000);

        // Marketplace
        if (item.marketplace_name) setVal('calcMpPreset', item.marketplace_name);
        setVal('calcMpFeePercent', item.marketplace_fee_percent || 14);
        setVal('calcMpFixedFee', item.marketplace_fixed_fee || 0);
        setVal('calcMpShipping', item.marketplace_shipping_cost || 0);
        setVal('calcMpTaxPercent', item.marketplace_tax_percent || 0);

        // Pricing
        setVal('calcTargetMarginType', item.target_margin_type || 'margin_percent');
        setVal('calcTargetMarginValue', item.target_margin_value || 25);
        setVal('calcVenta', item.sale_price || 0);

        switchChannel(item.channel || 'cod');
        switchPricingMode(item.pricing_mode || 'target_margin');

        // Ir a la pestaña de calculadora activa
        switchMainTab('active');
        calculate();

        Utils.showToast(`Liquidación "${item.name}" cargada en la calculadora`, 'success');
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

        // Encabezado
        doc.setFillColor(30, 30, 56);
        doc.rect(0, 0, 210, 32, 'F');
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(18);
        doc.setFont('helvetica', 'bold');
        doc.text('HOJA DE LIQUIDACIÓN Y COSTEO', 14, 16);
        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
        doc.text(`Fecha: ${Utils.formatDate(item.updated_at || new Date().toISOString())} | Canal: ${item.channel === 'marketplace' ? 'Marketplace' : 'Pago Contra Entrega'}`, 14, 25);

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
        doc.text('1. DESGLOSE DE COSTO PUESTO EN BODEGA (LANDED COST)', 16, y);
        y += 8;

        doc.setFont('helvetica', 'normal');
        const landedRows = [
            ['Costo Base de Compra / Proveedor', Utils.formatCurrency(item.cost_purchase || 0)],
            ['Transporte / Flete Principal', Utils.formatCurrency(item.cost_shipping_main || 0)],
            ['Arancel / Aduana / Impuestos Importación', Utils.formatCurrency(item.cost_customs || 0)],
            ['Transporte Local / Acarreo a Bodega', Utils.formatCurrency(item.cost_shipping_local || 0)],
            ['Empaque y Embalaje de Despacho', Utils.formatCurrency(item.cost_packaging || 0)],
            ['Picking, Packing y Almacenamiento', Utils.formatCurrency(item.cost_fulfillment || 0)],
            ['Otros Gastos Directos', Utils.formatCurrency(item.cost_other || 0)],
        ];

        landedRows.forEach(([concept, val]) => {
            doc.text(concept, 16, y);
            doc.text(val, 190, y, { align: 'right' });
            y += 6;
        });

        doc.setFont('helvetica', 'bold');
        doc.text('TOTAL COSTO LANDED UNITARIO:', 16, y + 2);
        doc.text(Utils.formatCurrency(item.total_landed_cost || 0), 190, y + 2, { align: 'right' });
        y += 14;

        // Variables del Canal
        doc.setFillColor(240, 240, 248);
        doc.rect(14, y - 5, 182, 8, 'F');
        doc.text(`2. VARIABLES DE COMERCIALIZACIÓN (${item.channel === 'marketplace' ? 'MARKETPLACE' : 'CONTRA ENTREGA'})`, 16, y);
        y += 8;

        doc.setFont('helvetica', 'normal');
        if (item.channel === 'cod') {
            const codRows = [
                ['Publicidad CPA (Meta / TikTok)', Utils.formatCurrency(item.sale_cpa || 0)],
                ['Tasa de Cancelación Previa', `${item.cancel_rate || 0}%`],
                ['Tasa de Devolución Transportadora', `${item.return_rate || 0}%`],
                ['Flete de Entrega / Despacho', Utils.formatCurrency(item.freight_out || 0)],
                ['Flete de Retorno / Devolución', Utils.formatCurrency(item.freight_return || 0)],
                ['Comisión Recaudo Transportadora', `${item.cod_fee_percent || 0}%`],
                ['Costo de Confirmación / Call Center', Utils.formatCurrency(item.cost_admin || 0)],
            ];
            codRows.forEach(([concept, val]) => {
                doc.text(concept, 16, y);
                doc.text(val, 190, y, { align: 'right' });
                y += 6;
            });
        } else {
            const mpRows = [
                ['Plataforma Marketplace', item.marketplace_name || 'Estándar'],
                ['Comisión Marketplace', `${item.marketplace_fee_percent || 0}%`],
                ['Costo Fijo por Unidad', Utils.formatCurrency(item.marketplace_fixed_fee || 0)],
                ['Envío Gratis Asumido por Vendedor', Utils.formatCurrency(item.marketplace_shipping_cost || 0)],
                ['Retenciones Fiscales de Plataforma', `${item.marketplace_tax_percent || 0}%`],
            ];
            mpRows.forEach(([concept, val]) => {
                doc.text(concept, 16, y);
                doc.text(val, 190, y, { align: 'right' });
                y += 6;
            });
        }

        y += 8;

        // Resultados y Rentabilidad
        doc.setFillColor(30, 30, 56);
        doc.rect(14, y - 5, 182, 8, 'F');
        doc.setTextColor(255, 255, 255);
        doc.setFont('helvetica', 'bold');
        doc.text('3. RESULTADOS DE RENTABILIDAD Y PRECIO', 16, y);
        y += 10;
        doc.setTextColor(30, 30, 30);

        doc.setFontSize(11);
        doc.text('Precio de Venta Final:', 16, y);
        doc.text(Utils.formatCurrency(item.sale_price || 0), 190, y, { align: 'right' });
        y += 7;

        doc.text('Utilidad Neta por Unidad:', 16, y);
        doc.setTextColor(16, 185, 129);
        doc.text(Utils.formatCurrency(item.net_profit || 0), 190, y, { align: 'right' });
        y += 7;
        doc.setTextColor(30, 30, 30);

        doc.text('Margen Neto sobre Venta:', 16, y);
        doc.text(`${(item.net_margin_percent || 0).toFixed(1)}%`, 190, y, { align: 'right' });

        // Guardar archivo
        const safeName = (item.name || 'producto').replace(/[^a-zA-Z0-9_-]/g, '_');
        doc.save(`Liquidacion_${safeName}.pdf`);
        Utils.showToast('PDF generado correctamente', 'success');
    }

    return {
        init,
        calculate,
        resetCalculator,
        saveCurrentLiquidation,
        loadLiquidation,
        duplicateLiquidation,
        deleteLiquidation,
        exportPdf,
        switchMainTab,
        switchChannel,
        switchPricingMode
    };
})();

// Exponer globalmente
window.CalculatorModule = CalculatorModule;
