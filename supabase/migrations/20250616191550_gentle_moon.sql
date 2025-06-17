/*
  # Ajout des colonnes pour les logos des sociétés

  1. Nouvelles colonnes
    - `logo_url` - URL du logo de la société
    - `logo_file_name` - Nom du fichier du logo

  2. Storage bucket
    - Création du bucket pour les assets des sociétés
*/

-- Ajouter les colonnes pour les logos
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'companies' AND column_name = 'logo_url'
  ) THEN
    ALTER TABLE companies ADD COLUMN logo_url text;
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'companies' AND column_name = 'logo_file_name'
  ) THEN
    ALTER TABLE companies ADD COLUMN logo_file_name text;
  END IF;
END $$;

-- Créer le bucket de stockage pour les assets des sociétés
INSERT INTO storage.buckets (id, name, public)
VALUES ('company-assets', 'company-assets', true)
ON CONFLICT (id) DO NOTHING;

-- Politique de stockage pour permettre l'upload et la lecture des logos
CREATE POLICY "Authenticated users can upload company logos"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'company-assets');

CREATE POLICY "Anyone can view company logos"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'company-assets');

CREATE POLICY "Authenticated users can update company logos"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'company-assets');

CREATE POLICY "Authenticated users can delete company logos"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'company-assets');