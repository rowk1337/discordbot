-- First drop the existing function if it exists
DROP FUNCTION IF EXISTS format_timestamp_for_json(timestamptz);

-- Create the format_timestamp_for_json function
CREATE OR REPLACE FUNCTION format_timestamp_for_json(ts timestamptz)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
AS $$
BEGIN
  -- Format timestamp as ISO 8601 string with timezone
  -- This ensures consistent JSON formatting across the application
  -- Using Europe/Paris timezone (France, UTC+1)
  RETURN to_char(ts AT TIME ZONE 'Europe/Paris', 'YYYY-MM-DD"T"HH24:MI:SS"Z"');
END;
$$;

-- Add comment for documentation
COMMENT ON FUNCTION format_timestamp_for_json(timestamptz) IS 'Formats timestamp with time zone for JSON output, converting to France timezone (UTC+1)';