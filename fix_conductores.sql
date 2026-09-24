-- ═══════════════════════════════════════════════════════════
-- FIX: Permisos tabla conductores + verificar datos
-- Ejecutar en Supabase SQL Editor
-- ═══════════════════════════════════════════════════════════

-- 1. Desactivar RLS (por si quedó activo)
ALTER TABLE conductores DISABLE ROW LEVEL SECURITY;

-- 2. Dar permisos explícitos al rol anon
GRANT SELECT, INSERT, UPDATE ON conductores TO anon;
GRANT SELECT, INSERT, UPDATE ON conductores TO authenticated;

-- 3. Verificar cuántos conductores hay
SELECT COUNT(*) as total FROM conductores;

-- 4. Si el count es 0, insertar conductores
INSERT INTO conductores (cedula, nombre, activo) VALUES
  ('1001', 'CESAR PEÑA', true),
  ('1002', 'DAVID ALFONSO', true),
  ('1003', 'RICARDO MENDEZ', true),
  ('1004', 'JUAN CARLOS', true),
  ('1005', 'WILSON PARDO', true),
  ('1006', 'CESAR ROA', true),
  ('1007', 'CARLOS ARTURO JIMENES', true),
  ('1008', 'CRISTIAN LARROTA', true),
  ('1009', 'MIGUEL PINILLA', true),
  ('1010', 'RAFAEL FERNANDEZ', true),
  ('1011', 'HENRRY MEDRANO', true),
  ('1012', 'IVAN PEÑUELA', true),
  ('1013', 'CARLOS ANDRES GALVIZ', true),
  ('1014', 'ARVEY RIVERA', true),
  ('1015', 'JHON CASTRO', true),
  ('1016', 'LUIS TINJACA', true)
ON CONFLICT (cedula) DO UPDATE SET nombre = EXCLUDED.nombre, activo = true;

-- 5. Verificar resultado final
SELECT id, nombre, cedula, activo FROM conductores ORDER BY nombre;
