from typing import Dict, Optional, List
import requests
import json
import base64
from datetime import datetime

class ERPConnector:
    """Base class for ERP connectors"""
    
    def __init__(self, api_key: str, api_secret: str, org_id: Optional[str] = None):
        self.api_key = api_key
        self.api_secret = api_secret
        self.org_id = org_id
    
    def test_connection(self) -> bool:
        raise NotImplementedError
    
    def sync_invoice(self, invoice_data: Dict) -> Dict:
        raise NotImplementedError


class XeroConnector(ERPConnector):
    """Xero API Integration"""
    
    BASE_URL = "https://api.xero.com/api.xro/2.0"
    
    def test_connection(self) -> bool:
        try:
            headers = {
                "Authorization": f"Bearer {self.api_key}",
                "Accept": "application/json"
            }
            # Add tenant ID header if available
            if self.org_id:
                headers["Xero-tenant-id"] = self.org_id
            
            response = requests.get(
                f"{self.BASE_URL}/Organisation",
                headers=headers,
                timeout=10
            )
            
            if response.status_code == 200:
                print("✅ Xero connection successful")
                return True
            else:
                print(f"❌ Xero connection failed: {response.status_code}")
                return False
        except Exception as e:
            print(f"❌ Xero connection test failed: {e}")
            return False
    
    def check_supplier_exists(self, vendor_name: str) -> bool:
        """
        Check if a supplier/contact exists in Xero
        This method queries the Xero Contacts API to verify the supplier exists
        """
        try:
            from urllib.parse import quote
            
            # URL encode the vendor name for the where clause
            where_clause = quote(f'Name=="{vendor_name}"')
            
            headers = {
                "Authorization": f"Bearer {self.api_key}",
                "Accept": "application/json"
            }
            if self.org_id:
                headers["Xero-tenant-id"] = self.org_id
            
            response = requests.get(
                f"{self.BASE_URL}/Contacts?where={where_clause}",
                headers=headers,
                timeout=10
            )
            
            if response.status_code == 200:
                data = response.json()
                contacts = data.get("Contacts", [])
                exists = len(contacts) > 0
                
                if exists:
                    print(f"✅ Supplier '{vendor_name}' found in Xero")
                else:
                    print(f"❌ Supplier '{vendor_name}' not found in Xero")
                
                return exists
            else:
                print(f"⚠️ Error checking supplier: HTTP {response.status_code}")
                return False
                
        except Exception as e:
            print(f"⚠️ Error checking supplier existence: {str(e)}")
            return False
    
    def sync_invoice(self, invoice_data: Dict) -> Dict:
        try:
            vendor_name = invoice_data.get("vendor_name", "").strip()
            invoice_number = invoice_data.get("invoice_number", "")
            
            # Validation: Vendor name is required
            if not vendor_name:
                return {
                    "success": False,
                    "message": "Vendor/Supplier name is required",
                    "error": "Cannot sync invoice without a vendor name. Please add the vendor name to the invoice."
                }
            
            if not invoice_number:
                return {
                    "success": False,
                    "message": "Invoice number is required",
                    "error": "Cannot sync invoice without an invoice number"
                }
            
            # CRITICAL: Check if supplier exists in Xero before proceeding
            print(f"🔍 Checking if supplier '{vendor_name}' exists in Xero...")
            supplier_exists = self.check_supplier_exists(vendor_name)
            
            if not supplier_exists:
                return {
                    "success": False,
                    "message": f"Supplier '{vendor_name}' not found in Xero",
                    "error": f"The supplier '{vendor_name}' does not exist in your Xero organization. Please create this supplier in Xero first, then try syncing again."
                }
            
            print(f"✅ Supplier '{vendor_name}' verified in Xero. Proceeding with sync...")
            
            # Build Xero invoice payload
            xero_invoice = {
                "Type": "ACCPAY",  # Accounts Payable (Bill)
                "Contact": {
                    "Name": vendor_name
                },
                "Date": invoice_data.get("date", ""),
                "DueDate": invoice_data.get("date", ""),
                "InvoiceNumber": invoice_number,
                "Reference": invoice_data.get("invoice_number", ""),
                "LineItems": [
                    {
                        "Description": item.get("description", ""),
                        "Quantity": item.get("quantity", 1),
                        "UnitAmount": item.get("unit_price", 0),
                        "LineAmount": item.get("total_price", 0),
                        "TaxType": "OUTPUT",
                        "AccountCode": "200"
                    }
                    for item in invoice_data.get("line_items", [])
                ],
                "Status": "DRAFT",
                "CurrencyCode": invoice_data.get("currency", "USD")
            }
            
            headers = {
                "Authorization": f"Bearer {self.api_key}",
                "Content-Type": "application/json",
                "Accept": "application/json"
            }
            # Add tenant ID header if available
            if self.org_id:
                headers["Xero-tenant-id"] = self.org_id
            
            response = requests.post(
                f"{self.BASE_URL}/Invoices",
                headers=headers,
                json={"Invoices": [xero_invoice]},
                timeout=30
            )
            
            if response.status_code in [200, 201]:
                data = response.json()
                invoices = data.get("Invoices", [])
                
                if invoices:
                    xero_invoice_id = invoices[0].get("InvoiceID")
                    xero_invoice_number = invoices[0].get("InvoiceNumber")
                    print(f"✅ Invoice '{invoice_number}' synced to Xero: {xero_invoice_id}")
                    
                    return {
                        "success": True,
                        "message": f"Invoice '{invoice_number}' successfully synced to Xero as draft bill for supplier '{vendor_name}'",
                        "external_id": xero_invoice_id,
                        "external_number": xero_invoice_number
                    }
                else:
                    return {
                        "success": False,
                        "message": "Xero returned empty response",
                        "error": "No invoice data returned from Xero"
                    }
            else:
                error_text = response.text
                print(f"❌ Xero sync failed: {response.status_code} - {error_text}")
                
                # Try to parse error details
                try:
                    error_data = response.json()
                    if "Elements" in error_data and error_data["Elements"]:
                        validation_errors = error_data["Elements"][0].get("ValidationErrors", [])
                        if validation_errors:
                            error_messages = [err.get("Message", "") for err in validation_errors]
                            error_text = "; ".join(error_messages)
                except:
                    pass
                
                return {
                    "success": False,
                    "message": f"Failed to sync to Xero (HTTP {response.status_code})",
                    "error": error_text
                }
        except requests.RequestException as e:
            print(f"❌ Network error syncing to Xero: {e}")
            return {
                "success": False, 
                "message": "Network error connecting to Xero",
                "error": f"Unable to connect to Xero API: {str(e)}"
            }
        except Exception as e:
            print(f"❌ Error syncing to Xero: {e}")
            return {
                "success": False,
                "message": "Error syncing to Xero",
                "error": str(e)
            }


