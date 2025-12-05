@echo off
REM Backend Setup Script for Windows

echo Setting up Invoice AI Backend...

REM Check if Python is installed
python --version >nul 2>&1
if errorlevel 1 (
    echo Python is not installed. Please install Python 3.10 or higher.
    exit /b 1
)

echo Python found

REM Create virtual environment if it doesn't exist
if not exist "venv" (
    echo Creating virtual environment...
    python -m venv venv
)

REM Activate virtual environment
echo Activating virtual environment...
call venv\Scripts\activate.bat

REM Install dependencies
echo Installing dependencies...
python -m pip install --upgrade pip
pip install -r requirements.txt

REM Check if .env file exists
if not exist ".env" (
    echo Creating .env file from template...
    copy .env.example .env
    echo Please edit .env file and add your GEMINI_API_KEY
    echo Generate a secure JWT_SECRET_KEY
)

echo.
echo Backend setup complete!
echo.
echo Next steps:
echo 1. Make sure PostgreSQL is running (docker-compose up -d)
echo 2. Edit backend\.env and set GEMINI_API_KEY and JWT_SECRET_KEY
echo 3. Run the backend: uvicorn app.main:app --reload
echo.

pause

