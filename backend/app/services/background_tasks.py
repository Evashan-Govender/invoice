"""Background task service for periodic Gmail checking and other scheduled tasks"""
import threading
import time
from typing import Optional
from datetime import datetime, timedelta
from sqlalchemy.orm import Session
from ..database import SessionLocal
from ..models import UserSettings
from .gmail_service import process_gmail_invoices

# Global flag to control the background thread
_stop_event = threading.Event()
_background_thread: Optional[threading.Thread] = None

# Check interval in seconds (5 minutes)
CHECK_INTERVAL = 300


def check_all_gmail_accounts():
    """Check Gmail for all users with Gmail enabled"""
    db = SessionLocal()
    try:
        # Get all users with Gmail enabled
        settings_list = db.query(UserSettings).filter(
            UserSettings.gmail_enabled == True,
            UserSettings.gmail_access_token != None
        ).all()
        
        for settings in settings_list:
            try:
                # Only check if it's been more than 5 minutes since last check
                if settings.gmail_last_check:
                    time_since_check = datetime.utcnow() - settings.gmail_last_check
                    if time_since_check < timedelta(minutes=5):
                        continue
                
                print(f"Checking Gmail for user {settings.user_id}")
                result = process_gmail_invoices(db, settings.user_id, settings)
                
                if result.get("processed", 0) > 0:
                    print(f"Found {result['processed']} new invoices for user {settings.user_id}")
                    
            except Exception as e:
                print(f"Error checking Gmail for user {settings.user_id}: {e}")
                
    except Exception as e:
        print(f"Error in background Gmail check: {e}")
    finally:
        db.close()


def background_worker():
    """Background worker that runs periodic tasks"""
    print("Starting background worker for Gmail checking...")
    
    while not _stop_event.is_set():
        try:
            check_all_gmail_accounts()
        except Exception as e:
            print(f"Background worker error: {e}")
        
        # Wait for the next check interval or until stop is signaled
        _stop_event.wait(CHECK_INTERVAL)
    
    print("Background worker stopped")


def start_background_tasks():
    """Start the background task thread"""
    global _background_thread
    
    if _background_thread is not None and _background_thread.is_alive():
        print("Background tasks already running")
        return
    
    _stop_event.clear()
    _background_thread = threading.Thread(target=background_worker, daemon=True)
    _background_thread.start()
    print("Background tasks started")


def stop_background_tasks():
    """Stop the background task thread"""
    global _background_thread
    
    if _background_thread is None:
        return
    
    _stop_event.set()
    _background_thread.join(timeout=5)
    _background_thread = None
    print("Background tasks stopped")

