#!/bin/bash

# Backend Setup Script

echo "🚀 Setting up Invoice AI Backend..."

# Check if Python is installed
if ! command -v python3 &> /dev/null; then
    echo "❌ Python 3 is not installed. Please install Python 3.10 or higher."
    exit 1
fi

echo "✓ Python 3 found"

# Create virtual environment if it doesn't exist
if [ ! -d "venv" ]; then
    echo "📦 Creating virtual environment..."
    python3 -m venv venv
fi

# Activate virtual environment
echo "🔧 Activating virtual environment..."
source venv/bin/activate

# Install dependencies
echo "📥 Installing dependencies..."
pip install --upgrade pip
pip install -r requirements.txt

# Check if .env file exists
if [ ! -f ".env" ]; then
    echo "📝 Creating .env file from template..."
    cp .env.example .env
    echo "⚠️  Please edit .env file and add your GEMINI_API_KEY"
    echo "⚠️  Generate a secure JWT_SECRET_KEY (you can use: openssl rand -hex 32)"
fi

echo ""
echo "✅ Backend setup complete!"
echo ""
echo "Next steps:"
echo "1. Make sure PostgreSQL is running (docker-compose up -d)"
echo "2. Edit backend/.env and set GEMINI_API_KEY and JWT_SECRET_KEY"
echo "3. Run the backend: uvicorn app.main:app --reload"
echo ""

