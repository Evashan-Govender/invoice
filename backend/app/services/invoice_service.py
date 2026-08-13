import os
import shutil
from typing import List, Optional, Dict, Tuple
from fastapi import UploadFile
from sqlalchemy.orm import Session
from sqlalchemy import func
from ..models import Invoice, InvoiceData, InvoiceStatus, User, UserSettings, Vendor, FieldCorrection
from .gemini_service import GeminiService

UPLOAD_DIR = "uploads"

# Supported file types
SUPPORTED_PDF_EXTENSIONS = ['.pdf']
SUPPORTED_IMAGE_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp', '.tiff']
SUPPORTED_EXTENSIONS = SUPPORTED_PDF_EXTENSIONS + SUPPORTED_IMAGE_EXTENSIONS

class InvoiceService:
    def __init__(self):
        self.gemini_service = GeminiService()
        
        # Ensure upload directory exists
        os.makedirs(UPLOAD_DIR, exist_ok=True)
    
    def is_supported_file(self, filename: str) -> bool:
        """Check if file type is supported"""
        ext = os.path.splitext(filename.lower())[1]
        return ext in SUPPORTED_EXTENSIONS

    def get_safe_filename(self, filename: str) -> str:
        """Return the final filename component without any directory path."""
        safe_filename = filename.replace("\\", "/").rsplit("/", 1)[-1]
        if not safe_filename or safe_filename in {".", ".."}:
            raise ValueError("Invalid filename")
        return safe_filename
    
    def is_image_file(self, filename: str) -> bool:
        """Check if file is an image"""
        ext = os.path.splitext(filename.lower())[1]
        return ext in SUPPORTED_IMAGE_EXTENSIONS
    
    def get_user_api_key(self, db: Session, user_id: int) -> Optional[str]:
        """Get Gemini API key for user from settings
        
        Args:
            db: Database session
            user_id: ID of the user
            
        Returns:
            API key or None if not set
        """
        settings = db.query(UserSettings).filter(UserSettings.user_id == user_id).first()
        if settings and settings.gemini_api_key:
            return settings.gemini_api_key
        return None
    
    def save_uploaded_file(self, file: UploadFile, user_id: int) -> str:
        """Save uploaded PDF file to disk
        
        Args:
            file: Uploaded file
            user_id: ID of the user uploading the file
            
        Returns:
            Path to saved file
        """
        # Create user-specific directory
        user_dir = os.path.join(UPLOAD_DIR, str(user_id))
        os.makedirs(user_dir, exist_ok=True)
        
        # Generate unique filename
        # Strip any directory components from the original filename to prevent
        # path traversal issues (e.g. "folder/invoice.pdf" -> "invoice.pdf")
        import time
        safe_name = os.path.basename(file.filename.replace("\\", "/"))
        timestamp = int(time.time() * 1000)
<<<<<<< HEAD
        filename = f"{timestamp}_{self.get_safe_filename(file.filename)}"
=======
        filename = f"{timestamp}_{safe_name}"
