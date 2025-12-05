from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from pydantic import BaseModel
from datetime import datetime
from ..database import get_db
from ..models import User, UserSettings
from ..auth import get_current_user

router = APIRouter(prefix="/settings", tags=["settings"])

class SettingsResponse(BaseModel):
    gemini_api_key_set: bool
    gmail_enabled: bool
    gmail_email: Optional[str] = None
    gmail_connected: bool
    smtp_enabled: bool
    smtp_email: Optional[str] = None
    smtp_connected: bool
    auto_process: bool
    email_notifications: bool
    auto_sync_erp: bool
    
    class Config:
        from_attributes = True

class GeminiKeyRequest(BaseModel):
    api_key: str

class PreferencesRequest(BaseModel):
    auto_process: Optional[bool] = None
    email_notifications: Optional[bool] = None
    auto_sync_erp: Optional[bool] = None

class GmailConnectRequest(BaseModel):
    access_token: str
    refresh_token: Optional[str] = None
    token_expiry: str  # ISO format string
    email: str

class SMTPConnectRequest(BaseModel):
    email: str
    password: str
    imap_host: str
    imap_port: int = 993
    smtp_host: str
    smtp_port: int = 587
    use_ssl: bool = True

class SMTPTestRequest(BaseModel):
    email: str
    password: str
    imap_host: str
    imap_port: int = 993
    use_ssl: bool = True

class EmailProviderResponse(BaseModel):
    id: str
    name: str
    imap_host: str
    imap_port: int
    smtp_host: str
    smtp_port: int
    use_ssl: bool
    help_url: str

def get_or_create_settings(db: Session, user_id: int) -> UserSettings:
    """Get or create user settings"""
    settings = db.query(UserSettings).filter(UserSettings.user_id == user_id).first()
    if not settings:
        settings = UserSettings(user_id=user_id)
        db.add(settings)
        db.commit()
        db.refresh(settings)
    return settings

