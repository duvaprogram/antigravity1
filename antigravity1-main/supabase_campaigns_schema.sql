-- ==============================================================================
-- SUPABASE SCHEMA: TABLAS PARA EL MÓDULO DE CAMPAÑAS Y RENDIMIENTO DE ANUNCIOS
-- Ejecuta este script en el SQL Editor de tu proyecto de Supabase
-- ==============================================================================

-- 1. TABLA: campaigns (Historial de Campañas Generadas)
CREATE TABLE IF NOT EXISTS public.campaigns (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    code TEXT NOT NULL,
    country TEXT,
    type TEXT,
    objective TEXT,
    date TEXT,
    product TEXT,
    ad_sets INTEGER DEFAULT 0,
    ads INTEGER DEFAULT 0,
    ad_set_codes JSONB DEFAULT '[]'::jsonb,
    ad_codes JSONB DEFAULT '[]'::jsonb,
    ad_details JSONB DEFAULT '[]'::jsonb,
    active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_campaigns_code ON public.campaigns(code);
ALTER TABLE public.campaigns ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all operations on campaigns" ON public.campaigns;
CREATE POLICY "Allow all operations on campaigns" ON public.campaigns FOR ALL TO public, anon, authenticated USING (true) WITH CHECK (true);


-- 2. TABLA: campaign_ads (Anuncios importados con su identificador único de Meta)
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
    start_date TEXT,
    end_date TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_campaign_ads_ad_id ON public.campaign_ads(ad_id);
CREATE INDEX IF NOT EXISTS idx_campaign_ads_campaign_code ON public.campaign_ads(campaign_code);
ALTER TABLE public.campaign_ads ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all operations on campaign_ads" ON public.campaign_ads;
CREATE POLICY "Allow all operations on campaign_ads" ON public.campaign_ads FOR ALL TO public, anon, authenticated USING (true) WITH CHECK (true);


-- 3. TABLA: campaign_sales (Registro Rápido de Ventas vinculadas a Anuncios)
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
    sale_date TEXT DEFAULT CURRENT_DATE::text,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_campaign_sales_ad_id ON public.campaign_sales(ad_id);
CREATE INDEX IF NOT EXISTS idx_campaign_sales_date ON public.campaign_sales(sale_date);
CREATE INDEX IF NOT EXISTS idx_campaign_sales_code ON public.campaign_sales(campaign_code);
ALTER TABLE public.campaign_sales ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all operations on campaign_sales" ON public.campaign_sales;
CREATE POLICY "Allow all operations on campaign_sales" ON public.campaign_sales FOR ALL TO public, anon, authenticated USING (true) WITH CHECK (true);


-- 4. TABLA: campaign_performance (Reportes de Rendimiento de Campañas desde Excel/CSV)
CREATE TABLE IF NOT EXISTS public.campaign_performance (
    id TEXT PRIMARY KEY,
    code TEXT,
    campaign_name TEXT,
    product TEXT,
    country TEXT,
    cost NUMERIC DEFAULT 0,
    impressions NUMERIC DEFAULT 0,
    reach NUMERIC DEFAULT 0,
    conversations NUMERIC DEFAULT 0,
    purchases NUMERIC DEFAULT 0,
    purchase_value NUMERIC DEFAULT 0,
    start_date TEXT,
    end_date TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_campaign_perf_code ON public.campaign_performance(code);
ALTER TABLE public.campaign_performance ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all operations on campaign_performance" ON public.campaign_performance;
CREATE POLICY "Allow all operations on campaign_performance" ON public.campaign_performance FOR ALL TO public, anon, authenticated USING (true) WITH CHECK (true);
