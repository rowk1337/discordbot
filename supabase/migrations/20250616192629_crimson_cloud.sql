/*
  # Fonctions pour la gestion des utilisateurs

  1. Nouvelles fonctions
    - `get_users_list` - Récupérer la liste des utilisateurs (admin seulement)
    - `invite_user` - Inviter un nouvel utilisateur
    - `update_user_role` - Mettre à jour le rôle d'un utilisateur

  2. Sécurité
    - Seuls les administrateurs peuvent utiliser ces fonctions
*/

-- Fonction pour récupérer la liste des utilisateurs (admin seulement)
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
BEGIN
  -- Vérifier que l'utilisateur actuel est un administrateur
  IF NOT EXISTS (
    SELECT 1 FROM auth.users 
    WHERE auth.users.id = auth.uid() 
    AND (auth.users.raw_user_meta_data->>'role') = 'admin'
  ) THEN
    RAISE EXCEPTION 'Accès refusé: seuls les administrateurs peuvent lister les utilisateurs';
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

-- Fonction pour inviter un utilisateur (admin seulement)
CREATE OR REPLACE FUNCTION invite_user(
  user_email text,
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
  invitation_result jsonb;
BEGIN
  -- Vérifier que l'utilisateur actuel est un administrateur
  IF NOT EXISTS (
    SELECT 1 FROM auth.users 
    WHERE auth.users.id = auth.uid() 
    AND (auth.users.raw_user_meta_data->>'role') = 'admin'
  ) THEN
    RAISE EXCEPTION 'Accès refusé: seuls les administrateurs peuvent inviter des utilisateurs';
  END IF;

  -- Vérifier que l'email n'existe pas déjà
  IF EXISTS (SELECT 1 FROM auth.users WHERE email = user_email) THEN
    RAISE EXCEPTION 'Un utilisateur avec cet email existe déjà';
  END IF;

  -- Créer l'utilisateur avec un mot de passe temporaire
  -- Note: En production, utilisez l'API Admin de Supabase pour créer des invitations
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
    gen_random_uuid(),
    'authenticated',
    'authenticated',
    user_email,
    crypt('temp_password_' || gen_random_uuid()::text, gen_salt('bf')),
    NULL, -- Email non confirmé, nécessite une activation
    jsonb_build_object(
      'role', user_role,
      'full_name', COALESCE(user_name, ''),
      'invited_by', auth.uid(),
      'invitation_sent_at', now()
    ),
    now(),
    now(),
    encode(gen_random_bytes(32), 'base64'),
    '',
    '',
    ''
  ) RETURNING id INTO new_user_id;

  -- Retourner les informations de l'invitation
  RETURN jsonb_build_object(
    'success', true,
    'user_id', new_user_id,
    'email', user_email,
    'message', 'Utilisateur créé avec succès. Un email d''activation doit être envoyé.'
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
  IF NOT EXISTS (
    SELECT 1 FROM auth.users 
    WHERE auth.users.id = auth.uid() 
    AND (auth.users.raw_user_meta_data->>'role') = 'admin'
  ) THEN
    RAISE EXCEPTION 'Accès refusé: seuls les administrateurs peuvent modifier les rôles';
  END IF;

  -- Vérifier que le rôle est valide
  IF new_role NOT IN ('admin', 'user') THEN
    RAISE EXCEPTION 'Rôle invalide: doit être "admin" ou "user"';
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
    RAISE EXCEPTION 'Utilisateur non trouvé';
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

-- Fonction pour supprimer un utilisateur (admin seulement)
CREATE OR REPLACE FUNCTION delete_user(
  target_user_id uuid
)
RETURNS jsonb
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  -- Vérifier que l'utilisateur actuel est un administrateur
  IF NOT EXISTS (
    SELECT 1 FROM auth.users 
    WHERE auth.users.id = auth.uid() 
    AND (auth.users.raw_user_meta_data->>'role') = 'admin'
  ) THEN
    RAISE EXCEPTION 'Accès refusé: seuls les administrateurs peuvent supprimer des utilisateurs';
  END IF;

  -- Empêcher la suppression de son propre compte
  IF target_user_id = auth.uid() THEN
    RAISE EXCEPTION 'Vous ne pouvez pas supprimer votre propre compte';
  END IF;

  -- Supprimer l'utilisateur
  DELETE FROM auth.users WHERE id = target_user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Utilisateur non trouvé';
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

-- Créer un utilisateur administrateur par défaut si aucun n'existe
DO $$
BEGIN
  -- Vérifier s'il existe déjà un administrateur
  IF NOT EXISTS (
    SELECT 1 FROM auth.users 
    WHERE (raw_user_meta_data->>'role') = 'admin'
  ) THEN
    -- Créer un utilisateur admin par défaut
    -- Note: Changez ces informations selon vos besoins
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
      gen_random_uuid(),
      'authenticated',
      'authenticated',
      'admin@paytracker.local',
      crypt('admin123', gen_salt('bf')),
      now(), -- Email confirmé
      jsonb_build_object(
        'role', 'admin',
        'full_name', 'Administrateur',
        'created_by_system', true
      ),
      now(),
      now(),
      '',
      '',
      '',
      ''
    );
    
    RAISE NOTICE 'Utilisateur administrateur créé: admin@paytracker.local / admin123';
  END IF;
END $$;