class QuickBooksConnector(ERPConnector):
    """QuickBooks API Integration"""
    
    BASE_URL = "https://quickbooks.api.intuit.com/v3/company"
    
    def test_connection(self) -> bool:
        try:
            response = requests.get(
                f"{self.BASE_URL}/{self.org_id}/companyinfo/{self.org_id}",
                headers={
                    "Authorization": f"Bearer {self.api_key}",
                    "Accept": "application/json"
                },
                timeout=10
            )
            return response.status_code == 200
        except Exception as e:
            print(f"QuickBooks connection test failed: {e}")
            return False
    
    def sync_invoice(self, invoice_data: Dict) -> Dict:
        try:
            qb_bill = {
                "VendorRef": {
                    "name": invoice_data.get("vendor_name", "")
                },
                "TxnDate": invoice_data.get("date", ""),
                "DueDate": invoice_data.get("date", ""),
                "DocNumber": invoice_data.get("invoice_number", ""),
                "Line": [
                    {
                        "Id": str(index + 1),
                        "DetailType": "ItemBasedExpenseLineDetail",
                        "Amount": item.get("total_price", 0),
                        "ItemBasedExpenseLineDetail": {
                            "ItemRef": {
                                "name": item.get("description", "")
                            },
                            "Qty": item.get("quantity", 1),
                            "UnitPrice": item.get("unit_price", 0)
                        }
                    }
                    for index, item in enumerate(invoice_data.get("line_items", []))
                ],
                "TotalAmt": invoice_data.get("total_amount", 0)
            }
            
            response = requests.post(
                f"{self.BASE_URL}/{self.org_id}/bill",
                headers={
                    "Authorization": f"Bearer {self.api_key}",
                    "Accept": "application/json",
                    "Content-Type": "application/json"
                },
                json=qb_bill,
                timeout=30
            )
            
            if response.status_code in [200, 201]:
                data = response.json()
                return {
                    "success": True,
                    "message": "Invoice synced to QuickBooks successfully",
                    "external_id": data.get("Bill", {}).get("Id")
                }
            else:
                return {
                    "success": False,
                    "message": "Failed to sync to QuickBooks",
                    "error": response.text
                }
        except Exception as e:
            return {
                "success": False,
                "message": "Error syncing to QuickBooks",
                "error": str(e)
            }


