from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Dict, List, Optional
from datetime import datetime

from ..database import get_db
from ..models import User
from ..auth import get_current_user
from ..services.erp_integration import ERPIntegrationService

router = APIRouter(prefix="/integrations", tags=["Integrations"])


class IntegrationConfig(BaseModel):
    provider: str
    apiKey: str
    apiSecret: str
    orgId: Optional[str] = None
    autoSync: bool = False


class TestConnectionRequest(BaseModel):
    provider: str
    config: Dict


class SyncInvoiceRequest(BaseModel):
    provider: str
    config: Dict
    invoice_data: Dict


@router.post("/test")
def test_integration_connection(
    request: TestConnectionRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Test connection to an ERP provider"""
    try:
        is_connected = ERPIntegrationService.test_connection(
            request.provider,
            request.config
        )
        
        return {
            "success": is_connected,
            "message": f"Connection to {request.provider} {'successful' if is_connected else 'failed'}"
        }
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error testing connection: {str(e)}"
        )


@router.post("/sync")
def sync_invoice_to_erp(
    request: SyncInvoiceRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Sync a single invoice to an ERP system"""
    try:
        from ..models import ERPIntegration
        import requests
        from datetime import timedelta
        
        # Get ERP integration from database for this user
        integration = db.query(ERPIntegration).filter(
            ERPIntegration.user_id == current_user.id,
            ERPIntegration.provider == request.provider.lower(),
            ERPIntegration.is_active == True
        ).first()
        
        if not integration:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"{request.provider} is not connected. Please connect it first in Settings."
            )
        
        if not integration.access_token:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"{request.provider} OAuth token not found. Please reconnect in Settings."
            )
        
        # Check if token is expired or about to expire (within 5 minutes)
        if integration.token_expiry and integration.token_expiry < datetime.utcnow() + timedelta(minutes=5):
            print(f"🔄 Token expired or expiring soon for {request.provider}, refreshing...")
            
            # Refresh token for Xero
            if request.provider.lower() == "xero" and integration.refresh_token:
                try:
                    XERO_TOKEN_URL = "https://identity.xero.com/connect/token"
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
                    
                    if response.ok:
                        tokens = response.json()
                        integration.access_token = tokens.get("access_token")
                        integration.refresh_token = tokens.get("refresh_token", integration.refresh_token)
                        integration.token_expiry = datetime.utcnow() + timedelta(seconds=tokens.get("expires_in", 1800))
                        db.commit()
                        print(f"✅ Token refreshed successfully for {request.provider}")
                    else:
                        print(f"❌ Failed to refresh token: {response.text}")
                        raise HTTPException(
                            status_code=status.HTTP_401_UNAUTHORIZED,
                            detail=f"{request.provider} token expired and refresh failed. Please reconnect in Settings."
                        )
                except Exception as e:
                    print(f"❌ Error refreshing token: {str(e)}")
                    raise HTTPException(
                        status_code=status.HTTP_401_UNAUTHORIZED,
                        detail=f"{request.provider} token expired and refresh failed. Please reconnect in Settings."
                    )
            else:
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail=f"{request.provider} token expired. Please reconnect in Settings."
                )
        
        # Build config with OAuth tokens from database
        config = {
            "apiKey": integration.access_token,  # OAuth access token
            "apiSecret": integration.refresh_token or "",  # Not used for Xero, but kept for compatibility
            "orgId": integration.tenant_id,  # Xero tenant ID
        }
        
        result = ERPIntegrationService.sync_invoice(
            request.provider,
            config,
            request.invoice_data
        )
        
        # Update sync count
        integration.sync_count += 1
        integration.last_sync = datetime.utcnow()
        db.commit()
        
        return result
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error syncing invoice: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error syncing invoice: {str(e)}"
        )


@router.post("/sync-batch")
def sync_multiple_invoices(
    provider: str,
    config: Dict,
    invoices: List[Dict],
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Sync multiple invoices to an ERP system"""
    try:
        results = []
        for invoice_data in invoices:
            result = ERPIntegrationService.sync_invoice(
                provider,
                config,
                invoice_data
            )
            results.append(result)
        
        success_count = sum(1 for r in results if r.get("success"))
        
        return {
            "total": len(results),
            "successful": success_count,
            "failed": len(results) - success_count,
            "results": results
        }
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error syncing invoices: {str(e)}"
        )


@router.get("/status")
def get_integrations_status(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get all ERP integrations status for the current user"""
    try:
        from ..models import ERPIntegration
        
        integrations = db.query(ERPIntegration).filter(
            ERPIntegration.user_id == current_user.id
        ).all()
        
        # Build response with integration status
        result = []
        for integration in integrations:
            result.append({
                "id": integration.provider,
                "provider": integration.provider,
                "status": "connected" if integration.is_active else "disconnected",
                "is_active": integration.is_active,
                "tenant_id": integration.tenant_id,
                "org_id": integration.org_id,
                "auto_sync": integration.auto_sync,
                "last_sync": integration.last_sync.isoformat() if integration.last_sync else None,
                "sync_count": integration.sync_count,
                "created_at": integration.created_at.isoformat() if integration.created_at else None,
            })
        
        return {"integrations": result}
    except Exception as e:
        print(f"Error getting integrations status: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error getting integrations status: {str(e)}"
        )

