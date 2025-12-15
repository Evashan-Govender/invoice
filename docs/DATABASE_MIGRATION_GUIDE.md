# Database Migration Guide

## Overview

The ERP integrations migration runs **automatically** when you start the backend server. No manual intervention needed!

## ✅ How Migrations Work (Automatic)

### What Happens on Backend Startup:

1. Backend starts via `start.bat` or `start.sh`
2. `app/main.py` calls `run_migrations()` automatically
3. System checks if tables/columns exist
4. Creates missing tables (including `erp_integrations`)
5. Adds missing columns
6. Creates indexes
7. **Done!**

### To Run Migrations:

```bash
cd backend

# Windows
start.bat

# Linux/Mac
./start.sh
```

You'll see output like:
```
📊 Running column migrations...
✓ Added column smtp_enabled to user_settings
📦 Creating new tables...
✓ Created table erp_integrations
🔍 Creating indexes...
✓ Index idx_erp_integrations_user_id ready
✅ Migrations complete!

🌐 Starting FastAPI server on http://localhost:8000
```

---

## Method 2: Using Python Code Directly

If you want to run migrations from your own Python script:

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

Save this as `run_manual_migration.py` and run:
```bash
cd backend
source venv/bin/activate  # or venv\Scripts\activate on Windows
python run_manual_migration.py
```

---

## Method 3: Using psql Command Line

If you prefer SQL command line:

```bash
cd backend

# Linux/Mac
export DATABASE_URL="postgresql://postgres:avinash@localhost:5433/invoiceai"
psql $DATABASE_URL -f migrations/add_erp_integrations.sql

# Windows PowerShell
$env:DATABASE_URL="postgresql://postgres:avinash@localhost:5433/invoiceai"
psql $env:DATABASE_URL -f migrations/add_erp_integrations.sql
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

### Issue: Need to activate virtual environment

If you see "ModuleNotFoundError: No module named 'sqlalchemy'":

**Solution**: Just start the backend normally (migrations run automatically):

```bash
cd backend

# Windows
start.bat

# Linux/Mac  
./start.sh
```

The `start.bat`/`start.sh` scripts handle:
- ✅ Activating virtual environment
- ✅ Running migrations automatically
- ✅ Starting the server

**No need to activate venv manually or run migrations separately!**

---

### Error: "DATABASE_URL not found"

**Solution**: Make sure `.env` file exists with DATABASE_URL:

```bash
cd backend
cat .env  # Linux/Mac
type .env  # Windows

# Should contain:
DATABASE_URL=postgresql://postgres:avinash@localhost:5433/invoiceai
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

**✅ Recommended approach (Easiest):**
1. Just start the backend with `start.bat` or `./start.sh`
2. Migrations run automatically
3. Check logs to confirm success
4. **That's it!**

**Alternative approaches:**
- Use Python code with `from app.migrations import run_migrations`
- Use `psql` command line if you prefer SQL directly

**Files you need:**
- ✅ `backend/start.bat` or `backend/start.sh` - Starts backend with auto-migrations
- ✅ `backend/app/migrations.py` - Contains migration logic
- ✅ `backend/migrations/*.sql` - SQL migration files (optional, for reference)

**Files removed (no longer needed):**
- ❌ `setup_xero.bat` / `setup_xero.sh` - Removed
- ❌ `run_migration.bat` / `run_migration.sh` - Removed  
- ❌ `run_migration.py` - Removed

Everything happens automatically now! 🎉

