/*
  # Secure Temporary Password System

  1. New Functions
    - `generate_secure_password` - Creates cryptographically secure temporary passwords
    - `create_user_with_temp_password` - Creates a user with a temporary password
    - `verify_password_change_required` - Checks if password change is required
    - `complete_password_change` - Handles the password change process

  2. Security Features
    - Bcrypt hashing with appropriate work factor
    - Secure random password generation
    - Password expiration enforcement
    - Comprehensive logging
    - Rate limiting
*/

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Function to generate a secure random password
CREATE OR REPLACE FUNCTION generate_secure_password(length integer DEFAULT 12)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  chars text := 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*()_-+=<>?';
  result text := '';
  i integer := 0;
  pos integer := 0;
  has_upper boolean := false;
  has_lower boolean := false;
  has_digit boolean := false;
  has_special boolean := false;
  random_bytes bytea;
BEGIN
  -- Generate random bytes
  random_bytes := gen_random_bytes(length * 2);
  
  -- Generate the password
  WHILE i < length LOOP
    -- Use the random bytes to select a position in the chars string
    pos := (get_byte(random_bytes, i) % length(chars)) + 1;
    
    -- Add the character at that position to the result
    result := result || substr(chars, pos, 1);
    
    -- Check character type
    IF result ~ '[A-Z]' THEN has_upper := true; END IF;
    IF result ~ '[a-z]' THEN has_lower := true; END IF;
    IF result ~ '[0-9]' THEN has_digit := true; END IF;
    IF result ~ '[!@#$%^&*()_\-+=<>?]' THEN has_special := true; END IF;
    
    i := i + 1;
  END LOOP;
  
  -- Ensure password meets complexity requirements
  IF NOT (has_upper AND has_lower AND has_digit AND has_special) THEN
    -- If not complex enough, recursively generate a new password
    RETURN generate_secure_password(length);
  END IF;
  
  RETURN result;
EXCEPTION
  WHEN OTHERS THEN
    -- Fallback method if gen_random_bytes fails
    RAISE WARNING 'Error in secure password generation: %. Falling back to less secure method.', SQLERRM;
    
    -- Less secure fallback using random() and md5
    WHILE i < length LOOP
      pos := (floor(random() * length(chars)) + 1)::integer;
      result := result || substr(chars, pos, 1);
      i := i + 1;
    END LOOP;
    
    RETURN result;
END;
$$;

-- Function to create a user with a temporary password
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
  
  -- Generate a secure temporary password
  temp_password := generate_secure_password(password_length);
  
  -- Set password expiry date
  password_expiry := current_time + (password_expiry_days || ' days')::interval;
  
  -- Generate new user ID
  new_user_id := generate_uuid();
  
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
  
  -- Return success with temporary password (for secure transmission to user)
  RETURN jsonb_build_object(
    'success', true,
    'user_id', new_user_id,
    'email', user_email,
    'temporary_password', temp_password,
    'password_expires_at', password_expiry,
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

-- Function to verify if password change is required
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
    
    IF password_expires_at < current_time THEN
      RETURN jsonb_build_object(
        'success', false,
        'error', 'Temporary password has expired. Please contact an administrator.',
        'password_change_required', true,
        'password_expired', true
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

-- Function to complete password change
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
  IF password_expires_at < current_time THEN
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
    raw_user_meta_data = raw_user_meta_data - 'password_change_required' - 'password_expires_at' - 'temp_password_log_id',
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

-- Create auth_logs table for comprehensive audit trail
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

-- Enable RLS on auth_logs
ALTER TABLE auth_logs ENABLE ROW LEVEL SECURITY;

-- Create policy for auth_logs (admin only)
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

-- Function to implement rate limiting for password operations
CREATE OR REPLACE FUNCTION check_password_rate_limit(
  user_id uuid,
  action_type text,
  max_attempts integer DEFAULT 5,
  window_minutes integer DEFAULT 15
)
RETURNS boolean
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  attempt_count integer;
  is_limited boolean;
BEGIN
  -- Count recent attempts
  SELECT COUNT(*) INTO attempt_count
  FROM auth_logs
  WHERE 
    target_id = user_id AND
    action = action_type AND
    created_at > (now() - (window_minutes || ' minutes')::interval);
  
  -- Check if rate limited
  is_limited := attempt_count >= max_attempts;
  
  -- Log the rate limit check
  IF is_limited THEN
    INSERT INTO auth_logs (
      action,
      actor_id,
      target_id,
      ip_address,
      user_agent,
      metadata
    ) VALUES (
      'rate_limit_exceeded',
      auth.uid(),
      user_id,
      current_setting('request.headers', true)::json->>'x-forwarded-for',
      current_setting('request.headers', true)::json->>'user-agent',
      jsonb_build_object(
        'action_type', action_type,
        'attempt_count', attempt_count,
        'max_attempts', max_attempts,
        'window_minutes', window_minutes
      )
    );
  END IF;
  
  RETURN is_limited;
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION generate_secure_password(integer) TO authenticated;
GRANT EXECUTE ON FUNCTION create_user_with_temp_password(text, text, text, integer, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION verify_password_change_required() TO authenticated;
GRANT EXECUTE ON FUNCTION complete_password_change(text) TO authenticated;
GRANT EXECUTE ON FUNCTION check_password_rate_limit(uuid, text, integer, integer) TO authenticated;