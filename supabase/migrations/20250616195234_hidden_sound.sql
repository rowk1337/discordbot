/*
  # Enable UUID extension

  This migration ensures the uuid-ossp extension is enabled in the database.
  The uuid-ossp extension provides functions to generate UUIDs, including uuid_generate_v4().
*/

-- Enable the uuid-ossp extension if it doesn't exist
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Verify the extension is enabled and the function exists
DO $$
BEGIN
  -- Check if the function exists
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc WHERE proname = 'uuid_generate_v4'
  ) THEN
    RAISE EXCEPTION 'uuid_generate_v4() function not found. Make sure the uuid-ossp extension is properly installed.';
  END IF;
  
  -- Test the function
  PERFORM uuid_generate_v4();
  
  RAISE NOTICE 'uuid-ossp extension is enabled and uuid_generate_v4() function is working properly.';
END $$;