"""
Seed script to initialize database with tables and default user
Usage: python seed_data.py
"""
import sys
import os
from pathlib import Path

# Add the app directory to the path
sys.path.insert(0, str(Path(__file__).parent))

from app.database import engine, Base, SessionLocal
from app.models import User, UserSettings
from app.migrations import run_migrations

# Import password hashing with fallback for bcrypt compatibility
try:
    from app.auth import get_password_hash
except Exception as e:
    print(f"⚠️  Warning: Could not import get_password_hash from app.auth: {e}")
    print("   Using direct bcrypt as fallback...")
    # Fallback to direct bcrypt if passlib has issues
    try:
        import bcrypt
        def get_password_hash(password: str) -> str:
            """Hash a password using bcrypt directly"""
            # Ensure password is bytes and not longer than 72 bytes (bcrypt limit)
            password_bytes = password.encode('utf-8')
            if len(password_bytes) > 72:
                password_bytes = password_bytes[:72]
            salt = bcrypt.gensalt()
            return bcrypt.hashpw(password_bytes, salt).decode('utf-8')
    except ImportError:
        print("❌ Error: bcrypt is not installed. Please install it: pip install bcrypt")
        raise

def create_tables():
    """Create all database tables"""
    print("📦 Creating database tables...")
    try:
        Base.metadata.create_all(bind=engine)
        print("✅ All tables created successfully!")
        return True
    except Exception as e:
        print(f"❌ Error creating tables: {e}")
        return False

def run_database_migrations():
    """Run database migrations"""
    print("\n🔄 Running database migrations...")
    try:
        run_migrations(engine)
        return True
    except Exception as e:
        print(f"❌ Error running migrations: {e}")
        return False

def create_default_user(email: str = "admin@example.com", password: str = "admin123"):
    """Create a default user with settings"""
    db = SessionLocal()
    try:
        # Check if user already exists
        existing_user = db.query(User).filter(User.email == email).first()
        if existing_user:
            print(f"⚠️  User with email '{email}' already exists. Skipping user creation.")
            return existing_user
        
        # Create new user
        print(f"\n👤 Creating default user: {email}")
        password_hash = get_password_hash(password)
        
        user = User(
            email=email,
            password_hash=password_hash
        )
        db.add(user)
        db.commit()
        db.refresh(user)
        
        print(f"✅ User created successfully! (ID: {user.id})")
        
        # Create user settings
        print(f"⚙️  Creating user settings...")
        settings = UserSettings(
            user_id=user.id,
            auto_process=True,
            email_notifications=False,
            auto_sync_erp=False
        )
        db.add(settings)
        db.commit()
        db.refresh(settings)
        
        print(f"✅ User settings created successfully!")
        print(f"\n📋 Login Credentials:")
        print(f"   Email: {email}")
        print(f"   Password: {password}")
        print(f"\n⚠️  Please change the default password after first login!")
        
        return user
        
    except Exception as e:
        db.rollback()
        print(f"❌ Error creating user: {e}")
        return None
    finally:
        db.close()

def main():
    """Main seed function"""
    print("=" * 60)
    print("🌱 Invoice AI - Database Seeding")
    print("=" * 60)
    
    # Step 1: Create tables
    if not create_tables():
        print("\n❌ Failed to create tables. Exiting.")
        sys.exit(1)
    
    # Step 2: Run migrations
    if not run_database_migrations():
        print("\n⚠️  Migrations had errors, but continuing...")
    
    # Step 3: Create default user
    # Get email and password from environment or use defaults
    email = os.getenv("SEED_USER_EMAIL", "admin@example.com")
    password = os.getenv("SEED_USER_PASSWORD", "admin123")
    
    user = create_default_user(email, password)
    
    if user:
        print("\n" + "=" * 60)
        print("✅ Database seeding completed successfully!")
        print("=" * 60)
    else:
        print("\n" + "=" * 60)
        print("⚠️  Database seeding completed with warnings.")
        print("=" * 60)
        sys.exit(1)

if __name__ == "__main__":
    main()

