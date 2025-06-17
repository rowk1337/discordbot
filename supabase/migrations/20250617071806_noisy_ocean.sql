/*
  # Fix UUID extension definitively

  1. Enable uuid-ossp extension properly
  2. Fallback to gen_random_uuid() if uuid-ossp is not available
  3. Update all functions to use the available UUID generation method
*/

-- Try to enable uuid-ossp extension
DO $$
BEGIN
  -- Try to create the extension
  CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
  RAISE NOTICE 'uuid-ossp extension enabled successfully';
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'uuid-ossp extension not available, will use gen_random_uuid() instead';
END $$;

-- Create a universal UUID generation function that works in all cases
CREATE OR REPLACE FUNCTION generate_uuid()
RETURNS uuid
LANGUAGE plpgsql
AS $$
BEGIN
  -- Try uuid_generate_v4() first
  BEGIN
    RETURN uuid_generate_v4();
  EXCEPTION
    WHEN undefined_function THEN
      -- Fallback to gen_random_uuid() if uuid_generate_v4() is not available
      RETURN gen_random_uuid();
  END;
END;
$$;

-- Update all table defaults to use our universal function
ALTER TABLE companies ALTER COLUMN id SET DEFAULT generate_uuid();
ALTER TABLE accounting_periods ALTER COLUMN id SET DEFAULT generate_uuid();
ALTER TABLE clients ALTER COLUMN id SET DEFAULT generate_uuid();
ALTER TABLE invoices ALTER COLUMN id SET DEFAULT generate_uuid();
ALTER TABLE payments ALTER COLUMN id SET DEFAULT generate_uuid();
ALTER TABLE client_reminders ALTER COLUMN id SET DEFAULT generate_uuid();
ALTER TABLE notifications ALTER COLUMN id SET DEFAULT generate_uuid();
ALTER TABLE app_settings ALTER COLUMN id SET DEFAULT generate_uuid();

-- Update tables that might exist
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'reminder_templates') THEN
    ALTER TABLE reminder_templates ALTER COLUMN id SET DEFAULT generate_uuid();
  END IF;
  
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'email_logs') THEN
    ALTER TABLE email_logs ALTER COLUMN id SET DEFAULT generate_uuid();
  END IF;
  
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'automation_rules') THEN
    ALTER TABLE automation_rules ALTER COLUMN id SET DEFAULT generate_uuid();
  END IF;
  
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'user_company_access') THEN
    ALTER TABLE user_company_access ALTER COLUMN id SET DEFAULT generate_uuid();
  END IF;
END $$;

-- Update the create_user_account function to use our universal UUID function
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

  -- Générer un nouvel ID utilisateur avec notre fonction universelle
  new_user_id := generate_uuid();

  -- Si aucun mot de passe n'est fourni, générer un token de configuration
  IF user_password IS NULL THEN
    setup_token := encode(gen_random_bytes(32), 'base64');
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

-- Test our universal UUID function
DO $$
DECLARE
  test_uuid uuid;
BEGIN
  test_uuid := generate_uuid();
  RAISE NOTICE 'UUID generation test successful: %', test_uuid;
END $$;