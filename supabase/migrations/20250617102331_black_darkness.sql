/*
  # Fix resend_password_setup_link function

  1. Improvements
    - Simplify the function to avoid timestamp formatting issues
    - Make it work with existing users
    - Ensure proper error handling
    - Fix URL generation

  2. Security
    - Maintain admin-only access
    - Proper logging
*/

-- Drop the existing function if it exists
DROP FUNCTION IF EXISTS resend_password_setup_link(text);

-- Create a simplified version that works reliably
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
  SELECT id INTO target_user_id
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

  RETURN jsonb_build_object(
    'success', true,
    'setup_url', setup_url,
    'message', 'Setup link has been regenerated'
  );
EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Error resending setup link: ' || SQLERRM
    );
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION resend_password_setup_link(text) TO authenticated;