from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Text, Enum, Boolean, Float
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import relationship
from datetime import datetime
import enum
from .database import Base

class InvoiceStatus(enum.Enum):
    pending = "pending"
    processing = "processing"
    completed = "completed"
    error = "error"

class ExpenseCategory(enum.Enum):
    utilities = "Utilities"
    office_supplies = "Office Supplies"
    software = "Software & Subscriptions"
    professional_services = "Professional Services"
    travel = "Travel & Transportation"
    meals = "Meals & Entertainment"
    rent = "Rent & Lease"
    insurance = "Insurance"
    marketing = "Marketing & Advertising"
    equipment = "Equipment & Machinery"
    raw_materials = "Raw Materials"
    shipping = "Shipping & Logistics"
    maintenance = "Maintenance & Repairs"
    telecommunications = "Telecommunications"
    other = "Other"

class User(Base):
    __tablename__ = "users"
    
    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, index=True, nullable=False)
    password_hash = Column(String, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    invoices = relationship("Invoice", back_populates="user")
    settings = relationship("UserSettings", back_populates="user", uselist=False)

class UserSettings(Base):
    __tablename__ = "user_settings"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, unique=True)
    
    # API Keys
    gemini_api_key = Column(String, nullable=True)
    
    # Gmail Integration
    gmail_enabled = Column(Boolean, default=False)
    gmail_access_token = Column(Text, nullable=True)
    gmail_refresh_token = Column(Text, nullable=True)
    gmail_token_expiry = Column(DateTime, nullable=True)
    gmail_email = Column(String, nullable=True)
    gmail_last_check = Column(DateTime, nullable=True)
    
    # SMTP/IMAP Integration (for generic email providers)
    smtp_enabled = Column(Boolean, default=False)
    smtp_email = Column(String, nullable=True)
    smtp_password = Column(Text, nullable=True)  # Encrypted app password
    imap_host = Column(String, nullable=True)  # e.g., imap.gmail.com, outlook.office365.com
    imap_port = Column(Integer, nullable=True, default=993)
    smtp_host = Column(String, nullable=True)  # e.g., smtp.gmail.com
    smtp_port = Column(Integer, nullable=True, default=587)
    smtp_use_ssl = Column(Boolean, default=True)
    smtp_last_check = Column(DateTime, nullable=True)
    
    # Preferences
    auto_process = Column(Boolean, default=True)
    email_notifications = Column(Boolean, default=False)
    auto_sync_erp = Column(Boolean, default=False)
    
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    user = relationship("User", back_populates="settings")

class Invoice(Base):
    __tablename__ = "invoices"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    filename = Column(String, nullable=False)
    status = Column(Enum(InvoiceStatus), default=InvoiceStatus.pending)
    upload_date = Column(DateTime, default=datetime.utcnow)
    pdf_path = Column(String, nullable=False)
    error_message = Column(Text, nullable=True)
    
    user = relationship("User", back_populates="invoices")
    data = relationship("InvoiceData", back_populates="invoice", uselist=False, primaryjoin="Invoice.id==InvoiceData.invoice_id")

class InvoiceData(Base):
    __tablename__ = "invoice_data"
    
    id = Column(Integer, primary_key=True, index=True)
    invoice_id = Column(Integer, ForeignKey("invoices.id"), nullable=False, unique=True)
    extracted_json = Column(JSONB, nullable=True)
    amended_json = Column(JSONB, nullable=True)
    confidence_scores = Column(JSONB, nullable=True)  # Confidence scores for each field
    category = Column(String, nullable=True)  # Expense category
    detected_language = Column(String, nullable=True)  # Detected invoice language
    is_duplicate = Column(Boolean, default=False)  # Duplicate flag
    duplicate_of_id = Column(Integer, ForeignKey("invoices.id"), nullable=True)  # Reference to original
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    invoice = relationship("Invoice", back_populates="data", foreign_keys=[invoice_id])
    duplicate_of = relationship("Invoice", foreign_keys=[duplicate_of_id])


class Vendor(Base):
    """Vendor database for recognition and auto-fill"""
    __tablename__ = "vendors"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    name = Column(String, nullable=False, index=True)
    normalized_name = Column(String, nullable=False, index=True)  # Lowercase, trimmed for matching
    address = Column(Text, nullable=True)
    email = Column(String, nullable=True)
    phone = Column(String, nullable=True)
    tax_id = Column(String, nullable=True)
    default_category = Column(String, nullable=True)
    invoice_count = Column(Integer, default=1)
    total_spent = Column(Float, default=0.0)
    last_invoice_date = Column(DateTime, nullable=True)
    extra_data = Column(JSONB, nullable=True)  # Additional vendor-specific fields
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    user = relationship("User")


class FieldCorrection(Base):
    """Track user corrections to learn and improve AI extraction"""
    __tablename__ = "field_corrections"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    invoice_id = Column(Integer, ForeignKey("invoices.id"), nullable=False)
    field_name = Column(String, nullable=False)  # e.g., "vendor_name", "total_amount"
    original_value = Column(Text, nullable=True)
    corrected_value = Column(Text, nullable=True)
    vendor_name = Column(String, nullable=True)  # For vendor-specific learning
    created_at = Column(DateTime, default=datetime.utcnow)
    
    user = relationship("User")
    invoice = relationship("Invoice")


class ERPIntegration(Base):
    """Store ERP integration configurations and OAuth tokens"""
    __tablename__ = "erp_integrations"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    provider = Column(String, nullable=False)  # xero, quickbooks, sap, etc.
    is_active = Column(Boolean, default=False)
    
    # OAuth 2.0 tokens
    access_token = Column(Text, nullable=True)
    refresh_token = Column(Text, nullable=True)
    token_expiry = Column(DateTime, nullable=True)
    
    # Provider-specific configuration
    tenant_id = Column(String, nullable=True)  # Xero tenant_id / QB realm_id
    org_id = Column(String, nullable=True)  # Organization/Company ID
    config_data = Column(JSONB, nullable=True)  # Additional provider-specific data
    
    # Sync settings
    auto_sync = Column(Boolean, default=False)
    last_sync = Column(DateTime, nullable=True)
    sync_count = Column(Integer, default=0)
    
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    user = relationship("User")
