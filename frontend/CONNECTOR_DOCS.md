# ERP Integration Connectors

This document explains how the ERP integration connectors work in the Invoice AI system.

## Architecture Overview

The connector system uses a **modular, extensible architecture** with:
- **Base connector class** - Abstract interface all connectors implement
- **Individual connectors** - Xero, QuickBooks, SAP, NetSuite, Zoho
- **Connector manager** - Singleton to manage all connector instances
- **UI components** - Settings page and sync buttons

## File Structure

```
frontend/src/lib/connectors/
├── base.ts          # Base connector interface
├── xero.ts          # Xero implementation
├── quickbooks.ts    # QuickBooks implementation
├── sap.ts           # SAP implementation
├── netsuite.ts      # NetSuite implementation
├── zoho.ts          # Zoho implementation
└── index.ts         # Connector manager & exports
```

## How It Works

### 1. Base Connector (`base.ts`)

All connectors extend the `BaseConnector` abstract class which defines:

```typescript
abstract class BaseConnector {
  abstract testConnection(): Promise<boolean>;
  abstract syncInvoice(invoiceData: InvoiceData): Promise<SyncResult>;
  abstract getStatus(): Promise<ConnectorStatus>;
}
```

**Key Methods:**
- `testConnection()` - Validates API credentials
- `syncInvoice()` - Sends invoice data to ERP system
- `getStatus()` - Gets connection health status

### 2. Xero Connector (`xero.ts`)

**API Endpoint:** `https://api.xero.com/api.xro/2.0`

**Features:**
- OAuth2 Bearer token authentication
- Creates Bills (Accounts Payable)
- Line item mapping
- Tax calculation
- Currency support

**Data Transformation:**
```typescript
{
  Type: 'ACCPAY',
  Contact: { Name: vendor_name },
  LineItems: [...],
  TotalAmt: total_amount
}
```

### 3. QuickBooks Connector (`quickbooks.ts`)

**API Endpoint:** `https://quickbooks.api.intuit.com/v3`

**Features:**
- OAuth2 authentication
- Bill creation API
- Vendor reference linking
- Item-based expense lines
- Tax detail handling

**Data Transformation:**
```typescript
{
  TxnDate: date,
  VendorRef: { name: vendor_name },
  Line: [...line_items],
  TxnTaxDetail: { TotalTax: tax }
}
```

### 4. SAP Connector (`sap.ts`)

**API Endpoint:** Custom (customer-specific)

**Features:**
- Basic authentication
- OData API integration
- Supplier invoice creation
- GL account mapping
- Tax code handling

**Data Transformation:**
```typescript
{
  InvoiceHeader: {...},
  VendorDetails: {...},
  LineItems: [...with GL accounts]
}
```

### 5. NetSuite Connector (`netsuite.ts`)

**API Endpoint:** `https://{account}.suitetalk.api.netsuite.com`

**Features:**
- NLAuth authentication
- Vendor bill creation
- RESTlet support
- Multi-currency
- Custom field mapping

**Data Transformation:**
```typescript
{
  tranId: invoice_number,
  entity: { name: vendor },
  item: [...line_items],
  total: total_amount
}
```

### 6. Zoho Books Connector (`zoho.ts`)

**API Endpoint:** `https://books.zoho.com/api/v3`

**Features:**
- OAuth token authentication
- Bill API
- Organization-scoped
- Tax total handling
- Notes field support

## Usage Flow

### Setup (One-time)

1. **User goes to Settings page**
2. **Clicks "Connect" on integration card**
3. **Enters API credentials in modal**
4. **Clicks "Test Connection"** (optional)
5. **Clicks "Save & Connect"**
6. **Connector is initialized and stored**

### Syncing Invoices

1. **User opens processed invoice**
2. **Clicks "Sync to ERP" button**
3. **Dropdown shows active connectors**
4. **User selects specific ERP or "Sync to All"**
5. **Connector transforms data and sends to ERP API**
6. **Success/failure message shown**
7. **External ID returned (if successful)**

## Connector Manager

The `ConnectorManager` singleton provides:

```typescript
// Create connector
connectorManager.createConnector(type, config);

// Test connection
connectorManager.testConnection(type);

// Sync invoice to one
connectorManager.syncInvoice(type, invoiceData);

// Sync to all active
connectorManager.syncToAll(invoiceData);

// Get status
connectorManager.getAllStatus();

// Load from storage
connectorManager.loadFromStorage();
```

## Data Transformation

Each connector automatically transforms the standard Invoice AI format to the ERP-specific format:

