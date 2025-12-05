import os
import base64
import tempfile
from typing import List, Dict, Optional, Any
from datetime import datetime
from google.oauth2.credentials import Credentials
from google.auth.transport.requests import Request
from googleapiclient.discovery import build
from sqlalchemy.orm import Session
from ..models import Invoice, InvoiceData, InvoiceStatus, UserSettings

UPLOAD_DIR = "uploads"

class GmailService:
    """Service for Gmail integration to scan emails for invoices"""
    
    def __init__(self, access_token: str, refresh_token: str, token_expiry: Optional[datetime] = None):
        """Initialize Gmail service with OAuth tokens
        
        Args:
            access_token: OAuth access token
            refresh_token: OAuth refresh token  
            token_expiry: Token expiration datetime
        """
        self.credentials = Credentials(
            token=access_token,
            refresh_token=refresh_token,
            token_uri="https://oauth2.googleapis.com/token",
            client_id=os.getenv("GOOGLE_CLIENT_ID"),
            client_secret=os.getenv("GOOGLE_CLIENT_SECRET"),
        )
        
        # Refresh token if expired
        if self.credentials.expired and self.credentials.refresh_token:
            self.credentials.refresh(Request())
        
        self.service = build('gmail', 'v1', credentials=self.credentials)
    
    def get_user_email(self) -> str:
        """Get the authenticated user's email address"""
        try:
            profile = self.service.users().getProfile(userId='me').execute()
            return profile.get('emailAddress', '')
        except Exception as e:
            print(f"Error getting user profile: {e}")
            return ''
    
    def search_emails_with_pdfs(self, after_date: Optional[datetime] = None, max_results: int = 10) -> List[Dict]:
        """Search for emails with PDF attachments
        
        Args:
            after_date: Only get emails after this date
            max_results: Maximum number of emails to retrieve
            
        Returns:
            List of email metadata with attachment info
        """
        try:
            # Build search query
            query = "has:attachment filename:pdf"
            if after_date:
                date_str = after_date.strftime("%Y/%m/%d")
                query += f" after:{date_str}"
            
            # Search for emails
            results = self.service.users().messages().list(
                userId='me',
                q=query,
                maxResults=max_results
            ).execute()
            
            messages = results.get('messages', [])
            email_list = []
            
            for msg in messages:
                email_data = self._get_email_with_attachments(msg['id'])
                if email_data:
                    email_list.append(email_data)
            
            return email_list
            
        except Exception as e:
            print(f"Error searching emails: {e}")
            return []
    
    def _get_email_with_attachments(self, message_id: str) -> Optional[Dict]:
        """Get email details including PDF attachments
        
        Args:
            message_id: Gmail message ID
            
        Returns:
            Email data with attachments or None
        """
        try:
            message = self.service.users().messages().get(
                userId='me',
                id=message_id,
                format='full'
            ).execute()
            
            # Extract headers
            headers = {h['name']: h['value'] for h in message['payload'].get('headers', [])}
            
            # Find PDF attachments
            pdf_attachments = []
            parts = message['payload'].get('parts', [])
            
            # Handle single-part messages
            if not parts and message['payload'].get('filename'):
                if message['payload']['filename'].lower().endswith('.pdf'):
                    pdf_attachments.append({
                        'filename': message['payload']['filename'],
                        'attachment_id': message['payload']['body'].get('attachmentId'),
                        'size': message['payload']['body'].get('size', 0)
                    })
            
            # Handle multi-part messages
            for part in parts:
                self._find_pdf_parts(part, pdf_attachments)
            
            if not pdf_attachments:
                return None
            
            return {
                'message_id': message_id,
                'subject': headers.get('Subject', 'No Subject'),
                'from': headers.get('From', ''),
                'date': headers.get('Date', ''),
                'snippet': message.get('snippet', ''),
                'attachments': pdf_attachments
            }
            
        except Exception as e:
            print(f"Error getting email {message_id}: {e}")
            return None
    
    def _find_pdf_parts(self, part: Dict, pdf_attachments: List[Dict]):
        """Recursively find PDF attachments in message parts
        
        Args:
            part: Message part to check
            pdf_attachments: List to append found PDFs to
        """
        filename = part.get('filename', '')
        if filename.lower().endswith('.pdf'):
            attachment_id = part['body'].get('attachmentId')
            if attachment_id:
                pdf_attachments.append({
                    'filename': filename,
                    'attachment_id': attachment_id,
                    'size': part['body'].get('size', 0)
                })
        
        # Check nested parts
        for nested_part in part.get('parts', []):
            self._find_pdf_parts(nested_part, pdf_attachments)
    
    def download_attachment(self, message_id: str, attachment_id: str, filename: str, user_id: int) -> str:
        """Download a PDF attachment and save it
        
        Args:
            message_id: Gmail message ID
            attachment_id: Attachment ID
            filename: Original filename
            user_id: User ID for saving
            
        Returns:
            Path to saved file
        """
        try:
            # Get attachment data
            attachment = self.service.users().messages().attachments().get(
                userId='me',
                messageId=message_id,
                id=attachment_id
            ).execute()
            
            # Decode attachment data
            data = base64.urlsafe_b64decode(attachment['data'])
            
            # Create user directory
            user_dir = os.path.join(UPLOAD_DIR, str(user_id))
            os.makedirs(user_dir, exist_ok=True)
            
            # Generate unique filename
            import time
            timestamp = int(time.time() * 1000)
            safe_filename = f"{timestamp}_gmail_{filename}"
            file_path = os.path.join(user_dir, safe_filename)
            
            # Save file
            with open(file_path, 'wb') as f:
                f.write(data)
            
            return file_path
            
        except Exception as e:
            raise Exception(f"Error downloading attachment: {str(e)}")
    
    def mark_as_processed(self, message_id: str, label_name: str = "InvoiceAI-Processed"):
        """Mark an email as processed by adding a label
        
        Args:
            message_id: Gmail message ID
            label_name: Label to add
        """
        try:
            # Get or create label
            label_id = self._get_or_create_label(label_name)
            
            # Add label to message
            self.service.users().messages().modify(
                userId='me',
                id=message_id,
                body={'addLabelIds': [label_id]}
            ).execute()
            
        except Exception as e:
            print(f"Error marking message as processed: {e}")
    
    def _get_or_create_label(self, label_name: str) -> str:
        """Get or create a Gmail label
        
        Args:
            label_name: Label name
            
        Returns:
            Label ID
        """
        try:
            # List existing labels
            results = self.service.users().labels().list(userId='me').execute()
            labels = results.get('labels', [])
            
            # Find existing label
            for label in labels:
                if label['name'] == label_name:
                    return label['id']
            
            # Create new label
            label = self.service.users().labels().create(
                userId='me',
                body={
                    'name': label_name,
                    'labelListVisibility': 'labelShow',
                    'messageListVisibility': 'show'
                }
            ).execute()
            
            return label['id']
            
        except Exception as e:
            print(f"Error getting/creating label: {e}")
            return ''


