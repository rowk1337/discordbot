/*
  # Fix User Creation System

  1. Updates
    - Improve create_user_with_temp_password function to return setup URL
    - Fix password change verification and completion
    - Add auth_logs table if it doesn't exist yet

  2. Security
    - Ensure proper password security
    - Fix authentication issues
*/

-- Create auth_logs table if it doesn't exist
CREATE TABLE IF NOT EXISTS auth_logs (
  id uuid PRIMARY KEY DEFAULT generate_uuid(),
  action text NOT NULL,
  actor_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  target_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  target_email text,
  ip_address text,
  user_agent text,
  metadata jsonb DEFAULT '{}',
  error_message text,
  created_at timestamptz DEFAULT now()
);

-- Enable RLS on auth_logs if not already enabled
ALTER TABLE auth_logs ENABLE ROW LEVEL SECURITY;

-- Create policy for auth_logs (admin only) if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'auth_logs' AND policyname = 'Only admins can view auth logs'
  ) THEN
    CREATE POLICY "Only admins can view auth logs"
      ON auth_logs
      FOR SELECT
      TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM auth.users 
          WHERE id = auth.uid() 
          AND (raw_user_meta_data->>'role') = 'admin'
        )
      );
  END IF;
END $$;

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

-- Update the verify_password_change_required function
CREATE OR REPLACE FUNCTION verify_password_change_required()
RETURNS jsonb
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  user_record auth.users%ROWTYPE;
  password_expires_at timestamptz;
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
  
  -- Check if password change is required
  IF user_record.raw_user_meta_data->>'password_change_required' = 'true' THEN
    -- Check if temporary password has expired
    password_expires_at := (user_record.raw_user_meta_data->>'password_expires_at')::timestamptz;
    
    IF password_expires_at IS NOT NULL AND password_expires_at < current_time THEN
      RETURN jsonb_build_object(
        'success', true,
        'password_change_required', true,
        'password_expired', true,
        'password_expires_at', password_expires_at
      );
    END IF;
    
    RETURN jsonb_build_object(
      'success', true,
      'password_change_required', true,
      'password_expires_at', password_expires_at
    );
  END IF;
  
  RETURN jsonb_build_object(
    'success', true,
    'password_change_required', false
  );
EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Error checking password status: ' || SQLERRM
    );
END;
$$;

-- Update the complete_password_change function
CREATE OR REPLACE FUNCTION complete_password_change(
  new_password text
)
RETURNS jsonb
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  user_record auth.users%ROWTYPE;
  current_time timestamptz := now();
  password_expires_at timestamptz;
  log_id uuid;
  temp_password_log_id uuid;
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
  
  -- Validate password
  IF length(new_password) < 12 THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Password must be at least 12 characters long'
    );
  END IF;
  
  IF NOT (new_password ~ '[A-Z]' AND 
          new_password ~ '[a-z]' AND 
          new_password ~ '[0-9]' AND 
          new_password ~ '[!@#$%^&*()_\-+=<>?]') THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Password must include uppercase, lowercase, numbers, and special characters'
    );
  END IF;
  
  -- Check if password change is required
  IF user_record.raw_user_meta_data->>'password_change_required' != 'true' THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Password change not required for this user'
    );
  END IF;
  
  -- Check if temporary password has expired
  password_expires_at := (user_record.raw_user_meta_data->>'password_expires_at')::timestamptz;
  IF password_expires_at IS NOT NULL AND password_expires_at < current_time THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Temporary password has expired. Please contact an administrator.'
    );
  END IF;
  
  -- Get the original temp password log ID for reference
  temp_password_log_id := (user_record.raw_user_meta_data->>'temp_password_log_id')::uuid;
  
  -- Create log entry for audit trail
  INSERT INTO auth_logs (
    action,
    actor_id,
    target_id,
    ip_address,
    user_agent,
    metadata
  ) VALUES (
    'password_change_completed',
    auth.uid(),
    auth.uid(),
    current_setting('request.headers', true)::json->>'x-forwarded-for',
    current_setting('request.headers', true)::json->>'user-agent',
    jsonb_build_object(
      'related_log_id', temp_password_log_id,
      'completed_at', current_time
    )
  ) RETURNING id INTO log_id;
  
  -- Update the user's password and metadata
  UPDATE auth.users
  SET
    encrypted_password = crypt(new_password, gen_salt('bf', 10)),
    raw_user_meta_data = raw_user_meta_data - 'password_change_required' - 'password_expires_at' - 'temp_password_log_id' - 'password_setup_token' - 'password_setup_token_expiry',
    raw_user_meta_data = jsonb_set(
      raw_user_meta_data,
      '{password_last_changed}',
      to_jsonb(current_time)
    ),
    updated_at = current_time
  WHERE id = auth.uid();
  
  RETURN jsonb_build_object(
    'success', true,
    'message', 'Password changed successfully'
  );
EXCEPTION
  WHEN OTHERS THEN
    -- Log the error
    INSERT INTO auth_logs (
      action,
      actor_id,
      target_id,
      ip_address,
      user_agent,
      metadata,
      error_message
    ) VALUES (
      'password_change_error',
      auth.uid(),
      auth.uid(),
      current_setting('request.headers', true)::json->>'x-forwarded-for',
      current_setting('request.headers', true)::json->>'user-agent',
      jsonb_build_object(
        'error_time', current_time
      ),
      SQLERRM
    );
    
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Error changing password: ' || SQLERRM
    );
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION create_user_with_temp_password(text, text, text, integer, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION verify_password_change_required() TO authenticated;
GRANT EXECUTE ON FUNCTION complete_password_change(text) TO authenticated;