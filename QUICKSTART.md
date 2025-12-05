# Invoice AI - Quick Start Guide

## 🚀 Quick Start (5 Minutes)

### 1. Prerequisites Check

- ✅ Python 3.10+
- ✅ Node.js 18+
- ✅ Docker (for PostgreSQL)
- ✅ Gemini API Key

### 2. Database

```bash
docker-compose up -d
```

### 3. Backend

```bash
cd backend

# Windows
setup.bat
# Edit .env file with your GEMINI_API_KEY
start.bat

# Linux/macOS
./setup.sh
# Edit .env file with your GEMINI_API_KEY
./start.sh
```

### 4. Frontend

```bash
cd frontend
npm install
npm run dev
```

### 5. Access

- Frontend: http://localhost:3000
- Backend API: http://localhost:8000/docs

### 6. Use

1. Register at http://localhost:3000
2. Upload invoice PDFs
3. Click "Process"
4. Click "View & Edit" to review and correct data
5. Click "Save Changes"

---

## 📋 Environment Variables

### Backend (.env)
```env
DATABASE_URL=postgresql://postgres:avinash@localhost:5433/invoiceai
JWT_SECRET_KEY=<generate-with-openssl-rand-hex-32>
GEMINI_API_KEY=<your-gemini-api-key>
```

### Frontend (.env.local)
```env
NEXT_PUBLIC_API_URL=http://localhost:8000
```

---

## 🆘 Common Issues

**Database connection failed?**
```bash
docker-compose up -d
docker-compose ps
```

**PDF processing error?**
Install Poppler:
- Windows: Download from [poppler-windows](https://github.com/oschwartz10612/poppler-windows/releases)
- Mac: `brew install poppler`
- Linux: `sudo apt-get install poppler-utils`

**Port 8000 in use?**
```bash
# Kill existing process or change port
uvicorn app.main:app --reload --port 8001
```

---

## 📚 Full Documentation

See [README.md](README.md) for complete documentation.

---

**AG Tech Consulting PTE Ltd © 2025**

