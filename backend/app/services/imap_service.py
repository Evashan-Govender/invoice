import os
import email
import imaplib
import ssl
from email.header import decode_header
from typing import List, Dict, Optional, Any
from datetime import datetime, timedelta
from sqlalchemy.orm import Session
from ..models import Invoice, InvoiceData, InvoiceStatus, UserSettings

UPLOAD_DIR = "uploads"

# Common IMAP/SMTP configurations for popular providers
EMAIL_PROVIDERS = {
    "gmail": {
        "imap_host": "imap.gmail.com",
        "imap_port": 993,
        "smtp_host": "smtp.gmail.com", 
        "smtp_port": 587,
        "use_ssl": True,
        "name": "Gmail",
        "help_url": "https://support.google.com/accounts/answer/185833"
    },
    "outlook": {
        "imap_host": "outlook.office365.com",
        "imap_port": 993,
        "smtp_host": "smtp.office365.com",
        "smtp_port": 587,
        "use_ssl": True,
        "name": "Outlook / Microsoft 365",
        "help_url": "https://support.microsoft.com/en-us/account-billing/using-app-passwords"
    },
    "yahoo": {
        "imap_host": "imap.mail.yahoo.com",
        "imap_port": 993,
        "smtp_host": "smtp.mail.yahoo.com",
        "smtp_port": 587,
        "use_ssl": True,
        "name": "Yahoo Mail",
        "help_url": "https://help.yahoo.com/kb/SLN15241.html"
    },
    "icloud": {
        "imap_host": "imap.mail.me.com",
        "imap_port": 993,
        "smtp_host": "smtp.mail.me.com",
        "smtp_port": 587,
        "use_ssl": True,
        "name": "iCloud Mail",
        "help_url": "https://support.apple.com/en-us/HT204397"
    },
    "zoho": {
        "imap_host": "imap.zoho.com",
        "imap_port": 993,
        "smtp_host": "smtp.zoho.com",
        "smtp_port": 587,
        "use_ssl": True,
        "name": "Zoho Mail",
        "help_url": "https://www.zoho.com/mail/help/imap-access.html"
    },
    "custom": {
        "imap_host": "",
        "imap_port": 993,
        "smtp_host": "",
        "smtp_port": 587,
        "use_ssl": True,
        "name": "Custom Server",
        "help_url": ""
    }
}


