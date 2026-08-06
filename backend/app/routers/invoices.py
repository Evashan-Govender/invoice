from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File, Query
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from pydantic import BaseModel
from datetime import datetime
from ..database import get_db
from ..models import User, Invoice, InvoiceData
from ..auth import get_current_user, decode_token
from ..services.invoice_service import InvoiceService

router = APIRouter(prefix="/invoices", tags=["invoices"])
invoice_service = InvoiceService()

class InvoiceResponse(BaseModel):
    id: int
    filename: str
    status: str
    upload_date: datetime
    error_message: Optional[str] = None
    is_duplicate: Optional[bool] = False
    duplicate_of_id: Optional[int] = None
    category: Optional[str] = None
    detected_language: Optional[str] = None
    confidence_score: Optional[float] = None  # Overall confidence score
    vendor_name: Optional[str] = None
    total_amount: Optional[float] = None
    
    class Config:
        from_attributes = True

class InvoiceDataResponse(BaseModel):
    id: int
    invoice_id: int
    extracted_json: Optional[dict] = None
    amended_json: Optional[dict] = None
    confidence_scores: Optional[dict] = None
    category: Optional[str] = None
    detected_language: Optional[str] = None
    is_duplicate: Optional[bool] = False
    duplicate_of_id: Optional[int] = None
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True

class InvoiceDetailResponse(BaseModel):
    invoice: InvoiceResponse
    data: Optional[InvoiceDataResponse] = None

class AmendDataRequest(BaseModel):
    amended_data: dict

@router.post("/upload", response_model=List[InvoiceResponse], status_code=status.HTTP_201_CREATED)
async def upload_invoices(
    files: List[UploadFile] = File(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Upload invoice files (PDF or images, max 5 files)
    
    Supported formats:
    - PDF (.pdf)
    - Images (.jpg, .jpeg, .png, .gif, .webp, .bmp, .tiff)
    """
    # Validate file count
    if len(files) > 5:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Maximum 5 files allowed per upload"
        )
    
    # Validate file types
    for file in files:
        filename = invoice_service.get_safe_filename(file.filename)
        if not invoice_service.is_supported_file(filename):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"File {filename} is not supported. Supported formats: PDF, JPG, JPEG, PNG, GIF, WEBP, BMP, TIFF"
            )
    
    # Save files and create records
    invoices = []
    for file in files:
        try:
            filename = invoice_service.get_safe_filename(file.filename)
            # Save file
            file_path = invoice_service.save_uploaded_file(file, current_user.id)
            
            # Create invoice record
            invoice = invoice_service.create_invoice_record(
                db, current_user, filename, file_path
            )
            invoices.append(invoice)
        except Exception as e:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Error uploading {filename}: {str(e)}"
            )
    
    return invoices

@router.post("/{invoice_id}/process", response_model=InvoiceDataResponse)
def process_invoice(
    invoice_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Process an invoice using Gemini Vision"""
    try:
        # Get invoice (with user verification)
        invoice = invoice_service.get_invoice_by_id(db, invoice_id, current_user.id)
        
        # Process invoice
        invoice_data = invoice_service.process_invoice(db, invoice)
        
        return invoice_data
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )

@router.get("", response_model=List[InvoiceResponse])
def list_invoices(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get all invoices for current user with AI-extracted info"""
    invoices = invoice_service.get_user_invoices(db, current_user.id)
    
    # Build response with AI features from InvoiceData
    response = []
    for invoice in invoices:
        # Get extracted data fields
        extracted_json = invoice.data.extracted_json if invoice.data and invoice.data.extracted_json else {}
        amended_json = invoice.data.amended_json if invoice.data and invoice.data.amended_json else {}
        data_json = amended_json or extracted_json
        
        # Get confidence score (overall)
        confidence_scores = invoice.data.confidence_scores if invoice.data else None
        overall_confidence = None
        if confidence_scores and isinstance(confidence_scores, dict):
            overall_confidence = confidence_scores.get('overall')
        
        invoice_dict = {
            "id": invoice.id,
            "filename": invoice.filename,
            "status": invoice.status.value if hasattr(invoice.status, 'value') else invoice.status,
            "upload_date": invoice.upload_date,
            "error_message": invoice.error_message,
            "is_duplicate": invoice.data.is_duplicate if invoice.data else False,
            "duplicate_of_id": invoice.data.duplicate_of_id if invoice.data else None,
            "category": invoice.data.category if invoice.data else None,
            "detected_language": invoice.data.detected_language if invoice.data else None,
            "confidence_score": overall_confidence,
            "vendor_name": data_json.get('vendor_name') if data_json else None,
            "total_amount": data_json.get('total_amount') if data_json else None
        }
        response.append(invoice_dict)
    
    return response

@router.get("/{invoice_id}", response_model=InvoiceDetailResponse)
def get_invoice(
    invoice_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get invoice details with extracted data"""
    try:
        invoice = invoice_service.get_invoice_by_id(db, invoice_id, current_user.id)
        
        # Get invoice data if it exists
        invoice_data = db.query(InvoiceData).filter(
            InvoiceData.invoice_id == invoice_id
        ).first()
        
        return {
            "invoice": invoice,
            "data": invoice_data
        }
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e)
        )

