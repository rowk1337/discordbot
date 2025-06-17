/*
  # Fix timestamp format in user creation functions

  1. Updates
    - Fix the to_char() function usage in create_user_with_temp_password
    - Fix the to_char() function usage in create_user_with_setup_link
    - Ensure proper timestamp handling in all related functions

  2. Issue
    - The previous implementation was using to_char() incorrectly with time with time zone data type
    - This caused the error: "function to_char(time with time zone, unknown) does not exist"
*/

-- Update the create_user_with_temp_password function
CREATE OR REPLACE FUNCTION create_user_with_temp_password(
  user_email text,
  user_role text DEFAULT 'user',
  user_name text DEFAULT NULL,
  password_expiry_days integer DEFAULT 7,
  password_length integer DEFAULT 12
)
RETURNS jsonb
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  new_user_id uuid;
  temp_password text;
  password_expiry timestamptz;
  current_time timestamptz := now();
  log_id uuid;
  setup_token text;
  setup_url text;
  base_url text := 'https://splendid-semolina-29baa8.netlify.app';
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
  
  -- Generate a secure temporary password
  BEGIN
    -- Try using gen_random_bytes from pgcrypto
    SELECT encode(gen_random_bytes(6), 'hex') || 
           CASE WHEN random() > 0.5 THEN '!' ELSE '@' END || 
           CASE WHEN random() > 0.5 THEN 'A' ELSE 'Z' END || 
           CASE WHEN random() > 0.5 THEN '1' ELSE '9' END
    INTO temp_password;
  EXCEPTION
    WHEN OTHERS THEN
      -- Fallback to a less secure but functional alternative
      SELECT 
        substr(md5(random()::text || clock_timestamp()::text), 1, 8) || 
        '!' || 'A' || '1'
      INTO temp_password;
  END;
  
  -- Generate a setup token
  BEGIN
    -- Try using gen_random_bytes from pgcrypto
    SELECT encode(gen_random_bytes(32), 'base64')
    INTO setup_token;
  EXCEPTION
    WHEN OTHERS THEN
      -- Fallback to a less secure but functional alternative
      SELECT encode(
        ('x'||substr(md5(random()::text || clock_timestamp()::text), 1, 64))::bytea, 
        'base64'
      ) INTO setup_token;
  END;
  
  -- Set password expiry date
  password_expiry := current_time + (password_expiry_days || ' days')::interval;
  
  -- Generate new user ID
  new_user_id := gen_random_uuid();
  
  -- Create log entry for audit trail
  INSERT INTO auth_logs (
    action,
    actor_id,
    target_email,
    ip_address,
    user_agent,
    metadata
  ) VALUES (
    'create_temp_password',
    auth.uid(),
    user_email,
    current_setting('request.headers', true)::json->>'x-forwarded-for',
    current_setting('request.headers', true)::json->>'user-agent',
    jsonb_build_object(
      'role', user_role,
      'password_expiry', password_expiry,
      'created_at', current_time
    )
  ) RETURNING id INTO log_id;
  
  -- Create the user with temporary password
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
    crypt(temp_password, gen_salt('bf', 10)), -- Use work factor of 10 for bcrypt
    current_time, -- Auto-confirm email for admin-created accounts
    jsonb_build_object(
      'role', user_role,
      'full_name', COALESCE(user_name, ''),
      'created_by', auth.uid(),
      'created_at', current_time::text,
      'password_change_required', true,
      'password_created_at', current_time::text,
      'password_expires_at', password_expiry::text,
      'password_setup_token', setup_token,
      'password_setup_token_expiry', password_expiry::text,
      'temp_password_log_id', log_id
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
  
  -- Generate setup URL
  setup_url := base_url || '/setup-password?token=' || setup_token;
  
  -- Return success with temporary password and setup URL
  RETURN jsonb_build_object(
    'success', true,
    'user_id', new_user_id,
    'email', user_email,
    'temporary_password', temp_password,
    'password_expires_at', password_expiry,
    'setup_url', setup_url,
    'message', 'User created successfully with temporary password. User must change password on first login.'
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
      'create_temp_password_error',
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

-- Update the create_user_with_setup_link function
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
  IF NOT is_admin() THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Only administrators can create users'
    );
  END IF;
  
  -- Generate a secure setup token
  setup_token := generate_secure_token(32);
  token_expiry := current_time + (link_expiry_days || ' days')::interval;
  
  -- Generate new user ID
  new_user_id := generate_uuid();
  
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
    crypt(generate_secure_token(32), gen_salt('bf', 10)),
    current_time, -- Auto-confirm email for admin-created accounts
    jsonb_build_object(
      'role', user_role,
      'full_name', COALESCE(user_name, ''),
      'created_by', auth.uid(),
      'created_at', current_time::text,
      'password_setup_required', true,
      'password_setup_token', setup_token,
      'password_setup_token_expiry', token_expiry::text,
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
  
  -- Return success with setup link
  RETURN jsonb_build_object(
    'success', true,
    'user_id', new_user_id,
    'email', user_email,
    'setup_url', setup_url,
    'setup_token', setup_token,
    'token_expiry', token_expiry,
    'message', 'User created successfully. Share the setup link with the user.'
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

-- Update the verify_setup_link function
CREATE OR REPLACE FUNCTION verify_setup_link(setup_token text)
RETURNS jsonb
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  user_record auth.users%ROWTYPE;
  token_expiry timestamptz;
  current_time timestamptz := now();
BEGIN
  -- Find the user with this token
  SELECT * INTO user_record
  FROM auth.users 
  WHERE raw_user_meta_data->>'password_setup_token' = setup_token;

  IF user_record.id IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Invalid setup link'
    );
  END IF;

  -- Verify token expiration
  BEGIN
    token_expiry := (user_record.raw_user_meta_data->>'password_setup_token_expiry')::timestamptz;
  EXCEPTION
    WHEN OTHERS THEN
      RETURN jsonb_build_object(
        'success', false,
        'error', 'Invalid token expiry format'
      );
  END;
  
  IF token_expiry IS NULL OR token_expiry < current_time THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Setup link has expired'
    );
  END IF;

  -- Verify setup is still required
  IF COALESCE(user_record.raw_user_meta_data->>'password_setup_required', 'false') != 'true' THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Password has already been set'
    );
  END IF;

  -- Log the verification
  INSERT INTO auth_logs (
    action,
    target_id,
    target_email,
    ip_address,
    user_agent,
    metadata
  ) VALUES (
    'verify_setup_link',
    user_record.id,
    user_record.email,
    current_setting('request.headers', true)::json->>'x-forwarded-for',
    current_setting('request.headers', true)::json->>'user-agent',
    jsonb_build_object(
      'verified_at', current_time
    )
  );

  RETURN jsonb_build_object(
    'success', true,
    'email', user_record.email,
    'user_id', user_record.id,
    'name', user_record.raw_user_meta_data->>'full_name',
    'token_expiry', token_expiry
  );
EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Error verifying setup link: ' || SQLERRM
    );
END;
$$;

-- Update the complete_setup function
CREATE OR REPLACE FUNCTION complete_setup(
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
  current_time timestamptz := now();
  log_id uuid;
  setup_log_id uuid;
BEGIN
  -- Find the user with this token
  SELECT * INTO user_record
  FROM auth.users 
  WHERE raw_user_meta_data->>'password_setup_token' = setup_token;

  IF user_record.id IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Invalid setup link'
    );
  END IF;

  -- Verify token expiration
  BEGIN
    token_expiry := (user_record.raw_user_meta_data->>'password_setup_token_expiry')::timestamptz;
  EXCEPTION
    WHEN OTHERS THEN
      RETURN jsonb_build_object(
        'success', false,
        'error', 'Invalid token expiry format'
      );
  END;
  
  IF token_expiry IS NULL OR token_expiry < current_time THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Setup link has expired'
    );
  END IF;

  -- Verify setup is still required
  IF COALESCE(user_record.raw_user_meta_data->>'password_setup_required', 'false') != 'true' THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Password has already been set'
    );
  END IF;

  -- Validate password strength
  IF length(new_password) < 8 THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Password must be at least 8 characters long'
    );
  END IF;

  -- Get the original setup log ID for reference
  BEGIN
    setup_log_id := (user_record.raw_user_meta_data->>'setup_log_id')::uuid;
  EXCEPTION
    WHEN OTHERS THEN
      setup_log_id := NULL;
  END;

  -- Log the completion
  INSERT INTO auth_logs (
    action,
    target_id,
    target_email,
    ip_address,
    user_agent,
    metadata
  ) VALUES (
    'complete_setup',
    user_record.id,
    user_record.email,
    current_setting('request.headers', true)::json->>'x-forwarded-for',
    current_setting('request.headers', true)::json->>'user-agent',
    jsonb_build_object(
      'related_log_id', setup_log_id,
      'completed_at', current_time
    )
  ) RETURNING id INTO log_id;

  -- Update the user's password and metadata
  UPDATE auth.users
  SET
    encrypted_password = crypt(new_password, gen_salt('bf', 10)),
    email_confirmed_at = COALESCE(email_confirmed_at, current_time),
    raw_user_meta_data = raw_user_meta_data - 'password_setup_required' - 'password_setup_token' - 'password_setup_token_expiry' - 'setup_log_id',
    raw_user_meta_data = jsonb_set(
      raw_user_meta_data,
      '{password_set_at}',
      to_jsonb(current_time::text)
    ),
    updated_at = current_time
  WHERE id = user_record.id;

  RETURN jsonb_build_object(
    'success', true,
    'message', 'Password set successfully. You can now log in with your email and password.'
  );
EXCEPTION
  WHEN OTHERS THEN
    -- Log the error
    INSERT INTO auth_logs (
      action,
      target_id,
      target_email,
      ip_address,
      user_agent,
      metadata,
      error_message
    ) VALUES (
      'complete_setup_error',
      user_record.id,
      user_record.email,
      current_setting('request.headers', true)::json->>'x-forwarded-for',
      current_setting('request.headers', true)::json->>'user-agent',
      jsonb_build_object(
        'error_time', current_time
      ),
      SQLERRM
    );
    
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Error setting password: ' || SQLERRM
    );
END;
$$;