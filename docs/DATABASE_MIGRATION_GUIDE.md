# Database Migration Guide

## Overview

There are **3 ways** to run the ERP integrations migration in Python:

## ✅ Method 1: Automatic on Startup (Recommended)

The migration now runs **automatically** when you start the backend server!

### How it works:
- The `backend/app/main.py` calls `run_migrations()` on startup
- It checks if the `erp_integrations` table exists
- If not, it creates the table automatically
- **No manual intervention needed!**

### To use:
```bash
cd backend

# Windows
start.bat

# Linux/Mac
./start.sh
```

The migration will run automatically and you'll see:
```
📊 Running column migrations...
📦 Creating new tables...
✓ Created table erp_integrations
🔍 Creating indexes...
✅ Migrations complete!
```

---

## Method 2: Using the Migration Runner Script

If you want to run migrations manually or separately:

### Step 1: Use the migration runner

```bash
cd backend

# Activate virtual environment first
# Windows:
venv\Scripts\activate
# Linux/Mac:
source venv/bin/activate

# Run the ERP integrations migration
python run_migration.py

# Or run a specific migration file:
python run_migration.py --file migrations/add_erp_integrations.sql

# Or run all migrations:
python run_migration.py --all
```

### Output:
```
🔗 Connecting to database...
📁 Migration file: migrations/add_erp_integrations.sql
📄 SQL file loaded (1234 characters)
🚀 Executing migration...
   Executing statement 1/5...
   Executing statement 2/5...
   Executing statement 3/5...
   Executing statement 4/5...
   Executing statement 5/5...
✅ Migration completed successfully!
📊 Executed 5 SQL statements
```

---

## Method 3: Using Python Code Directly

If you want to integrate migration into your own script:

```python
from sqlalchemy import create_engine
from app.migrations import run_migrations
import os
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Create engine
database_url = os.getenv("DATABASE_URL")
engine = create_engine(database_url)

# Run all migrations
run_migrations(engine)

print("✅ Migrations completed!")
```

---

## Method 4: Using psql Command Line (Non-Python)

If you prefer command-line SQL:

```bash
cd backend

# Set DATABASE_URL environment variable
$env:DATABASE_URL="postgresql://postgres:avinash@localhost:5433/invoiceai"  # Windows PowerShell
# or
export DATABASE_URL="postgresql://postgres:avinash@localhost:5433/invoiceai"  # Linux/Mac

# Run the migration
psql $DATABASE_URL -f migrations/add_erp_integrations.sql
```

---

## Verify Migration Success

After running the migration, verify it worked:

### Option A: Check from Python
```python
from sqlalchemy import create_engine, text
import os

database_url = os.getenv("DATABASE_URL")
engine = create_engine(database_url)

with engine.connect() as conn:
    result = conn.execute(text("""
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_name = 'erp_integrations'
    """))
    
    if result.fetchone():
        print("✅ erp_integrations table exists!")
    else:
        print("❌ erp_integrations table not found")
```

### Option B: Check from psql
```sql
psql $DATABASE_URL

-- List all tables
\dt

-- Describe erp_integrations table
\d erp_integrations

-- Check if data can be inserted
SELECT COUNT(*) FROM erp_integrations;
```

---

## Troubleshooting

### Error: "DATABASE_URL not found"

**Solution**: Make sure `.env` file exists with DATABASE_URL:

```bash
cd backend
cat .env  # Linux/Mac
type .env  # Windows

# Should contain:
DATABASE_URL=postgresql://postgres:avinash@localhost:5433/invoiceai
```

### Error: "Module not found: sqlalchemy"

**Solution**: Activate virtual environment:

```bash
cd backend

# Windows
venv\Scripts\activate

# Linux/Mac  
source venv/bin/activate

# Verify
python -c "import sqlalchemy; print('✅ SQLAlchemy installed')"
```

### Error: "Table already exists"

**Solution**: This is normal! The migration uses `CREATE TABLE IF NOT EXISTS`, so it's safe to run multiple times.

### Error: "Permission denied"

**Solution**: Check database credentials in `.env` file and ensure PostgreSQL is running:

```bash
# Check if PostgreSQL is running
docker ps  # If using Docker

# Or check service
# Windows:
services.msc  # Look for PostgreSQL

# Linux:
sudo systemctl status postgresql
```

---

## What Gets Created

When you run the migration, it creates:

### 1. `erp_integrations` Table
- Stores OAuth tokens for Xero, QuickBooks, etc.
- One integration per user per provider
- Columns: access_token, refresh_token, tenant_id, etc.

### 2. Indexes
- `idx_erp_integrations_user_id` - Fast user lookups
- `idx_erp_integrations_provider` - Fast provider lookups  
- `idx_erp_integrations_user_provider` - Combined lookups

### 3. Trigger
- `update_erp_integrations_updated_at` - Auto-updates timestamp

---

## Summary

**Recommended approach:**
1. ✅ Just start the backend with `start.bat` or `start.sh`
2. ✅ Migration runs automatically
3. ✅ Check logs to confirm success

**Alternative:**
- Use `python run_migration.py` if you need manual control
- Use `psql` if you prefer SQL command line

That's it! The migration will create everything needed for Xero OAuth integration. 🎉

