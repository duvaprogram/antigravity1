-- ==============================================================================
-- SUPABASE SCHEMA: TABLA PARA EL MÓDULO DE PENDIENTES MUTUOS
-- Sincronizador de acuerdos y responsabilidades cruzadas (Dirección vs Trabajadora)
-- Ejecuta este script en el SQL Editor de tu proyecto de Supabase
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.mutual_tasks (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    description TEXT DEFAULT '',
    category TEXT NOT NULL DEFAULT 'issue', -- 'payment' | 'web' | 'issue' | 'general'
    priority TEXT NOT NULL DEFAULT 'medium', -- 'low' | 'medium' | 'high'
    turn TEXT NOT NULL DEFAULT 'worker',     -- 'admin' | 'worker'
    created_by TEXT NOT NULL DEFAULT 'admin',-- 'admin' | 'worker'
    status TEXT NOT NULL DEFAULT 'active',   -- 'active' | 'in_review' | 'completed'
    amount NUMERIC DEFAULT NULL,             -- Valor en pesos ($) para pagos
    due_date TEXT DEFAULT NULL,              -- Fecha límite YYYY-MM-DD
    notes JSONB DEFAULT '[]'::jsonb,        -- Historial de notas: [{ id, author, text, timestamp }]
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Asegurar columnas si la tabla ya existía
ALTER TABLE public.mutual_tasks ADD COLUMN IF NOT EXISTS description TEXT DEFAULT '';
ALTER TABLE public.mutual_tasks ADD COLUMN IF NOT EXISTS category TEXT NOT NULL DEFAULT 'issue';
ALTER TABLE public.mutual_tasks ADD COLUMN IF NOT EXISTS priority TEXT NOT NULL DEFAULT 'medium';
ALTER TABLE public.mutual_tasks ADD COLUMN IF NOT EXISTS turn TEXT NOT NULL DEFAULT 'worker';
ALTER TABLE public.mutual_tasks ADD COLUMN IF NOT EXISTS created_by TEXT NOT NULL DEFAULT 'admin';
ALTER TABLE public.mutual_tasks ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'active';
ALTER TABLE public.mutual_tasks ADD COLUMN IF NOT EXISTS amount NUMERIC DEFAULT NULL;
ALTER TABLE public.mutual_tasks ADD COLUMN IF NOT EXISTS due_date TEXT DEFAULT NULL;
ALTER TABLE public.mutual_tasks ADD COLUMN IF NOT EXISTS notes JSONB DEFAULT '[]'::jsonb;
ALTER TABLE public.mutual_tasks ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- Índices para búsquedas y filtros rápidos
CREATE INDEX IF NOT EXISTS idx_mutual_tasks_status ON public.mutual_tasks(status);
CREATE INDEX IF NOT EXISTS idx_mutual_tasks_turn ON public.mutual_tasks(turn);
CREATE INDEX IF NOT EXISTS idx_mutual_tasks_category ON public.mutual_tasks(category);
CREATE INDEX IF NOT EXISTS idx_mutual_tasks_created_at ON public.mutual_tasks(created_at DESC);

-- Habilitar Row Level Security (RLS)
ALTER TABLE public.mutual_tasks ENABLE ROW LEVEL SECURITY;

-- Política de acceso total para lectura y escritura (pública / anon / autenticado)
DROP POLICY IF EXISTS "Allow all operations on mutual_tasks" ON public.mutual_tasks;
CREATE POLICY "Allow all operations on mutual_tasks" 
ON public.mutual_tasks 
FOR ALL TO public, anon, authenticated 
USING (true) 
WITH CHECK (true);

-- Habilitar Realtime para esta tabla (para que los cambios se reflejen de inmediato en ambas pantallas)
DO $$ 
BEGIN 
    ALTER PUBLICATION supabase_realtime ADD TABLE public.mutual_tasks; 
EXCEPTION 
    WHEN OTHERS THEN NULL; 
END $$;

-- Datos semilla iniciales (solo se insertan si no existen)
INSERT INTO public.mutual_tasks (id, title, description, category, priority, turn, created_by, status, amount, due_date, created_at, notes)
VALUES
(
    '101',
    'Pago pendiente comisión / reembolso de envíos',
    'Quedó pendiente liquidar el excedente de la semana pasada según relación enviada.',
    'payment',
    'high',
    'admin',
    'worker',
    'active',
    185000,
    '2026-10-21',
    NOW(),
    '[{"id":"n1","author":"worker","text":"Subí las fotos de los recibos a la carpeta compartida.","timestamp":"Ayer, 4:20 PM"}]'::jsonb
),
(
    '102',
    'Arreglar banner y botón de WhatsApp en la página web',
    'En celulares el botón flotante tapa el carrito de compras y el banner principal carga lento.',
    'web',
    'high',
    'worker',
    'admin',
    'active',
    NULL,
    '2026-10-20',
    NOW(),
    '[{"id":"n2","author":"admin","text":"Te dejé la imagen optimizada lista para subir.","timestamp":"Hoy, 9:15 AM"}]'::jsonb
),
(
    '103',
    'Solucionar reclamo de cliente por pedido trocado',
    'Llamar al cliente del pedido #408, ofrecerle cambio exprés y coordinar recogida.',
    'issue',
    'medium',
    'admin',
    'admin',
    'in_review',
    NULL,
    '2026-10-19',
    NOW(),
    '[{"id":"n3","author":"worker","text":"Ya hablé con la clienta, aceptó el cambio y la transportadora recoge mañana. Quedo atenta a tu visto bueno.","timestamp":"Hoy, 11:40 AM"}]'::jsonb
)
ON CONFLICT (id) DO NOTHING;
