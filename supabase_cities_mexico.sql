-- ==========================================================
-- SCRIPT SQL PARA SUPABASE: CIUDADES DE MEXICO EN `cities`
-- ==========================================================
-- La tabla cities solo tenia Quito, Guayaquil, Caracas, Medellin y Bogota.
-- Sin CDMX, Guadalajara y Monterrey no se puede agregar inventario (ni
-- guias) en Mexico, porque el sistema busca el city_id por nombre.
-- Ejecutalo completo en el SQL Editor de Supabase. Es idempotente.

-- 1. (Opcional) Mira la restriccion de pais, si existe
SELECT conname, pg_get_constraintdef(oid) AS definicion
FROM pg_constraint
WHERE conrelid = 'public.cities'::regclass;

-- 2. Inserta las ciudades que falten
INSERT INTO public.cities (name, country, active)
SELECT v.name, v.country, true
FROM (VALUES
    ('CDMX', 'Mexico'),
    ('Guadalajara', 'Mexico'),
    ('Monterrey', 'Mexico')
) AS v(name, country)
WHERE NOT EXISTS (
    SELECT 1 FROM public.cities c WHERE c.name = v.name
);

-- 3. Verifica
SELECT id, name, country, active FROM public.cities ORDER BY created_at;
