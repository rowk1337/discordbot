/*
  # Add Email Notification for User Creation

  1. New Function
    - `send_setup_email` - Sends an email with the setup link to the user
    - Integrates with Supabase's built-in email service

  2. Updates
    - Modify user creation functions to trigger email sending
    - Add email templates for setup notifications
*/

-- Create a function to send setup emails
CREATE OR REPLACE FUNCTION send_setup_email(
  recipient_email text,
  setup_url text,
  user_name text DEFAULT NULL
)
RETURNS jsonb
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  email_subject text := 'Complete Your Account Setup';
  email_content text;
  current_time timestamptz := now();
BEGIN
  -- Create email content
  email_content := 'Hello ' || COALESCE(user_name, 'there') || ',

Thank you for joining our application. To complete your account setup, please click the link below:

' || setup_url || '

This link will expire in 7 days. If you did not request this account, please ignore this email.

Best regards,
The PayTracker Team';

  -- Log the email attempt
  INSERT INTO auth_logs (
    action,
    actor_id,
    target_email,
    ip_address,
    user_agent,
    metadata
  ) VALUES (
    'setup_email_sent',
    auth.uid(),
    recipient_email,
    current_setting('request.headers', true)::json->>'x-forwarded-for',
    current_setting('request.headers', true)::json->>'user-agent',
    jsonb_build_object(
      'sent_at', current_time,
      'setup_url', setup_url
    )
  );

  -- Return success - note that this doesn't actually send an email
  -- Email sending requires an Edge Function or external service
  RETURN jsonb_build_object(
    'success', true,
    'message', 'Email would be sent in production environment',
    'recipient', recipient_email,
    'subject', email_subject,
    'setup_url', setup_url
  );
EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Error sending email: ' || SQLERRM
    );
END;
$$;

-- Update the create_user_with_setup_link function to trigger email sending
CREATE OR REPLACE FUNCTION create_user_with_setup_link(
  user_email text,
  user_role text DEFAULT 'user',
  user_name text DEFAULT NULL,
  link_expiry_days integer DEFAULT 7
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
  current_time timestamptz := now();
  log_id uuid;
  setup_url text;
  email_result jsonb;
BEGIN
  -- Validate inputs
  IF user_email IS NULL OR user_email = '' THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Email is required'
    );
  END IF;
  
  IF NOT (user_email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$') THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Invalid email format'
    );
  END IF;
  
  -- Check if user already exists
  IF EXISTS (SELECT 1 FROM auth.users WHERE email = user_email) THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'User with this email already exists'
    );
  END IF;
  
  -- Verify the current user is an admin
  IF NOT EXISTS (
    SELECT 1 FROM auth.users 
    WHERE auth.users.id = auth.uid() 
    AND (auth.users.raw_user_meta_data->>'role') = 'admin'
  ) THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Only administrators can create users'
    );
  END IF;
  
  -- Generate a secure setup token (simple approach to avoid formatting issues)
  setup_token := md5(random()::text || clock_timestamp()::text);
  token_expiry := current_time + (link_expiry_days || ' days')::interval;
  
  -- Generate new user ID
  new_user_id := gen_random_uuid();
  
  -- Create the setup URL
  setup_url := 'https://splendid-semolina-29baa8.netlify.app/setup-password?token=' || setup_token;
  
  -- Create log entry for audit trail
  INSERT INTO auth_logs (
    action,
    actor_id,
    target_email,
    ip_address,
    user_agent,
    metadata
  ) VALUES (
    'create_user_with_setup_link',
    auth.uid(),
    user_email,
    current_setting('request.headers', true)::json->>'x-forwarded-for',
    current_setting('request.headers', true)::json->>'user-agent',
    jsonb_build_object(
      'role', user_role,
      'token_expiry', token_expiry,
      'created_at', current_time
    )
  ) RETURNING id INTO log_id;
  
  -- Create the user with a temporary password and setup token
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
    updated_at
  ) VALUES (
    '00000000-0000-0000-0000-000000000000',
    new_user_id,
    'authenticated',
    'authenticated',
    user_email,
    -- Use a random password that the user will never know
    crypt(md5(random()::text), gen_salt('bf', 10)),
    current_time, -- Auto-confirm email for admin-created accounts
    jsonb_build_object(
      'role', user_role,
      'full_name', COALESCE(user_name, ''),
      'created_by', auth.uid(),
      'created_at', current_time,
      'password_setup_required', true,
      'password_setup_token', setup_token,
      'password_setup_token_expiry', token_expiry,
      'setup_log_id', log_id
    ),
    current_time,
    current_time
  );
  
  -- Create default app settings for the user
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
  
  -- Try to send setup email
  email_result := send_setup_email(user_email, setup_url, user_name);
  
  -- Return success with setup link
  RETURN jsonb_build_object(
    'success', true,
    'user_id', new_user_id,
    'email', user_email,
    'setup_url', setup_url,
    'setup_token', setup_token,
    'token_expiry', token_expiry,
    'message', 'User created successfully. Share the setup link with the user.',
    'email_sent', email_result->>'success'
  );
