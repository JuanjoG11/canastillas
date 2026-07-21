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

-- ── Auxiliares de la empresa ──────────────────────────────────
INSERT INTO auxiliares (cedula, nombre, activo) VALUES
  ('1053866136', 'ADRIAN FELIPE MARTINEZ ORTEGON', true),
  ('1038768016', 'ANDRES FELIPE RIOS CAICEDO', true),
  ('1023378066', 'ANDRES MATEO VILLALBA DIAZ', true),
  ('9910933', 'ARBEY DE JESUS LARGO LARGO', true),
  ('1089933391', 'BRAHIAN STIVEN VALENCIA IGLESIAS', true),
  ('1004671619', 'BRANDON STEVEN GIL BAEZ', true),
  ('1127384755', 'CAMILO ANDRES CONTRERAS RIVAS', true),
  ('1006128361', 'CAMILO LEANDRO GUECHE PEÑA', true),
  ('1089382609', 'CAMILO SUAREZ GARCIA', true),
  ('1064723579', 'CARLOS ALBERTO JIMENEZ JACOME', true),
  ('1088253407', 'CARLOS ANDRES PINEDA CANO', true),
  ('10033035', 'CESAR AUGUSTO CASTILLO LONDOÑO', true),
  ('1112227774', 'CHRISTIAN DAVID CAICEDO MONTAÑO', true),
  ('1123141444', 'CRISTIAN FABIAN CAMACHO MARTINEZ', true),
  ('1038926903', 'DIORLAN ANTONIO MESA FLOREZ', true),
  ('18524020', 'EDWIN MAURICIO GOMEZ GALINDO', true),
  ('9726421', 'ELKIN GARCIA OCAMPO', true),
  ('10027683', 'GERMAN GALVEZ CORTES', true),
  ('18517128', 'JHON FREDY MORENO', true),
  ('1002730727', 'JHON WILSON GIRALDO CARVAJAL', true),
  ('1088249115', 'JOHN EDWAR ZAPATA ACEVEDO', true),
  ('1112226698', 'JOSE ALEXANDER CONSTAIN PERLAZA', true),
  ('1087559558', 'JUAN ALEJANDRO FRANCO MARIN', true),
  ('1002718622', 'JUAN CAMILO COCOMA OROZCO', true),
  ('1088308341', 'JUAN DAVID QUINTERO GRAJALES', true),
  ('1093220521', 'JUAN DIEGO FRANCO VERGARA', true),
  ('1088352440', 'JUAN ESTEBAN GALLEGO DIEZ', true),
  ('1064310724', 'JUAN JOSE CONTRERAS HERNANDEZ', true),
  ('1004778577', 'JUAN MANUEL DELGADO NARVAEZ', true),
  ('1137060545', 'JUAN MANUEL LARGO SUAREZ', true),
  ('1112778308', 'LUIS CARLOS CADAVID RESTREPO', true),
  ('1088331177', 'MICHAEL STEVEN HENAO RODRIGUEZ', true),
  ('1099204769', 'MILTON GILMER OSORIO CALLE', true),
  ('18519474', 'OSCAR MAURICIO RESTREPO MORENO', true),
  ('10138323', 'ROVINSON TORRES RIVERA', true),
  ('1110041554', 'SAMUEL ZAPATA PINEDA', true),
  ('1004737907', 'SANTIAGO HENAO MORALES', true),
  ('1089382721', 'SEBASTIAN MONTES RENDON', true),
  ('1088334475', 'SEBASTIAN VILLADA VELASQUEZ', true),
  ('1058821245', 'VICTOR ALFONSO PULGARIN MEJIA', true),
  ('1007783801', 'YEISON DAVID RENDON SOTO', true),
  ('1053849016', 'YHONY ALEXANDER LOPEZ LOPEZ', true)
ON CONFLICT (cedula) DO UPDATE SET nombre = EXCLUDED.nombre, activo = true;

-- ── Row Level Security: desactivado (app usa anon key con lógica propia) ──
ALTER TABLE auxiliares  DISABLE ROW LEVEL SECURITY;
ALTER TABLE movimientos DISABLE ROW LEVEL SECURITY;
ALTER TABLE estado      DISABLE ROW LEVEL SECURITY;
ALTER TABLE config      DISABLE ROW LEVEL SECURITY;
