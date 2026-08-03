-- ==========================================================
-- SCRIPT SQL PARA SUPABASE: TABLA DE DIARIO Y METAS SEMANALES
-- ==========================================================
-- Ejecuta este script en el SQL Editor de tu proyecto de Supabase

-- 1. Crear tabla si no existe
CREATE TABLE IF NOT EXISTS public.user_journals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES public.app_users(id) ON DELETE CASCADE,
    entries JSONB DEFAULT '[]'::jsonb,
    goals JSONB DEFAULT '[]'::jsonb,
    weekly_goals JSONB DEFAULT '[]'::jsonb,
    principles JSONB DEFAULT '{"principles":[],"rules":[],"actions":[],"improvements":[]}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT user_journals_user_id_key UNIQUE (user_id)
);

-- 2. Asegurar que la columna weekly_goals exista si la tabla fue creada previamente
ALTER TABLE public.user_journals ADD COLUMN IF NOT EXISTS weekly_goals JSONB DEFAULT '[]'::jsonb;

-- 3. Habilitar seguridad de nivel de fila (Row Level Security) y permisos
ALTER TABLE public.user_journals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all operations for authenticated users" ON public.user_journals;
CREATE POLICY "Allow all operations for authenticated users" 
ON public.user_journals 
FOR ALL 
USING (true) 
WITH CHECK (true);
