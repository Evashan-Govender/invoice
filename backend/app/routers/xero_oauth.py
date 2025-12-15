"""
Xero OAuth 2.0 Integration Router
Handles OAuth flow for connecting Xero accounts
"""
from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import RedirectResponse
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional
import requests
import os
from datetime import datetime, timedelta

from ..database import get_db
from ..models import User, ERPIntegration
from ..auth import get_current_user

router = APIRouter(prefix="/xero", tags=["Xero OAuth"])

# Xero OAuth configuration
XERO_CLIENT_ID = os.getenv("XERO_CLIENT_ID")
XERO_CLIENT_SECRET = os.getenv("XERO_CLIENT_SECRET")
XERO_REDIRECT_URI = os.getenv("XERO_REDIRECT_URI", "http://localhost:3000/settings")
FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:3000")

XERO_AUTH_URL = "https://login.xero.com/identity/connect/authorize"
XERO_TOKEN_URL = "https://identity.xero.com/connect/token"
XERO_CONNECTIONS_URL = "https://api.xero.com/connections"

# Scopes required for invoice management
XERO_SCOPES = [
    "offline_access",  # For refresh token
    "accounting.transactions",  # Create and manage bills
    "accounting.contacts.read",  # Read supplier information
    "accounting.settings.read",  # Read organization settings
]


class XeroAuthRequest(BaseModel):
    state: Optional[str] = None


class XeroDisconnectRequest(BaseModel):
    pass


@router.get("/authorize")
def authorize_xero(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Initiate Xero OAuth 2.0 authorization flow
    Returns the authorization URL to redirect the user to
    """
    if not XERO_CLIENT_ID:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Xero OAuth not configured. Please set XERO_CLIENT_ID in environment."
        )
    
    # Build authorization URL
    params = {
        "response_type": "code",
        "client_id": XERO_CLIENT_ID,
        "redirect_uri": XERO_REDIRECT_URI,
        "scope": " ".join(XERO_SCOPES),
        "state": str(current_user.id),  # Use user ID as state for security
    }
    
    auth_url = f"{XERO_AUTH_URL}?{'&'.join([f'{k}={v}' for k, v in params.items()])}"
    
    return {
        "authorization_url": auth_url,
        "redirect_to": auth_url
    }


@router.get("/callback")
def xero_callback(
    code: str = Query(..., description="Authorization code from Xero"),
    state: Optional[str] = Query(None, description="State parameter for security"),
    error: Optional[str] = Query(None, description="Error from Xero"),
    db: Session = Depends(get_db)
):
    """
    Handle OAuth callback from Xero
    Exchange authorization code for access token
    """
    if error:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Xero authorization failed: {error}"
        )
    
    if not code:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No authorization code received from Xero"
        )
    
    # Exchange code for tokens
    try:
        token_data = {
            "grant_type": "authorization_code",
            "code": code,
            "redirect_uri": XERO_REDIRECT_URI,
        }
        
        response = requests.post(
            XERO_TOKEN_URL,
            data=token_data,
            auth=(XERO_CLIENT_ID, XERO_CLIENT_SECRET),
            headers={"Content-Type": "application/x-www-form-urlencoded"}
        )
        
        if not response.ok:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Failed to exchange code for tokens: {response.text}"
            )
        
        tokens = response.json()
        access_token = tokens.get("access_token")
        refresh_token = tokens.get("refresh_token")
        expires_in = tokens.get("expires_in", 1800)  # Default 30 minutes
        
        # Get tenant/organization connections
        connections_response = requests.get(
            XERO_CONNECTIONS_URL,
            headers={"Authorization": f"Bearer {access_token}"}
        )
        
        if not connections_response.ok:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Failed to get Xero tenant connections"
            )
        
        connections = connections_response.json()
        if not connections:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="No Xero organizations found for this account"
            )
        
        # Use the first tenant/organization
        tenant = connections[0]
        tenant_id = tenant.get("tenantId")
        tenant_name = tenant.get("tenantName")
        
        # Get user from state
        if state:
            user_id = int(state)
            user = db.query(User).filter(User.id == user_id).first()
            if not user:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="User not found"
                )
        else:
            # Fallback: This shouldn't happen in production
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid state parameter"
            )
        
        # Store or update integration
        integration = db.query(ERPIntegration).filter(
            ERPIntegration.user_id == user.id,
            ERPIntegration.provider == "xero"
        ).first()
        
        if integration:
            # Update existing
            integration.access_token = access_token
            integration.refresh_token = refresh_token
            integration.token_expiry = datetime.utcnow() + timedelta(seconds=expires_in)
            integration.tenant_id = tenant_id
            integration.is_active = True
            integration.config_data = {
                "tenant_name": tenant_name,
                "all_tenants": connections
            }
        else:
            # Create new
            integration = ERPIntegration(
                user_id=user.id,
                provider="xero",
                access_token=access_token,
                refresh_token=refresh_token,
                token_expiry=datetime.utcnow() + timedelta(seconds=expires_in),
                tenant_id=tenant_id,
                is_active=True,
                config_data={
                    "tenant_name": tenant_name,
                    "all_tenants": connections
                }
            )
            db.add(integration)
        
        db.commit()
        
        # Redirect back to frontend settings page
        return RedirectResponse(
            url=f"{FRONTEND_URL}/settings?xero_success=true&tenant={tenant_name}",
            status_code=302
        )
        
    except requests.RequestException as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error communicating with Xero: {str(e)}"
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error processing Xero callback: {str(e)}"
        )


@router.post("/disconnect")
def disconnect_xero(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Disconnect Xero integration"""
    integration = db.query(ERPIntegration).filter(
        ERPIntegration.user_id == current_user.id,
        ERPIntegration.provider == "xero"
    ).first()
    
    if not integration:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Xero integration not found"
        )
    
    # Revoke tokens at Xero (optional but recommended)
    if integration.access_token:
        try:
            requests.post(
                "https://identity.xero.com/connect/revocation",
                data={"token": integration.access_token},
                auth=(XERO_CLIENT_ID, XERO_CLIENT_SECRET)
            )
        except:
            pass  # Continue even if revocation fails
    
    # Delete integration
    db.delete(integration)
    db.commit()
    
    return {"message": "Xero disconnected successfully", "success": True}


