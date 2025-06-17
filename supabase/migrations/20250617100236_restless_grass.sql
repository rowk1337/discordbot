-- Drop the existing function
DROP FUNCTION IF EXISTS create_user_with_temp_password(text, text, text, integer, integer);

-- Recreate the function with fixed timestamp handling
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
  IF password_length <= 0 THEN
    -- If password_length is 0 or negative, we'll only generate a setup link without a temp password
    temp_password := NULL;
  ELSE
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
          substr(md5(random()::text || extract(epoch from now())::text), 1, 8) || 
          '!' || 'A' || '1'
        INTO temp_password;
    END;
  END IF;
  
  -- Generate a setup token
  BEGIN
    -- Try using gen_random_bytes from pgcrypto
    SELECT encode(gen_random_bytes(32), 'base64')
    INTO setup_token;
  EXCEPTION
    WHEN OTHERS THEN
      -- Fallback to a less secure but functional alternative
      SELECT encode(
        ('x'||substr(md5(random()::text || extract(epoch from now())::text), 1, 64))::bytea, 
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
    CASE 
      WHEN temp_password IS NOT NULL THEN crypt(temp_password, gen_salt('bf', 10))
      ELSE crypt('temp_' || gen_random_uuid()::text, gen_salt('bf', 10))
    END,
    current_time, -- Auto-confirm email for admin-created accounts
    jsonb_build_object(
      'role', user_role,
      'full_name', COALESCE(user_name, ''),
      'created_by', auth.uid(),
      'created_at', current_time,
      'password_change_required', true,
      'password_created_at', current_time,
      'password_expires_at', password_expiry,
      'password_setup_token', setup_token,
      'password_setup_token_expiry', password_expiry,
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
    'message', 'User created successfully. User must change password on first login.'
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
END
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION create_user_with_temp_password(text, text, text, integer, integer) TO authenticated;