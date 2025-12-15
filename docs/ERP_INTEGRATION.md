# ERP Integration Guide

This document explains how to configure and use ERP integrations in Invoice AI.

## Supported Integrations

### 1. Xero
**API Documentation:** https://developer.xero.com/documentation/api/accounting/overview

**⚠️ IMPORTANT: Xero now uses OAuth 2.0 - Manual API keys are not supported**

**Setup Steps:**
1. Go to [Xero Developer Portal](https://developer.xero.com)
2. Click **My Apps** → **New App**
3. Choose **Web app** integration type
4. Fill in your application details:
   - **App Name**: InvoiceAI
   - **Company/Application URL**: Your frontend URL (e.g., `https://invoiceocr.sambeconsulting.com`)
   - **OAuth 2.0 redirect URI**: `YOUR_FRONTEND_URL/settings`
     - Production: `https://invoiceocr.sambeconsulting.com/settings`
     - Local: `http://localhost:3000/settings`
5. Click **Create app** and save your **Client ID** and **Client Secret**

**Backend Configuration (.env file):**
```env
XERO_CLIENT_ID=your_client_id_here
XERO_CLIENT_SECRET=your_client_secret_here
XERO_REDIRECT_URI=https://invoiceocr.sambeconsulting.com/settings
FRONTEND_URL=https://invoiceocr.sambeconsulting.com
```

**How to Connect:**
1. In Invoice AI, go to Settings → Integrations
2. Click **Connect** on Xero
3. You'll be redirected to Xero to authorize access
4. Select your organization and click **Allow access**
5. You'll be redirected back with a success message

**Required Scopes:**
- `offline_access` - For refresh tokens
- `accounting.transactions` - Create and manage bills
- `accounting.contacts.read` - Read supplier information
- `accounting.settings.read` - Read organization settings

**API Endpoint:** `https://api.xero.com/api.xro/2.0`

**See detailed setup guide:** [XERO_OAUTH_SETUP.md](./XERO_OAUTH_SETUP.md)

---

### 2. QuickBooks Online
**API Documentation:** https://developer.intuit.com/app/developer/qbo/docs/api/accounting/most-commonly-used/invoice

**Setup Steps:**
1. Log in to QuickBooks Developer Portal
2. Create a new app
3. Get your OAuth 2.0 credentials
4. Copy Client ID and Client Secret
5. Note your Company/Realm ID

**Required Credentials:**
- API Key: OAuth Client ID
- API Secret: OAuth Client Secret  
- Organization ID: Your Company/Realm ID

**API Endpoint:** `https://quickbooks.api.intuit.com/v3/company/{realmId}`

---

### 3. SAP
**API Documentation:** https://api.sap.com/

**Setup Steps:**
1. Access your SAP API Business Hub
2. Navigate to Invoice Management APIs
3. Generate API credentials
4. Note your system URL and credentials

**Required Credentials:**
- API Key: SAP username/API key
- API Secret: SAP password
- Organization ID: Company Code (default: 1000)

**API Endpoint:** `https://api.sap.com/s4hanacloud`

---

### 4. NetSuite
**API Documentation:** https://docs.oracle.com/en/cloud/saas/netsuite/ns-online-help/section_4724921034.html

**Setup Steps:**
1. Log in to NetSuite
2. Setup → Company → Enable Features → SuiteCloud → REST Web Services
3. Create integration record
4. Generate tokens

**Required Credentials:**
- API Key: Account email
- API Secret: Token secret
- Organization ID: Account ID

**API Endpoint:** `https://{accountId}.restlets.api.netsuite.com`

---

### 5. Zoho Books
**API Documentation:** https://www.zoho.com/books/api/v3/

**Setup Steps:**
1. Log in to Zoho API Console
2. Create a new Client ID
3. Generate OAuth token
4. Get Organization ID from Zoho Books

**Required Credentials:**
- API Key: OAuth Access Token
- API Secret: (Leave empty for OAuth)
- Organization ID: Your Zoho Organization ID

**API Endpoint:** `https://books.zoho.com/api/v3`

---

## Integration Architecture

### Frontend (TypeScript)
```
frontend/src/lib/erpIntegration.ts
- XeroConnector
- QuickBooksConnector  
- SAPConnector
- NetSuiteConnector
- ZohoConnector
- ERPIntegrationService
```

### Backend (Python)
```
backend/app/services/erp_integration.py
- XeroConnector
- QuickBooksConnector
- SAPConnector
- NetSuiteConnector
- ZohoConnector
- ERPIntegrationService
```

### API Endpoints
```
POST /integrations/test
POST /integrations/sync
POST /integrations/sync-batch
```

---

## Usage Flow

### 1. Connect Integration
```typescript
// User clicks "Connect" on integration card
// Fills in API credentials
// Clicks "Test Connection"
// Backend validates credentials
// Saves configuration to localStorage
// Status changes to "Connected"
```

### 2. Sync Invoice
```typescript
// User reviews invoice
// Clicks "Sync to ERP" button
// Selects connected provider
// Backend transforms and sends data
// Returns success/failure status
```

### 3. Auto-Sync (Optional)
```typescript
// Enable "Auto-sync" in integration config
// After processing, automatically sync to ERP
// Log results in database
```

---

## Data Transformation

Each connector transforms Invoice AI data to provider-specific format:

### Example: Xero Format
```json
{
  "Type": "ACCPAY",
  "Contact": { "Name": "Vendor Name" },
  "LineItems": [
    {
      "Description": "Item description",
      "Quantity": 1,
      "UnitAmount": 100.00,
      "LineAmount": 100.00
    }
  ]
}
```

---

## Error Handling

### Connection Errors
- Invalid credentials → Show error message
- Network timeout → Retry logic
- Rate limiting → Queue requests

### Sync Errors
- Missing required fields → Validation error
- Duplicate invoice → Check existing records
- API errors → Log and display to user

---

## Security

### Credential Storage
- **Frontend:** localStorage (encrypted in production)
- **Backend:** Environment variables
- **Never commit** credentials to git

### API Security
- All requests use HTTPS
- OAuth 2.0 where supported
- API key rotation recommended
- Audit logs for all sync operations

---

## Testing

### Manual Testing
1. Configure integration with test credentials
2. Click "Test Connection"
3. Sync a sample invoice
4. Verify in target system

### Automated Testing
```bash
# Backend tests
pytest backend/tests/test_erp_integration.py

# Frontend tests  
npm test src/lib/erpIntegration.test.ts
```

---

## Rate Limits

| Provider | Limit | Note |
|----------|-------|------|
| Xero | 60 calls/min | Per tenant |
| QuickBooks | 500 calls/min | Per app |
| SAP | Varies | Per contract |
| NetSuite | 1000 calls/hour | Per account |
| Zoho | 100 calls/min | Per organization |

**Recommendation:** Add 1-second delay between batch syncs

---

## Troubleshooting

### "Connection Failed"
- Verify API credentials are correct
- Check if API is enabled in provider settings
- Ensure organization ID is correct
- Check network connectivity

### "Sync Failed"
- Verify invoice data is complete
- Check required fields for provider
- Review error message for details
- Check rate limits

### "Invalid Token"
- Tokens may expire (especially OAuth)
- Refresh token if needed
- Reconnect integration

---

## Future Enhancements

- [ ] OAuth 2.0 flow for better security
- [ ] Webhook support for bidirectional sync
- [ ] Sync history and logs
- [ ] Custom field mapping
- [ ] Bulk sync operations
- [ ] Scheduled auto-sync
- [ ] Error retry mechanism
- [ ] Integration health monitoring

