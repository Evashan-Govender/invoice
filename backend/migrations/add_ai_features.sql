-- Migration: Add AI Enhancement Features
-- Date: 2024
-- Features: Duplicate Detection, Confidence Scoring, Smart Categorization, Vendor Recognition, Learning from Corrections

-- =============================================
-- Add new columns to invoice_data table
-- =============================================

-- Confidence scores for each extracted field (JSON)
ALTER TABLE invoice_data ADD COLUMN IF NOT EXISTS confidence_scores JSONB;

-- Expense category classification
ALTER TABLE invoice_data ADD COLUMN IF NOT EXISTS category VARCHAR(100);

-- Detected language of the invoice
ALTER TABLE invoice_data ADD COLUMN IF NOT EXISTS detected_language VARCHAR(50);

-- Duplicate detection flags
ALTER TABLE invoice_data ADD COLUMN IF NOT EXISTS is_duplicate BOOLEAN DEFAULT FALSE;
ALTER TABLE invoice_data ADD COLUMN IF NOT EXISTS duplicate_of_id INTEGER REFERENCES invoices(id);

-- Create index for duplicate detection
CREATE INDEX IF NOT EXISTS idx_invoice_data_duplicate ON invoice_data(duplicate_of_id) WHERE duplicate_of_id IS NOT NULL;

-- =============================================
-- Create vendors table for vendor recognition
-- =============================================

CREATE TABLE IF NOT EXISTS vendors (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    normalized_name VARCHAR(255) NOT NULL,
    address TEXT,
    email VARCHAR(255),
    phone VARCHAR(100),
    tax_id VARCHAR(100),
    default_category VARCHAR(100),
    invoice_count INTEGER DEFAULT 1,
    total_spent FLOAT DEFAULT 0.0,
    last_invoice_date TIMESTAMP,
    extra_data JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for vendor lookup
CREATE INDEX IF NOT EXISTS idx_vendors_user_id ON vendors(user_id);
CREATE INDEX IF NOT EXISTS idx_vendors_normalized_name ON vendors(normalized_name);
CREATE UNIQUE INDEX IF NOT EXISTS idx_vendors_user_normalized ON vendors(user_id, normalized_name);

-- =============================================
-- Create field_corrections table for AI learning
-- =============================================

CREATE TABLE IF NOT EXISTS field_corrections (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    invoice_id INTEGER NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
    field_name VARCHAR(100) NOT NULL,
    original_value TEXT,
    corrected_value TEXT,
    vendor_name VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for correction analysis
CREATE INDEX IF NOT EXISTS idx_field_corrections_user_id ON field_corrections(user_id);
CREATE INDEX IF NOT EXISTS idx_field_corrections_field_name ON field_corrections(field_name);
CREATE INDEX IF NOT EXISTS idx_field_corrections_vendor ON field_corrections(vendor_name) WHERE vendor_name IS NOT NULL;

-- =============================================
-- Update trigger for vendors updated_at
-- =============================================

CREATE OR REPLACE FUNCTION update_vendors_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS vendors_updated_at_trigger ON vendors;
CREATE TRIGGER vendors_updated_at_trigger
    BEFORE UPDATE ON vendors
    FOR EACH ROW
    EXECUTE FUNCTION update_vendors_updated_at();

