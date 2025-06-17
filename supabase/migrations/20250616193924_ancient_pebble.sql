/*
  # Correction des fonctions de gestion des utilisateurs

  1. Corrections
    - Correction de la structure de retour de get_users_list()
    - Amélioration de la gestion des erreurs
    - Ajout de fonctions utilitaires sécurisées

  2. Sécurité
    - Toutes les fonctions utilisent SECURITY DEFINER
    - Vérification stricte des permissions administrateur
    - Protection contre l'accès non autorisé aux données utilisateur
*/

-- Supprimer les anciennes fonctions pour les recréer proprement
DROP FUNCTION IF EXISTS get_users_list();
DROP FUNCTION IF EXISTS invite_user(text, text, text);
DROP FUNCTION IF EXISTS update_user_role(uuid, text);
DROP FUNCTION IF EXISTS delete_user(uuid);
DROP FUNCTION IF EXISTS check_user_role(uuid);
DROP FUNCTION IF EXISTS promote_to_admin(text);

-- Fonction pour vérifier si l'utilisateur actuel est admin
CREATE OR REPLACE FUNCTION is_admin(user_id uuid DEFAULT auth.uid())
RETURNS boolean
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  user_role text;
BEGIN
  IF user_id IS NULL THEN
    RETURN false;
  END IF;

  SELECT COALESCE(raw_user_meta_data->>'role', 'user') INTO user_role
  FROM auth.users 
  WHERE id = user_id;
  
  RETURN COALESCE(user_role = 'admin', false);
END;
$$;

-- Fonction pour récupérer la liste des utilisateurs (admin seulement)
CREATE OR REPLACE FUNCTION get_users_list()
RETURNS jsonb
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  users_data jsonb;
BEGIN
  -- Vérifier que l'utilisateur actuel est un administrateur
  IF NOT is_admin() THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Accès refusé: seuls les administrateurs peuvent lister les utilisateurs'
    );
  END IF;

  -- Récupérer la liste des utilisateurs
  SELECT jsonb_agg(
    jsonb_build_object(
      'id', u.id,
      'email', u.email,
      'created_at', u.created_at,
      'email_confirmed_at', u.email_confirmed_at,
      'raw_user_meta_data', u.raw_user_meta_data,
      'last_sign_in_at', u.last_sign_in_at,
      'banned_until', u.banned_until
    )
    ORDER BY u.created_at DESC
  ) INTO users_data
  FROM auth.users u;

  RETURN jsonb_build_object(
    'success', true,
    'data', COALESCE(users_data, '[]'::jsonb)
  );

EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', SQLERRM
    );
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
  IF user_id IS NULL THEN
    RETURN 'anonymous';
  END IF;

  SELECT COALESCE(raw_user_meta_data->>'role', 'user') INTO user_role
  FROM auth.users 
  WHERE id = user_id;
  
  RETURN COALESCE(user_role, 'user');
END;
$$;

-- Fonction pour créer un utilisateur (admin seulement)
CREATE OR REPLACE FUNCTION create_user_account(
  user_email text,
  user_password text,
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
    crypt(user_password, gen_salt('bf')),
    now(), -- Email confirmé automatiquement
    jsonb_build_object(
      'role', user_role,
      'full_name', COALESCE(user_name, ''),
      'created_by', auth.uid(),
      'created_at', now()
    ),
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
    'message', 'Utilisateur créé avec succès'
  );

EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', SQLERRM
    );
END;
$$;

-- Fonction pour mettre à jour le rôle d'un utilisateur (admin seulement)
CREATE OR REPLACE FUNCTION update_user_role(
  target_user_id uuid,
  new_role text
)
RETURNS jsonb
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  -- Vérifier que l'utilisateur actuel est un administrateur
  IF NOT is_admin() THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Accès refusé: seuls les administrateurs peuvent modifier les rôles'
    );
  END IF;

  -- Vérifier que le rôle est valide
  IF new_role NOT IN ('admin', 'user') THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Rôle invalide: doit être "admin" ou "user"'
    );
  END IF;

  -- Mettre à jour le rôle de l'utilisateur
  UPDATE auth.users 
  SET 
    raw_user_meta_data = jsonb_set(
      COALESCE(raw_user_meta_data, '{}'),
      '{role}',
      to_jsonb(new_role)
    ),
    updated_at = now()
  WHERE id = target_user_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Utilisateur non trouvé'
    );
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'message', 'Rôle mis à jour avec succès'
  );

EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', SQLERRM
    );
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
  -- Vérifier que l'utilisateur actuel est un administrateur
  IF NOT is_admin() THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Accès refusé: seuls les administrateurs peuvent promouvoir des utilisateurs'
    );
  END IF;

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

-- Fonction pour désactiver/activer un utilisateur
CREATE OR REPLACE FUNCTION toggle_user_status(
  target_user_id uuid,
  ban_duration text DEFAULT NULL
)
RETURNS jsonb
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  ban_until timestamptz;
BEGIN
  -- Vérifier que l'utilisateur actuel est un administrateur
  IF NOT is_admin() THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Accès refusé: seuls les administrateurs peuvent modifier le statut des utilisateurs'
    );
  END IF;

  -- Empêcher la modification de son propre statut
  IF target_user_id = auth.uid() THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Vous ne pouvez pas modifier votre propre statut'
    );
  END IF;

  -- Calculer la date de fin de bannissement
  IF ban_duration IS NOT NULL AND ban_duration != 'none' THEN
    ban_until := now() + ban_duration::interval;
  ELSE
    ban_until := NULL;
  END IF;

  -- Mettre à jour le statut de l'utilisateur
  UPDATE auth.users 
  SET 
    banned_until = ban_until,
    updated_at = now()
  WHERE id = target_user_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Utilisateur non trouvé'
    );
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'message', CASE 
      WHEN ban_until IS NULL THEN 'Utilisateur activé avec succès'
      ELSE 'Utilisateur désactivé avec succès'
    END
  );

EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', SQLERRM
    );
END;
$$;

-- Fonction pour supprimer un utilisateur (admin seulement)
CREATE OR REPLACE FUNCTION delete_user_account(
  target_user_id uuid
)
RETURNS jsonb
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  -- Vérifier que l'utilisateur actuel est un administrateur
  IF NOT is_admin() THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Accès refusé: seuls les administrateurs peuvent supprimer des utilisateurs'
    );
  END IF;

  -- Empêcher la suppression de son propre compte
  IF target_user_id = auth.uid() THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Vous ne pouvez pas supprimer votre propre compte'
    );
  END IF;

  -- Supprimer l'utilisateur (les données liées seront supprimées en cascade)
  DELETE FROM auth.users WHERE id = target_user_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Utilisateur non trouvé'
    );
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'message', 'Utilisateur supprimé avec succès'
  );

EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', SQLERRM
    );
END;
$$;

-- Fonction pour obtenir les statistiques des utilisateurs
CREATE OR REPLACE FUNCTION get_user_stats()
RETURNS jsonb
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  stats jsonb;
BEGIN
  -- Vérifier que l'utilisateur actuel est un administrateur
  IF NOT is_admin() THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Accès refusé: seuls les administrateurs peuvent voir les statistiques'
    );
  END IF;

  SELECT jsonb_build_object(
    'total_users', COUNT(*),
    'active_users', COUNT(*) FILTER (WHERE email_confirmed_at IS NOT NULL AND banned_until IS NULL),
    'pending_users', COUNT(*) FILTER (WHERE email_confirmed_at IS NULL),
    'banned_users', COUNT(*) FILTER (WHERE banned_until IS NOT NULL AND banned_until > now()),
    'admin_users', COUNT(*) FILTER (WHERE (raw_user_meta_data->>'role') = 'admin'),
    'regular_users', COUNT(*) FILTER (WHERE COALESCE(raw_user_meta_data->>'role', 'user') = 'user')
  ) INTO stats
  FROM auth.users;

  RETURN jsonb_build_object(
    'success', true,
    'data', stats
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
  RAISE NOTICE 'Fonctions de gestion des utilisateurs mises à jour avec succès';
  RAISE NOTICE 'Sécurité renforcée avec SECURITY DEFINER et vérifications strictes';
END $$;