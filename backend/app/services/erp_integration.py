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
            response = requests.get(
                f"{self.BASE_URL}/Organisation",
                headers={
                    "Authorization": f"Bearer {self.api_key}",
                    "Accept": "application/json"
                },
                timeout=10
            )
            return response.status_code == 200
        except Exception as e:
            print(f"Xero connection test failed: {e}")
            return False
    
    def sync_invoice(self, invoice_data: Dict) -> Dict:
        try:
            xero_invoice = {
                "Type": "ACCPAY",  # Accounts Payable
                "Contact": {
                    "Name": invoice_data.get("vendor_name", "")
                },
                "Date": invoice_data.get("date", ""),
                "DueDate": invoice_data.get("date", ""),
                "InvoiceNumber": invoice_data.get("invoice_number", ""),
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
            
            response = requests.post(
                f"{self.BASE_URL}/Invoices",
                headers={
                    "Authorization": f"Bearer {self.api_key}",
                    "Content-Type": "application/json",
                    "Accept": "application/json"
                },
                json={"Invoices": [xero_invoice]},
                timeout=30
            )
            
            if response.status_code in [200, 201]:
                data = response.json()
                return {
                    "success": True,
                    "message": "Invoice synced to Xero successfully",
                    "external_id": data.get("Invoices", [{}])[0].get("InvoiceID")
                }
            else:
                return {
                    "success": False,
                    "message": "Failed to sync to Xero",
                    "error": response.text
                }
        except Exception as e:
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