class IMAPService:
    """Service for IMAP/SMTP email integration to scan emails for invoices"""
    
    def __init__(self, email_address: str, password: str, imap_host: str, imap_port: int = 993, use_ssl: bool = True):
        """Initialize IMAP service with credentials
        
        Args:
            email_address: Email address
            password: Email password or app password
            imap_host: IMAP server hostname
            imap_port: IMAP port (default 993)
            use_ssl: Whether to use SSL (default True)
        """
        self.email_address = email_address
        self.password = password
        self.imap_host = imap_host
        self.imap_port = imap_port
        self.use_ssl = use_ssl
        self.connection: Optional[imaplib.IMAP4_SSL] = None
    
    def connect(self) -> bool:
        """Connect to IMAP server
        
        Returns:
            True if connection successful, False otherwise
        """
        try:
            if self.use_ssl:
                context = ssl.create_default_context()
                self.connection = imaplib.IMAP4_SSL(self.imap_host, self.imap_port, ssl_context=context)
            else:
                self.connection = imaplib.IMAP4(self.imap_host, self.imap_port)
            
            # Login
            self.connection.login(self.email_address, self.password)
            return True
            
        except Exception as e:
            print(f"IMAP connection error: {e}")
            return False
    
    def disconnect(self):
        """Disconnect from IMAP server"""
        if self.connection:
            try:
                self.connection.logout()
            except:
                pass
            self.connection = None
    
    def test_connection(self) -> Dict[str, Any]:
        """Test IMAP connection
        
        Returns:
            Dict with success status and message
        """
        try:
            if self.connect():
                self.disconnect()
                return {"success": True, "message": "Connection successful"}
            else:
                return {"success": False, "message": "Failed to connect to IMAP server"}
        except Exception as e:
            return {"success": False, "message": str(e)}
    
    def search_emails_with_pdfs(self, after_date: Optional[datetime] = None, max_results: int = 10, folder: str = "INBOX") -> List[Dict]:
        """Search for emails with PDF attachments
        
        Args:
            after_date: Only get emails after this date
            max_results: Maximum number of emails to retrieve
            folder: Mailbox folder to search (default INBOX)
            
        Returns:
            List of email metadata with attachment info
        """
        if not self.connection:
            if not self.connect():
                return []
        
        try:
            # Select folder
            self.connection.select(folder)
            
            # Build search criteria
            search_criteria = []
            if after_date:
                # IMAP date format: DD-Mon-YYYY
                date_str = after_date.strftime("%d-%b-%Y")
                search_criteria.append(f'(SINCE {date_str})')
            
            # Search for all emails (we'll filter by PDF attachments)
            if search_criteria:
                search_query = ' '.join(search_criteria)
            else:
                search_query = 'ALL'
            
            _, message_numbers = self.connection.search(None, search_query)
            email_ids = message_numbers[0].split()
            
            # Get the most recent emails first
            email_ids = email_ids[-max_results * 3:][::-1]  # Get more and filter
            
            email_list = []
            
            for email_id in email_ids:
                if len(email_list) >= max_results:
                    break
                    
                email_data = self._get_email_with_attachments(email_id)
                if email_data:
                    email_list.append(email_data)
            
            return email_list
            
        except Exception as e:
            print(f"Error searching emails: {e}")
            return []
    
    def _decode_header_value(self, value) -> str:
        """Decode email header value
        
        Args:
            value: Header value to decode
            
        Returns:
            Decoded string
        """
        if value is None:
            return ""
        
        decoded_parts = decode_header(value)
        result = ""
        for part, charset in decoded_parts:
            if isinstance(part, bytes):
                try:
                    result += part.decode(charset or 'utf-8', errors='replace')
                except:
                    result += part.decode('utf-8', errors='replace')
            else:
                result += part
        return result
    
    def _get_email_with_attachments(self, email_id: bytes) -> Optional[Dict]:
        """Get email details including PDF attachments
        
        Args:
            email_id: Email ID from IMAP
            
        Returns:
            Email data with attachments or None
        """
        try:
            _, data = self.connection.fetch(email_id, '(RFC822)')
            raw_email = data[0][1]
            msg = email.message_from_bytes(raw_email)
            
            # Extract headers
            subject = self._decode_header_value(msg['Subject'])
            from_addr = self._decode_header_value(msg['From'])
            date = msg['Date']
            
            # Find PDF attachments
            pdf_attachments = []
            
            for part in msg.walk():
                content_type = part.get_content_type()
                content_disposition = str(part.get("Content-Disposition") or "")
                
                # Check if it's an attachment
                if "attachment" in content_disposition or content_type == "application/pdf":
                    filename = part.get_filename()
                    if filename:
                        filename = self._decode_header_value(filename)
                        if filename.lower().endswith('.pdf'):
                            pdf_attachments.append({
                                'filename': filename,
                                'part': part,
                                'size': len(part.get_payload(decode=True) or b'')
                            })
            
            if not pdf_attachments:
                return None
            
            return {
                'email_id': email_id.decode() if isinstance(email_id, bytes) else str(email_id),
                'subject': subject or 'No Subject',
                'from': from_addr or '',
                'date': date or '',
                'snippet': subject[:100] if subject else '',
                'attachments': pdf_attachments
            }
            
        except Exception as e:
            print(f"Error getting email: {e}")
            return None
    
    def download_attachment(self, attachment_data: Dict, user_id: int) -> str:
        """Download a PDF attachment and save it
        
        Args:
            attachment_data: Attachment dict with 'part' and 'filename'
            user_id: User ID for saving
            
        Returns:
            Path to saved file
        """
        try:
            part = attachment_data['part']
            filename = attachment_data['filename']
            
            # Get attachment data
            data = part.get_payload(decode=True)
            
            # Create user directory
            user_dir = os.path.join(UPLOAD_DIR, str(user_id))
            os.makedirs(user_dir, exist_ok=True)
            
            # Generate unique filename
            import time
            timestamp = int(time.time() * 1000)
            safe_filename = f"{timestamp}_imap_{filename}"
            file_path = os.path.join(user_dir, safe_filename)
            
            # Save file
            with open(file_path, 'wb') as f:
                f.write(data)
            
            return file_path
            
        except Exception as e:
            raise Exception(f"Error downloading attachment: {str(e)}")
    
    def mark_as_processed(self, email_id: str, flag: str = "\\Seen"):
        """Mark an email as processed by adding a flag
        
        Args:
            email_id: Email ID
            flag: Flag to add (default \\Seen)
        """
        try:
            if self.connection:
                self.connection.store(email_id.encode() if isinstance(email_id, str) else email_id, '+FLAGS', flag)
        except Exception as e:
            print(f"Error marking message as processed: {e}")