def process_gmail_invoices(db: Session, user_id: int, settings: UserSettings) -> Dict[str, Any]:
    """Process Gmail inbox for new invoices
    
    Args:
        db: Database session
        user_id: User ID
        settings: User settings with Gmail credentials
        
    Returns:
        Dict with processing results
    """
    from .invoice_service import InvoiceService
    
    if not settings.gmail_enabled or not settings.gmail_access_token:
        return {"success": False, "error": "Gmail not connected or enabled"}
    
    try:
        # Initialize Gmail service
        gmail = GmailService(
            access_token=settings.gmail_access_token,
            refresh_token=settings.gmail_refresh_token,
            token_expiry=settings.gmail_token_expiry
        )
        
        # Search for emails with PDFs since last check
        emails = gmail.search_emails_with_pdfs(
            after_date=settings.gmail_last_check,
            max_results=10
        )
        
        invoice_service = InvoiceService()
        processed = []
        errors = []
        
        for email in emails:
            for attachment in email.get('attachments', []):
                try:
                    # Download attachment
                    pdf_path = gmail.download_attachment(
                        message_id=email['message_id'],
                        attachment_id=attachment['attachment_id'],
                        filename=attachment['filename'],
                        user_id=user_id
                    )
                    
                    # Create invoice record
                    invoice = Invoice(
                        user_id=user_id,
                        filename=f"[Gmail] {attachment['filename']}",
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
                    gmail.mark_as_processed(email['message_id'])
                    
                    processed.append({
                        'filename': attachment['filename'],
                        'invoice_id': invoice.id,
                        'from': email['from'],
                        'subject': email['subject']
                    })
                    
                except Exception as e:
                    errors.append({
                        'filename': attachment['filename'],
                        'error': str(e)
                    })
        
        # Update last check time
        settings.gmail_last_check = datetime.utcnow()
        db.commit()
        
        return {
            "success": True,
            "processed": len(processed),
            "errors": len(errors),
            "invoices": processed,
            "error_details": errors
        }
        
    except Exception as e:
        return {"success": False, "error": str(e)}

