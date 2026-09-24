-- ═══════════════════════════════════════════════════════════
-- FASE 1-2-3: Modelo completo de clientes, kardex y alertas
-- Ejecutar en Supabase SQL Editor
-- ═══════════════════════════════════════════════════════════

-- ── Tabla clientes ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS clientes (
  id              TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  nombre          TEXT NOT NULL,
  nit             TEXT,
  telefono        TEXT,
  direccion       TEXT,
  stock_acordado  INTEGER NOT NULL DEFAULT 0,  -- max canastillas que puede tener
  activo          BOOLEAN NOT NULL DEFAULT true,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── Tabla movimientos_cliente (kardex por cliente) ─────────
CREATE TABLE IF NOT EXISTS movimientos_cliente (
  id              TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  fecha           DATE NOT NULL DEFAULT CURRENT_DATE,
  tipo            TEXT NOT NULL CHECK (tipo IN ('entrega','retorno','ajuste','baja')),
  -- 'entrega'  = canastillas salen a cliente
  -- 'retorno'  = cliente devuelve canastillas
  -- 'ajuste'   = corrección de inventario
  -- 'baja'     = canastillas dañadas / perdidas
  cliente_id      TEXT NOT NULL REFERENCES clientes(id) ON DELETE RESTRICT,
  cantidad        INTEGER NOT NULL CHECK (cantidad > 0),
  numero_doc      TEXT,            -- # factura, # remisión, etc.
  viaje_id        TEXT REFERENCES viajes(id) ON DELETE SET NULL,
  conductor_id    TEXT REFERENCES conductores(id) ON DELETE SET NULL,
  auxiliar_id     TEXT REFERENCES auxiliares(id) ON DELETE SET NULL,
  notas           TEXT DEFAULT '',
  admin_registrador TEXT NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── Tabla inventario_general (estado en tiempo real) ───────
-- Una sola fila que se actualiza con cada movimiento
CREATE TABLE IF NOT EXISTS inventario_general (
  id              TEXT PRIMARY KEY DEFAULT 'main',
  total_sistema   INTEGER NOT NULL DEFAULT 5000,
  en_bodega       INTEGER NOT NULL DEFAULT 5000,
  en_clientes     INTEGER NOT NULL DEFAULT 0,
  en_rutas        INTEGER NOT NULL DEFAULT 0,   -- viajes abiertos
  danadas         INTEGER NOT NULL DEFAULT 0,
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── Fila inicial ────────────────────────────────────────────
INSERT INTO inventario_general (id, total_sistema, en_bodega)
VALUES ('main', 5000, 5000)
ON CONFLICT (id) DO NOTHING;

-- ── Índices ─────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_movcli_cliente  ON movimientos_cliente(cliente_id);
CREATE INDEX IF NOT EXISTS idx_movcli_fecha    ON movimientos_cliente(fecha DESC);
CREATE INDEX IF NOT EXISTS idx_movcli_tipo     ON movimientos_cliente(tipo);
CREATE INDEX IF NOT EXISTS idx_movcli_viaje    ON movimientos_cliente(viaje_id);
CREATE INDEX IF NOT EXISTS idx_clientes_activo ON clientes(activo);

-- ── Permisos ─────────────────────────────────────────────────
ALTER TABLE clientes            DISABLE ROW LEVEL SECURITY;
ALTER TABLE movimientos_cliente DISABLE ROW LEVEL SECURITY;
ALTER TABLE inventario_general  DISABLE ROW LEVEL SECURITY;

GRANT ALL ON clientes            TO anon;
GRANT ALL ON movimientos_cliente TO anon;
GRANT ALL ON inventario_general  TO anon;
