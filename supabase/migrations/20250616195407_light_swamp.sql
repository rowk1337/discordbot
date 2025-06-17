/*
  # Fix UUID extension availability

  1. Ensure uuid-ossp extension is enabled
  2. Verify uuid_generate_v4() function is available
  3. No need to drop/recreate since tables already depend on it
*/

-- Create the uuid-ossp extension if it doesn't exist
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Verify the extension is working properly
DO $$
BEGIN
  -- Test that the function exists and works
  PERFORM uuid_generate_v4();
  
  RAISE NOTICE 'uuid-ossp extension is enabled and uuid_generate_v4() function is working properly.';
EXCEPTION
  WHEN OTHERS THEN
    RAISE EXCEPTION 'Failed to verify uuid_generate_v4() function: %', SQLERRM;
END $$;

-- Ensure all tables have the correct default values set
-- (This is redundant but ensures consistency)
DO $$
BEGIN
  -- Only update if the default is not already set correctly
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'companies' 
    AND column_name = 'id' 
    AND column_default LIKE '%uuid_generate_v4%'
  ) THEN
    ALTER TABLE companies ALTER COLUMN id SET DEFAULT uuid_generate_v4();
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'accounting_periods' 
    AND column_name = 'id' 
    AND column_default LIKE '%uuid_generate_v4%'
  ) THEN
    ALTER TABLE accounting_periods ALTER COLUMN id SET DEFAULT uuid_generate_v4();
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'clients' 
    AND column_name = 'id' 
    AND column_default LIKE '%uuid_generate_v4%'
  ) THEN
    ALTER TABLE clients ALTER COLUMN id SET DEFAULT uuid_generate_v4();
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'invoices' 
    AND column_name = 'id' 
    AND column_default LIKE '%uuid_generate_v4%'
  ) THEN
    ALTER TABLE invoices ALTER COLUMN id SET DEFAULT uuid_generate_v4();
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'payments' 
    AND column_name = 'id' 
    AND column_default LIKE '%uuid_generate_v4%'
  ) THEN
    ALTER TABLE payments ALTER COLUMN id SET DEFAULT uuid_generate_v4();
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'client_reminders' 
    AND column_name = 'id' 
    AND column_default LIKE '%uuid_generate_v4%'
  ) THEN
    ALTER TABLE client_reminders ALTER COLUMN id SET DEFAULT uuid_generate_v4();
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'notifications' 
    AND column_name = 'id' 
    AND column_default LIKE '%uuid_generate_v4%'
  ) THEN
    ALTER TABLE notifications ALTER COLUMN id SET DEFAULT uuid_generate_v4();
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'app_settings' 
    AND column_name = 'id' 
    AND column_default LIKE '%uuid_generate_v4%'
  ) THEN
    ALTER TABLE app_settings ALTER COLUMN id SET DEFAULT uuid_generate_v4();
  END IF;

  -- Check if tables exist before trying to alter them
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'reminder_templates') THEN
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_name = 'reminder_templates' 
      AND column_name = 'id' 
      AND column_default LIKE '%uuid_generate_v4%'
    ) THEN
      ALTER TABLE reminder_templates ALTER COLUMN id SET DEFAULT uuid_generate_v4();
    END IF;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'email_logs') THEN
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_name = 'email_logs' 
      AND column_name = 'id' 
      AND column_default LIKE '%uuid_generate_v4%'
    ) THEN
      ALTER TABLE email_logs ALTER COLUMN id SET DEFAULT uuid_generate_v4();
    END IF;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'automation_rules') THEN
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_name = 'automation_rules' 
      AND column_name = 'id' 
      AND column_default LIKE '%uuid_generate_v4%'
    ) THEN
      ALTER TABLE automation_rules ALTER COLUMN id SET DEFAULT uuid_generate_v4();
    END IF;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'user_company_access') THEN
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_name = 'user_company_access' 
      AND column_name = 'id' 
      AND column_default LIKE '%uuid_generate_v4%'
    ) THEN
      ALTER TABLE user_company_access ALTER COLUMN id SET DEFAULT uuid_generate_v4();
    END IF;
  END IF;

  RAISE NOTICE 'All table defaults have been verified and updated if necessary.';
END $$;