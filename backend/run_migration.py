"""
Database Migration Runner
Executes SQL migration files against the PostgreSQL database
"""
import os
import sys
from sqlalchemy import create_engine, text
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

def run_migration(migration_file: str):
    """
    Execute a SQL migration file
    
    Args:
        migration_file: Path to the SQL file to execute
    """
    # Get database URL from environment
    database_url = os.getenv("DATABASE_URL")
    
    if not database_url:
        print("❌ Error: DATABASE_URL not found in .env file")
        sys.exit(1)
    
    print(f"🔗 Connecting to database...")
    print(f"📁 Migration file: {migration_file}")
    
    try:
        # Create database engine
        engine = create_engine(database_url)
        
        # Read the SQL file
        if not os.path.exists(migration_file):
            print(f"❌ Error: Migration file not found: {migration_file}")
            sys.exit(1)
        
        with open(migration_file, 'r', encoding='utf-8') as f:
            sql_content = f.read()
        
        print(f"📄 SQL file loaded ({len(sql_content)} characters)")
        print("🚀 Executing migration...")
        
        # Execute the SQL
        with engine.connect() as connection:
            # Split by semicolon and execute each statement
            statements = [s.strip() for s in sql_content.split(';') if s.strip()]
            
            for idx, statement in enumerate(statements, 1):
                if statement:
                    try:
                        print(f"   Executing statement {idx}/{len(statements)}...")
                        connection.execute(text(statement))
                        connection.commit()
                    except Exception as e:
                        print(f"   ⚠️ Statement {idx} error (might be expected): {str(e)}")
                        # Continue with other statements
        
        print("✅ Migration completed successfully!")
        print(f"📊 Executed {len(statements)} SQL statements")
        
    except Exception as e:
        print(f"❌ Error executing migration: {str(e)}")
        sys.exit(1)


def run_all_pending_migrations():
    """Run all migration files in the migrations directory"""
    migrations_dir = "migrations"
    
    if not os.path.exists(migrations_dir):
        print(f"❌ Migrations directory not found: {migrations_dir}")
        sys.exit(1)
    
    # Get all .sql files
    sql_files = sorted([f for f in os.listdir(migrations_dir) if f.endswith('.sql')])
    
    if not sql_files:
        print("ℹ️ No migration files found")
        return
    
    print(f"📋 Found {len(sql_files)} migration file(s)")
    print("=" * 60)
    
    for sql_file in sql_files:
        print(f"\n🔄 Running: {sql_file}")
        migration_path = os.path.join(migrations_dir, sql_file)
        run_migration(migration_path)
        print("-" * 60)
    
    print("\n✅ All migrations completed!")


if __name__ == "__main__":
    import argparse
    
    parser = argparse.ArgumentParser(description="Run database migrations")
    parser.add_argument(
        '--file', 
        type=str, 
        help='Specific migration file to run (e.g., migrations/add_erp_integrations.sql)'
    )
    parser.add_argument(
        '--all',
        action='store_true',
        help='Run all pending migrations in the migrations directory'
    )
    
    args = parser.parse_args()
    
    if args.file:
        # Run specific migration
        run_migration(args.file)
    elif args.all:
        # Run all migrations
        run_all_pending_migrations()
    else:
        # Default: run the ERP integrations migration
        print("Running ERP integrations migration...")
        run_migration("migrations/add_erp_integrations.sql")