@router.put("/{invoice_id}/data", response_model=InvoiceDataResponse)
def update_invoice_data(
    invoice_id: int,
    request: AmendDataRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Update invoice data with user amendments"""
    try:
        # Verify user owns this invoice
        invoice = invoice_service.get_invoice_by_id(db, invoice_id, current_user.id)
        
        # Update data
        invoice_data = invoice_service.update_invoice_data(
            db, invoice_id, request.amended_data
        )
        
        return invoice_data
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )

@router.delete("/{invoice_id}")
def delete_invoice(
    invoice_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Delete an invoice"""
    try:
        invoice_service.delete_invoice(db, invoice_id, current_user.id)
        return {"message": "Invoice deleted successfully", "success": True}
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e)
        )

@router.get("/{invoice_id}/pdf")
def get_invoice_pdf(
    invoice_id: int,
    token: Optional[str] = Query(None),
    db: Session = Depends(get_db)
):
    """Serve the PDF/image file for an invoice
    
    Accepts authentication via query parameter for iframe embedding
    """
    try:
        # Validate token from query parameter
        if not token:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Token required"
            )
        
        # Decode token and get user_id
        payload = decode_token(token)
        user_id_str = payload.get("sub")
        if not user_id_str:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid token"
            )
        
        user_id = int(user_id_str)
        
        # Get invoice with user verification
        invoice = invoice_service.get_invoice_by_id(db, invoice_id, user_id)
        
        # Determine media type based on file extension
        import os
        ext = os.path.splitext(invoice.filename.lower())[1]
        media_types = {
            '.pdf': 'application/pdf',
            '.jpg': 'image/jpeg',
            '.jpeg': 'image/jpeg',
            '.png': 'image/png',
            '.gif': 'image/gif',
            '.webp': 'image/webp',
            '.bmp': 'image/bmp',
            '.tiff': 'image/tiff'
        }
        media_type = media_types.get(ext, 'application/octet-stream')
        
        return FileResponse(
            invoice.pdf_path,
            media_type=media_type,
            headers={
                "Content-Disposition": f"inline; filename={invoice.filename}"
            }
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e)
        )


# ============================================
# AI Enhancement Endpoints
# ============================================

class CorrectionRequest(BaseModel):
    field_name: str
    original_value: Optional[str] = None
    corrected_value: str
    vendor_name: Optional[str] = None

class VendorResponse(BaseModel):
    id: int
    name: str
    address: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    tax_id: Optional[str] = None
    default_category: Optional[str] = None
    invoice_count: int
    total_spent: float

