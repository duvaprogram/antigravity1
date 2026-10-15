-- ============================================================================
-- Calculadora de Materiales para Pulseras
-- Catálogo de diseños, dijes, material disponible y diseños en producción.
-- Ejecutar en el SQL Editor de Supabase.
-- ============================================================================

-- 1. Catálogo de diseños de pulseras -----------------------------------------
create table if not exists public.bracelet_designs (
    id          text primary key,
    name        text        not null,
    sequence    jsonb       not null default '[]'::jsonb,  -- [{ typeId, qty }, ...]
    dije_id     text,
    thread_cm   integer     not null default 35,
    created_at  timestamptz not null default now(),
    updated_at  timestamptz not null default now()
);

-- 2. Dijes (colgantes) con su propio stock -----------------------------------
create table if not exists public.bracelet_charms (
    id          text primary key,
    name        text        not null,
    shape       text        not null default 'medalla',   -- medalla | cruz | corazon | estrella
    color       text        not null default 'dorado',    -- dorado | plata | ororosa | negro
    stock       numeric     not null default 0,
    created_at  timestamptz not null default now(),
    updated_at  timestamptz not null default now()
);

-- 3. Material disponible (balines e hilo) ------------------------------------
--    material_key: el id del balín (ej. 'neopreno_negro') o 'thread' (en metros)
create table if not exists public.bracelet_material_stock (
    material_key text primary key,
    quantity     numeric     not null default 0,
    updated_at   timestamptz not null default now()
);

-- 4. Diseños comprometidos a producción --------------------------------------
create table if not exists public.bracelet_productions (
    id          text primary key,
    name        text        not null,
    color       text        not null default 'negro',     -- neopreno: negro | rojo
    qty         integer     not null default 1,
    sequence    jsonb       not null default '[]'::jsonb,
    dije_id     text,
    thread_cm   integer     not null default 35,
    created_at  timestamptz not null default now(),
    updated_at  timestamptz not null default now()
);

-- Mantener updated_at al día --------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
    new.updated_at = now();
    return new;
end;
$$;

do $$
declare
    t text;
begin
    foreach t in array array[
        'bracelet_designs',
        'bracelet_charms',
        'bracelet_material_stock',
        'bracelet_productions'
    ] loop
        execute format('drop trigger if exists set_updated_at on public.%I', t);
        execute format(
            'create trigger set_updated_at before update on public.%I
             for each row execute function public.set_updated_at()', t);
    end loop;
end;
$$;

-- Políticas de acceso ---------------------------------------------------------
-- Mismo criterio que el resto de tablas de la app: acceso con la clave anon.
alter table public.bracelet_designs        enable row level security;
alter table public.bracelet_charms         enable row level security;
alter table public.bracelet_material_stock enable row level security;
alter table public.bracelet_productions    enable row level security;

do $$
declare
    t text;
begin
    foreach t in array array[
        'bracelet_designs',
        'bracelet_charms',
        'bracelet_material_stock',
        'bracelet_productions'
    ] loop
        execute format('drop policy if exists "acceso_completo" on public.%I', t);
        execute format(
            'create policy "acceso_completo" on public.%I
             for all using (true) with check (true)', t);
    end loop;
end;
$$;