**Input (Standard):**
```json
{
  "invoice_number": "INV-001",
  "date": "2025-11-29",
  "vendor_name": "Acme Corp",
  "line_items": [...],
  "total_amount": 1000
}
```

**Output (Xero Example):**
```json
{
  "Type": "ACCPAY",
  "Contact": { "Name": "Acme Corp" },
  "LineItems": [...transformed...],
  "TotalAmt": 1000
}
```

## Error Handling

Each connector implements robust error handling:

- **Validation** - Checks required config fields
- **API errors** - Captures HTTP status codes
- **Exceptions** - Try-catch blocks around all API calls
- **Logging** - Console logging for debugging
- **User feedback** - Alert messages with clear status

## Authentication Methods

| ERP | Auth Method | Token Location |
|-----|-------------|----------------|
| Xero | OAuth2 Bearer | Authorization header |
| QuickBooks | OAuth2 Bearer | Authorization header |
| SAP | Basic Auth | Authorization header |
| NetSuite | NLAuth | Authorization header |
| Zoho | OAuth Token | Authorization header |

## Testing

### Test Connection Flow:
1. Creates HTTP request to provider's API
2. Sends credentials in appropriate format
3. Validates response status code
4. Returns boolean success/failure
5. Logs result to console

### In Development:
- Use test/sandbox API endpoints
- Test with demo credentials
- Verify transformations with mock data

### In Production:
- Use production API endpoints
- Real customer credentials
- Error monitoring and alerts
- Retry logic for transient failures

## Security Considerations

1. **Credentials Storage:**
   - Currently: localStorage (client-side)
   - Production: Encrypted backend storage

2. **API Secrets:**
   - Password fields for input
   - Never logged to console
   - Should be encrypted at rest

3. **CORS:**
   - May need backend proxy for some APIs
   - Handles cross-origin restrictions

4. **Token Refresh:**
   - OAuth tokens expire
   - Need refresh token flow (future enhancement)

## Adding New Connectors

To add a new ERP integration:

1. **Create connector file** (e.g., `sage.ts`)
```typescript
import { BaseConnector } from './base';

export class SageConnector extends BaseConnector {
  async testConnection() { /* implement */ }
  async syncInvoice() { /* implement */ }
  async getStatus() { /* implement */ }
}
```

2. **Add to factory** (`index.ts`)
```typescript
case 'sage':
  connector = new SageConnector(config);
  break;
```

3. **Add to Settings UI** (`settings/page.tsx`)
```typescript
{
  id: 'sage',
  name: 'Sage',
  description: 'Connect with Sage accounting',
  logo: '🟣',
  status: 'disconnected',
}
```

## API Endpoints Used

### Xero
- `GET /api.xro/2.0/Organisation` - Test connection
- `POST /api.xro/2.0/Invoices` - Create bill

### QuickBooks
- `GET /v3/company/{id}/companyinfo/{id}` - Test connection
- `POST /v3/company/{id}/bill` - Create bill

### SAP
- `GET /sap/opu/odata/sap/API_BUSINESS_PARTNER` - Test connection
- `POST /sap/opu/odata/sap/API_SUPPLIERINVOICE_PROCESS_SRV` - Create invoice

### NetSuite
- `GET /services/rest/record/v1/account/{id}` - Test connection
- `POST /services/rest/record/v1/vendorBill` - Create vendor bill

### Zoho
- `GET /api/v3/organizations` - Test connection
- `POST /api/v3/bills` - Create bill

## Future Enhancements

1. **OAuth2 Flow** - Full OAuth instead of API keys
2. **Webhook Support** - Real-time bidirectional sync
3. **Field Mapping** - Custom field mapping UI
4. **Bulk Sync** - Sync multiple invoices at once
5. **Sync History** - Log of all sync operations
6. **Retry Logic** - Automatic retry for failed syncs
7. **Queue System** - Background job processing
8. **Conflict Resolution** - Handle duplicate invoices
9. **Backend Proxy** - Server-side API calls for security
10. **Encryption** - Encrypt stored credentials

## Troubleshooting

### Connection Fails
- Verify API credentials are correct
- Check organization/tenant ID
- Ensure API access is enabled in ERP
- Check network/CORS issues

### Sync Fails
- Verify invoice data is complete
- Check required fields for ERP
- Review error message details
- Test with simpler invoice first

### Status Not Updating
- Check localStorage is enabled
- Clear browser cache
- Re-initialize connector

## Support

For issues or questions:
1. Check browser console for detailed errors
2. Test connection before syncing
3. Verify credentials in ERP admin panel
4. Review API documentation for specific ERP