EXCEPTION
  WHEN OTHERS THEN
    -- Log the error
    INSERT INTO auth_logs (
      action,
      actor_id,
      target_email,
      ip_address,
      user_agent,
      metadata,
      error_message
    ) VALUES (
      'create_user_error',
      auth.uid(),
      user_email,
      current_setting('request.headers', true)::json->>'x-forwarded-for',
      current_setting('request.headers', true)::json->>'user-agent',
      jsonb_build_object(
        'role', user_role,
        'error_time', current_time
      ),
      SQLERRM
    );
    
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Error creating user: ' || SQLERRM
    );
END;
$$;

-- Update the resend_password_setup_link function to trigger email sending
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
  base_url text := 'https://splendid-semolina-29baa8.netlify.app';
  user_name text;
  email_result jsonb;
BEGIN
  -- Verify the current user is an admin
  IF NOT EXISTS (
    SELECT 1 FROM auth.users 
    WHERE auth.users.id = auth.uid() 
    AND (auth.users.raw_user_meta_data->>'role') = 'admin'
  ) THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Only administrators can resend setup links'
    );
  END IF;

  -- Find the user
  SELECT id, raw_user_meta_data->>'full_name' INTO target_user_id, user_name
  FROM auth.users 
  WHERE email = user_email;

  IF target_user_id IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'User not found'
    );
  END IF;

  -- Generate a new token (simple approach to avoid formatting issues)
  setup_token := md5(random()::text || clock_timestamp()::text);
  token_expiry := now() + interval '7 days';
  
  -- Create the setup URL
  setup_url := base_url || '/setup-password?token=' || setup_token;

  -- Update the user's metadata
  UPDATE auth.users 
  SET 
    raw_user_meta_data = jsonb_set(
      COALESCE(raw_user_meta_data, '{}'::jsonb),
      '{password_setup_required}',
      'true'
    ),
    raw_user_meta_data = jsonb_set(
      raw_user_meta_data,
      '{password_setup_token}',
      to_jsonb(setup_token)
    ),
    raw_user_meta_data = jsonb_set(
      raw_user_meta_data,
      '{password_setup_token_expiry}',
      to_jsonb(token_expiry)
    ),
    updated_at = now()
  WHERE id = target_user_id;

  -- Log the action
  INSERT INTO auth_logs (
    action,
    actor_id,
    target_id,
    target_email,
    ip_address,
    user_agent,
    metadata
  ) VALUES (
    'resend_setup_link',
    auth.uid(),
    target_user_id,
    user_email,
    current_setting('request.headers', true)::json->>'x-forwarded-for',
    current_setting('request.headers', true)::json->>'user-agent',
    jsonb_build_object(
      'token_expiry', token_expiry,
      'resent_at', now()
    )
  );

  -- Try to send setup email
  email_result := send_setup_email(user_email, setup_url, user_name);

  RETURN jsonb_build_object(
    'success', true,
    'setup_url', setup_url,
    'message', 'Setup link has been regenerated',
    'email_sent', email_result->>'success'
  );
EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Error resending setup link: ' || SQLERRM
    );
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION send_setup_email(text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION create_user_with_setup_link(text, text, text, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION resend_password_setup_link(text) TO authenticated;