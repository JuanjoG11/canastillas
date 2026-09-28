-- ═══════════════════════════════════════════════════════════
-- MIGRACIÓN: AUXILIAR COMO RESPONSABLE DEL VIAJE
-- Control de Canastas PWA · Alpina
-- Ejecutar en Supabase SQL Editor
-- ═══════════════════════════════════════════════════════════

-- 1. Permitir que conductor_id sea NULL en la tabla viajes
-- (El viaje queda registrado al auxiliar, quien es el responsable del material)
ALTER TABLE viajes ALTER COLUMN conductor_id DROP NOT NULL;

-- 2. Asegurar que auxiliar_id sea NOT NULL (responsable obligatorio)
ALTER TABLE viajes ALTER COLUMN auxiliar_id SET NOT NULL;

-- 3. Crear índice para optimizar consultas por auxiliar
CREATE INDEX IF NOT EXISTS idx_viajes_auxiliar_id ON viajes(auxiliar_id);

-- 4. Comentario explicativo en la tabla
COMMENT ON COLUMN viajes.auxiliar_id IS 'Auxiliar responsable del viaje y del conteo de canastas';
COMMENT ON COLUMN viajes.conductor_id IS 'Conductor que transportó el viaje (opcional / informativo)';
