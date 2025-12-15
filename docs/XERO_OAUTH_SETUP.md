# Xero OAuth 2.0 Integration Setup Guide

This guide walks you through setting up real Xero OAuth 2.0 integration for Invoice AI.

## Prerequisites

1. A Xero account (you can sign up for a free developer account)
2. Access to your deployment URL (production or localhost)

## Step 1: Create a Xero App

1. Go to the [Xero Developer Portal](https://developer.xero.com/)
2. Click **My Apps** → **New App**
3. Fill in the application details:
   - **App Name**: `InvoiceAI` (or your preferred name)
   - **Company/Application URL**: Your application URL
     - Production: `https://invoiceocr.sambeconsulting.com`
     - Local: `http://localhost:3000`
   - **Integration Type**: Web app
   - **OAuth 2.0 redirect URIs**: Your redirect URI
     - Production: `https://invoiceocr.sambeconsulting.com/settings`
     - Local: `http://localhost:3000/settings`

4. Click **Create app**

## Step 2: Get Your Credentials

After creating the app:

1. You'll see your **Client ID** - copy this
2. Click **Generate a secret** to get your **Client Secret** - copy this immediately (you won't see it again)
3. Save both credentials securely

## Step 3: Configure Backend Environment Variables

### For Production (https://invoiceocr.sambeconsulting.com)

Add these environment variables to your backend `.env` file:

```env
# Xero OAuth Configuration
XERO_CLIENT_ID=your_xero_client_id_here
XERO_CLIENT_SECRET=your_xero_client_secret_here
XERO_REDIRECT_URI=https://invoiceocr.sambeconsulting.com/settings
FRONTEND_URL=https://invoiceocr.sambeconsulting.com

# CORS Configuration (add your domain)
CORS_ORIGINS=https://invoiceocr.sambeconsulting.com,http://localhost:3000
```

### For Local Development

```env
# Xero OAuth Configuration
XERO_CLIENT_ID=your_xero_client_id_here
XERO_CLIENT_SECRET=your_xero_client_secret_here
XERO_REDIRECT_URI=http://localhost:3000/settings
FRONTEND_URL=http://localhost:3000

# CORS Configuration
CORS_ORIGINS=http://localhost:3000
```

## Step 4: Run Database Migration

The integration requires a new database table. Run the migration:

```bash
cd backend
psql $DATABASE_URL -f migrations/add_erp_integrations.sql
```

Or manually in your PostgreSQL database:

```sql
\i migrations/add_erp_integrations.sql
```

## Step 5: Restart Backend

Restart your backend server to load the new environment variables:

```bash
cd backend
./start.sh  # or start.bat on Windows
```

## Step 6: Test the Integration

1. Log in to Invoice AI
2. Go to **Settings** → **Integrations** tab
3. Find **Xero** in the list
4. Click **Connect**
5. You'll be redirected to Xero to authorize the connection
6. Select your organization and click **Allow access**
7. You'll be redirected back to Invoice AI with a success message

## Step 7: Sync an Invoice

1. Go to **Dashboard**
2. Process an invoice (or use an existing one)
3. Click the **Sync to ERP** button
4. Select **Xero**
5. The invoice will be synced as a **Draft Bill** in Xero

## API Endpoints

The following endpoints are now available:

### Authorization Flow
- `GET /xero/authorize` - Initiate OAuth flow
- `GET /xero/callback` - Handle OAuth callback (automatic)

### Integration Management
- `GET /xero/status` - Get connection status
- `POST /xero/disconnect` - Disconnect Xero
- `POST /xero/refresh` - Refresh access token

### Testing Connection
- `POST /integrations/test` - Test ERP connection
  ```json
  {
    "provider": "xero",
    "config": {
      "apiKey": "access_token",
      "orgId": "tenant_id"
    }
  }
  ```

### Syncing Invoices
- `POST /integrations/sync` - Sync single invoice
  ```json
  {
    "provider": "xero",
    "config": {
      "apiKey": "access_token",
      "orgId": "tenant_id"
    },
    "invoice_data": {
      "invoice_number": "INV-001",
      "vendor_name": "Acme Corp",
      "date": "2025-01-15",
      "total": 1000.00,
      "line_items": [...]
    }
  }
  ```

## Troubleshooting

### Connection Test Fails

**Error: "Xero authentication failed - token may be expired"**

Solution: The access token expires after 30 minutes. Call the `/xero/refresh` endpoint to get a new token:

```bash
curl -X POST http://localhost:8000/xero/refresh \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

### Redirect URI Mismatch

**Error: "redirect_uri_mismatch"**

Solution: Ensure the `XERO_REDIRECT_URI` in your `.env` file **exactly matches** the redirect URI configured in your Xero app (including http/https, no trailing slash).

### Supplier Not Found

**Error: "Supplier 'XYZ' not found in Xero"**

Solution: Before syncing an invoice, the supplier/contact must exist in Xero. Either:
1. Create the supplier manually in Xero, OR
2. Update the code to auto-create suppliers (see `XeroConnector.check_supplier_exists()`)

### CORS Errors

**Error: "Access to fetch blocked by CORS policy"**

Solution: Add your frontend URL to the `CORS_ORIGINS` environment variable in the backend `.env` file.

## Security Notes

1. **Never commit your `.env` file** - it contains sensitive credentials
2. Access tokens are stored encrypted in the database
3. Tokens automatically refresh before expiration
4. Use HTTPS in production (required by Xero for OAuth)
5. Implement rate limiting on the OAuth endpoints in production

## Testing in Demo Mode vs Real Mode

### Demo Mode (Old Behavior)
- Accepted any credentials
- Didn't make real API calls
- Returned fake success messages

### Real Mode (Current Implementation)
- Uses OAuth 2.0 with real Xero credentials
- Makes actual API calls to Xero
- Creates real draft bills in your Xero organization
- Validates supplier existence
- Returns real Xero invoice IDs

## Next Steps

- [ ] Add webhook support for bidirectional sync
- [ ] Implement auto-creation of suppliers
- [ ] Add support for multiple Xero organizations
- [ ] Add invoice status tracking (Draft → Approved → Paid)
- [ ] Implement attachment upload (PDF to Xero)

## Support

For issues with:
- **Xero OAuth**: Check the [Xero OAuth 2.0 documentation](https://developer.xero.com/documentation/oauth2/overview)
- **Invoice AI Integration**: Check the logs in `backend/` or contact support

