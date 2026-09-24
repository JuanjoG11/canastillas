-- ═══════════════════════════════════════════════════════════
-- FIX: Permisos tablas nuevas del modelo viajes
-- Ejecutar en Supabase SQL Editor
-- ═══════════════════════════════════════════════════════════

-- Desactivar RLS en todas las tablas nuevas
ALTER TABLE conductores         DISABLE ROW LEVEL SECURITY;
ALTER TABLE viajes               DISABLE ROW LEVEL SECURITY;
ALTER TABLE inventario_inicial   DISABLE ROW LEVEL SECURITY;

-- Dar permisos completos al rol anon (el que usa la app)
GRANT ALL ON conductores        TO anon;
GRANT ALL ON viajes              TO anon;
GRANT ALL ON inventario_inicial  TO anon;

-- Verificar
SELECT schemaname, tablename, rowsecurity 
FROM pg_tables 
WHERE tablename IN ('conductores','viajes','inventario_inicial','auxiliares','movimientos','estado','config');
