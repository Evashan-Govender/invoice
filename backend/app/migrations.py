"""
Database migration utilities for handling schema updates.
This handles adding new columns to existing tables.
"""

from sqlalchemy import text, inspect
from sqlalchemy.engine import Engine
from typing import List, Tuple


def column_exists(engine: Engine, table_name: str, column_name: str) -> bool:
    """Check if a column exists in a table"""
    inspector = inspect(engine)
    try:
        columns = [col['name'] for col in inspector.get_columns(table_name)]
        return column_name in columns
    except:
        return False


def table_exists(engine: Engine, table_name: str) -> bool:
    """Check if a table exists"""
    inspector = inspect(engine)
    return table_name in inspector.get_table_names()


def run_migrations(engine: Engine):
    """Run all pending migrations"""
    
    # Define column migrations: (table_name, column_name, column_definition)
    column_migrations: List[Tuple[str, str, str]] = [
        # SMTP/IMAP Integration columns
        ("user_settings", "smtp_enabled", "BOOLEAN DEFAULT FALSE"),
        ("user_settings", "smtp_email", "VARCHAR(255)"),
        ("user_settings", "smtp_password", "TEXT"),
        ("user_settings", "imap_host", "VARCHAR(255)"),
        ("user_settings", "imap_port", "INTEGER DEFAULT 993"),
        ("user_settings", "smtp_host", "VARCHAR(255)"),
        ("user_settings", "smtp_port", "INTEGER DEFAULT 587"),
        ("user_settings", "smtp_use_ssl", "BOOLEAN DEFAULT TRUE"),
        ("user_settings", "smtp_last_check", "TIMESTAMP"),
        
        # AI Enhancement columns for invoice_data
        ("invoice_data", "confidence_scores", "JSONB"),
        ("invoice_data", "category", "VARCHAR(100)"),
        ("invoice_data", "detected_language", "VARCHAR(50)"),
        ("invoice_data", "is_duplicate", "BOOLEAN DEFAULT FALSE"),
        ("invoice_data", "duplicate_of_id", "INTEGER REFERENCES invoices(id)"),
        
        # ERP Integration OAuth credentials (added for database-based config)
        ("erp_integrations", "client_id", "VARCHAR(255)"),
        ("erp_integrations", "client_secret", "TEXT"),
        ("erp_integrations", "redirect_uri", "VARCHAR(500)"),
    ]
    
    # Define new tables
    new_tables = {
        "vendors": """
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
            )
        """,
        "field_corrections": """
            CREATE TABLE IF NOT EXISTS field_corrections (
                id SERIAL PRIMARY KEY,
                user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                invoice_id INTEGER NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
                field_name VARCHAR(100) NOT NULL,
                original_value TEXT,
                corrected_value TEXT,
                vendor_name VARCHAR(255),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """,
        "erp_integrations": """
            CREATE TABLE IF NOT EXISTS erp_integrations (
                id SERIAL PRIMARY KEY,
                user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                provider VARCHAR(50) NOT NULL,
                is_active BOOLEAN DEFAULT FALSE,
                client_id VARCHAR(255),
                client_secret TEXT,
                redirect_uri VARCHAR(500),
                access_token TEXT,
                refresh_token TEXT,
                token_expiry TIMESTAMP,
                tenant_id VARCHAR(255),
                org_id VARCHAR(255),
                config_data JSONB,
                auto_sync BOOLEAN DEFAULT FALSE,
                last_sync TIMESTAMP,
                sync_count INTEGER DEFAULT 0,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(user_id, provider)
            )
        """
    }
    
    with engine.connect() as conn:
        # Run column migrations
        print("\n📊 Running column migrations...")
        for table_name, column_name, column_def in column_migrations:
            if not table_exists(engine, table_name):
                print(f"⏭ Table {table_name} doesn't exist yet, skipping {column_name}")
                continue
            if not column_exists(engine, table_name, column_name):
                try:
                    conn.execute(text(
                        f"ALTER TABLE {table_name} ADD COLUMN {column_name} {column_def}"
                    ))
                    conn.commit()
                    print(f"✓ Added column {column_name} to {table_name}")
                except Exception as e:
                    print(f"✗ Error adding column {column_name}: {e}")
            else:
                print(f"· Column {column_name} already exists in {table_name}")
        
        # Create new tables
        print("\n📦 Creating new tables...")
        for table_name, create_sql in new_tables.items():
            if not table_exists(engine, table_name):
                try:
                    conn.execute(text(create_sql))
                    conn.commit()
                    print(f"✓ Created table {table_name}")
                except Exception as e:
                    print(f"✗ Error creating table {table_name}: {e}")
            else:
                print(f"· Table {table_name} already exists")
        
        # Create indexes
        print("\n🔍 Creating indexes...")
        indexes = [
            ("idx_invoice_data_duplicate", "CREATE INDEX IF NOT EXISTS idx_invoice_data_duplicate ON invoice_data(duplicate_of_id) WHERE duplicate_of_id IS NOT NULL"),
            ("idx_vendors_user_id", "CREATE INDEX IF NOT EXISTS idx_vendors_user_id ON vendors(user_id)"),
            ("idx_vendors_normalized_name", "CREATE INDEX IF NOT EXISTS idx_vendors_normalized_name ON vendors(normalized_name)"),
            ("idx_field_corrections_user_id", "CREATE INDEX IF NOT EXISTS idx_field_corrections_user_id ON field_corrections(user_id)"),
            ("idx_field_corrections_field_name", "CREATE INDEX IF NOT EXISTS idx_field_corrections_field_name ON field_corrections(field_name)"),
            ("idx_erp_integrations_user_id", "CREATE INDEX IF NOT EXISTS idx_erp_integrations_user_id ON erp_integrations(user_id)"),
            ("idx_erp_integrations_provider", "CREATE INDEX IF NOT EXISTS idx_erp_integrations_provider ON erp_integrations(provider)"),
            ("idx_erp_integrations_user_provider", "CREATE INDEX IF NOT EXISTS idx_erp_integrations_user_provider ON erp_integrations(user_id, provider)"),
        ]
        
        for idx_name, idx_sql in indexes:
            try:
                conn.execute(text(idx_sql))
                conn.commit()
                print(f"✓ Index {idx_name} ready")
            except Exception as e:
                print(f"· Index {idx_name}: {e}")
        
        print("\n✅ Migrations complete!")

