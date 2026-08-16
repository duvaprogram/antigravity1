-- ==============================================================================
-- SUPABASE SCHEMA: TABLA Y STORAGE PARA EL MÓDULO MULTIMEDIA (VIDEOS)
-- Ejecuta este script en el SQL Editor de tu proyecto de Supabase si deseas sincronizar en la nube.
-- ==============================================================================

-- 1. TABLA: multimedia_videos
CREATE TABLE IF NOT EXISTS public.multimedia_videos (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    description TEXT,
    category TEXT DEFAULT 'General',
    url TEXT NOT NULL,
    storage_path TEXT,
    thumbnail_url TEXT,
    size_bytes BIGINT DEFAULT 0,
    duration_seconds NUMERIC DEFAULT 0,
    file_type TEXT DEFAULT 'video/mp4',
    source_type TEXT DEFAULT 'local', -- 'local', 'supabase', 'url', 'cloudflare', 'youtube'
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_multimedia_videos_category ON public.multimedia_videos(category);
CREATE INDEX IF NOT EXISTS idx_multimedia_videos_created ON public.multimedia_videos(created_at DESC);

-- Habilitar Row Level Security (RLS)
ALTER TABLE public.multimedia_videos ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all operations on multimedia_videos" ON public.multimedia_videos;
CREATE POLICY "Allow all operations on multimedia_videos" ON public.multimedia_videos FOR ALL TO public, anon, authenticated USING (true) WITH CHECK (true);

-- 2. CREACIÓN OPCIONAL DE BUCKET DE STORAGE (si se usa Supabase Storage):
-- INSERT INTO storage.buckets (id, name, public) 
-- VALUES ('multimedia', 'multimedia', true)
-- ON CONFLICT (id) DO NOTHING;