@router.get("/status")
def get_xero_status(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get Xero integration status"""
    integration = db.query(ERPIntegration).filter(
        ERPIntegration.user_id == current_user.id,
        ERPIntegration.provider == "xero"
    ).first()
    
    if not integration or not integration.is_active:
        return {
            "connected": False,
            "tenant_id": None,
            "tenant_name": None,
            "last_sync": None
        }
    
    # Check if token is expired
    is_expired = integration.token_expiry and integration.token_expiry < datetime.utcnow()
    
    return {
        "connected": True,
        "is_expired": is_expired,
        "tenant_id": integration.tenant_id,
        "tenant_name": integration.config_data.get("tenant_name") if integration.config_data else None,
        "last_sync": integration.last_sync.isoformat() if integration.last_sync else None,
        "sync_count": integration.sync_count,
        "auto_sync": integration.auto_sync
    }


@router.post("/refresh")
def refresh_xero_token(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Refresh Xero access token using refresh token"""
    integration = db.query(ERPIntegration).filter(
        ERPIntegration.user_id == current_user.id,
        ERPIntegration.provider == "xero"
    ).first()
    
    if not integration or not integration.refresh_token:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Xero integration not found or no refresh token available"
        )
    
    try:
        token_data = {
            "grant_type": "refresh_token",
            "refresh_token": integration.refresh_token,
        }
        
        response = requests.post(
            XERO_TOKEN_URL,
            data=token_data,
            auth=(XERO_CLIENT_ID, XERO_CLIENT_SECRET),
            headers={"Content-Type": "application/x-www-form-urlencoded"}
        )
        
        if not response.ok:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Failed to refresh token: {response.text}"
            )
        
        tokens = response.json()
        integration.access_token = tokens.get("access_token")
        integration.refresh_token = tokens.get("refresh_token", integration.refresh_token)
        integration.token_expiry = datetime.utcnow() + timedelta(seconds=tokens.get("expires_in", 1800))
        
        db.commit()
        
        return {
            "message": "Token refreshed successfully",
            "success": True,
            "expires_at": integration.token_expiry.isoformat()
        }
        
    except requests.RequestException as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error refreshing Xero token: {str(e)}"
        )

