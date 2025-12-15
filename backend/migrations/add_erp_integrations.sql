-- Migration: Add ERP Integrations Table
-- This table stores OAuth tokens and configuration for ERP systems like Xero, QuickBooks, etc.

CREATE TABLE IF NOT EXISTS erp_integrations (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    provider VARCHAR(50) NOT NULL,
    is_active BOOLEAN DEFAULT FALSE,
    
    -- OAuth 2.0 tokens
    access_token TEXT,
    refresh_token TEXT,
    token_expiry TIMESTAMP,
    
    -- Provider-specific configuration
    tenant_id VARCHAR(255),  -- Xero tenant_id / QB realm_id
    org_id VARCHAR(255),     -- Organization/Company ID
    config_data JSONB,       -- Additional provider-specific data
    
    -- Sync settings
    auto_sync BOOLEAN DEFAULT FALSE,
    last_sync TIMESTAMP,
    sync_count INTEGER DEFAULT 0,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- One active integration per provider per user
    UNIQUE(user_id, provider)
);

-- Create indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_erp_integrations_user_id ON erp_integrations(user_id);
CREATE INDEX IF NOT EXISTS idx_erp_integrations_provider ON erp_integrations(provider);
CREATE INDEX IF NOT EXISTS idx_erp_integrations_user_provider ON erp_integrations(user_id, provider);

-- Add trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_erp_integrations_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_erp_integrations_timestamp
    BEFORE UPDATE ON erp_integrations
    FOR EACH ROW
    EXECUTE FUNCTION update_erp_integrations_updated_at();

