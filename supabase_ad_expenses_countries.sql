-- ==========================================================
-- SCRIPT SQL PARA SUPABASE: PAISES PERMITIDOS EN ad_expenses
-- ==========================================================
-- La restriccion ad_expenses_country_check solo aceptaba los paises
-- iniciales, asi que una importacion de Meta Ads con campanas de Mexico o
-- Guatemala fallaba entera con:
--   new row for relation "ad_expenses" violates check constraint
--   "ad_expenses_country_check"
--
-- Este script amplia la lista a los mismos nombres que produce el
-- importador (normalizeCountryName en js/income-statement.js).
-- Ejecutalo completo en el SQL Editor de tu proyecto de Supabase.
-- Es idempotente: puedes correrlo varias veces sin romper nada.

-- ----------------------------------------------------------
-- 1. (Opcional) Mira como esta hoy la restriccion
-- ----------------------------------------------------------
SELECT pg_get_constraintdef(oid) AS definicion_actual
FROM pg_constraint
WHERE conname = 'ad_expenses_country_check';

-- ----------------------------------------------------------
-- 2. Revisa que no haya filas fuera de la lista nueva
--    (deberia devolver 0 filas antes de continuar)
-- ----------------------------------------------------------
SELECT DISTINCT country
FROM public.ad_expenses
WHERE country IS NOT NULL
  AND country NOT IN (
      'Ecuador', 'Colombia', 'Venezuela', 'Mexico', 'Guatemala',
      'Peru', 'Chile', 'Panama', 'Bolivia', 'Paraguay', 'Uruguay',
      'Argentina', 'Brasil', 'Costa Rica', 'Republica Dominicana',
      'Honduras', 'El Salvador', 'Nicaragua', 'Espana', 'Estados Unidos'
  );

-- ----------------------------------------------------------
-- 3. Reemplaza la restriccion por la lista ampliada
-- ----------------------------------------------------------
ALTER TABLE public.ad_expenses
    DROP CONSTRAINT IF EXISTS ad_expenses_country_check;

ALTER TABLE public.ad_expenses
    ADD CONSTRAINT ad_expenses_country_check CHECK (
        country IN (
            'Ecuador', 'Colombia', 'Venezuela', 'Mexico', 'Guatemala',
            'Peru', 'Chile', 'Panama', 'Bolivia', 'Paraguay', 'Uruguay',
            'Argentina', 'Brasil', 'Costa Rica', 'Republica Dominicana',
            'Honduras', 'El Salvador', 'Nicaragua', 'Espana', 'Estados Unidos'
        )
    );

-- ----------------------------------------------------------
-- 4. Verifica como quedo la restriccion
-- ----------------------------------------------------------
SELECT pg_get_constraintdef(oid) AS definicion
FROM pg_constraint
WHERE conname = 'ad_expenses_country_check';