class SAPConnector(ERPConnector):
    """SAP API Integration"""
    
    BASE_URL = "https://api.sap.com/s4hanacloud"
    
    def test_connection(self) -> bool:
        try:
            auth_string = base64.b64encode(f"{self.api_key}:{self.api_secret}".encode()).decode()
            response = requests.get(
                f"{self.BASE_URL}/sap/opu/odata/sap/API_PURCHASEORDER_PROCESS_SRV",
                headers={
                    "Authorization": f"Basic {auth_string}"
                },
                timeout=10
            )
            return response.status_code == 200
        except Exception as e:
            print(f"SAP connection test failed: {e}")
            return False
    
    def sync_invoice(self, invoice_data: Dict) -> Dict:
        try:
            auth_string = base64.b64encode(f"{self.api_key}:{self.api_secret}".encode()).decode()
            
            sap_invoice = {
                "SupplierInvoice": invoice_data.get("invoice_number", ""),
                "FiscalYear": str(datetime.now().year),
                "CompanyCode": self.org_id or "1000",
                "DocumentDate": invoice_data.get("date", ""),
                "PostingDate": invoice_data.get("date", ""),
                "InvoicingParty": invoice_data.get("vendor_name", ""),
                "DocumentCurrency": invoice_data.get("currency", "USD"),
                "InvoiceGrossAmount": str(invoice_data.get("total_amount", 0)),
                "to_SuplrInvcItemPurOrdRef": [
                    {
                        "SupplierInvoiceItem": str(index + 1).zfill(6),
                        "DocumentCurrency": invoice_data.get("currency", "USD"),
                        "SupplierInvoiceItemAmount": str(item.get("total_price", 0)),
                        "QuantityInPurchaseOrderUnit": str(item.get("quantity", 1)),
                        "SupplierInvoiceItemText": item.get("description", "")
                    }
                    for index, item in enumerate(invoice_data.get("line_items", []))
                ]
            }
            
            response = requests.post(
                f"{self.BASE_URL}/sap/opu/odata/sap/API_SUPPLIERINVOICE_PROCESS_SRV/A_SupplierInvoice",
                headers={
                    "Authorization": f"Basic {auth_string}",
                    "Content-Type": "application/json"
                },
                json=sap_invoice,
                timeout=30
            )
            
            if response.status_code in [200, 201]:
                data = response.json()
                return {
                    "success": True,
                    "message": "Invoice synced to SAP successfully",
                    "external_id": data.get("d", {}).get("SupplierInvoice")
                }
            else:
                return {
                    "success": False,
                    "message": "Failed to sync to SAP",
                    "error": response.text
                }
        except Exception as e:
            return {
                "success": False,
                "message": "Error syncing to SAP",
                "error": str(e)
            }


class NetSuiteConnector(ERPConnector):
    """NetSuite RESTlet Integration"""
    
    def __init__(self, api_key: str, api_secret: str, org_id: Optional[str] = None):
        super().__init__(api_key, api_secret, org_id)
        self.base_url = f"https://{org_id}.restlets.api.netsuite.com/app/site/hosting/restlet.nl"
    
    def test_connection(self) -> bool:
        try:
            response = requests.get(
                f"{self.base_url}?script=customscript_test&deploy=1",
                headers={
                    "Authorization": f'NLAuth nlauth_account={self.org_id}, nlauth_email={self.api_key}, nlauth_signature={self.api_secret}',
                    "Content-Type": "application/json"
                },
                timeout=10
            )
            return response.status_code == 200
        except Exception as e:
            print(f"NetSuite connection test failed: {e}")
            return False
    
    def sync_invoice(self, invoice_data: Dict) -> Dict:
        try:
            netsuite_bill = {
                "recordType": "vendorbill",
                "entity": {"name": invoice_data.get("vendor_name", "")},
                "tranDate": invoice_data.get("date", ""),
                "dueDate": invoice_data.get("date", ""),
                "tranId": invoice_data.get("invoice_number", ""),
                "currency": {"name": invoice_data.get("currency", "USD")},
                "item": [
                    {
                        "item": {"name": item.get("description", "")},
                        "quantity": item.get("quantity", 1),
                        "rate": item.get("unit_price", 0),
                        "amount": item.get("total_price", 0)
                    }
                    for item in invoice_data.get("line_items", [])
                ]
            }
            
            response = requests.post(
                self.base_url,
                headers={
                    "Authorization": f'NLAuth nlauth_account={self.org_id}, nlauth_email={self.api_key}, nlauth_signature={self.api_secret}',
                    "Content-Type": "application/json"
                },
                json=netsuite_bill,
                timeout=30
            )
            
            if response.status_code in [200, 201]:
                data = response.json()
                return {
                    "success": True,
                    "message": "Invoice synced to NetSuite successfully",
                    "external_id": data.get("id")
                }
            else:
                return {
                    "success": False,
                    "message": "Failed to sync to NetSuite",
                    "error": response.text
                }
        except Exception as e:
            return {
                "success": False,
                "message": "Error syncing to NetSuite",
                "error": str(e)
            }


