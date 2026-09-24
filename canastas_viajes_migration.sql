-- ═══════════════════════════════════════════════════════════
-- REDISEÑO MODELO VIAJES — Opción B tipo Excel
-- Control de Canastas PWA 2.0
-- ═══════════════════════════════════════════════════════════

-- ── Tabla conductores ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS conductores (
  id          TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  nombre      TEXT NOT NULL,
  cedula      TEXT NOT NULL UNIQUE,
  activo      BOOLEAN NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── Tabla viajes (despacho completo) ──────────────────────────
CREATE TABLE IF NOT EXISTS viajes (
  id             TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  numero_viaje   TEXT NOT NULL UNIQUE,
  fecha          DATE NOT NULL DEFAULT CURRENT_DATE,
  conductor_id   TEXT NOT NULL REFERENCES conductores(id) ON DELETE RESTRICT,
  auxiliar_id    TEXT NOT NULL REFERENCES auxiliares(id) ON DELETE RESTRICT,
  placa          TEXT NOT NULL,
  remolque       TEXT,
  numero_factura TEXT,
  
  -- DESPACHADO (salió de Alpina)
  desp_grandes   INTEGER NOT NULL DEFAULT 0 CHECK (desp_grandes >= 0),
  desp_medianas  INTEGER NOT NULL DEFAULT 0 CHECK (desp_medianas >= 0),
  desp_pequenas  INTEGER NOT NULL DEFAULT 0 CHECK (desp_pequenas >= 0),
  desp_estibas   INTEGER NOT NULL DEFAULT 0 CHECK (desp_estibas >= 0),
  
  -- RETORNO (devolvió el distribuidor)
  ret_grandes    INTEGER CHECK (ret_grandes >= 0),
  ret_medianas   INTEGER CHECK (ret_medianas >= 0),
  ret_pequenas   INTEGER CHECK (ret_pequenas >= 0),
  ret_estibas    INTEGER CHECK (ret_estibas >= 0),
  fecha_retorno  TIMESTAMPTZ,
  
  observaciones  TEXT DEFAULT '',
  estado         TEXT NOT NULL DEFAULT 'abierto' CHECK (estado IN ('abierto', 'cerrado')),
  admin_registrador TEXT NOT NULL,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── Inventario teórico inicial (por tipo de envase) ───────────
CREATE TABLE IF NOT EXISTS inventario_inicial (
  id         TEXT PRIMARY KEY DEFAULT 'main',
  grandes    INTEGER NOT NULL DEFAULT 0,
  medianas   INTEGER NOT NULL DEFAULT 0,
  pequenas   INTEGER NOT NULL DEFAULT 0,
  estibas    INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── Tabla config actualizada ──────────────────────────────────
-- Se mantiene mov_counter por compatibilidad, añadimos viaje_counter
ALTER TABLE config ADD COLUMN IF NOT EXISTS viaje_counter INTEGER NOT NULL DEFAULT 0;

-- ── Indices para búsqueda rápida ──────────────────────────────
CREATE INDEX IF NOT EXISTS idx_viajes_fecha       ON viajes(fecha DESC);
CREATE INDEX IF NOT EXISTS idx_viajes_estado      ON viajes(estado);
CREATE INDEX IF NOT EXISTS idx_viajes_conductor   ON viajes(conductor_id);
CREATE INDEX IF NOT EXISTS idx_viajes_auxiliar    ON viajes(auxiliar_id);
CREATE INDEX IF NOT EXISTS idx_conductores_activo ON conductores(activo);

-- ── Filas iniciales ───────────────────────────────────────────
INSERT INTO inventario_inicial (id, grandes, medianas, pequenas, estibas)
VALUES ('main', 5146, 10232, 56, 303)
ON CONFLICT (id) DO NOTHING;

UPDATE config SET viaje_counter = 0 WHERE id = 'main';

-- ── RLS desactivado (igual que el modelo anterior) ────────────
ALTER TABLE conductores DISABLE ROW LEVEL SECURITY;
ALTER TABLE viajes DISABLE ROW LEVEL SECURITY;
ALTER TABLE inventario_inicial DISABLE ROW LEVEL SECURITY;

-- ═══════════════════════════════════════════════════════════════
-- MANTENER COMPATIBILIDAD CON MODELO ANTIGUO
-- (auxiliares, movimientos, estado siguen existiendo)
-- Los admins pueden seguir usando el flow viejo o migrar gradualmente
-- ═══════════════════════════════════════════════════════════════
