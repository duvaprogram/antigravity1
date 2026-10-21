// ========================================
// Venezuela FX Module
// Comisión cambiaria (Bs -> USD) y caja en dólares
// ========================================
//
// En Venezuela las guías se cobran en bolívares a una tasa (tasa de cobro) y
// esos bolívares se cambian después a dólares a otra tasa más alta (tasa de
// cambio). La diferencia es la comisión cambiaria.
//
// Las guías que el cliente paga en dólares no se cambian: ese efectivo queda en
// la caja de Venezuela, de ahí salen los servicios y fletes locales, y cada
// cierto tiempo el saldo se liquida en un pago aparte (sin comisión).
//
// Si el pago trae las variables nuevas (bs_amount, exchange_rate, charge_rate)
// se usan tal cual. Si no, se infieren de las guías para que el histórico
// también funcione.

const VenezuelaFX = {
    num(value) {
        const n = parseFloat(value);
        return isNaN(n) ? 0 : n;
    },

    hasValue(value) {
        return value !== undefined && value !== null && value !== '' && this.num(value) > 0;
    },

    isVenezuelaPayment(payment) {
        return /venezuela/i.test(payment?.origin || '');
    },

    isReturnOrCancel(guide) {
        const status = (guide?.status || guide?.status_name || guide?.guide_statuses?.name || '').toLowerCase();
        return status.includes('devol') || status.includes('cancel');
    },

    median(values) {
        if (!values.length) return 0;
        const sorted = [...values].sort((a, b) => a - b);
        const mid = sorted.length >> 1;
        return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
    },

    // Las guías pueden venir anidadas en el pago o resolverse por id contra un índice
    getPaymentGuides(payment, guideIndex) {
        return (payment?.payment_guides || [])
            .map(row => row.guides || (guideIndex ? guideIndex[row.guide_id] : null))
            .filter(Boolean);
    },

    analyzePayment(payment, guideIndex) {
        const guides = this.getPaymentGuides(payment, guideIndex);
        const effective = guides.filter(g => !this.isReturnOrCancel(g));
        const withBs = effective.filter(g => this.num(g.payment_bs) > 0);

        const bsFromGuides = withBs.reduce((sum, g) => sum + this.num(g.payment_bs), 0);
        const bsInferred = !this.hasValue(payment.bs_amount);
        const bs = bsInferred ? bsFromGuides : this.num(payment.bs_amount);

        const received = this.num(payment.amount);

        const guideRates = withBs
            .map(g => this.num(g.payment_bs) / (this.num(g.total_amount || g.amount_usd) || 1))
            .filter(r => r > 0);
        const chargeInferred = !this.hasValue(payment.charge_rate);
        const chargeRate = chargeInferred ? this.median(guideRates) : this.num(payment.charge_rate);

        const fxInferred = !this.hasValue(payment.exchange_rate);
        const fxRate = fxInferred
            ? (bs > 0 && received > 0 ? bs / received : 0)
            : this.num(payment.exchange_rate);

        // Liquidación de caja: no hay bolívares de por medio, así que no hay comisión.
        // Sin guías vinculadas no hay con qué clasificar el pago, así que se deja fuera.
        const hasGuides = guides.length > 0;
        const isSettlement = payment.is_cash_settlement === true || (hasGuides && bs <= 0 && received > 0);
        const unclassified = !hasGuides && !payment.is_cash_settlement;

        const usdCharged = (bs > 0 && chargeRate > 0) ? bs / chargeRate : 0;
        const commission = isSettlement ? 0 : (usdCharged - received);
        const commissionPct = usdCharged > 0 ? (commission / usdCharged) * 100 : 0;

        // Lo que no se cubrió con bolívares entró en efectivo y se quedó en caja
        const guidesValue = effective.reduce((sum, g) => sum + this.num(g.total_amount || g.amount_usd), 0);
        const cashIn = isSettlement ? 0 : Math.max(0, guidesValue - usdCharged);
        // Los fletes de Venezuela se pagan allá con el efectivo de la caja, no
        // con los dólares que llegan a Binance. Si el pago no trae el dato, se
        // usan los fletes de sus propias guías.
        const cashServicesInferred = !this.hasValue(payment.cash_services);
        const cashServices = cashServicesInferred
            ? guides.reduce((sum, g) => sum + this.num(g.shipping_cost), 0)
            : this.num(payment.cash_services);
        const settlementOut = isSettlement ? received : 0;

        // Guías cuya tasa se sale del patrón: suelen ser pagos mixtos (parte Bs,
        // parte efectivo) o un error de digitación en los bolívares
        const mixedGuides = chargeRate > 0
            ? withBs.filter(g => {
                const rate = this.num(g.payment_bs) / (this.num(g.total_amount || g.amount_usd) || 1);
                return Math.abs(rate - chargeRate) / chargeRate > 0.08;
            })
            : [];

        return {
            id: payment.id,
            code: payment.code || '',
            date: payment.created_at || '',
            notes: payment.notes || '',
            guides,
            effectiveCount: effective.length,
            guidesValue,
            bs,
            bsInferred,
            chargeRate,
            chargeInferred,
            fxRate,
            fxInferred,
            isSettlement,
            unclassified,
            hasGuides,
            usdCharged,
            received,
            commission,
            commissionPct,
            cashIn,
            cashServices,
            cashServicesInferred,
            settlementOut,
            mixedGuides
        };
    },

    // Analiza todos los pagos de Venezuela en orden cronológico y arrastra el
    // saldo de la caja en dólares pago a pago.
    // Saldo con el que arranca la caja en dólares, para los meses anteriores a
    // que se empezara a registrar. Se guarda en el navegador.
    OPENING_BALANCE_KEY: 'veCashOpeningBalance',

    getOpeningBalance() {
        try {
            return this.num(localStorage.getItem(this.OPENING_BALANCE_KEY));
        } catch (e) {
            return 0;
        }
    },

    setOpeningBalance(value) {
        try {
            localStorage.setItem(this.OPENING_BALANCE_KEY, String(this.num(value)));
        } catch (e) {
            console.warn('No se pudo guardar el saldo inicial de caja:', e);
        }
    },

    analyze(payments, guideIndex) {
        const rows = (payments || [])
            .filter(p => this.isVenezuelaPayment(p))
            .map(p => this.analyzePayment(p, guideIndex))
            .sort((a, b) => new Date(a.date || 0) - new Date(b.date || 0));

        let balance = this.getOpeningBalance();
        rows.forEach(row => {
            if (row.unclassified) { row.cashBalance = balance; return; }
            balance += row.cashIn - row.cashServices - row.settlementOut;
            row.cashBalance = balance;
        });

        return rows;
    },

    summarize(rows) {
        const totals = {
            payments: rows.length,
            bs: 0,
            usdCharged: 0,
            received: 0,
            commission: 0,
            commissionPct: 0,
            chargeRate: 0,
            fxRate: 0,
            cashIn: 0,
            cashServices: 0,
            settlementOut: 0,
            cashBalance: rows.length ? rows[rows.length - 1].cashBalance : 0,
            inferredCount: 0,
            mixedCount: 0,
            unclassifiedCount: 0
        };

        rows.forEach(row => {
            if (row.unclassified) { totals.unclassifiedCount++; return; }
            totals.bs += row.bs;
            totals.usdCharged += row.usdCharged;
            totals.cashIn += row.cashIn;
            totals.cashServices += row.cashServices;
            totals.settlementOut += row.settlementOut;
            totals.mixedCount += row.mixedGuides.length;
            if (row.fxInferred) totals.inferredCount++;
            if (!row.isSettlement) {
                totals.received += row.received;
                totals.commission += row.commission;
            }
        });

        totals.commissionPct = totals.usdCharged > 0 ? (totals.commission / totals.usdCharged) * 100 : 0;
        totals.chargeRate = totals.usdCharged > 0 ? totals.bs / totals.usdCharged : 0;
        totals.fxRate = totals.received > 0 ? totals.bs / totals.received : 0;

        return totals;
    }
};

window.VenezuelaFX = VenezuelaFX;
