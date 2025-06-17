/*
  # Magic Link Authentication Support

  1. New Functions
    - `check_email_and_send_link` - Checks if an email exists and prepares for magic link
    - `handle_magic_link_login` - Handles post-login actions for magic link users
    - `setup_new_user` - Sets up a new user after creation

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
  needs_password_setup := COALESCE(user_record.raw_user_meta_data->>'needs_password_setup', 'false') = 'true';
  
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

-- Function to set up a new user after creation
CREATE OR REPLACE FUNCTION setup_new_user(
  user_id uuid,
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
  current_time timestamptz := now();
BEGIN
  -- Create default app settings for the user
  INSERT INTO app_settings (
    user_id,
    theme,
    accent_color,
    notifications_settings,
    client_type_settings,
    google_integration_settings
  ) VALUES (
    user_id,
    'light',
    '#3B82F6',
    '{"overdueInvoices": true, "newPayments": true, "dueDateReminders": true, "weeklyReport": false}',
    '{"externe": {"defaultPaymentDays": 30, "defaultPaymentMode": "Virement"}, "interne": {"defaultPaymentDays": 15, "defaultPaymentMode": "Virement"}, "partenaire": {"defaultPaymentDays": 60, "defaultPaymentMode": "Virement"}}',
    '{"isConnected": false}'
  )
  ON CONFLICT (user_id) DO NOTHING;

  -- Log the user setup
  INSERT INTO auth_logs (
    action,
    actor_id,
    target_id,
    target_email,
    ip_address,
    user_agent,
    metadata
  ) VALUES (
    'user_setup',
    auth.uid(),
    user_id,
    user_email,
    current_setting('request.headers', true)::json->>'x-forwarded-for',
    current_setting('request.headers', true)::json->>'user-agent',
    jsonb_build_object(
      'role', user_role,
      'name', user_name,
      'setup_at', current_time
    )
  );

  RETURN jsonb_build_object(
    'success', true,
    'message', 'User setup completed successfully'
  );
EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Error setting up user: ' || SQLERRM
    );
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION check_email_and_send_link(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION handle_magic_link_login() TO authenticated;
GRANT EXECUTE ON FUNCTION setup_new_user(uuid, text, text, text) TO authenticated;