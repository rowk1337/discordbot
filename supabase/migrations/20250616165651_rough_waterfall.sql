/*
  # Add Google Integration Settings Column

  1. New Column
    - Add `google_integration_settings` column to `app_settings` table
    - Store Google OAuth tokens and integration configuration as JSONB

  2. Security
    - Column is protected by existing RLS policies on `app_settings` table
    - Only authenticated users can access their own settings
*/

-- Add google_integration_settings column to app_settings table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'app_settings' AND column_name = 'google_integration_settings'
  ) THEN
    ALTER TABLE app_settings ADD COLUMN google_integration_settings jsonb DEFAULT '{"isConnected": false}';
  END IF;
END $$;

-- Update existing records to have the default value
UPDATE app_settings 
SET google_integration_settings = '{"isConnected": false}'
WHERE google_integration_settings IS NULL;