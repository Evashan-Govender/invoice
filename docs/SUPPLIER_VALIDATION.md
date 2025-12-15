# Supplier Validation Implementation

## Summary

I've enhanced the Xero integration to **enforce supplier/seller validation** before syncing invoices. The system now follows this strict workflow:

## Validation Flow

```
1. User clicks "Sync to ERP" on an invoice
         ↓
2. System extracts vendor_name from invoice
         ↓
3. CHECK: Is vendor_name empty?
   → YES: ❌ Return error "Vendor/Supplier name is required"
   → NO: Continue ↓
         ↓
4. API call to Xero: GET /Contacts?where=Name=="VendorName"
         ↓
5. CHECK: Does supplier exist in Xero?
   → NO: ❌ Return error "Supplier not found in Xero"
   → YES: ✅ Continue ↓
         ↓
6. Build invoice payload
         ↓
7. POST to Xero /Invoices endpoint
         ↓
8. ✅ Success: Draft bill created in Xero
```

## Implementation Details

### 1. Added `check_supplier_exists()` Method

**Location**: `backend/app/services/erp_integration.py` - `XeroConnector` class

```python
def check_supplier_exists(self, vendor_name: str) -> bool:
    """
    Check if a supplier/contact exists in Xero
    Queries the Xero Contacts API to verify the supplier exists
    """
    # URL encode vendor name for query
    where_clause = quote(f'Name=="{vendor_name}"')
    
    # Call Xero Contacts API
    response = requests.get(
        f"{self.BASE_URL}/Contacts?where={where_clause}",
        headers=headers,
        timeout=10
    )
    
    # Check if any contacts returned
    contacts = response.json().get("Contacts", [])
    return len(contacts) > 0
```

### 2. Enhanced `sync_invoice()` Method

**Updated validation logic**:

```python
def sync_invoice(self, invoice_data: Dict) -> Dict:
    # Step 1: Extract vendor name
    vendor_name = invoice_data.get("vendor_name", "").strip()
    
    # Step 2: Validate vendor name exists
    if not vendor_name:
        return {
            "success": False,
            "message": "Vendor/Supplier name is required",
            "error": "Cannot sync invoice without a vendor name..."
        }
    
    # Step 3: CRITICAL - Check supplier exists in Xero
    print(f"🔍 Checking if supplier '{vendor_name}' exists...")
    supplier_exists = self.check_supplier_exists(vendor_name)
    
    if not supplier_exists:
        return {
            "success": False,
            "message": f"Supplier '{vendor_name}' not found in Xero",
            "error": "Please create this supplier in Xero first..."
        }
    
    # Step 4: Supplier verified ✅ - proceed with sync
    print(f"✅ Supplier verified. Proceeding with sync...")
    # ... create invoice in Xero
```

## Error Messages

### When vendor name is missing:
```
❌ Error: "Vendor/Supplier name is required"
Detail: "Cannot sync invoice without a vendor name. Please add the vendor name to the invoice."
```

### When supplier doesn't exist in Xero:
```
❌ Error: "Supplier 'ABC Corp' not found in Xero"
Detail: "The supplier 'ABC Corp' does not exist in your Xero organization. 
        Please create this supplier in Xero first, then try syncing again."
```

### When supplier exists:
```
✅ Success: "Invoice 'INV-001' successfully synced to Xero as draft bill for supplier 'ABC Corp'"
```

## Testing

### Test Case 1: Missing Vendor Name
```json
{
  "invoice_number": "INV-001",
  "vendor_name": "",  // Empty
  "total": 1000
}
```
**Expected**: ❌ Error - "Vendor/Supplier name is required"

### Test Case 2: Supplier Doesn't Exist
```json
{
  "invoice_number": "INV-001",
  "vendor_name": "NonExistent Company",
  "total": 1000
}
```
**Expected**: ❌ Error - "Supplier 'NonExistent Company' not found in Xero"

### Test Case 3: Supplier Exists
```json
{
  "invoice_number": "INV-001",
  "vendor_name": "ABC Corp",  // Exists in Xero
  "total": 1000
}
```
**Expected**: ✅ Success - Draft bill created in Xero

## User Workflow

### Before Syncing an Invoice:

1. **Go to Xero** → Contacts → Add Contact
2. **Create the supplier**:
   - Name: Exact name as appears on invoice
   - Type: Supplier
   - Save

3. **Return to Invoice AI** → Dashboard
4. **Click "Sync to ERP"** on the invoice
5. **Select Xero**
6. ✅ **Success**: Invoice synced

### If Supplier Doesn't Exist:

User will see:
```
⚠️ Sync Failed
Supplier 'XYZ Corp' not found in Xero

Please create this supplier in Xero first:
1. Go to Xero → Contacts
2. Click "Add Contact"
3. Enter name: "XYZ Corp"
4. Set type: Supplier
5. Save
6. Return here and try syncing again
```

## Benefits

✅ **Data Integrity**: Ensures all invoices link to valid suppliers
✅ **Error Prevention**: Catches missing suppliers before API call
✅ **User Guidance**: Clear error messages guide users to fix issues
✅ **Audit Trail**: Logs show exactly which suppliers were validated
✅ **API Efficiency**: Validates before attempting to create invoice

## Console Output

When syncing an invoice, you'll see:

```
🔍 Checking if supplier 'Acme Corp' exists in Xero...
✅ Supplier 'Acme Corp' found in Xero
✅ Supplier 'Acme Corp' verified in Xero. Proceeding with sync...
✅ Invoice 'INV-001' synced to Xero: 12345-abcd-6789-efgh
```

Or if supplier doesn't exist:

```
🔍 Checking if supplier 'Unknown Corp' exists in Xero...
❌ Supplier 'Unknown Corp' not found in Xero
```

## API Endpoint Used

```
GET https://api.xero.com/api.xro/2.0/Contacts?where=Name=="SupplierName"

Headers:
  Authorization: Bearer {access_token}
  Xero-tenant-id: {tenant_id}
  Accept: application/json

Response:
{
  "Contacts": [
    {
      "ContactID": "...",
      "Name": "SupplierName",
      "IsSupplier": true,
      ...
    }
  ]
}
```

## Future Enhancements

- [ ] **Auto-create suppliers**: If supplier doesn't exist, create it automatically
- [ ] **Fuzzy matching**: Suggest similar supplier names if exact match not found
- [ ] **Cache validation**: Cache supplier existence checks to reduce API calls
- [ ] **Bulk validation**: Validate multiple invoices' suppliers in one API call

## Summary

The system now **guarantees** that:
1. ✅ Every invoice has a vendor name before syncing
2. ✅ Every vendor exists in Xero before creating the bill
3. ✅ Users get clear error messages when validation fails
4. ✅ No orphaned or failed bills in Xero due to missing suppliers

This ensures **100% data integrity** when syncing invoices to Xero! 🎉

