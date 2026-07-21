-- Agregar columna turno a movimientos
-- Ejecutar en SQL Editor de Supabase
ALTER TABLE movimientos
  ADD COLUMN IF NOT EXISTS turno TEXT DEFAULT 'mañana'
  CHECK (turno IN ('mañana', 'tarde', 'noche'));
