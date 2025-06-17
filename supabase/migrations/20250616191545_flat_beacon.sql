/*
  # Table pour gérer les accès utilisateur aux sociétés

  1. Nouvelle table
    - `user_company_access` - Gestion des accès utilisateur aux sociétés

  2. Sécurité
    - Activation RLS
    - Politiques pour les administrateurs uniquement
*/

-- Table des accès utilisateur aux sociétés
CREATE TABLE IF NOT EXISTS user_company_access (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  company_id uuid REFERENCES companies(id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'user' CHECK (role IN ('admin', 'user', 'viewer')),
  created_at timestamptz DEFAULT now(),
  UNIQUE(user_id, company_id)
);

-- Activation RLS
ALTER TABLE user_company_access ENABLE ROW LEVEL SECURITY;

-- Politiques RLS (seuls les admins peuvent gérer les accès)
CREATE POLICY "Admins can manage user company access"
  ON user_company_access
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM auth.users 
      WHERE id = auth.uid() 
      AND (raw_user_meta_data->>'role') = 'admin'
    )
  );

-- Index pour optimiser les requêtes
CREATE INDEX IF NOT EXISTS idx_user_company_access_user_id ON user_company_access(user_id);
CREATE INDEX IF NOT EXISTS idx_user_company_access_company_id ON user_company_access(company_id);