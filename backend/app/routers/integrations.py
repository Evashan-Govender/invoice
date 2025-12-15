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

