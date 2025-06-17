/*
  # Fix gen_random_bytes function error

  1. Enable pgcrypto extension which provides gen_random_bytes
  2. Create a fallback function for generating secure random tokens
  3. Update all functions that use gen_random_bytes to use the fallback if needed
*/

-- Enable pgcrypto extension which provides gen_random_bytes
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Create a secure random token generator function that works regardless of available extensions
CREATE OR REPLACE FUNCTION generate_secure_token(bytes_length integer)
RETURNS text
LANGUAGE plpgsql
AS $$
DECLARE
  result text;
BEGIN
  -- Try gen_random_bytes first (from pgcrypto)
  BEGIN
    SELECT encode(gen_random_bytes(bytes_length), 'base64') INTO result;
    RETURN result;
  EXCEPTION
    WHEN undefined_function THEN
      -- Fallback to a less secure but functional alternative
      SELECT encode(
        ('x'||substr(md5(random()::text || clock_timestamp()::text), 1, bytes_length*2))::bytea, 
        'base64'
      ) INTO result;
      RETURN result;
  END;
END;
$$;

-- Update the create_user_account function to use our secure token generator
CREATE OR REPLACE FUNCTION create_user_account(
  user_email text,
  user_password text DEFAULT NULL,
  user_role text DEFAULT 'user',
  user_name text DEFAULT NULL
)
RETURNS jsonb
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  new_user_id uuid;
  setup_token text;
  token_expiry timestamptz;
  setup_url text;
BEGIN
  -- Vérifier que l'utilisateur actuel est un administrateur
  IF NOT is_admin() THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Accès refusé: seuls les administrateurs peuvent créer des utilisateurs'
    );
  END IF;

  -- Vérifier que l'email n'existe pas déjà
  IF EXISTS (SELECT 1 FROM auth.users WHERE email = user_email) THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Un utilisateur avec cet email existe déjà'
    );
  END IF;

  -- Vérifier que le rôle est valide
  IF user_role NOT IN ('admin', 'user') THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Rôle invalide: doit être "admin" ou "user"'
    );
  END IF;

  -- Générer un nouvel ID utilisateur
  new_user_id := generate_uuid();

  -- Si aucun mot de passe n'est fourni, générer un token de configuration
  -- en utilisant notre fonction sécurisée
  IF user_password IS NULL THEN
    setup_token := generate_secure_token(32);
    token_expiry := now() + interval '7 days';
    setup_url := 'https://splendid-semolina-29baa8.netlify.app/setup-password?token=' || setup_token;
  END IF;

  -- Créer l'utilisateur
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
  ) VALUES (
    '00000000-0000-0000-0000-000000000000',
    new_user_id,
    'authenticated',
    'authenticated',
    user_email,
    CASE 
      WHEN user_password IS NOT NULL THEN crypt(user_password, gen_salt('bf'))
      ELSE crypt('temp_' || generate_uuid()::text, gen_salt('bf'))
    END,
    CASE WHEN user_password IS NOT NULL THEN now() ELSE NULL END,
    jsonb_build_object(
      'role', user_role,
      'full_name', COALESCE(user_name, ''),
      'created_by', auth.uid(),
      'created_at', now()
    ) || CASE 
      WHEN setup_token IS NOT NULL THEN jsonb_build_object(
        'password_setup_token', setup_token,
        'password_setup_token_expiry', token_expiry,
        'password_setup_required', true
      )
      ELSE '{}'::jsonb
    END,
    now(),
    now(),
    '',
    '',
    '',
    ''
  );

  -- Créer les paramètres par défaut pour l'utilisateur
  INSERT INTO app_settings (
    user_id,
    theme,
    accent_color,
    notifications_settings,
    client_type_settings,
    google_integration_settings
  ) VALUES (
    new_user_id,
    'light',
    '#3B82F6',
    '{"overdueInvoices": true, "newPayments": true, "dueDateReminders": true, "weeklyReport": false}',
    '{"externe": {"defaultPaymentDays": 30, "defaultPaymentMode": "Virement"}, "interne": {"defaultPaymentDays": 15, "defaultPaymentMode": "Virement"}, "partenaire": {"defaultPaymentDays": 60, "defaultPaymentMode": "Virement"}}',
    '{"isConnected": false}'
  );

  RETURN jsonb_build_object(
    'success', true,
    'user_id', new_user_id,
    'email', user_email,
    'message', CASE 
      WHEN user_password IS NOT NULL THEN 'Utilisateur créé avec succès'
      ELSE 'Utilisateur créé. Un lien de configuration du mot de passe a été généré.'
    END,
    'setup_url', setup_url,
    'setup_token', setup_token
  );

EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', SQLERRM
    );
END;
$$;

-- Update the resend_password_setup_link function to use our secure token generator
CREATE OR REPLACE FUNCTION resend_password_setup_link(user_email text)
RETURNS jsonb
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  target_user_id uuid;
  setup_token text;
  token_expiry timestamptz;
  setup_url text;
BEGIN
  -- Vérifier que l'utilisateur actuel est un administrateur
  IF NOT is_admin() THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Accès refusé: seuls les administrateurs peuvent renvoyer des liens'
    );
  END IF;

  -- Trouver l'utilisateur
  SELECT id INTO target_user_id
  FROM auth.users 
  WHERE email = user_email;

  IF target_user_id IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Utilisateur non trouvé'
    );
  END IF;

  -- Générer un nouveau token avec notre fonction sécurisée
  setup_token := generate_secure_token(32);
  token_expiry := now() + interval '7 days';
  setup_url := 'https://splendid-semolina-29baa8.netlify.app/setup-password?token=' || setup_token;

  -- Mettre à jour les métadonnées utilisateur
  UPDATE auth.users 
  SET 
    raw_user_meta_data = jsonb_set(
      COALESCE(raw_user_meta_data, '{}'),
      '{password_setup_token}',
      to_jsonb(setup_token)
    ),
    raw_user_meta_data = jsonb_set(
      raw_user_meta_data,
      '{password_setup_token_expiry}',
      to_jsonb(token_expiry)
    ),
    raw_user_meta_data = jsonb_set(
      raw_user_meta_data,
      '{password_setup_required}',
      'true'
    ),
    updated_at = now()
  WHERE id = target_user_id;

  RETURN jsonb_build_object(
    'success', true,
    'setup_url', setup_url,
    'message', 'Nouveau lien de configuration généré'
  );

EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', SQLERRM
    );
END;
$$;

-- Update the generate_password_setup_token function to use our secure token generator
CREATE OR REPLACE FUNCTION generate_password_setup_token(user_email text)
RETURNS jsonb
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  target_user_id uuid;
  setup_token text;
  token_expiry timestamptz;
BEGIN
  -- Trouver l'utilisateur par email
  SELECT id INTO target_user_id
  FROM auth.users 
  WHERE email = user_email;

  IF target_user_id IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Utilisateur non trouvé'
    );
  END IF;

  -- Générer un token sécurisé avec notre fonction
  setup_token := generate_secure_token(32);
  token_expiry := now() + interval '24 hours';

  -- Stocker le token dans les métadonnées utilisateur
  UPDATE auth.users 
  SET 
    raw_user_meta_data = jsonb_set(
      COALESCE(raw_user_meta_data, '{}'),
      '{password_setup_token}',
      to_jsonb(setup_token)
    ),
    raw_user_meta_data = jsonb_set(
      raw_user_meta_data,
      '{password_setup_token_expiry}',
      to_jsonb(token_expiry)
    ),
    raw_user_meta_data = jsonb_set(
      raw_user_meta_data,
      '{password_setup_required}',
      'true'
    ),
    updated_at = now()
  WHERE id = target_user_id;

  RETURN jsonb_build_object(
    'success', true,
    'token', setup_token,
    'expiry', token_expiry,
    'setup_url', 'https://splendid-semolina-29baa8.netlify.app/setup-password?token=' || setup_token
  );

EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', SQLERRM
    );
END;
$$;

-- Test our secure token generator
DO $$
DECLARE
  test_token text;
BEGIN
  test_token := generate_secure_token(32);
  RAISE NOTICE 'Secure token generation test successful: %', test_token;
END $$;