def test_smtp_connection(email_address: str, password: str, imap_host: str, imap_port: int = 993, use_ssl: bool = True) -> Dict[str, Any]:
    """Test SMTP/IMAP connection
    
    Args:
        email_address: Email address
        password: Password or app password
        imap_host: IMAP server hostname
        imap_port: IMAP port
        use_ssl: Whether to use SSL
        
    Returns:
        Dict with success status and message
    """
    service = IMAPService(email_address, password, imap_host, imap_port, use_ssl)
    return service.test_connection()


def process_imap_invoices(db: Session, user_id: int, settings: UserSettings) -> Dict[str, Any]:
    """Process IMAP inbox for new invoices
    
    Args:
        db: Database session
        user_id: User ID
        settings: User settings with IMAP credentials
        
    Returns:
        Dict with processing results
    """
    from .invoice_service import InvoiceService
    
    if not settings.smtp_enabled or not settings.smtp_email or not settings.smtp_password:
        return {"success": False, "error": "SMTP/IMAP not connected or enabled"}
    
    if not settings.imap_host:
        return {"success": False, "error": "IMAP server not configured"}
    
    try:
        # Initialize IMAP service
        imap = IMAPService(
            email_address=settings.smtp_email,
            password=settings.smtp_password,
            imap_host=settings.imap_host,
            imap_port=settings.imap_port or 993,
            use_ssl=settings.smtp_use_ssl
        )
        
        # Connect to IMAP server
        if not imap.connect():
            return {"success": False, "error": "Failed to connect to email server"}
        
        try:
            # Search for emails with PDFs since last check
            emails = imap.search_emails_with_pdfs(
                after_date=settings.smtp_last_check,
                max_results=10
            )
            
            invoice_service = InvoiceService()
            processed = []
            errors = []
            
            for email_data in emails:
                for attachment in email_data.get('attachments', []):
                    try:
                        # Download attachment
                        pdf_path = imap.download_attachment(
                            attachment_data=attachment,
                            user_id=user_id
                        )
                        
                        # Create invoice record
                        invoice = Invoice(
                            user_id=user_id,
                            filename=f"[Email] {attachment['filename']}",
                            pdf_path=pdf_path,
                            status=InvoiceStatus.pending
                        )
                        db.add(invoice)
                        db.commit()
                        db.refresh(invoice)
                        
                        # Process if auto-process is enabled
                        if settings.auto_process:
                            try:
                                invoice_service.process_invoice(db, invoice)
                            except Exception as e:
                                print(f"Error auto-processing invoice: {e}")
                        
                        # Mark email as processed
                        imap.mark_as_processed(email_data['email_id'])
                        
                        processed.append({
                            'filename': attachment['filename'],
                            'invoice_id': invoice.id,
                            'from': email_data['from'],
                            'subject': email_data['subject']
                        })
                        
                    except Exception as e:
                        errors.append({
                            'filename': attachment['filename'],
                            'error': str(e)
                        })
            
            # Update last check time
            settings.smtp_last_check = datetime.utcnow()
            db.commit()
            
            return {
                "success": True,
                "processed": len(processed),
                "errors": len(errors),
                "invoices": processed,
                "error_details": errors
            }
            
        finally:
            imap.disconnect()
        
    except Exception as e:
        return {"success": False, "error": str(e)}

