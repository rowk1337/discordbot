/*
  # Correction des politiques de stockage pour les logos

  1. Suppression des anciennes politiques
  2. Création de nouvelles politiques plus permissives
  3. Configuration du bucket company-assets
*/

-- Supprimer les anciennes politiques si elles existent
DROP POLICY IF EXISTS "Authenticated users can upload company logos" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can view company logos" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can update company logos" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete company logos" ON storage.objects;

-- Créer le bucket s'il n'existe pas
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'company-assets', 
  'company-assets', 
  true, 
  5242880, -- 5MB
  ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml']
)
ON CONFLICT (id) DO UPDATE SET
  public = true,
  file_size_limit = 5242880,
  allowed_mime_types = ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml'];

-- Politiques de stockage pour les logos des sociétés
CREATE POLICY "Allow authenticated users to upload company logos"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'company-assets' 
  AND (storage.foldername(name))[1] = 'company-logos'
);

CREATE POLICY "Allow public read access to company logos"
ON storage.objects FOR SELECT
TO public
USING (
  bucket_id = 'company-assets' 
  AND (storage.foldername(name))[1] = 'company-logos'
);

CREATE POLICY "Allow authenticated users to update company logos"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'company-assets' 
  AND (storage.foldername(name))[1] = 'company-logos'
);

CREATE POLICY "Allow authenticated users to delete company logos"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'company-assets' 
  AND (storage.foldername(name))[1] = 'company-logos'
);