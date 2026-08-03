-- ==============================================================================
-- SUPABASE SCHEMA: TABLAS PARA ANUNCIOS (ADS) Y REGISTRO RÁPIDO DE VENTAS
-- ==============================================================================

-- 1. TABLA: campaign_ads (Anuncios importados con su identificador único de Meta)
CREATE TABLE IF NOT EXISTS public.campaign_ads (
    id TEXT PRIMARY KEY,
    ad_id TEXT NOT NULL,
    ad_name TEXT,
    ad_set_name TEXT,
    campaign_name TEXT,
    campaign_code TEXT,
    country TEXT,
    product TEXT,
    spent NUMERIC DEFAULT 0,
    currency TEXT DEFAULT 'COP',
    impressions NUMERIC DEFAULT 0,
    reach NUMERIC DEFAULT 0,
    conversations NUMERIC DEFAULT 0,
    start_date DATE,
    end_date DATE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices para búsqueda rápida por ad_id y campaign_code
CREATE INDEX IF NOT EXISTS idx_campaign_ads_ad_id ON public.campaign_ads(ad_id);
CREATE INDEX IF NOT EXISTS idx_campaign_ads_campaign_code ON public.campaign_ads(campaign_code);

-- Habilitar RLS
ALTER TABLE public.campaign_ads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all operations on campaign_ads"
ON public.campaign_ads
FOR ALL
TO public, anon, authenticated
USING (true)
WITH CHECK (true);


-- 2. TABLA: campaign_sales (Registro Rápido de Ventas vinculadas a Anuncios)
CREATE TABLE IF NOT EXISTS public.campaign_sales (
    id TEXT PRIMARY KEY,
    ad_id TEXT NOT NULL,
    ad_name TEXT,
    campaign_code TEXT,
    campaign_name TEXT,
    product TEXT,
    price NUMERIC NOT NULL DEFAULT 0,
    quantity INTEGER DEFAULT 1,
    customer_name TEXT,
    order_number TEXT,
    city TEXT,
    sale_date DATE DEFAULT CURRENT_DATE,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices para búsquedas y agregaciones
CREATE INDEX IF NOT EXISTS idx_campaign_sales_ad_id ON public.campaign_sales(ad_id);
CREATE INDEX IF NOT EXISTS idx_campaign_sales_date ON public.campaign_sales(sale_date);
CREATE INDEX IF NOT EXISTS idx_campaign_sales_code ON public.campaign_sales(campaign_code);

-- Habilitar RLS
ALTER TABLE public.campaign_sales ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all operations on campaign_sales"
ON public.campaign_sales
FOR ALL
TO public, anon, authenticated
USING (true)
WITH CHECK (true);
