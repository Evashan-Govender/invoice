-- Migration: Add SMTP/IMAP columns to user_settings table
-- Run this SQL script against your database to add the new columns

-- Add SMTP/IMAP Integration columns
ALTER TABLE user_settings
ADD COLUMN IF NOT EXISTS smtp_enabled BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS smtp_email VARCHAR(255),
ADD COLUMN IF NOT EXISTS smtp_password TEXT,
ADD COLUMN IF NOT EXISTS imap_host VARCHAR(255),
ADD COLUMN IF NOT EXISTS imap_port INTEGER DEFAULT 993,
ADD COLUMN IF NOT EXISTS smtp_host VARCHAR(255),
ADD COLUMN IF NOT EXISTS smtp_port INTEGER DEFAULT 587,
ADD COLUMN IF NOT EXISTS smtp_use_ssl BOOLEAN DEFAULT TRUE,
ADD COLUMN IF NOT EXISTS smtp_last_check TIMESTAMP;

-- Verify the columns were added
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'user_settings' 
AND column_name LIKE 'smtp%' OR column_name LIKE 'imap%';

