-- ==============================================================================
-- SUPABASE SCHEMA: TABLA PARA EL MÓDULO DE LIQUIDACIONES DE PRODUCTOS
-- Ejecuta este script en el SQL Editor de tu proyecto de Supabase
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.product_liquidations (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    sku TEXT,
    product_id TEXT,
    channel TEXT NOT NULL DEFAULT 'cod', -- 'cod' (Contra Entrega), 'marketplace', 'direct'
    marketplace_name TEXT,
    cost_mode TEXT DEFAULT 'unit', -- 'unit' o 'batch'
    batch_units NUMERIC DEFAULT 1,
    currency TEXT DEFAULT 'COP', -- 'COP' o 'USD'
    exchange_rate NUMERIC DEFAULT 4000, -- Tasa de cambio (TRM)
    
    -- Costeo Landed Puesto en Bodega (Unitario)
    cost_purchase NUMERIC DEFAULT 0,
    cost_shipping_main NUMERIC DEFAULT 0,
    cost_customs NUMERIC DEFAULT 0,
    cost_shipping_local NUMERIC DEFAULT 0,
    cost_packaging NUMERIC DEFAULT 0,
    cost_fulfillment NUMERIC DEFAULT 0,
    cost_other NUMERIC DEFAULT 0,
    total_landed_cost NUMERIC DEFAULT 0,
    
    -- Parámetros del Canal de Venta
    sale_cpa NUMERIC DEFAULT 0,
    cancel_rate NUMERIC DEFAULT 0, -- % (ej: 10 para 10%)
    return_rate NUMERIC DEFAULT 0, -- % (ej: 20 para 20%)
    freight_out NUMERIC DEFAULT 0,
    freight_return NUMERIC DEFAULT 0,
    cod_fee_percent NUMERIC DEFAULT 0, -- % comisión recaudo
    cost_admin NUMERIC DEFAULT 0,
    
    -- Parámetros Marketplace
    marketplace_fee_percent NUMERIC DEFAULT 0,
    marketplace_fixed_fee NUMERIC DEFAULT 0,
    marketplace_shipping_cost NUMERIC DEFAULT 0,
    marketplace_tax_percent NUMERIC DEFAULT 0,
    
    -- Fijación y Márgenes
    pricing_mode TEXT DEFAULT 'target_margin', -- 'target_margin' o 'fixed_price'
    target_margin_type TEXT DEFAULT 'margin_percent', -- 'margin_percent', 'markup_percent', 'fixed_profit'
    target_margin_value NUMERIC DEFAULT 25,
    sale_price NUMERIC DEFAULT 0,
    recommended_price NUMERIC DEFAULT 0,
    net_profit NUMERIC DEFAULT 0,
    net_margin_percent NUMERIC DEFAULT 0,
    roi_percent NUMERIC DEFAULT 0,
    break_even_price NUMERIC DEFAULT 0,
    break_even_cpa NUMERIC DEFAULT 0,
    
    -- Metadatos y notas
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices para optimizar búsquedas frecuentes
CREATE INDEX IF NOT EXISTS idx_liquidations_name ON public.product_liquidations(name);
CREATE INDEX IF NOT EXISTS idx_liquidations_channel ON public.product_liquidations(channel);
CREATE INDEX IF NOT EXISTS idx_liquidations_created_at ON public.product_liquidations(created_at DESC);

-- Habilitar Row Level Security (RLS)
ALTER TABLE public.product_liquidations ENABLE ROW LEVEL SECURITY;

-- Políticas de acceso permisivas para lectura y escritura
DROP POLICY IF EXISTS "Allow all operations on product_liquidations" ON public.product_liquidations;
CREATE POLICY "Allow all operations on product_liquidations" 
ON public.product_liquidations 
FOR ALL TO public, anon, authenticated 
USING (true) 
WITH CHECK (true);
