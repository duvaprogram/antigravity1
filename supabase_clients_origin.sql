-- ========================================================
-- Script opcional de base de datos: Clasificación de Clientes
-- ========================================================
-- Este script es OPCIONAL. El sistema ya guarda y lee el origen
-- (WhatsApp, Página Web u Otro) automáticamente sin necesidad
-- de cambios manuales en la base de datos.
--
-- Si deseas tener la columna nativa 'origin' en tu tabla 'clients':
-- 1. Ve a tu panel de Supabase -> SQL Editor
-- 2. Ejecuta la siguiente consulta:

ALTER TABLE clients ADD COLUMN IF NOT EXISTS origin text;
