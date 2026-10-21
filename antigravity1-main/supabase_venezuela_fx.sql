-- ==============================================================================
-- SUPABASE: VARIABLES DE VENEZUELA (CAMBIO DE BOLIVARES Y CAJA EN DOLARES)
-- Ejecuta este script en el SQL Editor de tu proyecto de Supabase
-- ==============================================================================
--
-- Contexto: en Venezuela las guias se cobran en bolivares a una tasa (tasa de
-- cobro) y luego esos bolivares se cambian a dolares a otra tasa mas alta
-- (tasa de cambio). Esa diferencia es la comision cambiaria y hasta ahora solo
-- quedaba escrita en las notas del pago.
--
-- Las guias que el cliente paga en dolares no se cambian: ese efectivo queda en
-- la caja de Venezuela, de ahi salen los servicios/fletes locales y cada cierto
-- tiempo el saldo se liquida en un pago aparte (sin comision).

ALTER TABLE public.payments
    -- Bolivares que realmente se cambiaron en este pago.
    -- Si se deja en NULL, el sistema usa la suma de payment_bs de las guias.
    ADD COLUMN IF NOT EXISTS bs_amount NUMERIC,

    -- Tasa Bs/USD a la que se cambiaron esos bolivares.
    -- Si se deja en NULL, el sistema la infiere: bs_amount / monto recibido.
    ADD COLUMN IF NOT EXISTS exchange_rate NUMERIC,

    -- Tasa Bs/USD a la que se le cobro al cliente.
    -- Si se deja en NULL, el sistema usa la mediana de (payment_bs / total) de
    -- las guias del pago.
    ADD COLUMN IF NOT EXISTS charge_rate NUMERIC,

    -- Servicios, fletes y gastos locales pagados con la caja en dolares.
    ADD COLUMN IF NOT EXISTS cash_services NUMERIC DEFAULT 0,

    -- TRUE cuando el pago es la liquidacion del saldo acumulado en la caja en
    -- dolares (no hay cambio de bolivares, por lo tanto no hay comision).
    ADD COLUMN IF NOT EXISTS is_cash_settlement BOOLEAN DEFAULT FALSE;

COMMENT ON COLUMN public.payments.bs_amount IS 'Bolivares cambiados en este pago (Venezuela)';
COMMENT ON COLUMN public.payments.exchange_rate IS 'Tasa Bs/USD a la que se cambiaron los bolivares';
COMMENT ON COLUMN public.payments.charge_rate IS 'Tasa Bs/USD a la que se le cobro al cliente';
COMMENT ON COLUMN public.payments.cash_services IS 'Servicios y fletes pagados con la caja en dolares';
COMMENT ON COLUMN public.payments.is_cash_settlement IS 'El pago es una liquidacion de la caja en dolares';

-- ------------------------------------------------------------------------------
-- OPCIONAL: marcar los pagos historicos que fueron liquidacion de caja.
-- Son los pagos de Venezuela cuyas guias no tienen bolivares registrados.
-- El sistema ya los detecta solo, esto unicamente lo deja explicito.
-- ------------------------------------------------------------------------------
-- UPDATE public.payments p
-- SET is_cash_settlement = TRUE
-- WHERE p.origin ILIKE '%venezuela%'
--   AND NOT EXISTS (
--       SELECT 1 FROM public.payment_guides pg
--       JOIN public.guides g ON g.id = pg.guide_id
--       WHERE pg.payment_id = p.id AND COALESCE(g.payment_bs, 0) > 0
--   );
