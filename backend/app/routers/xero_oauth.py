"""
Xero OAuth 2.0 Integration Router
Handles OAuth flow for connecting Xero accounts with per-user credentials
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

# Xero OAuth endpoints
XERO_AUTH_URL = "https://login.xero.com/identity/connect/authorize"
XERO_TOKEN_URL = "https://identity.xero.com/connect/token"
XERO_CONNECTIONS_URL = "https://api.xero.com/connections"
FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:3000")

# Scopes required for invoice management
XERO_SCOPES = [
    "offline_access",  # For refresh token
    "accounting.transactions",  # Create and manage bills
    "accounting.contacts.read",  # Read supplier information
    "accounting.settings.read",  # Read organization settings
]


class XeroConfigRequest(BaseModel):
    client_id: str
    client_secret: str
    redirect_uri: Optional[str] = None


class XeroAuthRequest(BaseModel):
    state: Optional[str] = None


class XeroDisconnectRequest(BaseModel):
    pass


@router.post("/config")
def save_xero_config(
    request: XeroConfigRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Save Xero OAuth configuration (Client ID, Secret) to database
    This allows per-user Xero app configuration
    """
    # Validate inputs
    if not request.client_id or not request.client_secret:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Client ID and Client Secret are required"
        )
    
    # Set redirect URI (use provided or default to frontend URL)
    redirect_uri = request.redirect_uri or f"{FRONTEND_URL}/settings"
    
    # Check if config already exists
    integration = db.query(ERPIntegration).filter(
        ERPIntegration.user_id == current_user.id,
        ERPIntegration.provider == "xero"
    ).first()
    
    if integration:
        # Update existing config
        integration.client_id = request.client_id
        integration.client_secret = request.client_secret
        integration.redirect_uri = redirect_uri
    else:
        # Create new config
        integration = ERPIntegration(
            user_id=current_user.id,
            provider="xero",
            client_id=request.client_id,
            client_secret=request.client_secret,
            redirect_uri=redirect_uri,
            is_active=False
        )
        db.add(integration)
    
    db.commit()
    
    return {
        "message": "Xero configuration saved successfully",
        "success": True,
        "redirect_uri": redirect_uri
    }


@router.get("/config")
def get_xero_config(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Get Xero OAuth configuration (without exposing client secret)
    """
    integration = db.query(ERPIntegration).filter(
        ERPIntegration.user_id == current_user.id,
        ERPIntegration.provider == "xero"
    ).first()
    
    if not integration or not integration.client_id:
        return {
            "configured": False,
            "client_id": None,
            "redirect_uri": None
        }
    
    return {
        "configured": True,
        "client_id": integration.client_id,
        "redirect_uri": integration.redirect_uri or f"{FRONTEND_URL}/settings",
        "is_connected": integration.is_active and integration.access_token is not None
    }


@router.get("/authorize")
def authorize_xero(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Initiate Xero OAuth 2.0 authorization flow
    Uses per-user credentials from database
    """
    # Get user's Xero config from database
    integration = db.query(ERPIntegration).filter(
        ERPIntegration.user_id == current_user.id,
        ERPIntegration.provider == "xero"
    ).first()
    
    if not integration or not integration.client_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Xero not configured. Please save your Xero Client ID and Secret first in Settings."
        )
    
    client_id = integration.client_id
    redirect_uri = integration.redirect_uri or f"{FRONTEND_URL}/settings"
    
    # Build authorization URL
    params = {
        "response_type": "code",
        "client_id": client_id,
        "redirect_uri": redirect_uri,
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
    
    # Get user from state
    if not state:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid state parameter"
        )
    
    try:
        user_id = int(state)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid state parameter"
        )
    
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    
    # Get user's Xero config
    integration = db.query(ERPIntegration).filter(
        ERPIntegration.user_id == user.id,
        ERPIntegration.provider == "xero"
    ).first()
    
    if not integration or not integration.client_id or not integration.client_secret:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Xero credentials not configured"
        )
    
    client_id = integration.client_id
    client_secret = integration.client_secret
    redirect_uri = integration.redirect_uri or f"{FRONTEND_URL}/settings"
    
    # Exchange code for tokens
    try:
        token_data = {
            "grant_type": "authorization_code",
            "code": code,
            "redirect_uri": redirect_uri,
        }
        
        response = requests.post(
            XERO_TOKEN_URL,
            data=token_data,
            auth=(client_id, client_secret),
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
        
        # Update the integration (already retrieved above) with OAuth tokens
        integration.access_token = access_token
        integration.refresh_token = refresh_token
        integration.token_expiry = datetime.utcnow() + timedelta(seconds=expires_in)
        integration.tenant_id = tenant_id
        integration.is_active = True
        integration.config_data = {
            "tenant_name": tenant_name,
            "all_tenants": connections
        }
        
        db.commit()
        
        # Redirect back to frontend settings page
        # Use the redirect_uri from config, or fall back to FRONTEND_URL
        frontend_url = FRONTEND_URL
        if integration.redirect_uri:
            # Extract base URL from redirect_uri (remove /settings)
            frontend_url = integration.redirect_uri.replace('/settings', '')
        
        return RedirectResponse(
            url=f"{frontend_url}/settings?xero_success=true&tenant={tenant_name}",
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
    """Disconnect Xero integration (clears tokens but keeps credentials)"""
    try:
        integration = db.query(ERPIntegration).filter(
            ERPIntegration.user_id == current_user.id,
            ERPIntegration.provider == "xero"
        ).first()
        
        if not integration:
            # No integration found - return success (already disconnected)
            return {
                "message": "Xero not connected",
                "success": True
            }
        
        # Revoke tokens at Xero (optional but recommended)
        if integration.access_token and integration.client_id and integration.client_secret:
            try:
                revoke_response = requests.post(
                    "https://identity.xero.com/connect/revocation",
                    data={"token": integration.access_token},
                    auth=(integration.client_id, integration.client_secret),
                    timeout=10
                )
                print(f"Token revocation response: {revoke_response.status_code}")
            except Exception as e:
                print(f"Token revocation failed (continuing anyway): {e}")
                # Continue even if revocation fails
        
        # Clear tokens but keep credentials for re-connection
        integration.access_token = None
        integration.refresh_token = None
        integration.token_expiry = None
        integration.tenant_id = None
        integration.is_active = False
        integration.config_data = None
        
        db.commit()
        
        return {
            "message": "Xero disconnected successfully",
            "success": True
        }
        
    except Exception as e:
        print(f"Error disconnecting Xero: {e}")
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to disconnect Xero: {str(e)}"
        )


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
    
    if not integration.client_id or not integration.client_secret:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Xero credentials not configured"
        )
    
    try:
        token_data = {
            "grant_type": "refresh_token",
            "refresh_token": integration.refresh_token,
        }
        
        response = requests.post(
            XERO_TOKEN_URL,
            data=token_data,
            auth=(integration.client_id, integration.client_secret),
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

