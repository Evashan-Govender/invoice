# Invoice AI - Automated Invoice Data Extraction POC

AI-powered invoice data extraction system using Google Gemini Vision API for automated OCR and structured data parsing.

**Prepared For:** Sambe Consulting Pvt Ltd  
**Prepared By:** AG Tech Consulting PTE Ltd  
**Date:** November 27, 2025

---

## 📋 Table of Contents

- [Overview](#overview)
- [Features](#features)
- [Technology Stack](#technology-stack)
- [Prerequisites](#prerequisites)
- [Installation](#installation)
- [Configuration](#configuration)
- [Running the Application](#running-the-application)
- [Usage Guide](#usage-guide)
- [API Documentation](#api-documentation)
- [Project Structure](#project-structure)
- [Known Limitations](#known-limitations)
- [Troubleshooting](#troubleshooting)
- [Future Enhancements](#future-enhancements)
- [Support](#support)

---

## 🎯 Overview

This POC demonstrates automated invoice data extraction using modern AI/OCR technologies. The system allows users to:

- **Upload** invoice PDFs (single or batch up to 5 files)
- **Process** invoices using Gemini Vision API for OCR and structured data extraction
- **Review** and edit extracted data in an intuitive split-screen interface
- **Save** validated data for export or integration

---

## ✨ Features

### Implemented in POC

- ✅ User authentication (email/password with JWT)
- ✅ Single and bulk upload (up to 5 invoices per batch)
- ✅ AI-powered extraction using Gemini Vision API
- ✅ PDF viewer with side-by-side data editing
- ✅ Editable invoice header fields and line items
- ✅ Save amended data to PostgreSQL database
- ✅ Real-time processing status tracking

### Out of Scope (Future Enhancements)

- ❌ ERP integrations (SAP, Tally, Zoho, QuickBooks, NetSuite)
- ❌ Processing more than 5 invoices per batch
- ❌ Role-based access control (RBAC)
- ❌ Analytics dashboard
- ❌ Vendor model training & continuous learning
- ❌ Azure deployment (local development ready)

---

## 🛠 Technology Stack

| Layer | Technology |
|-------|------------|
| **Frontend** | Next.js 14, React, TypeScript, Tailwind CSS |
| **Backend** | FastAPI (Python), SQLAlchemy |
| **AI/OCR** | Google Gemini 1.5 Flash (Vision API) |
| **Database** | PostgreSQL 15 |
| **Authentication** | JWT (JSON Web Tokens) |
| **PDF Processing** | pdf2image, Pillow |

---

## 📦 Prerequisites

Before you begin, ensure you have the following installed:

### Required Software

- **Python 3.10+** ([Download](https://www.python.org/downloads/))
- **Node.js 18+** and npm ([Download](https://nodejs.org/))
- **PostgreSQL 15+** or Docker ([Docker](https://www.docker.com/get-started))
- **Poppler** (for PDF processing)
  - **Windows:** Download from [poppler-windows](https://github.com/oschwartz10612/poppler-windows/releases)
  - **macOS:** `brew install poppler`
  - **Linux:** `sudo apt-get install poppler-utils`

### API Keys

- **Gemini API Key**: Get from [Google AI Studio](https://makersuite.google.com/app/apikey)

---

## 🚀 Installation

### Step 1: Clone the Repository

```bash
cd c:\code\invoiceAI
```

### Step 2: Database Setup

#### Option A: Using Docker (Recommended)

```bash
docker-compose up -d
```

This will start PostgreSQL on `localhost:5433` with:
- Username: `postgres`
- Password: `avinash`
- Database: `invoiceai`

#### Option B: Local PostgreSQL

If you have PostgreSQL installed locally, create a database:

```sql
CREATE DATABASE invoiceai;
```

Update the connection string in your `.env` file accordingly.

### Step 3: Backend Setup

#### Windows

```bash
cd backend
setup.bat
```

#### Linux/macOS

```bash
cd backend
chmod +x setup.sh
./setup.sh
```

This will:
- Create a Python virtual environment
- Install all dependencies
- Create a `.env` file from template

### Step 4: Frontend Setup

```bash
cd frontend
npm install
```

---

## ⚙️ Configuration

### Backend Configuration

Edit `backend/.env`:

```env
DATABASE_URL=postgresql://postgres:avinash@localhost:5433/invoiceai
JWT_SECRET_KEY=your-secret-key-here-generate-a-secure-random-string
GEMINI_API_KEY=your-gemini-api-key-here
POWER_AUTOMATE_INTEGRATION_KEY=generate-a-long-random-secret-for-your-flow
```

**Generate a secure JWT secret:**

```bash
# Linux/macOS
openssl rand -hex 32

# Windows (PowerShell)
-join ((48..57) + (65..90) + (97..122) | Get-Random -Count 32 | % {[char]$_})
```

### Frontend Configuration

Create `frontend/.env.local`:

```env
NEXT_PUBLIC_API_URL=http://localhost:8000
```

---

## 🏃 Running the Application

### Start the Database

If using Docker:

```bash
docker-compose up -d
```

### Start the Backend

#### Windows

```bash
cd backend
start.bat
```

#### Linux/macOS

```bash
cd backend
chmod +x start.sh
./start.sh
```

The backend will be available at:
- **API**: http://localhost:8000
- **API Docs**: http://localhost:8000/docs
- **Health Check**: http://localhost:8000/health

### Start the Frontend

```bash
cd frontend
npm run dev
```

The frontend will be available at: http://localhost:3000

---

## 📖 Usage Guide

### 1. Register/Login

1. Navigate to http://localhost:3000
2. Click "Register" tab
3. Enter email and password
4. Click "Register" (you'll be automatically logged in)

### 2. Upload Invoices

1. On the dashboard, drag and drop PDF files or click to browse
2. Select 1-5 invoice PDF files
3. Files will be uploaded and listed in the table

### 3. Process Invoices

1. Find your uploaded invoice in the table (status: "pending")
2. Click "Process" button
3. Wait for AI extraction (status changes to "processing" then "completed")

### 4. Review and Edit Data

1. Click "View & Edit" on a completed invoice
2. Left panel shows the original PDF
3. Right panel shows extracted data
4. Edit any fields as needed:
   - Invoice header fields (number, date, vendor, customer, amounts)
   - Line items (add, edit, or remove rows)
5. Click "Save Changes" to persist edits

### 5. Logout

Click "Logout" in the header to sign out.

---

## 📚 API Documentation

### Authentication Endpoints

#### Register User
```http
POST /auth/register
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "securepassword"
}
```

#### Login
```http
POST /auth/login
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "securepassword"
}

Response:
{
  "access_token": "eyJ...",
  "token_type": "bearer"
}
```

#### Get Current User
```http
GET /auth/me
Authorization: Bearer {token}
```

### Invoice Endpoints

#### Upload Invoices
```http
POST /invoices/upload
Authorization: Bearer {token}
Content-Type: multipart/form-data

files: [file1.pdf, file2.pdf, ...]
```

#### Process Invoice
```http
POST /invoices/{invoice_id}/process
Authorization: Bearer {token}
```

#### List Invoices
```http
GET /invoices
Authorization: Bearer {token}
```

#### Get Invoice Details
```http
GET /invoices/{invoice_id}
Authorization: Bearer {token}
```

#### Update Invoice Data
```http
PUT /invoices/{invoice_id}/data
Authorization: Bearer {token}
Content-Type: application/json

{
  "amended_data": {
    "invoice_number": "INV-001",
    "date": "2025-11-27",
    ...
  }
}
```

#### Get PDF File
```http
GET /invoices/{invoice_id}/pdf
Authorization: Bearer {token}
```

For interactive API documentation, visit: http://localhost:8000/docs

---

## 📁 Project Structure

```
invoiceAI/
├── backend/                    # FastAPI backend
│   ├── app/
│   │   ├── main.py            # FastAPI app initialization
│   │   ├── database.py        # Database connection
│   │   ├── models.py          # SQLAlchemy models
│   │   ├── auth.py            # JWT authentication
│   │   ├── routers/           # API endpoints
│   │   │   ├── auth.py        # Auth routes
│   │   │   └── invoices.py    # Invoice routes
│   │   └── services/          # Business logic
│   │       ├── gemini_service.py   # Gemini Vision integration
│   │       └── invoice_service.py  # Invoice processing
│   ├── uploads/               # Uploaded PDF storage
│   ├── requirements.txt       # Python dependencies
│   ├── .env.example          # Environment template
│   ├── setup.sh/.bat         # Setup scripts
│   └── start.sh/.bat         # Start scripts
│
├── frontend/                  # Next.js frontend
│   ├── src/
│   │   ├── app/
│   │   │   ├── page.tsx              # Home/redirect
│   │   │   ├── login/page.tsx        # Login/register
│   │   │   ├── dashboard/page.tsx    # Upload & list
│   │   │   └── invoices/[id]/page.tsx  # Review & edit
│   │   ├── components/
│   │   │   ├── PDFViewer.tsx         # PDF display
│   │   │   ├── InvoiceForm.tsx       # Header fields
│   │   │   └── LineItemsTable.tsx    # Line items editor
│   │   └── lib/
│   │       └── api.ts                # API client
│   ├── package.json
│   └── .env.local.example
│
├── docker-compose.yml         # PostgreSQL container
└── README.md                  # This file
```

---

## ⚠️ Known Limitations

This is a **Proof of Concept** designed to demonstrate feasibility:

### Data Extraction Quality
- Extraction accuracy depends on invoice format, clarity, and structure
- Complex or poorly scanned invoices may have lower accuracy
- Multi-page invoices process only the first 3 pages

### User Interface
- UI is functional but minimal (POC-grade, not production-polished)
- Limited mobile responsiveness
- Basic error handling

### Performance
- No optimization for large-scale processing
- Gemini API rate limits apply
- Single-threaded processing (no parallel batch processing)

### Security
- Basic JWT authentication (no refresh tokens)
- No rate limiting
- No HTTPS (local development)

### Deployment
- Configured for local development
- Azure deployment requires additional configuration

---

## 🔧 Troubleshooting

### Database Connection Errors

**Error:** `connection refused` on port 5433

**Solution:**
```bash
# Check if PostgreSQL container is running
docker ps

# Start the database
docker-compose up -d

# Check logs
docker-compose logs postgres
```

### Gemini API Errors

**Error:** `API key not valid` or `403 Forbidden`

**Solution:**
- Verify your `GEMINI_API_KEY` in `backend/.env`
- Get a new key from [Google AI Studio](https://makersuite.google.com/app/apikey)
- Ensure the API is enabled for your Google Cloud project

### PDF Processing Errors

**Error:** `Unable to convert PDF to images`

**Solution:**
- Install Poppler (see Prerequisites)
- Windows: Add Poppler bin folder to PATH
- Test: `pdftoppm -h` (should show help)

### Port Already in Use

**Error:** `Address already in use` on port 8000 or 3000

**Solution:**
```bash
# Find process using port
# Windows
netstat -ano | findstr :8000

# Linux/macOS
lsof -i :8000

# Kill the process or change port in config
```

### Frontend Build Errors

**Error:** `Module not found` or TypeScript errors

**Solution:**
```bash
cd frontend
rm -rf node_modules package-lock.json
npm install
npm run dev
```

---

## 🚀 Future Enhancements

### Phase 1: Production Readiness
- Error handling and retry logic
- Rate limiting and request throttling
- Audit logs and activity tracking
- Enhanced UI/UX with loading states
- Mobile-responsive design
- HTTPS and security hardening

### Phase 2: Advanced Features
- **ERP Integrations**: SAP, Tally, Zoho Books, QuickBooks, NetSuite
- **Bulk Processing**: Process 50+ invoices per batch
- **Role-Based Access**: Admin, Reviewer, Viewer roles
- **Analytics Dashboard**: Processing metrics, accuracy stats
- **Vendor Templates**: Learn and improve accuracy per vendor
- **Export Options**: Excel, CSV, JSON export
- **Email Integration**: Email invoice upload

### Phase 3: AI Enhancements
- Multi-model fallback (Gemini → Azure Vision → Tesseract)
- Continuous learning from corrections
- Confidence scores for extracted fields
- Auto-validation rules
- Duplicate invoice detection

### Phase 4: Azure Deployment
- Azure App Services deployment
- Azure Blob Storage for PDFs
- Azure SQL Database
- Azure Monitor and Application Insights
- CI/CD pipeline with GitHub Actions

---

## 📞 Support

### 7-Day Post-Delivery Support Included
- Bug fixes
- Prompt tuning for better extraction
- Configuration assistance

### Contact
**AG Tech Consulting PTE Ltd**  
Email: support@agtechconsulting.com  
Website: www.agtechconsulting.com

---

## 📄 License

This is a proprietary POC developed for Sambe Consulting Pvt Ltd by AG Tech Consulting PTE Ltd.

© 2025 AG Tech Consulting PTE Ltd. All rights reserved.

---

## 🙏 Acknowledgments

- **Google Gemini**: AI model for vision and structured output
- **FastAPI**: High-performance Python web framework
- **Next.js**: React framework for production
- **PostgreSQL**: Reliable relational database

---

**Happy Invoice Processing! 🎉**

For any questions or issues, please reach out to our support team.

