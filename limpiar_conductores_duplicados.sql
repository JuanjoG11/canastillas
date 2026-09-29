-- ═══════════════════════════════════════════════════════════
-- SCRIPT: Limpiar conductores duplicados
-- Control de Canastas PWA
-- ═══════════════════════════════════════════════════════════
-- Este script elimina los conductores duplicados creados con cédulas
-- de prueba (insert_conductores.sql) y reasigna los viajes existentes
-- a los conductores oficiales (cédulas 1001 a 1016 de fix_conductores.sql).

-- 1. Reasignar cualquier viaje que apunte al ID de un conductor duplicado/de prueba
UPDATE viajes v
SET conductor_id = c_real.id
FROM conductores c_dummy
JOIN conductores c_real 
  ON UPPER(TRIM(c_dummy.nombre)) = UPPER(TRIM(c_real.nombre))
  AND c_real.cedula IN ('1001','1002','1003','1004','1005','1006','1007','1008','1009','1010','1011','1012','1013','1014','1015','1016')
WHERE v.conductor_id = c_dummy.id
  AND c_dummy.cedula IN (
    '123456789', '987654321', '456789123', '789123456',
    '321654987', '654987321', '147258369', '369258147',
    '258369147', '741852963', '963852741', '159357486',
    '486159357', '357486159', '486357159', '159486357'
  );

-- 2. Eliminar los registros con las cédulas dummy de prueba
DELETE FROM conductores
WHERE cedula IN (
  '123456789', '987654321', '456789123', '789123456',
  '321654987', '654987321', '147258369', '369258147',
  '258369147', '741852963', '963852741', '159357486',
  '486159357', '357486159', '486357159', '159486357'
);

-- 3. Verificar que quedan exactamente los conductores únicos oficiales
SELECT id, nombre, cedula, activo, created_at 
FROM conductores 
ORDER BY nombre ASC;
