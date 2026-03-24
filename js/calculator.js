/* ========================================
   Calculadora de Precios y Utilidad
   ======================================== */

const CalculatorModule = (() => {
    // Selectores
    const inputs = {
        compra: null,
        venta: null,
        cpa: null,
        cancelacion: null,
        devolucion: null,
        fullfilment: null,
        flete: null,
        admin: null
    };

    const results = {
        utilidadNeta: null,
        utilidadPercent: null,
        realFlete: null,
        realPublicidad: null,
        inefectividad: null
    };

    // Flags
    let initialized = false;

    /**
     * Inicializar el módulo
     */
    function init() {
        if (initialized) return;
        
        console.log('Iniciando CalculatorModule...');
        
        // Mapear inputs
        inputs.compra = document.getElementById('calcCompra');
        inputs.venta = document.getElementById('calcVenta');
        inputs.cpa = document.getElementById('calcCpa');
        inputs.cancelacion = document.getElementById('calcCancelacion');
        inputs.devolucion = document.getElementById('calcDevolucion');
        inputs.fullfilment = document.getElementById('calcFullfilment');
        inputs.flete = document.getElementById('calcFlete');
        inputs.admin = document.getElementById('calcAdmin');

        // Mapear resultados
        results.utilidadNeta = document.getElementById('resUtilidadNeta');
        results.utilidadPercent = document.getElementById('resUtilidadNetaPercent');
        results.realFlete = document.getElementById('resRealFlete');
        results.realPublicidad = document.getElementById('resRealPublicidad');
        results.inefectividad = document.getElementById('resInefectividad');

        // Verificar que existan los elementos
        if (!inputs.compra) {
            console.warn('No se encontraron elementos de la calculadora en el DOM.');
            return;
        }

        // Añadir event listeners a todos los inputs
        Object.values(inputs).forEach(input => {
            if (input) {
                input.addEventListener('input', calculate);
            }
        });

        initialized = true;
        // Cálculo inicial
        calculate();
    }


    /**
     * Realizar los cálculos
     */
    function calculate() {
        if (!inputs.compra) return;

        // Obtener valores
        const compra = parseFloat(inputs.compra.value) || 0;
        const venta = parseFloat(inputs.venta.value) || 0;
        const cpa = parseFloat(inputs.cpa.value) || 0;
        const pCancelacion = (parseFloat(inputs.cancelacion.value) || 0) / 100;
        const pDevolucion = (parseFloat(inputs.devolucion.value) || 0) / 100;
        const fullfilment = parseFloat(inputs.fullfilment.value) || 0;
        const flete = parseFloat(inputs.flete.value) || 0;
        const admin = parseFloat(inputs.admin.value) || 0;

        // Según fórmulas de la imagen:
        // 1. Inefectividad = %cancelacion + %devolucion
        const inefectividad = pCancelacion + pDevolucion;

        // 2. Costo real de flete = Flete / (1 - %devolucion)
        let realFlete = 0;
        if (pDevolucion < 1) {
            realFlete = flete / (1 - pDevolucion);
        } else {
            realFlete = flete; // Fallback si es 100%
        }

        // 3. Costo real de publicidad = CPA / (1 - Inefectividad)
        let realPublicidad = 0;
        if (inefectividad < 1) {
            realPublicidad = cpa / (1 - inefectividad);
        } else {
            realPublicidad = cpa; // Fallback
        }

        // 4. Utilidad Neta = Venta - (Compra + RealFlete + RealPublicidad + Fullfilment + Admin)
        const totalCostosReales = compra + realFlete + realPublicidad + fullfilment + admin;
        const utilidadNeta = venta - totalCostosReales;

        // 5. % Utilidad Neta = (Utilidad / Venta) * 100
        const utilidadPercent = venta > 0 ? (utilidadNeta / venta) * 100 : 0;

        // Actualizar UI
        updateUI({
            utilidadNeta,
            utilidadPercent,
            realFlete,
            realPublicidad,
            inefectividad
        });
    }

    /**
     * Actualizar la interfaz con los resultados
     */
    function updateUI(data) {
        if (!results.utilidadNeta) return;

        results.utilidadNeta.textContent = Utils.formatCurrency(data.utilidadNeta);
        results.utilidadPercent.textContent = `${data.utilidadPercent.toFixed(1)}%`;
        results.realFlete.textContent = Utils.formatCurrency(data.realFlete);
        results.realPublicidad.textContent = Utils.formatCurrency(data.realPublicidad);
        results.inefectividad.textContent = `${(data.inefectividad * 100).toFixed(1)}%`;

        // Colorear badge de utilidad
        results.utilidadPercent.className = 'result-badge';
        if (data.utilidadPercent > 18) {
            results.utilidadPercent.classList.add('badge-success');
        } else if (data.utilidadPercent > 8) {
            results.utilidadPercent.classList.add('badge-warning');
        } else {
            results.utilidadPercent.classList.add('badge-danger');
        }
    }

    return {
        init,
        calculate
    };
})();
