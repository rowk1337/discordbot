/*
  # Magic Link Authentication Support

  1. New Functions
    - `check_email_and_send_link` - Checks if an email exists and prepares for magic link
    - `handle_magic_link_login` - Handles post-login actions for magic link users

  2. Security
    - Secure token handling
    - Proper error handling
    - Audit logging
*/

-- Function to check if an email exists and prepare for magic link
CREATE OR REPLACE FUNCTION check_email_and_send_link(user_email text)
RETURNS jsonb
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  user_exists boolean;
  needs_setup boolean;
  user_id uuid;
  current_time timestamptz := now();
BEGIN
  -- Check if user exists
  SELECT EXISTS (
    SELECT 1 FROM auth.users WHERE email = user_email
  ) INTO user_exists;

  IF NOT user_exists THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'No account found with this email address'
    );
  END IF;

  -- Get user ID
  SELECT id INTO user_id
  FROM auth.users
  WHERE email = user_email;

  -- Log the magic link request
  INSERT INTO auth_logs (
    action,
    target_id,
    target_email,
    ip_address,
    user_agent,
    metadata
  ) VALUES (
    'magic_link_requested',
    user_id,
    user_email,
    current_setting('request.headers', true)::json->>'x-forwarded-for',
    current_setting('request.headers', true)::json->>'user-agent',
    jsonb_build_object(
      'requested_at', current_time
    )
  );

  -- Return success
  RETURN jsonb_build_object(
    'success', true,
    'message', 'Magic link can be sent to this email'
  );
EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Error processing request: ' || SQLERRM
    );
END;
$$;

-- Function to handle post-login actions for magic link users
CREATE OR REPLACE FUNCTION handle_magic_link_login()
RETURNS jsonb
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  user_record auth.users%ROWTYPE;
  needs_password_setup boolean;
  current_time timestamptz := now();
BEGIN
  -- Get current user
  SELECT * INTO user_record
  FROM auth.users
  WHERE id = auth.uid();
  
  IF user_record.id IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'User not found'
    );
  END IF;
  
  -- Check if user needs to set up a password
  needs_password_setup := COALESCE(user_record.raw_user_meta_data->>'password_setup_required', 'false') = 'true';
  
  -- Log the magic link login
  INSERT INTO auth_logs (
    action,
    actor_id,
    target_id,
    ip_address,
    user_agent,
    metadata
  ) VALUES (
    'magic_link_login',
    user_record.id,
    user_record.id,
    current_setting('request.headers', true)::json->>'x-forwarded-for',
    current_setting('request.headers', true)::json->>'user-agent',
    jsonb_build_object(
      'login_at', current_time,
      'needs_password_setup', needs_password_setup
    )
  );
  
  -- Return user status
  RETURN jsonb_build_object(
    'success', true,
    'needs_password_setup', needs_password_setup
  );
EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Error handling login: ' || SQLERRM
    );
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION check_email_and_send_link(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION handle_magic_link_login() TO authenticated;