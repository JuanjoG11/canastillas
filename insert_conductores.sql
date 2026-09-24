-- ═══════════════════════════════════════════════════════════
-- Insertar conductores de ejemplo
-- Basado en los datos del Excel original
-- ═══════════════════════════════════════════════════════════

INSERT INTO conductores (cedula, nombre, activo) VALUES
  ('123456789', 'CESAR PEÑA', true),
  ('987654321', 'DAVID ALFONSO', true),
  ('456789123', 'RICARDO MENDEZ', true),
  ('789123456', 'JUAN CARLOS', true),
  ('321654987', 'WILSON PARDO', true),
  ('654987321', 'CESAR ROA', true),
  ('147258369', 'CARLOS ARTURO JIMENES', true),
  ('369258147', 'CRISTIAN LARROTA', true),
  ('258369147', 'MIGUEL PINILLA', true),
  ('741852963', 'RAFAEL FERNANDEZ', true),
  ('963852741', 'HENRRY MEDRANO', true),
  ('159357486', 'IVAN PEÑUELA', true),
  ('486159357', 'CARLOS ANDRES GALVIZ', true),
  ('357486159', 'ARVEY RIVERA', true),
  ('486357159', 'JHON CASTRO', true),
  ('159486357', 'LUIS TINJACA', true)
ON CONFLICT (cedula) DO UPDATE SET nombre = EXCLUDED.nombre, activo = true;