class ZohoConnector(ERPConnector):
    """Zoho Books API Integration"""
    
    BASE_URL = "https://books.zoho.com/api/v3"
    
    def test_connection(self) -> bool:
        try:
            response = requests.get(
                f"{self.BASE_URL}/organizations",
                headers={
                    "Authorization": f"Zoho-oauthtoken {self.api_key}"
                },
                timeout=10
            )
            return response.status_code == 200
        except Exception as e:
            print(f"Zoho connection test failed: {e}")
            return False
    
    def sync_invoice(self, invoice_data: Dict) -> Dict:
        try:
            zoho_bill = {
                "vendor_id": invoice_data.get("vendor_name", ""),
                "bill_number": invoice_data.get("invoice_number", ""),
                "date": invoice_data.get("date", ""),
                "due_date": invoice_data.get("date", ""),
                "line_items": [
                    {
                        "name": item.get("description", ""),
                        "description": item.get("description", ""),
                        "rate": item.get("unit_price", 0),
                        "quantity": item.get("quantity", 1),
                        "amount": item.get("total_price", 0)
                    }
                    for item in invoice_data.get("line_items", [])
                ],
                "tax_total": invoice_data.get("tax", 0),
                "sub_total": invoice_data.get("subtotal", 0),
                "total": invoice_data.get("total_amount", 0),
                "currency_code": invoice_data.get("currency", "USD")
            }
            
            response = requests.post(
                f"{self.BASE_URL}/bills?organization_id={self.org_id}",
                headers={
                    "Authorization": f"Zoho-oauthtoken {self.api_key}",
                    "Content-Type": "application/json"
                },
                json=zoho_bill,
                timeout=30
            )
            
            if response.status_code in [200, 201]:
                data = response.json()
                return {
                    "success": True,
                    "message": "Invoice synced to Zoho Books successfully",
                    "external_id": data.get("bill", {}).get("bill_id")
                }
            else:
                return {
                    "success": False,
                    "message": "Failed to sync to Zoho Books",
                    "error": response.text
                }
        except Exception as e:
            return {
                "success": False,
                "message": "Error syncing to Zoho Books",
                "error": str(e)
            }


class ERPIntegrationService:
    """Main service for managing ERP integrations"""
    
    @staticmethod
    def get_connector(provider: str, config: Dict) -> ERPConnector:
        api_key = config.get("apiKey") or config.get("api_key", "")
        api_secret = config.get("apiSecret") or config.get("api_secret", "")
        org_id = config.get("orgId") or config.get("org_id")
        
        provider_lower = provider.lower()
        
        if provider_lower == "xero":
            return XeroConnector(api_key, api_secret, org_id)
        elif provider_lower == "quickbooks":
            return QuickBooksConnector(api_key, api_secret, org_id)
        elif provider_lower == "sap":
            return SAPConnector(api_key, api_secret, org_id)
        elif provider_lower == "netsuite":
            return NetSuiteConnector(api_key, api_secret, org_id)
        elif provider_lower == "zoho":
            return ZohoConnector(api_key, api_secret, org_id)
        else:
            raise ValueError(f"Unsupported provider: {provider}")
    
    @staticmethod
    def test_connection(provider: str, config: Dict) -> bool:
        try:
            connector = ERPIntegrationService.get_connector(provider, config)
            return connector.test_connection()
        except Exception as e:
            print(f"Connection test failed: {e}")
            return False
    
    @staticmethod
    def sync_invoice(provider: str, config: Dict, invoice_data: Dict) -> Dict:
        try:
            connector = ERPIntegrationService.get_connector(provider, config)
            return connector.sync_invoice(invoice_data)
        except Exception as e:
            return {
                "success": False,
                "message": f"Failed to sync to {provider}",
                "error": str(e)
            }

