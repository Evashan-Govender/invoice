# AI Invoice Data Extraction - Technical Architecture

## System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         User Browser                             │
│                    (Next.js Frontend - Port 3000)                │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             │ HTTP/REST API
                             │ JWT Authentication
                             │
┌────────────────────────────▼────────────────────────────────────┐
│                      FastAPI Backend                             │
│                        (Port 8000)                               │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  API Layer (Routers)                                     │   │
│  │  - /auth/* (Login, Register)                             │   │
│  │  - /invoices/* (Upload, Process, View, Update)           │   │
│  └────────────────┬────────────────────────────┬────────────┘   │
│                   │                             │                │
│  ┌────────────────▼────────────┐  ┌────────────▼────────────┐  │
│  │  Authentication Layer        │  │  Business Logic          │  │
│  │  - JWT Token Generation      │  │  - Invoice Service       │  │
│  │  - Password Hashing          │  │  - File Management       │  │
│  │  - User Verification         │  │  - Data Validation       │  │
│  └──────────────────────────────┘  └────────┬─────────────────┘  │
│                                               │                   │
│                                  ┌────────────▼────────────┐     │
│                                  │  Gemini Service         │     │
│                                  │  - PDF → Image          │     │
│                                  │  - AI Extraction        │     │
│                                  │  - JSON Parsing         │     │
│                                  └────────┬────────────────┘     │
└───────────────────────────────────────────┼──────────────────────┘
                                            │
                    ┌───────────────────────┼───────────────────────┐
                    │                       │                       │
         ┌──────────▼──────────┐  ┌────────▼────────┐  ┌──────────▼────────┐
         │  PostgreSQL DB      │  │  Gemini Vision  │  │  File Storage     │
         │  - Users            │  │  API            │  │  - PDFs in        │
         │  - Invoices         │  │  (Google Cloud) │  │    uploads/       │
         │  - Invoice Data     │  │                 │  │                   │
         └─────────────────────┘  └─────────────────┘  └───────────────────┘
```

## Data Flow

### 1. Upload Flow
```
User → Upload PDF → Backend → Save to uploads/ → Create DB record → Return invoice ID
```

### 2. Processing Flow
```
User → Click Process → Backend → Load PDF → Convert to Images → 
Send to Gemini Vision → Parse JSON → Save to DB → Update status
```

### 3. Review & Edit Flow
```
User → View Invoice → Load PDF + Data from DB → Edit fields → 
Save amendments → Update DB (amended_json)
```

## Database Schema

### Users Table
```sql
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    email VARCHAR UNIQUE NOT NULL,
    password_hash VARCHAR NOT NULL,
    created_at TIMESTAMP DEFAULT NOW()
);
```

### Invoices Table
```sql
CREATE TABLE invoices (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id),
    filename VARCHAR NOT NULL,
    status VARCHAR NOT NULL, -- pending, processing, completed, error
    upload_date TIMESTAMP DEFAULT NOW(),
    pdf_path VARCHAR NOT NULL,
    error_message TEXT
);
```

### Invoice Data Table
```sql
CREATE TABLE invoice_data (
    id SERIAL PRIMARY KEY,
    invoice_id INTEGER REFERENCES invoices(id) UNIQUE,
    extracted_json JSONB, -- AI extraction result
    amended_json JSONB,   -- User-corrected data
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);
```

## Extracted Data Structure

```json
{
  "invoice_number": "INV-2025-001",
  "date": "2025-11-27",
  "vendor_name": "Acme Corp",
  "vendor_address": "123 Business St, City, State 12345",
  "customer_name": "Client Inc",
  "customer_address": "456 Client Ave, City, State 67890",
  "currency": "USD",
  "subtotal": 1000.00,
  "tax": 80.00,
  "total_amount": 1080.00,
  "line_items": [
    {
      "description": "Consulting Services",
      "quantity": 10,
      "unit_price": 100.00,
      "total_price": 1000.00
    }
  ]
}
```

## API Authentication

All protected endpoints require JWT token in header:
```
Authorization: Bearer <token>
```

Token payload:
```json
{
  "sub": 123,  // user_id
  "exp": 1234567890  // expiration timestamp
}
```

## Gemini Vision Integration

### Prompt Template
```
You are an invoice data extraction system. Analyze this invoice image and extract structured data.
Return ONLY valid JSON with no additional text.

Required format: { ... }
```

### Processing Steps
1. Convert PDF to images (first 3 pages, 200 DPI)
2. Send first page to Gemini Vision
3. Parse JSON response
4. Validate structure
5. Store in database

## Security Considerations

- Passwords hashed with bcrypt
- JWT tokens with expiration
- CORS configured for frontend origin
- File upload limited to PDFs only
- Max 5 files per upload
- User-specific file isolation

## Performance Optimizations

- Database connection pooling
- Single page processing (first page only)
- Image resolution optimization (200 DPI)
- Lazy loading of PDF viewer
- Client-side form state management

## Error Handling

- API errors return structured JSON
- Frontend displays user-friendly messages
- Processing errors stored in invoice.error_message
- Retry capability for failed extractions

---

**AG Tech Consulting PTE Ltd © 2025**

