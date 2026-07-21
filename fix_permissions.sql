-- ═══════════════════════════════════════════════════════════
-- Habilitar permisos y filas iniciales en Supabase
-- Ejecutar este script en el SQL Editor de Supabase
-- ═══════════════════════════════════════════════════════════

-- 1. Desactivar Row Level Security en todas las tablas
ALTER TABLE IF EXISTS auxiliares  DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS movimientos DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS estado      DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS config      DISABLE ROW LEVEL SECURITY;

-- 2. Crear las filas iniciales necesarias si no existen
INSERT INTO estado (id, canastas_en_bodega, canastas_con_auxiliares, canastas_clientes_prestadas)
VALUES ('main', 100, '{}', '[]')
ON CONFLICT (id) DO NOTHING;

INSERT INTO config (id, inventario_inicial, mov_counter)
VALUES ('main', 100, 0)
ON CONFLICT (id) DO NOTHING;
