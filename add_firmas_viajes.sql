-- ═══════════════════════════════════════════════════════════
-- Agregar columnas de firma a la tabla viajes
-- Ejecutar en Supabase SQL Editor
-- ═══════════════════════════════════════════════════════════

ALTER TABLE viajes
  ADD COLUMN IF NOT EXISTS firma_despacho_url  TEXT,
  ADD COLUMN IF NOT EXISTS firma_retorno_url   TEXT;