@router.get("", response_model=SettingsResponse)
def get_settings(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get user settings"""
    settings = get_or_create_settings(db, current_user.id)
    
    return {
        "gemini_api_key_set": bool(settings.gemini_api_key),
        "gmail_enabled": settings.gmail_enabled,
        "gmail_email": settings.gmail_email,
        "gmail_connected": bool(settings.gmail_access_token),
        "smtp_enabled": settings.smtp_enabled,
        "smtp_email": settings.smtp_email,
        "smtp_connected": bool(settings.smtp_password and settings.imap_host),
        "auto_process": settings.auto_process,
        "email_notifications": settings.email_notifications,
        "auto_sync_erp": settings.auto_sync_erp,
    }

@router.post("/gemini-key")
def save_gemini_key(
    request: GeminiKeyRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Save Gemini API key"""
    settings = get_or_create_settings(db, current_user.id)
    settings.gemini_api_key = request.api_key
    db.commit()
    
    return {"message": "Gemini API key saved successfully", "success": True}

@router.delete("/gemini-key")
def delete_gemini_key(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Delete Gemini API key"""
    settings = get_or_create_settings(db, current_user.id)
    settings.gemini_api_key = None
    db.commit()
    
    return {"message": "Gemini API key deleted", "success": True}

@router.get("/gemini-key")
def get_gemini_key(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get Gemini API key (masked)"""
    settings = get_or_create_settings(db, current_user.id)
    
    if settings.gemini_api_key:
        # Return masked key
        key = settings.gemini_api_key
        masked = key[:8] + "*" * (len(key) - 12) + key[-4:] if len(key) > 12 else "****"
        return {"api_key_masked": masked, "is_set": True}
    
    return {"api_key_masked": None, "is_set": False}

@router.put("/preferences")
def update_preferences(
    request: PreferencesRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Update user preferences"""
    settings = get_or_create_settings(db, current_user.id)
    
    if request.auto_process is not None:
        settings.auto_process = request.auto_process
    if request.email_notifications is not None:
        settings.email_notifications = request.email_notifications
    if request.auto_sync_erp is not None:
        settings.auto_sync_erp = request.auto_sync_erp
    
    db.commit()
    
    return {"message": "Preferences updated", "success": True}

@router.post("/gmail/connect")
def connect_gmail(
    request: GmailConnectRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Connect Gmail account"""
    settings = get_or_create_settings(db, current_user.id)
    
    # Parse token expiry from ISO string
    try:
        token_expiry = datetime.fromisoformat(request.token_expiry.replace('Z', '+00:00'))
    except ValueError:
        token_expiry = datetime.utcnow()
    
    settings.gmail_enabled = True
    settings.gmail_access_token = request.access_token
    settings.gmail_refresh_token = request.refresh_token
    settings.gmail_token_expiry = token_expiry
    settings.gmail_email = request.email
    
    db.commit()
    
    return {"message": "Gmail connected successfully", "success": True}

@router.delete("/gmail/disconnect")
def disconnect_gmail(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Disconnect Gmail account"""
    settings = get_or_create_settings(db, current_user.id)
    
    settings.gmail_enabled = False
    settings.gmail_access_token = None
    settings.gmail_refresh_token = None
    settings.gmail_token_expiry = None
    settings.gmail_email = None
    settings.gmail_last_check = None
    
    db.commit()
    
    return {"message": "Gmail disconnected", "success": True}

@router.post("/gmail/toggle")
def toggle_gmail(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Toggle Gmail integration on/off"""
    settings = get_or_create_settings(db, current_user.id)
    
    if not settings.gmail_access_token:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Gmail not connected. Please connect Gmail first."
        )
    
    settings.gmail_enabled = not settings.gmail_enabled
    db.commit()
    
    return {
        "message": f"Gmail integration {'enabled' if settings.gmail_enabled else 'disabled'}",
        "enabled": settings.gmail_enabled,
        "success": True
    }

@router.post("/gmail/check")
def check_gmail_for_invoices(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Manually trigger Gmail inbox check for invoices"""
    from ..services.gmail_service import process_gmail_invoices
    
    settings = get_or_create_settings(db, current_user.id)
    
    if not settings.gmail_enabled or not settings.gmail_access_token:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Gmail not connected or not enabled"
        )
    
    result = process_gmail_invoices(db, current_user.id, settings)
    
    if not result["success"]:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=result.get("error", "Unknown error")
        )
    
    return result


# ================== SMTP/IMAP Integration ==================

@router.get("/smtp/providers")
def get_email_providers():
    """Get list of supported email providers with their IMAP/SMTP configs"""
    from ..services.imap_service import EMAIL_PROVIDERS
    
    return [
        {
            "id": provider_id,
            "name": config["name"],
            "imap_host": config["imap_host"],
            "imap_port": config["imap_port"],
            "smtp_host": config["smtp_host"],
            "smtp_port": config["smtp_port"],
            "use_ssl": config["use_ssl"],
            "help_url": config["help_url"]
        }
        for provider_id, config in EMAIL_PROVIDERS.items()
    ]


@router.post("/smtp/test")
def test_smtp_connection(
    request: SMTPTestRequest,
    current_user: User = Depends(get_current_user)
):
    """Test SMTP/IMAP connection"""
    from ..services.imap_service import test_smtp_connection as do_test
    
    result = do_test(
        email_address=request.email,
        password=request.password,
        imap_host=request.imap_host,
        imap_port=request.imap_port,
        use_ssl=request.use_ssl
    )
    
    return result


@router.post("/smtp/connect")
def connect_smtp(
    request: SMTPConnectRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Connect SMTP/IMAP email account"""
    from ..services.imap_service import test_smtp_connection as do_test
    
    # First test the connection
    result = do_test(
        email_address=request.email,
        password=request.password,
        imap_host=request.imap_host,
        imap_port=request.imap_port,
        use_ssl=request.use_ssl
    )
    
    if not result["success"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Connection test failed: {result.get('message', 'Unknown error')}"
        )
    
    settings = get_or_create_settings(db, current_user.id)
    
    settings.smtp_enabled = True
    settings.smtp_email = request.email
    settings.smtp_password = request.password  # In production, encrypt this!
    settings.imap_host = request.imap_host
    settings.imap_port = request.imap_port
    settings.smtp_host = request.smtp_host
    settings.smtp_port = request.smtp_port
    settings.smtp_use_ssl = request.use_ssl
    
    db.commit()
    
    return {"message": "Email connected successfully", "success": True}


@router.delete("/smtp/disconnect")
def disconnect_smtp(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Disconnect SMTP/IMAP account"""
    settings = get_or_create_settings(db, current_user.id)
    
    settings.smtp_enabled = False
    settings.smtp_email = None
    settings.smtp_password = None
    settings.imap_host = None
    settings.imap_port = None
    settings.smtp_host = None
    settings.smtp_port = None
    settings.smtp_use_ssl = True
    settings.smtp_last_check = None
    
    db.commit()
    
    return {"message": "Email disconnected", "success": True}


@router.post("/smtp/toggle")
def toggle_smtp(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Toggle SMTP/IMAP integration on/off"""
    settings = get_or_create_settings(db, current_user.id)
    
    if not settings.smtp_password or not settings.imap_host:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="SMTP/IMAP not connected. Please connect email first."
        )
    
    settings.smtp_enabled = not settings.smtp_enabled
    db.commit()
    
    return {
        "message": f"Email integration {'enabled' if settings.smtp_enabled else 'disabled'}",
        "enabled": settings.smtp_enabled,
        "success": True
    }


@router.post("/smtp/check")
def check_smtp_for_invoices(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Manually trigger SMTP/IMAP inbox check for invoices"""
    from ..services.imap_service import process_imap_invoices
    
    settings = get_or_create_settings(db, current_user.id)
    
    if not settings.smtp_enabled or not settings.smtp_password:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email not connected or not enabled"
        )
    
    result = process_imap_invoices(db, current_user.id, settings)
    
    if not result["success"]:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=result.get("error", "Unknown error")
        )
    
    return result

