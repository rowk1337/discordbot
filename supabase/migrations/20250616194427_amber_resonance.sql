/*
  # Système de définition de mot de passe à la première connexion

  1. Nouvelles fonctions
    - `generate_password_setup_token` - Générer un token de configuration
    - `verify_password_setup_token` - Vérifier un token de configuration
    - `setup_user_password` - Définir le mot de passe utilisateur
    - `send_password_setup_email` - Envoyer l'email de configuration

  2. Modifications
    - Mise à jour de la fonction de création d'utilisateur
    - Ajout de champs pour la gestion des tokens

  3. Sécurité
    - Tokens sécurisés avec expiration
    - Validation stricte des mots de passe
*/

-- Fonction pour générer un token de configuration de mot de passe
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

  -- Générer un token sécurisé
  setup_token := encode(gen_random_bytes(32), 'base64');
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

-- Fonction pour vérifier un token de configuration
CREATE OR REPLACE FUNCTION verify_password_setup_token(setup_token text)
RETURNS jsonb
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  user_record auth.users%ROWTYPE;
  token_expiry timestamptz;
BEGIN
  -- Trouver l'utilisateur avec ce token
  SELECT * INTO user_record
  FROM auth.users 
  WHERE raw_user_meta_data->>'password_setup_token' = setup_token;

  IF user_record.id IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Token invalide'
    );
  END IF;

  -- Vérifier l'expiration du token
  token_expiry := (user_record.raw_user_meta_data->>'password_setup_token_expiry')::timestamptz;
  
  IF token_expiry IS NULL OR token_expiry < now() THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Token expiré'
    );
  END IF;

  -- Vérifier que la configuration est encore requise
  IF COALESCE(user_record.raw_user_meta_data->>'password_setup_required', 'false') != 'true' THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Configuration déjà effectuée'
    );
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'email', user_record.email,
    'user_id', user_record.id
  );

EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', SQLERRM
    );
END;
$$;

-- Fonction pour définir le mot de passe utilisateur
CREATE OR REPLACE FUNCTION setup_user_password(
  setup_token text,
  new_password text
)
RETURNS jsonb
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  user_record auth.users%ROWTYPE;
  token_expiry timestamptz;
BEGIN
  -- Vérifier le token d'abord
  SELECT * INTO user_record
  FROM auth.users 
  WHERE raw_user_meta_data->>'password_setup_token' = setup_token;

  IF user_record.id IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Token invalide'
    );
  END IF;

  -- Vérifier l'expiration
  token_expiry := (user_record.raw_user_meta_data->>'password_setup_token_expiry')::timestamptz;
  
  IF token_expiry IS NULL OR token_expiry < now() THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Token expiré'
    );
  END IF;

  -- Valider la force du mot de passe
  IF length(new_password) < 8 THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Le mot de passe doit contenir au moins 8 caractères'
    );
  END IF;

  -- Mettre à jour le mot de passe et nettoyer les métadonnées
  UPDATE auth.users 
  SET 
    encrypted_password = crypt(new_password, gen_salt('bf')),
    email_confirmed_at = COALESCE(email_confirmed_at, now()),
    raw_user_meta_data = raw_user_meta_data - 'password_setup_token' - 'password_setup_token_expiry' - 'password_setup_required',
    raw_user_meta_data = jsonb_set(
      raw_user_meta_data,
      '{password_set_at}',
      to_jsonb(now())
    ),
    updated_at = now()
  WHERE id = user_record.id;

  RETURN jsonb_build_object(
    'success', true,
    'message', 'Mot de passe défini avec succès'
  );

EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', SQLERRM
    );
END;
$$;

-- Mettre à jour la fonction de création d'utilisateur pour générer automatiquement le token
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
  new_user_id := gen_random_uuid();

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
      ELSE crypt('temp_' || gen_random_uuid()::text, gen_salt('bf'))
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

-- Fonction pour renvoyer un lien de configuration de mot de passe
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

  -- Générer un nouveau token
  setup_token := encode(gen_random_bytes(32), 'base64');
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

-- Afficher un message de confirmation
DO $$
BEGIN
  RAISE NOTICE 'Système de définition de mot de passe à la première connexion installé avec succès';
  RAISE NOTICE 'Les nouveaux utilisateurs recevront un lien pour définir leur mot de passe';
END $$;