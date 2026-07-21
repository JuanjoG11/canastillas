-- ═══════════════════════════════════════════════════════════
-- Control de Canastas — Setup de base de datos Supabase
-- Ejecutar completo en SQL Editor de Supabase
-- ═══════════════════════════════════════════════════════════

-- ── Tabla auxiliares ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS auxiliares (
  id          TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  nombre      TEXT NOT NULL,
  cedula      TEXT NOT NULL UNIQUE,
  activo      BOOLEAN NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── Tabla movimientos ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS movimientos (
  id                  TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  referencia_numero   TEXT NOT NULL UNIQUE,
  tipo                TEXT NOT NULL CHECK (tipo IN ('salida_auxiliar','entrada_auxiliar','entrada_cliente','salida_cliente')),
  cantidad            INTEGER NOT NULL CHECK (cantidad > 0),
  auxiliar_id         TEXT REFERENCES auxiliares(id) ON DELETE SET NULL,
  cliente_nombre      TEXT,
  cliente_prestamo_id TEXT,
  admin_registrador   TEXT NOT NULL,
  notas               TEXT DEFAULT '',
  fecha               TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── Tabla estado (una sola fila, id = 'main') ────────────────
CREATE TABLE IF NOT EXISTS estado (
  id                        TEXT PRIMARY KEY DEFAULT 'main',
  canastas_en_bodega        INTEGER NOT NULL DEFAULT 0,
  canastas_con_auxiliares   JSONB NOT NULL DEFAULT '{}',
  canastas_clientes_prestadas JSONB NOT NULL DEFAULT '[]',
  updated_at                TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── Tabla config ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS config (
  id                  TEXT PRIMARY KEY DEFAULT 'main',
  inventario_inicial  INTEGER NOT NULL DEFAULT 100,
  mov_counter         INTEGER NOT NULL DEFAULT 0
);

-- ── Índices para historial rápido ────────────────────────────
CREATE INDEX IF NOT EXISTS idx_movimientos_fecha       ON movimientos(fecha DESC);
CREATE INDEX IF NOT EXISTS idx_movimientos_tipo        ON movimientos(tipo);
CREATE INDEX IF NOT EXISTS idx_movimientos_auxiliar    ON movimientos(auxiliar_id);

-- ── Fila inicial de estado ───────────────────────────────────
INSERT INTO estado (id, canastas_en_bodega, canastas_con_auxiliares, canastas_clientes_prestadas)
VALUES ('main', 100, '{}', '[]')
ON CONFLICT (id) DO NOTHING;

-- ── Fila inicial de config ───────────────────────────────────
INSERT INTO config (id, inventario_inicial, mov_counter)
VALUES ('main', 100, 0)
ON CONFLICT (id) DO NOTHING;

-- ── Auxiliares de ejemplo ─────────────────────────────────────
INSERT INTO auxiliares (id, nombre, cedula, activo) VALUES
  ('aux1', 'Carlos Gómez',  '12345678', true),
  ('aux2', 'Ana Martínez',  '87654321', true),
  ('aux3', 'Luis Herrera',  '11223344', true)
ON CONFLICT (cedula) DO NOTHING;

-- ── Row Level Security: desactivado (app usa anon key con lógica propia) ──
ALTER TABLE auxiliares  DISABLE ROW LEVEL SECURITY;
ALTER TABLE movimientos DISABLE ROW LEVEL SECURITY;
ALTER TABLE estado      DISABLE ROW LEVEL SECURITY;
ALTER TABLE config      DISABLE ROW LEVEL SECURITY;
