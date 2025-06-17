/*
  # Create RPC function for user company access

  1. New Functions
    - `get_user_company_access()` - Securely fetch user company access data with company names
  
  2. Security
    - Function runs with SECURITY DEFINER to bypass RLS restrictions
    - Only accessible to authenticated users
    - Returns user access data with company information
*/

-- Create function to get user company access data
CREATE OR REPLACE FUNCTION get_user_company_access()
RETURNS TABLE (
  id uuid,
  user_id uuid,
  company_id uuid,
  role text,
  created_at timestamptz,
  company_name text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Check if user is authenticated
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Check if user is admin
  IF NOT EXISTS (
    SELECT 1 FROM auth.users 
    WHERE id = auth.uid() 
    AND (raw_user_meta_data->>'role')::text = 'admin'
  ) THEN
    RAISE EXCEPTION 'Access denied. Admin role required.';
  END IF;

  -- Return user company access data with company names
  RETURN QUERY
  SELECT 
    uca.id,
    uca.user_id,
    uca.company_id,
    uca.role,
    uca.created_at,
    COALESCE(c.name, 'Unknown Company') as company_name
  FROM user_company_access uca
  LEFT JOIN companies c ON c.id = uca.company_id
  ORDER BY uca.created_at DESC;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION get_user_company_access() TO authenticated;