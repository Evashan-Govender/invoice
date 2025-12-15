@echo off
REM Quick Setup Script for Xero OAuth Integration
REM This script helps you configure Xero OAuth in one go

echo ===============================================================
echo   Invoice AI - Xero OAuth 2.0 Setup
echo ===============================================================
echo.

REM Check if .env file exists
if not exist ".env" (
    echo Error: .env file not found in backend directory
    echo    Please run setup.bat first to create the .env file
    exit /b 1
)

echo This script will help you configure Xero OAuth 2.0 integration.
echo.
echo Before continuing, make sure you have:
echo   1. Created a Xero app at https://developer.xero.com
echo   2. Your Xero Client ID
echo   3. Your Xero Client Secret
echo.
pause

REM Get Xero credentials
echo.
echo Enter your Xero credentials:
set /p XERO_CLIENT_ID="Xero Client ID: "
set /p XERO_CLIENT_SECRET="Xero Client Secret: "

REM Get deployment URL
echo.
echo What is your deployment URL?
echo   For local development: http://localhost:3000
echo   For production: https://your-domain.com
set /p FRONTEND_URL="Frontend URL: "

REM Set redirect URI
set XERO_REDIRECT_URI=%FRONTEND_URL%/settings

REM Check if Xero config already exists
findstr /C:"XERO_CLIENT_ID" .env >nul 2>&1
if %ERRORLEVEL% EQU 0 (
    echo.
    echo WARNING: Xero configuration already exists in .env
    set /p UPDATE_CHOICE="Do you want to update it? (y/n): "
    if /i not "%UPDATE_CHOICE%"=="y" (
        echo Setup cancelled.
        exit /b 0
    )
    
    REM Create temp file without Xero config
    findstr /v /C:"XERO_CLIENT_ID" /C:"XERO_CLIENT_SECRET" /C:"XERO_REDIRECT_URI" /C:"FRONTEND_URL" .env > .env.tmp
    move /y .env.tmp .env >nul
)

REM Append Xero configuration
echo. >> .env
echo # Xero OAuth Configuration >> .env
echo XERO_CLIENT_ID=%XERO_CLIENT_ID% >> .env
echo XERO_CLIENT_SECRET=%XERO_CLIENT_SECRET% >> .env
echo XERO_REDIRECT_URI=%XERO_REDIRECT_URI% >> .env
echo FRONTEND_URL=%FRONTEND_URL% >> .env

REM Update CORS if needed
findstr /C:"CORS_ORIGINS" .env >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo CORS_ORIGINS=%FRONTEND_URL% >> .env
)

echo.
echo Xero OAuth configuration added to .env
echo.
echo ===============================================================
echo   Next Steps:
echo ===============================================================
echo.
echo 1. Run the database migration:
echo    psql %%DATABASE_URL%% -f migrations\add_erp_integrations.sql
echo.
echo 2. Restart your backend server:
echo    start.bat
echo.
echo 3. In Xero Developer Portal, add this redirect URI to your app:
echo    %XERO_REDIRECT_URI%
echo.
echo 4. Test the integration:
echo    - Go to %FRONTEND_URL%/settings
echo    - Click 'Connect' on Xero
echo    - Authorize the connection
echo.
echo For detailed setup instructions, see: docs\XERO_OAUTH_SETUP.md
echo.
pause