@router.get("/vendors/search")
def search_vendors(
    q: str = Query(..., min_length=1, description="Partial vendor name to search"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Search vendors for auto-complete suggestions
    
    Returns vendors matching the partial name, ordered by invoice count
    """
    suggestions = invoice_service.get_vendor_suggestions(db, current_user.id, q)
    return {"vendors": suggestions}


@router.post("/{invoice_id}/corrections")
def record_correction(
    invoice_id: int,
    request: CorrectionRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Record a user correction for AI learning
    
    This helps improve future extractions by tracking patterns in user corrections
    """
    try:
        # Verify user owns this invoice
        invoice = invoice_service.get_invoice_by_id(db, invoice_id, current_user.id)
        
        correction = invoice_service.record_field_correction(
            db=db,
            user_id=current_user.id,
            invoice_id=invoice_id,
            field_name=request.field_name,
            original_value=request.original_value,
            corrected_value=request.corrected_value,
            vendor_name=request.vendor_name
        )
        
        return {
            "message": "Correction recorded for AI learning",
            "correction_id": correction.id,
            "success": True
        }
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )


@router.get("/ai/learning-stats")
def get_learning_stats(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get AI learning statistics
    
    Shows how many corrections have been made and vendor recognition stats
    """
    stats = invoice_service.get_learning_stats(db, current_user.id)
    return stats


@router.get("/ai/categories")
def get_expense_categories():
    """Get list of available expense categories for invoices"""
    from ..services.gemini_service import EXPENSE_CATEGORIES
    return {"categories": EXPENSE_CATEGORIES}


# Supported languages for translation
SUPPORTED_LANGUAGES = [
    "English", "Spanish", "French", "German", "Italian", "Portuguese", 
    "Dutch", "Russian", "Chinese", "Japanese", "Korean", "Arabic", 
    "Hindi", "Turkish", "Polish", "Swedish", "Norwegian", "Danish",
    "Finnish", "Greek", "Czech", "Romanian", "Hungarian", "Thai",
    "Vietnamese", "Indonesian", "Malay", "Hebrew", "Ukrainian"
]

@router.get("/ai/languages")
def get_supported_languages():
    """Get list of supported languages for translation"""
    return {"languages": SUPPORTED_LANGUAGES}


class TranslateRequest(BaseModel):
    invoice_data: dict
    target_language: str


@router.post("/ai/translate")
def translate_invoice_data(
    request: TranslateRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Translate invoice data to a different language using AI
    
    Translates text fields while preserving numbers, dates, and structure.
    """
    try:
        # Get user's API key
        api_key = invoice_service.get_user_api_key(db, current_user.id)
        
        from ..services.gemini_service import GeminiService
        gemini = GeminiService(api_key)
        
        translated_data = gemini.translate_invoice_data(
            request.invoice_data, 
            request.target_language
        )
        
        return {
            "success": True,
            "translated_data": translated_data,
            "target_language": request.target_language
        }
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )


@router.get("/{invoice_id}/duplicates")
def check_duplicates(
    invoice_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Check if an invoice has potential duplicates
    
    Returns information about similar invoices in the system
    """
    try:
        # Verify user owns this invoice
        invoice = invoice_service.get_invoice_by_id(db, invoice_id, current_user.id)
        
        # Get invoice data
        invoice_data = db.query(InvoiceData).filter(
            InvoiceData.invoice_id == invoice_id
        ).first()
        
        if not invoice_data or not invoice_data.extracted_json:
            return {"has_duplicates": False, "duplicates": []}
        
        result = {
            "is_duplicate": invoice_data.is_duplicate,
            "duplicate_of_id": invoice_data.duplicate_of_id,
            "duplicates": []
        }
        
        # If marked as duplicate, get info about the original
        if invoice_data.duplicate_of_id:
            original = invoice_service.get_invoice_by_id(
                db, invoice_data.duplicate_of_id, current_user.id
            )
            result["duplicates"].append({
                "id": original.id,
                "filename": original.filename,
                "upload_date": original.upload_date.isoformat(),
                "relationship": "original"
            })
        
        # Find invoices that are duplicates of this one
        duplicate_data = db.query(InvoiceData).filter(
            InvoiceData.duplicate_of_id == invoice_id
        ).all()
        
        for dup in duplicate_data:
            dup_invoice = db.query(Invoice).filter(
                Invoice.id == dup.invoice_id,
                Invoice.user_id == current_user.id
            ).first()
            if dup_invoice:
                result["duplicates"].append({
                    "id": dup_invoice.id,
                    "filename": dup_invoice.filename,
                    "upload_date": dup_invoice.upload_date.isoformat(),
                    "relationship": "duplicate"
                })
        
        return result
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e)
        )

