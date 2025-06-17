/*
  # Add user creation RPC functions

  1. New Functions
    - `format_timestamp_for_json` - Helper function to format timestamps for JSON responses
    - `create_user_with_temp_password` - Main function to create users with temporary passwords
    - `resend_password_setup_link` - Function to resend password setup links

  2. Security
    - Functions are accessible to authenticated users only
    - Admin role validation included where appropriate

  3. Features
    - Creates users in auth.users table
    - Generates temporary passwords
    - Creates setup URLs for password configuration
    - Logs authentication actions
*/

-- Helper function to format timestamps for JSON responses
CREATE OR REPLACE FUNCTION format_timestamp_for_json(ts timestamptz)
RETURNS text
LANGUAGE plpgsql
AS $$
BEGIN
  IF ts IS NULL THEN
    RETURN NULL;
  END IF;
  RETURN to_char(ts, 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"');
END;
$$;

-- Function to generate random password
CREATE OR REPLACE FUNCTION generate_random_password(length integer DEFAULT 12)
RETURNS text
LANGUAGE plpgsql
AS $$
DECLARE
  chars text := 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$%^&*';
  result text := '';
  i integer;
BEGIN
  FOR i IN 1..length LOOP
    result := result || substr(chars, floor(random() * length(chars) + 1)::integer, 1);
  END LOOP;
  RETURN result;
END;
$$;

-- Main function to create user with temporary password
CREATE OR REPLACE FUNCTION create_user_with_temp_password(
  user_email text,
  user_role text DEFAULT 'user',
  user_name text DEFAULT NULL,
  password_expiry_days integer DEFAULT 7,
  password_length integer DEFAULT 12
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  new_user_id uuid;
  temp_password text;
  setup_token text;
  setup_url text;
  current_user_id uuid;
  current_user_role text;
  base_url text;
BEGIN
  -- Get current user and verify admin role
  current_user_id := auth.uid();
  
  IF current_user_id IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Authentication required'
    );
  END IF;

  -- Check if current user is admin
  SELECT raw_user_meta_data->>'role' INTO current_user_role
  FROM auth.users
  WHERE id = current_user_id;

  IF current_user_role != 'admin' THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Admin privileges required'
    );
  END IF;

  -- Validate email format
  IF user_email !~ '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$' THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Invalid email format'
    );
  END IF;

  -- Check if user already exists
  SELECT id INTO new_user_id
  FROM auth.users
  WHERE email = user_email;

  IF new_user_id IS NOT NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'User with this email already exists'
    );
  END IF;

  -- Generate temporary password if length > 0
  IF password_length > 0 THEN
    temp_password := generate_random_password(password_length);
  ELSE
    temp_password := generate_random_password(16); -- Default fallback
  END IF;

  -- Generate setup token
  setup_token := encode(gen_random_bytes(32), 'base64');
  setup_token := replace(replace(replace(setup_token, '+', '-'), '/', '_'), '=', '');

  -- Create user in auth.users
  INSERT INTO auth.users (
    instance_id,
    id,
    aud,
    role,
    email,
    encrypted_password,
    email_confirmed_at,
    recovery_sent_at,
    last_sign_in_at,
    raw_app_meta_data,
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
    crypt(temp_password, gen_salt('bf')),
    now(),
    now(),
    NULL,
    jsonb_build_object('provider', 'email', 'providers', jsonb_build_array('email')),
    jsonb_build_object(
      'role', user_role,
      'name', COALESCE(user_name, ''),
      'temp_password_expires', format_timestamp_for_json(now() + (password_expiry_days || ' days')::interval),
      'setup_token', setup_token,
      'setup_token_expires', format_timestamp_for_json(now() + (password_expiry_days || ' days')::interval),
      'requires_password_change', true
    ),
    now(),
    now(),
    '',
    '',
    '',
    ''
  ) RETURNING id INTO new_user_id;

  -- Create setup URL
  base_url := COALESCE(
    current_setting('app.base_url', true),
    'http://localhost:5173'
  );
  setup_url := base_url || '/setup-password?token=' || setup_token || '&email=' || encode(user_email::bytea, 'base64');

  -- Log the action
  INSERT INTO auth_logs (
    action,
    actor_id,
    target_id,
    target_email,
    metadata
  ) VALUES (
    'user_created',
    current_user_id,
    new_user_id,
    user_email,
    jsonb_build_object(
      'role', user_role,
      'name', user_name,
      'created_by_admin', true
    )
  );

  -- Return success response
  RETURN jsonb_build_object(
    'success', true,
    'user_id', new_user_id,
    'temporary_password', temp_password,
    'setup_url', setup_url,
    'setup_token', setup_token,
    'expires_at', format_timestamp_for_json(now() + (password_expiry_days || ' days')::interval)
  );

EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Failed to create user: ' || SQLERRM
    );
END;
$$;

-- Function to resend password setup link
CREATE OR REPLACE FUNCTION resend_password_setup_link(user_email text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  target_user_id uuid;
  setup_token text;
  setup_url text;
  current_user_id uuid;
  current_user_role text;
  base_url text;
BEGIN
  -- Get current user and verify admin role
  current_user_id := auth.uid();
  
  IF current_user_id IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Authentication required'
    );
  END IF;

  -- Check if current user is admin
  SELECT raw_user_meta_data->>'role' INTO current_user_role
  FROM auth.users
  WHERE id = current_user_id;

  IF current_user_role != 'admin' THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Admin privileges required'
    );
  END IF;

  -- Find the user
  SELECT id INTO target_user_id
  FROM auth.users
  WHERE email = user_email;

  IF target_user_id IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'User not found'
    );
  END IF;

  -- Generate new setup token
  setup_token := encode(gen_random_bytes(32), 'base64');
  setup_token := replace(replace(replace(setup_token, '+', '-'), '/', '_'), '=', '');

  -- Update user metadata with new token
  UPDATE auth.users
  SET 
    raw_user_meta_data = raw_user_meta_data || jsonb_build_object(
      'setup_token', setup_token,
      'setup_token_expires', format_timestamp_for_json(now() + '7 days'::interval)
    ),
    updated_at = now()
  WHERE id = target_user_id;

  -- Create setup URL
  base_url := COALESCE(
    current_setting('app.base_url', true),
    'http://localhost:5173'
  );
  setup_url := base_url || '/setup-password?token=' || setup_token || '&email=' || encode(user_email::bytea, 'base64');

  -- Log the action
  INSERT INTO auth_logs (
    action,
    actor_id,
    target_id,
    target_email,
    metadata
  ) VALUES (
    'setup_link_resent',
    current_user_id,
    target_user_id,
    user_email,
    jsonb_build_object(
      'resent_by_admin', true
    )
  );

  -- Return success response
  RETURN jsonb_build_object(
    'success', true,
    'setup_url', setup_url,
    'setup_token', setup_token,
    'expires_at', format_timestamp_for_json(now() + '7 days'::interval)
  );

EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Failed to resend setup link: ' || SQLERRM
    );
END;
$$;

-- Grant execute permissions to authenticated users
GRANT EXECUTE ON FUNCTION format_timestamp_for_json(timestamptz) TO authenticated;
GRANT EXECUTE ON FUNCTION generate_random_password(integer) TO authenticated;
GRANT EXECUTE ON FUNCTION create_user_with_temp_password(text, text, text, integer, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION resend_password_setup_link(text) TO authenticated;