>>>>>>> 37b73d54c8112b5b834fe525c12cfa169484ac69
        file_path = os.path.join(user_dir, filename)
        
        # Save file
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
        
        return file_path
    
    def create_invoice_record(
        self, 
        db: Session, 
        user: User, 
        filename: str, 
        pdf_path: str
    ) -> Invoice:
        """Create invoice database record
        
        Args:
            db: Database session
            user: User object
            filename: Original filename
            pdf_path: Path to saved PDF file
            
        Returns:
            Created Invoice object
        """
        invoice = Invoice(
            user_id=user.id,
            filename=filename,
            pdf_path=pdf_path,
            status=InvoiceStatus.pending
        )
        db.add(invoice)
        db.commit()
        db.refresh(invoice)
        return invoice
    
    def process_invoice(self, db: Session, invoice: Invoice) -> InvoiceData:
        """Process invoice using Gemini Vision with AI enhancements
        
        Features:
        - Confidence scoring for each field
        - Smart categorization
        - Multi-language support
        - Duplicate detection
        - Vendor recognition
        
        Args:
            db: Database session
            invoice: Invoice object to process
            
        Returns:
            InvoiceData object with extracted data
        """
        try:
            # Update status to processing
            invoice.status = InvoiceStatus.processing
            db.commit()
            
            # Get user's API key from settings
            api_key = self.get_user_api_key(db, invoice.user_id)
            
            # Check if it's an image or PDF
            is_image = self.is_image_file(invoice.filename)
            
            # Extract data using Gemini
            if is_image:
                extracted_data = self.gemini_service.extract_from_image(
                    invoice.pdf_path,
                    api_key=api_key
                )
            else:
                extracted_data = self.gemini_service.extract_invoice_data(
                    invoice.pdf_path, 
                    api_key=api_key
                )
            
            # Validate extraction
            if not self.gemini_service.validate_extraction(extracted_data):
                raise Exception("Extracted data failed validation")
            
            # Extract confidence scores and category from response
            confidence_scores = extracted_data.pop("confidence_scores", None)
            category = extracted_data.pop("expense_category", None)
            detected_language = extracted_data.pop("detected_language", None)
            
            # Check for duplicates
            is_duplicate, duplicate_of_id, similarity_score = self._check_for_duplicates(
                db, invoice.user_id, extracted_data
            )
            
            # Update or create vendor record
            self._update_vendor_database(db, invoice.user_id, extracted_data, category)
            
            # Create or update invoice data
            invoice_data = db.query(InvoiceData).filter(
                InvoiceData.invoice_id == invoice.id
            ).first()
            
            if invoice_data:
                invoice_data.extracted_json = extracted_data
                invoice_data.confidence_scores = confidence_scores
                invoice_data.category = category
                invoice_data.detected_language = detected_language
                invoice_data.is_duplicate = is_duplicate
                invoice_data.duplicate_of_id = duplicate_of_id
            else:
                invoice_data = InvoiceData(
                    invoice_id=invoice.id,
                    extracted_json=extracted_data,
                    confidence_scores=confidence_scores,
                    category=category,
                    detected_language=detected_language,
                    is_duplicate=is_duplicate,
                    duplicate_of_id=duplicate_of_id
                )
                db.add(invoice_data)
            
            # Update invoice status
            invoice.status = InvoiceStatus.completed
            invoice.error_message = None
            
            db.commit()
            db.refresh(invoice_data)
            
            return invoice_data
            
        except Exception as e:
            # Update status to error
            invoice.status = InvoiceStatus.error
            invoice.error_message = str(e)
            db.commit()
            raise Exception(f"Error processing invoice: {str(e)}")

    def _check_for_duplicates(
        self, 
        db: Session, 
        user_id: int, 
        extracted_data: Dict
    ) -> Tuple[bool, Optional[int], float]:
        """Check if this invoice is a duplicate
        
        Args:
            db: Database session
            user_id: User ID
            extracted_data: Newly extracted data
            
        Returns:
            Tuple of (is_duplicate, duplicate_of_id, similarity_score)
        """
        # Get existing completed invoices for this user
        # Explicitly specify join condition due to multiple foreign keys
        existing_invoices = db.query(Invoice).join(
            InvoiceData, Invoice.id == InvoiceData.invoice_id
        ).filter(
            Invoice.user_id == user_id,
            Invoice.status == InvoiceStatus.completed
        ).all()
        
        existing_data = []
        for inv in existing_invoices:
            if inv.data and inv.data.extracted_json:
                existing_data.append({
                    "id": inv.id,
                    "data": inv.data.extracted_json
                })
        
        return self.gemini_service.check_duplicate(extracted_data, existing_data)

    def _update_vendor_database(
        self, 
        db: Session, 
        user_id: int, 
        extracted_data: Dict,
        category: Optional[str] = None
    ) -> Optional[Vendor]:
        """Update or create vendor record for recognition
        
        Args:
            db: Database session
            user_id: User ID
            extracted_data: Extracted invoice data
            category: Expense category
            
        Returns:
            Vendor object or None
        """
        vendor_name = extracted_data.get("vendor_name", "").strip()
        if not vendor_name:
            return None
        
        normalized_name = self.gemini_service.normalize_vendor_name(vendor_name)
        if not normalized_name:
            return None
        
        # Look for existing vendor
        vendor = db.query(Vendor).filter(
            Vendor.user_id == user_id,
            Vendor.normalized_name == normalized_name
        ).first()
        
        total_amount = float(extracted_data.get("total_amount", 0) or 0)
        
        if vendor:
            # Update existing vendor
            vendor.invoice_count += 1
            vendor.total_spent += total_amount
            vendor.last_invoice_date = func.now()
            
            # Update address if we have a more complete one
            new_address = extracted_data.get("vendor_address", "")
            if new_address and (not vendor.address or len(new_address) > len(vendor.address)):
                vendor.address = new_address
            
            # Update contact info if available
            if extracted_data.get("vendor_email") and not vendor.email:
                vendor.email = extracted_data.get("vendor_email")
            if extracted_data.get("vendor_phone") and not vendor.phone:
                vendor.phone = extracted_data.get("vendor_phone")
            if extracted_data.get("vendor_tax_id") and not vendor.tax_id:
                vendor.tax_id = extracted_data.get("vendor_tax_id")
            
            # Update category if we have one
            if category:
                vendor.default_category = category
        else:
            # Create new vendor
            vendor = Vendor(
                user_id=user_id,
                name=vendor_name,
                normalized_name=normalized_name,
                address=extracted_data.get("vendor_address", ""),
                email=extracted_data.get("vendor_email", ""),
                phone=extracted_data.get("vendor_phone", ""),
                tax_id=extracted_data.get("vendor_tax_id", ""),
                default_category=category,
                invoice_count=1,
                total_spent=total_amount,
                last_invoice_date=func.now()
            )
            db.add(vendor)
        
        return vendor

    def get_vendor_suggestions(
        self, 
        db: Session, 
        user_id: int, 
        partial_name: str
    ) -> List[Dict]:
        """Get vendor suggestions for auto-complete
        
        Args:
            db: Database session
            user_id: User ID
            partial_name: Partial vendor name to search
            
        Returns:
            List of vendor suggestions
        """
        normalized = self.gemini_service.normalize_vendor_name(partial_name)
        
        vendors = db.query(Vendor).filter(
            Vendor.user_id == user_id,
            Vendor.normalized_name.contains(normalized)
        ).order_by(Vendor.invoice_count.desc()).limit(5).all()
        
        return [
            {
                "id": v.id,
                "name": v.name,
                "address": v.address,
                "email": v.email,
                "phone": v.phone,
                "tax_id": v.tax_id,
                "default_category": v.default_category,
                "invoice_count": v.invoice_count,
                "total_spent": v.total_spent
            }
            for v in vendors
        ]

    def record_field_correction(
        self, 
        db: Session, 
        user_id: int, 
        invoice_id: int,
        field_name: str,
        original_value: str,
        corrected_value: str,
        vendor_name: Optional[str] = None
    ) -> FieldCorrection:
        """Record a user's correction for learning
        
        Args:
            db: Database session
            user_id: User ID
            invoice_id: Invoice ID
            field_name: Name of the corrected field
            original_value: Original extracted value
            corrected_value: User's corrected value
            vendor_name: Optional vendor name for vendor-specific learning
            
        Returns:
            FieldCorrection object
        """
        correction = FieldCorrection(
            user_id=user_id,
            invoice_id=invoice_id,
            field_name=field_name,
            original_value=original_value,
            corrected_value=corrected_value,
            vendor_name=vendor_name
        )
        db.add(correction)
        db.commit()
        db.refresh(correction)
        return correction

    def get_learning_stats(self, db: Session, user_id: int) -> Dict:
        """Get statistics about AI learning from corrections
        
        Args:
            db: Database session
            user_id: User ID
            
        Returns:
            Dictionary with learning statistics
        """
        # Count total corrections
        total_corrections = db.query(FieldCorrection).filter(
            FieldCorrection.user_id == user_id
        ).count()
        
        # Group by field
        from sqlalchemy import func as sqlfunc
        field_counts = db.query(
            FieldCorrection.field_name,
            sqlfunc.count(FieldCorrection.id)
        ).filter(
            FieldCorrection.user_id == user_id
        ).group_by(FieldCorrection.field_name).all()
        
        # Count vendors
        vendor_count = db.query(Vendor).filter(
            Vendor.user_id == user_id
        ).count()
        
        return {
            "total_corrections": total_corrections,
            "corrections_by_field": {f: c for f, c in field_counts},
            "known_vendors": vendor_count
        }
    
    def update_invoice_data(
        self, 
        db: Session, 
        invoice_id: int, 
        amended_data: dict
    ) -> InvoiceData:
        """Update invoice data with user amendments
        
        Args:
            db: Database session
            invoice_id: ID of the invoice
            amended_data: Amended data from user
            
        Returns:
            Updated InvoiceData object
        """
        invoice_data = db.query(InvoiceData).filter(
            InvoiceData.invoice_id == invoice_id
        ).first()
        
        if not invoice_data:
            raise Exception("Invoice data not found")
        
        invoice_data.amended_json = amended_data
        db.commit()
        db.refresh(invoice_data)
        
        return invoice_data
    
    def get_user_invoices(self, db: Session, user_id: int) -> List[Invoice]:
        """Get all invoices for a user
        
        Args:
            db: Database session
            user_id: ID of the user
            
        Returns:
            List of Invoice objects
        """
        return db.query(Invoice).filter(Invoice.user_id == user_id).order_by(
            Invoice.upload_date.desc()
        ).all()
    
    def get_invoice_by_id(self, db: Session, invoice_id: int, user_id: int) -> Invoice:
        """Get invoice by ID (with user verification)
        
        Args:
            db: Database session
            invoice_id: ID of the invoice
            user_id: ID of the user (for verification)
            
        Returns:
            Invoice object
        """
        invoice = db.query(Invoice).filter(
            Invoice.id == invoice_id,
            Invoice.user_id == user_id
        ).first()
        
        if not invoice:
            raise Exception("Invoice not found or access denied")
        
        return invoice
    
    def delete_invoice(self, db: Session, invoice_id: int, user_id: int) -> bool:
        """Delete an invoice and its associated data
        
        Args:
            db: Database session
            invoice_id: ID of the invoice to delete
            user_id: ID of the user (for verification)
            
        Returns:
            True if deleted successfully
        """
        # Get invoice with user verification
        invoice = self.get_invoice_by_id(db, invoice_id, user_id)
        
        # Delete associated invoice data first
        db.query(InvoiceData).filter(InvoiceData.invoice_id == invoice_id).delete()
        
        # Delete the PDF file if it exists
        if invoice.pdf_path and os.path.exists(invoice.pdf_path):
            try:
                os.remove(invoice.pdf_path)
            except Exception as e:
                print(f"Warning: Could not delete PDF file: {e}")
        
        # Delete the invoice record
        db.delete(invoice)
        db.commit()
        
        return True
