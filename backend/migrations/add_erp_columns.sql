-- Add missing columns to existing erp_integrations table
-- Run this if the table exists but columns are missing

ALTER TABLE erp_integrations 
ADD COLUMN IF NOT EXISTS client_id VARCHAR(255);

ALTER TABLE erp_integrations 
ADD COLUMN IF NOT EXISTS client_secret TEXT;

ALTER TABLE erp_integrations 
ADD COLUMN IF NOT EXISTS redirect_uri VARCHAR(500);

-- Verify columns were added
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'erp_integrations'
ORDER BY ordinal_position;

