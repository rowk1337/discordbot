/*
  # Fix create_user_with_temp_password function

  1. Function Updates
    - Fix the `to_char` function call to use proper timestamp types
    - Ensure the temporary password generation uses correct timestamp formatting
    - Update the function to handle timezone conversions properly

  2. Changes Made
    - Replace `time with time zone` usage with `timestamptz`
    - Fix the `to_char` function calls to use proper timestamp types
    - Ensure all date/time operations use compatible types
*/

-- Drop the existing function if it exists
DROP FUNCTION IF EXISTS create_user_with_temp_password(text, text, text);

-- Create the corrected function
CREATE OR REPLACE FUNCTION create_user_with_temp_password(
  user_email text,
  user_role text DEFAULT 'user',
  company_name text DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  temp_password text;
  new_user_id uuid;
  company_id uuid;
  result json;
BEGIN
  -- Generate temporary password using proper timestamp formatting
  temp_password := 'temp_' || to_char(NOW(), 'YYYYMMDDHH24MISS') || '_' || substr(md5(random()::text), 1, 6);
  
  -- Create the user in auth.users
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
    NOW(),
    NOW(),
    NOW(),
    '{"provider": "email", "providers": ["email"]}',
    jsonb_build_object('role', user_role, 'temp_password', true),
    NOW(),
    NOW(),
    '',
    '',
    '',
    ''
  ) RETURNING id INTO new_user_id;

  -- Create user record in public.users
  INSERT INTO public.users (
    id,
    email,
    raw_user_meta_data,
    created_at,
    updated_at
  ) VALUES (
    new_user_id,
    user_email,
    jsonb_build_object('role', user_role, 'temp_password', true),
    NOW(),
    NOW()
  );

  -- Handle company assignment if company_name is provided
  IF company_name IS NOT NULL THEN
    -- Try to find existing company
    SELECT id INTO company_id FROM companies WHERE name = company_name LIMIT 1;
    
    -- If company doesn't exist, create it
    IF company_id IS NULL THEN
      INSERT INTO companies (name, created_at, updated_at)
      VALUES (company_name, NOW(), NOW())
      RETURNING id INTO company_id;
    END IF;
    
    -- Create user-company access record
    INSERT INTO user_company_access (user_id, company_id, role, created_at)
    VALUES (new_user_id, company_id, 'user', NOW());
  END IF;

  -- Create default app settings for the user
  INSERT INTO app_settings (user_id, created_at, updated_at)
  VALUES (new_user_id, NOW(), NOW());

  -- Return result
  result := json_build_object(
    'user_id', new_user_id,
    'email', user_email,
    'temp_password', temp_password,
    'company_id', company_id
  );

  RETURN result;
EXCEPTION
  WHEN OTHERS THEN
    RAISE EXCEPTION 'Error creating user: %', SQLERRM;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION create_user_with_temp_password(text, text, text) TO authenticated;