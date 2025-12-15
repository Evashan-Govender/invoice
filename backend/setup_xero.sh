#!/bin/bash

# Quick Setup Script for Xero OAuth Integration
# This script helps you configure Xero OAuth in one go

echo "═══════════════════════════════════════════════════════"
echo "  Invoice AI - Xero OAuth 2.0 Setup"
echo "═══════════════════════════════════════════════════════"
echo ""

# Check if .env file exists
if [ ! -f ".env" ]; then
    echo "❌ Error: .env file not found in backend directory"
    echo "   Please run setup.sh first to create the .env file"
    exit 1
fi

echo "This script will help you configure Xero OAuth 2.0 integration."
echo ""
echo "Before continuing, make sure you have:"
echo "  1. Created a Xero app at https://developer.xero.com"
echo "  2. Your Xero Client ID"
echo "  3. Your Xero Client Secret"
echo ""
read -p "Press Enter to continue..."

# Get Xero credentials
echo ""
echo "Enter your Xero credentials:"
read -p "Xero Client ID: " XERO_CLIENT_ID
read -sp "Xero Client Secret: " XERO_CLIENT_SECRET
echo ""

# Get deployment URL
echo ""
echo "What is your deployment URL?"
echo "  For local development: http://localhost:3000"
echo "  For production: https://your-domain.com"
read -p "Frontend URL: " FRONTEND_URL

# Set redirect URI
XERO_REDIRECT_URI="${FRONTEND_URL}/settings"

# Check if Xero config already exists
if grep -q "XERO_CLIENT_ID" .env; then
    echo ""
    echo "⚠️  Xero configuration already exists in .env"
    read -p "Do you want to update it? (y/n): " UPDATE_CHOICE
    if [[ $UPDATE_CHOICE != "y" && $UPDATE_CHOICE != "Y" ]]; then
        echo "Setup cancelled."
        exit 0
    fi
    
    # Remove existing Xero config
    sed -i '/XERO_CLIENT_ID/d' .env
    sed -i '/XERO_CLIENT_SECRET/d' .env
    sed -i '/XERO_REDIRECT_URI/d' .env
    sed -i '/FRONTEND_URL/d' .env
fi

# Append Xero configuration
echo "" >> .env
echo "# Xero OAuth Configuration" >> .env
echo "XERO_CLIENT_ID=${XERO_CLIENT_ID}" >> .env
echo "XERO_CLIENT_SECRET=${XERO_CLIENT_SECRET}" >> .env
echo "XERO_REDIRECT_URI=${XERO_REDIRECT_URI}" >> .env
echo "FRONTEND_URL=${FRONTEND_URL}" >> .env

# Update CORS if needed
if grep -q "CORS_ORIGINS" .env; then
    echo ""
    echo "ℹ️  CORS_ORIGINS found in .env. Make sure it includes your frontend URL."
else
    echo "CORS_ORIGINS=${FRONTEND_URL}" >> .env
fi

echo ""
echo "✅ Xero OAuth configuration added to .env"
echo ""
echo "═══════════════════════════════════════════════════════"
echo "  Next Steps:"
echo "═══════════════════════════════════════════════════════"
echo ""
echo "1. Run the database migration:"
echo "   psql \$DATABASE_URL -f migrations/add_erp_integrations.sql"
echo ""
echo "2. Restart your backend server:"
echo "   ./start.sh"
echo ""
echo "3. In Xero Developer Portal, add this redirect URI to your app:"
echo "   ${XERO_REDIRECT_URI}"
echo ""
echo "4. Test the integration:"
echo "   - Go to ${FRONTEND_URL}/settings"
echo "   - Click 'Connect' on Xero"
echo "   - Authorize the connection"
echo ""
echo "For detailed setup instructions, see: docs/XERO_OAUTH_SETUP.md"
echo ""

