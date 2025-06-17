/*
  # Correction des permissions utilisateur et amélioration de la gestion

  1. Mise à jour de l'utilisateur rfranco@sedadi.fr en tant qu'administrateur
  2. Amélioration des fonctions de gestion des utilisateurs
  3. Correction des politiques RLS
*/

-- Mettre à jour l'utilisateur rfranco@sedadi.fr en tant qu'administrateur
UPDATE auth.users 
SET raw_user_meta_data = jsonb_set(
  COALESCE(raw_user_meta_data, '{}'),
  '{role}',
  '"admin"'
)
WHERE email = 'rfranco@sedadi.fr';

-- Si l'utilisateur n'existe pas encore, le créer
INSERT INTO auth.users (
  instance_id,
  id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  raw_user_meta_data,
  created_at,
  updated_at,
  confirmation_token,
  email_change,
  email_change_token_new,
  recovery_token
) 
SELECT 
  '00000000-0000-0000-0000-000000000000',
  gen_random_uuid(),
  'authenticated',
  'authenticated',
  'rfranco@sedadi.fr',
  crypt('temp_password_123', gen_salt('bf')),
  now(),
  jsonb_build_object(
    'role', 'admin',
    'full_name', 'Romain Franco',
    'created_by_system', true
  ),
  now(),
  now(),
  '',
  '',
  '',
  ''
WHERE NOT EXISTS (
  SELECT 1 FROM auth.users WHERE email = 'rfranco@sedadi.fr'
);

-- Améliorer la fonction get_users_list pour être plus robuste
CREATE OR REPLACE FUNCTION get_users_list()
RETURNS TABLE (
  id uuid,
  email text,
  created_at timestamptz,
  email_confirmed_at timestamptz,
  raw_user_meta_data jsonb,
  last_sign_in_at timestamptz
) 
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  current_user_role text;
BEGIN
  -- Récupérer le rôle de l'utilisateur actuel
  SELECT COALESCE(u.raw_user_meta_data->>'role', 'user') INTO current_user_role
  FROM auth.users u 
  WHERE u.id = auth.uid();

  -- Vérifier que l'utilisateur actuel est un administrateur
  IF current_user_role != 'admin' THEN
    RAISE EXCEPTION 'Accès refusé: seuls les administrateurs peuvent lister les utilisateurs. Votre rôle actuel: %', current_user_role;
  END IF;

  -- Retourner la liste des utilisateurs
  RETURN QUERY
  SELECT 
    u.id,
    u.email,
    u.created_at,
    u.email_confirmed_at,
    u.raw_user_meta_data,
    u.last_sign_in_at
  FROM auth.users u
  ORDER BY u.created_at DESC;
END;
$$;

-- Fonction pour vérifier le rôle d'un utilisateur
CREATE OR REPLACE FUNCTION check_user_role(user_id uuid DEFAULT auth.uid())
RETURNS text
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  user_role text;
BEGIN
  SELECT COALESCE(raw_user_meta_data->>'role', 'user') INTO user_role
  FROM auth.users 
  WHERE id = user_id;
  
  RETURN COALESCE(user_role, 'user');
END;
$$;

-- Fonction pour promouvoir un utilisateur en administrateur
CREATE OR REPLACE FUNCTION promote_to_admin(target_email text)
RETURNS jsonb
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  target_user_id uuid;
BEGIN
  -- Trouver l'utilisateur par email
  SELECT id INTO target_user_id
  FROM auth.users 
  WHERE email = target_email;

  IF target_user_id IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Utilisateur non trouvé avec l''email: ' || target_email
    );
  END IF;

  -- Mettre à jour le rôle
  UPDATE auth.users 
  SET 
    raw_user_meta_data = jsonb_set(
      COALESCE(raw_user_meta_data, '{}'),
      '{role}',
      '"admin"'
    ),
    updated_at = now()
  WHERE id = target_user_id;

  RETURN jsonb_build_object(
    'success', true,
    'message', 'Utilisateur ' || target_email || ' promu administrateur avec succès'
  );

EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', SQLERRM
    );
END;
$$;

-- Créer des paramètres par défaut pour l'utilisateur admin
INSERT INTO app_settings (
  user_id,
  theme,
  accent_color,
  notifications_settings,
  client_type_settings,
  google_integration_settings
)
SELECT 
  u.id,
  'light',
  '#3B82F6',
  '{"overdueInvoices": true, "newPayments": true, "dueDateReminders": true, "weeklyReport": false}',
  '{"externe": {"defaultPaymentDays": 30, "defaultPaymentMode": "Virement"}, "interne": {"defaultPaymentDays": 15, "defaultPaymentMode": "Virement"}, "partenaire": {"defaultPaymentDays": 60, "defaultPaymentMode": "Virement"}}',
  '{"isConnected": false}'
FROM auth.users u
WHERE u.email = 'rfranco@sedadi.fr'
AND NOT EXISTS (
  SELECT 1 FROM app_settings WHERE user_id = u.id
);

-- Afficher un message de confirmation
DO $$
BEGIN
  RAISE NOTICE 'Utilisateur rfranco@sedadi.fr configuré en tant qu''administrateur';
  RAISE NOTICE 'Vous pouvez maintenant accéder à la gestion des utilisateurs';
END $$;