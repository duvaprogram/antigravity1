-- ==========================================================
-- SCRIPT SQL PARA SUPABASE: GASTOS MENSUALES (Finanzas Personales)
-- ==========================================================
-- Ejecuta este script completo en el SQL Editor de tu proyecto de Supabase.
-- Es idempotente: puedes correrlo varias veces sin romper nada.

-- ----------------------------------------------------------
-- 1. Categorias de gasto (con presupuesto mensual por categoria)
-- ----------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.pf_expense_categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    icon TEXT DEFAULT '📦',
    color TEXT DEFAULT '#6366f1',
    monthly_budget NUMERIC(14,2) DEFAULT 0,
    sort_order INTEGER DEFAULT 0,
    active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT pf_expense_categories_name_key UNIQUE (name)
);

-- ----------------------------------------------------------
-- 2. Gastos
-- ----------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.pf_expenses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    date DATE NOT NULL DEFAULT CURRENT_DATE,
    amount NUMERIC(14,2) NOT NULL DEFAULT 0,
    category_id UUID REFERENCES public.pf_expense_categories(id) ON DELETE SET NULL,
    description TEXT NOT NULL,
    payment_method TEXT DEFAULT 'cash',
    is_recurring BOOLEAN DEFAULT FALSE,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Columnas anadidas despues (por si la tabla ya existia)
ALTER TABLE public.pf_expenses ADD COLUMN IF NOT EXISTS payment_method TEXT DEFAULT 'cash';
ALTER TABLE public.pf_expenses ADD COLUMN IF NOT EXISTS is_recurring BOOLEAN DEFAULT FALSE;
ALTER TABLE public.pf_expenses ADD COLUMN IF NOT EXISTS notes TEXT;
ALTER TABLE public.pf_expenses ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE public.pf_expense_categories ADD COLUMN IF NOT EXISTS monthly_budget NUMERIC(14,2) DEFAULT 0;
ALTER TABLE public.pf_expense_categories ADD COLUMN IF NOT EXISTS sort_order INTEGER DEFAULT 0;

-- ----------------------------------------------------------
-- 3. Indices para consultas por mes y por categoria
-- ----------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_pf_expenses_date ON public.pf_expenses (date DESC);
CREATE INDEX IF NOT EXISTS idx_pf_expenses_category ON public.pf_expenses (category_id);

-- ----------------------------------------------------------
-- 4. Seguridad a nivel de fila
-- ----------------------------------------------------------
ALTER TABLE public.pf_expense_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pf_expenses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all operations for authenticated users" ON public.pf_expense_categories;
CREATE POLICY "Allow all operations for authenticated users"
ON public.pf_expense_categories FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all operations for authenticated users" ON public.pf_expenses;
CREATE POLICY "Allow all operations for authenticated users"
ON public.pf_expenses FOR ALL USING (true) WITH CHECK (true);

-- ----------------------------------------------------------
-- 5. Categorias iniciales sugeridas
-- ----------------------------------------------------------
INSERT INTO public.pf_expense_categories (name, icon, color, monthly_budget, sort_order) VALUES
    ('Vivienda',        '🏠', '#6366f1', 0, 1),
    ('Alimentación',    '🍽️', '#22c55e', 0, 2),
    ('Transporte',      '🚗', '#f59e0b', 0, 3),
    ('Servicios',       '💡', '#06b6d4', 0, 4),
    ('Salud',           '🏥', '#ef4444', 0, 5),
    ('Educación',       '📚', '#8b5cf6', 0, 6),
    ('Entretenimiento', '🎬', '#ec4899', 0, 7),
    ('Ropa',            '👕', '#14b8a6', 0, 8),
    ('Deudas',          '💳', '#f97316', 0, 9),
    ('Ahorro',          '🐷', '#10b981', 0, 10),
    ('Otros',           '📦', '#64748b', 0, 11)
ON CONFLICT (name) DO NOTHING;
