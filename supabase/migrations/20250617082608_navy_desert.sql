/*
  # Fix ambiguous column reference in get_user_company_access function

  1. Function Updates
    - Drop and recreate the `get_user_company_access` function
    - Fix ambiguous column references by properly qualifying table aliases
    - Ensure all column references are explicit and unambiguous

  2. Security
    - Maintain existing RLS policies and security constraints
    - Function accessible only to authenticated users with proper permissions
*/

-- Drop the existing function if it exists
DROP FUNCTION IF EXISTS get_user_company_access();

-- Recreate the function with properly qualified column references
CREATE OR REPLACE FUNCTION get_user_company_access()
RETURNS TABLE (
  id uuid,
  user_id uuid,
  company_id uuid,
  role text,
  company_name text,
  created_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Check if the current user is an admin
  IF NOT EXISTS (
    SELECT 1 FROM auth.users 
    WHERE auth.users.id = auth.uid() 
    AND (auth.users.raw_user_meta_data ->> 'role') = 'admin'
  ) THEN
    RAISE EXCEPTION 'Access denied. Admin role required.';
  END IF;

  -- Return user company access with properly qualified column references
  RETURN QUERY
  SELECT 
    uca.id,
    uca.user_id,
    uca.company_id,
    uca.role,
    c.name as company_name,
    uca.created_at
  FROM user_company_access uca
  LEFT JOIN companies c ON c.id = uca.company_id
  ORDER BY uca.created_at DESC;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION get_user_company_access() TO authenticated;