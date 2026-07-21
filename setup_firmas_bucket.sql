-- ═══════════════════════════════════════════════════════════
-- Crear Bucket de Firmas en Supabase Storage
-- Ejecutar en el SQL Editor de Supabase
-- ═══════════════════════════════════════════════════════════

-- 1. Crear el bucket 'firmas' público
INSERT INTO storage.buckets (id, name, public) 
VALUES ('firmas', 'firmas', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- 2. Desactivar RLS o agregar políticas públicas en storage.objects para el bucket 'firmas'
DROP POLICY IF EXISTS "Permitir subida publica firmas" ON storage.objects;
CREATE POLICY "Permitir subida publica firmas"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'firmas');

DROP POLICY IF EXISTS "Permitir lectura publica firmas" ON storage.objects;
CREATE POLICY "Permitir lectura publica firmas"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'firmas');

DROP POLICY IF EXISTS "Permitir actualizacion publica firmas" ON storage.objects;
CREATE POLICY "Permitir actualizacion publica firmas"
  ON storage.objects FOR UPDATE
  USING (bucket_id = 'firmas');
