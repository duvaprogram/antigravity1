-- ==============================================================================
-- SUPABASE SCHEMA: COMPRAS MÓNICA (compras por país)
-- Ejecuta este script en el SQL Editor de tu proyecto de Supabase.
-- Es idempotente: puedes correrlo varias veces sin romper nada.
--
-- Una compra de Venezuela con payment_method = 'Caja de Venezuela' descuenta
-- de la caja en dólares de Venezuela (ver VenezuelaFX.cajaUsd en
-- js/venezuela-fx.js).
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.monica_purchases (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    date DATE NOT NULL DEFAULT CURRENT_DATE,
    country TEXT NOT NULL,                       -- Colombia, Ecuador, Venezuela, México, Otro
    store TEXT,                                  -- Tienda o lugar de compra
    description TEXT NOT NULL,
    quantity INTEGER NOT NULL DEFAULT 1,
    amount NUMERIC(14,2) NOT NULL DEFAULT 0,
    currency TEXT NOT NULL DEFAULT 'USD',        -- COP, USD, MXN, VES
    payment_method TEXT NOT NULL DEFAULT 'Efectivo',
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_monica_purchases_date ON public.monica_purchases (date);
CREATE INDEX IF NOT EXISTS idx_monica_purchases_country_method ON public.monica_purchases (country, payment_method);

ALTER TABLE public.monica_purchases ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all operations on monica_purchases" ON public.monica_purchases;
CREATE POLICY "Allow all operations on monica_purchases"
ON public.monica_purchases
FOR ALL TO public, anon, authenticated
USING (true)
WITH CHECK (true);
