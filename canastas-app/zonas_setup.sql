-- ═══════════════════════════════════════════════════════════════════════════
-- MÓDULO ZONAS — Control de Canastas · Alpina
-- Ejecutar en Supabase → SQL Editor
-- ═══════════════════════════════════════════════════════════════════════════

-- ─── 1. Tabla de zonas (catálogo permanente) ──────────────────────────────
-- Cada batch del Excel es una zona. Se crean automáticamente al subir el Excel.
CREATE TABLE IF NOT EXISTS zonas (
  id            TEXT PRIMARY KEY,          -- el número de batch, ej: "9556"
  nombre        TEXT,                       -- nombre descriptivo opcional
  activa        BOOLEAN DEFAULT TRUE,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- ─── 2. Stock diario por zona ─────────────────────────────────────────────
-- Cada carga diaria inserta filas aquí. Se reemplaza el día actual.
CREATE TABLE IF NOT EXISTS stock_diario (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fecha         DATE NOT NULL DEFAULT CURRENT_DATE,
  zona_id       TEXT NOT NULL REFERENCES zonas(id),
  grandes       INT NOT NULL DEFAULT 0,
  medianas      INT NOT NULL DEFAULT 0,   -- reservado para futuro
  pequenas      INT NOT NULL DEFAULT 0,
  cargado_por   TEXT,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (fecha, zona_id)               -- un registro por zona por día
);

-- ─── 3. Campo zona_id en viajes ───────────────────────────────────────────
-- Agrega la columna zona_id a la tabla viajes (si no existe)
ALTER TABLE viajes ADD COLUMN IF NOT EXISTS zona_id TEXT REFERENCES zonas(id);

-- ─── 4. RLS — permitir todas las operaciones al rol anon ─────────────────
ALTER TABLE zonas       ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_diario ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "zonas_all"        ON zonas;
DROP POLICY IF EXISTS "stock_diario_all" ON stock_diario;

CREATE POLICY "zonas_all"
  ON zonas FOR ALL TO anon USING (TRUE) WITH CHECK (TRUE);

CREATE POLICY "stock_diario_all"
  ON stock_diario FOR ALL TO anon USING (TRUE) WITH CHECK (TRUE);

-- ─── 5. Índices útiles ────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_stock_diario_fecha   ON stock_diario (fecha DESC);
CREATE INDEX IF NOT EXISTS idx_stock_diario_zona    ON stock_diario (zona_id);
CREATE INDEX IF NOT EXISTS idx_viajes_zona          ON viajes (zona_id);
