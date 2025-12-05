// ERP Integration Service - Handles connections to various accounting systems

export interface ERPConfig {
  apiKey: string;
  apiSecret: string;
  orgId?: string;
  autoSync: boolean;
}

export interface InvoiceData {
  invoice_number: string;
  date: string;
  vendor_name: string;
  vendor_address: string;
  customer_name: string;
  customer_address: string;
  currency: string;
  subtotal: number;
  tax: number;
  total_amount: number;
  line_items: Array<{
    description: string;
    quantity: number;
    unit_price: number;
    total_price: number;
  }>;
}

export interface SyncResult {
  success: boolean;
  message: string;
  externalId?: string;
  error?: string;
}

class XeroConnector {
  private config: ERPConfig;
  private baseUrl = 'https://api.xero.com/api.xro/2.0';

  constructor(config: ERPConfig) {
    this.config = config;
  }

  async testConnection(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/Organisation`, {
        headers: {
          Authorization: `Bearer ${this.config.apiKey}`,
          'Content-Type': 'application/json',
        },
      });
      return response.ok;
    } catch (error) {
      console.error('Xero connection test failed:', error);
      return false;
    }
  }

  async syncInvoice(invoice: InvoiceData): Promise<SyncResult> {
    try {
      const xeroInvoice = {
        Type: 'ACCPAY', // Accounts Payable
        Contact: {
          Name: invoice.vendor_name,
        },
        Date: invoice.date,
        DueDate: invoice.date,
        InvoiceNumber: invoice.invoice_number,
        Reference: invoice.invoice_number,
        LineItems: invoice.line_items.map((item) => ({
          Description: item.description,
          Quantity: item.quantity,
          UnitAmount: item.unit_price,
          LineAmount: item.total_price,
          TaxType: 'OUTPUT',
          AccountCode: '200', // Default expense account
        })),
        Status: 'AUTHORISED',
        CurrencyCode: invoice.currency,
      };

      const response = await fetch(`${this.baseUrl}/Invoices`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.config.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ Invoices: [xeroInvoice] }),
      });

      if (response.ok) {
        const data = await response.json();
        return {
          success: true,
          message: 'Invoice synced to Xero successfully',
          externalId: data.Invoices?.[0]?.InvoiceID,
        };
      } else {
        const error = await response.text();
        return {
          success: false,
          message: 'Failed to sync to Xero',
          error,
        };
      }
    } catch (error: any) {
      return {
        success: false,
        message: 'Error syncing to Xero',
        error: error.message,
      };
    }
  }
}

class QuickBooksConnector {
  private config: ERPConfig;
  private baseUrl = 'https://quickbooks.api.intuit.com/v3/company';

  constructor(config: ERPConfig) {
    this.config = config;
  }

  async testConnection(): Promise<boolean> {
    try {
      const response = await fetch(
        `${this.baseUrl}/${this.config.orgId}/companyinfo/${this.config.orgId}`,
        {
          headers: {
            Authorization: `Bearer ${this.config.apiKey}`,
            Accept: 'application/json',
          },
        }
      );
      return response.ok;
    } catch (error) {
      console.error('QuickBooks connection test failed:', error);
      return false;
    }
  }

  async syncInvoice(invoice: InvoiceData): Promise<SyncResult> {
    try {
      const qbBill = {
        VendorRef: {
          name: invoice.vendor_name,
        },
        TxnDate: invoice.date,
        DueDate: invoice.date,
        DocNumber: invoice.invoice_number,
        Line: invoice.line_items.map((item, index) => ({
          Id: (index + 1).toString(),
          DetailType: 'ItemBasedExpenseLineDetail',
          Amount: item.total_price,
          ItemBasedExpenseLineDetail: {
            ItemRef: {
              name: item.description,
            },
            Qty: item.quantity,
            UnitPrice: item.unit_price,
          },
        })),
        TotalAmt: invoice.total_amount,
      };

      const response = await fetch(
        `${this.baseUrl}/${this.config.orgId}/bill`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${this.config.apiKey}`,
            Accept: 'application/json',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(qbBill),
        }
      );

      if (response.ok) {
        const data = await response.json();
        return {
          success: true,
          message: 'Invoice synced to QuickBooks successfully',
          externalId: data.Bill?.Id,
        };
      } else {
        const error = await response.text();
        return {
          success: false,
          message: 'Failed to sync to QuickBooks',
          error,
        };
      }
    } catch (error: any) {
      return {
        success: false,
        message: 'Error syncing to QuickBooks',
        error: error.message,
      };
    }
  }
}

class SAPConnector {
  private config: ERPConfig;
  private baseUrl = 'https://api.sap.com/s4hanacloud';

  constructor(config: ERPConfig) {
    this.config = config;
  }

  async testConnection(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/sap/opu/odata/sap/API_PURCHASEORDER_PROCESS_SRV`, {
        headers: {
          Authorization: `Basic ${btoa(`${this.config.apiKey}:${this.config.apiSecret}`)}`,
        },
      });
      return response.ok;
    } catch (error) {
      console.error('SAP connection test failed:', error);
      return false;
    }
  }

  async syncInvoice(invoice: InvoiceData): Promise<SyncResult> {
    try {
      const sapInvoice = {
        SupplierInvoice: invoice.invoice_number,
        FiscalYear: new Date(invoice.date).getFullYear().toString(),
        CompanyCode: this.config.orgId || '1000',
        DocumentDate: invoice.date,
        PostingDate: invoice.date,
        InvoicingParty: invoice.vendor_name,
        DocumentCurrency: invoice.currency,
        InvoiceGrossAmount: invoice.total_amount,
        SupplierInvoiceIDByInvcgParty: invoice.invoice_number,
        to_SuplrInvcItemPurOrdRef: invoice.line_items.map((item, index) => ({
          SupplierInvoiceItem: (index + 1).toString().padStart(6, '0'),
          PurchaseOrder: invoice.invoice_number,
          PurchaseOrderItem: (index + 1).toString().padStart(5, '0'),
          Plant: '1000',
          TaxCode: 'V0',
          DocumentCurrency: invoice.currency,
          SupplierInvoiceItemAmount: item.total_price,
          PurchaseOrderQuantityUnit: 'EA',
          QuantityInPurchaseOrderUnit: item.quantity,
          SupplierInvoiceItemText: item.description,
        })),
      };

      const response = await fetch(
        `${this.baseUrl}/sap/opu/odata/sap/API_SUPPLIERINVOICE_PROCESS_SRV/A_SupplierInvoice`,
        {
          method: 'POST',
          headers: {
            Authorization: `Basic ${btoa(`${this.config.apiKey}:${this.config.apiSecret}`)}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(sapInvoice),
        }
      );

      if (response.ok) {
        const data = await response.json();
        return {
          success: true,
          message: 'Invoice synced to SAP successfully',
          externalId: data.d?.SupplierInvoice,
        };
      } else {
        const error = await response.text();
        return {
          success: false,
          message: 'Failed to sync to SAP',
          error,
        };
      }
    } catch (error: any) {
      return {
        success: false,
        message: 'Error syncing to SAP',
        error: error.message,
      };
    }
  }
}

class NetSuiteConnector {
  private config: ERPConfig;
  private baseUrl = 'https://rest.na1.netsuite.com/app/site/hosting/restlet.nl';

  constructor(config: ERPConfig) {
    this.config = config;
  }

  async testConnection(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}?script=customscript_test&deploy=1`, {
        headers: {
          Authorization: `NLAuth nlauth_account=${this.config.orgId}, nlauth_email=${this.config.apiKey}, nlauth_signature=${this.config.apiSecret}`,
          'Content-Type': 'application/json',
        },
      });
      return response.ok;
    } catch (error) {
      console.error('NetSuite connection test failed:', error);
      return false;
    }
  }

  async syncInvoice(invoice: InvoiceData): Promise<SyncResult> {
    try {
      const netSuiteInvoice = {
        recordType: 'vendorbill',
        entity: {
          name: invoice.vendor_name,
        },
        tranDate: invoice.date,
        dueDate: invoice.date,
        tranId: invoice.invoice_number,
        currency: { name: invoice.currency },
        item: invoice.line_items.map((item) => ({
          item: { name: item.description },
          quantity: item.quantity,
          rate: item.unit_price,
          amount: item.total_price,
        })),
      };

      const response = await fetch(this.baseUrl, {
        method: 'POST',
        headers: {
          Authorization: `NLAuth nlauth_account=${this.config.orgId}, nlauth_email=${this.config.apiKey}, nlauth_signature=${this.config.apiSecret}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(netSuiteInvoice),
      });

      if (response.ok) {
        const data = await response.json();
        return {
          success: true,
          message: 'Invoice synced to NetSuite successfully',
          externalId: data.id,
        };
      } else {
        const error = await response.text();
        return {
          success: false,
          message: 'Failed to sync to NetSuite',
          error,
        };
      }
    } catch (error: any) {
      return {
        success: false,
        message: 'Error syncing to NetSuite',
        error: error.message,
      };
    }
  }
}

class ZohoConnector {
  private config: ERPConfig;
  private baseUrl = 'https://books.zoho.com/api/v3';

  constructor(config: ERPConfig) {
    this.config = config;
  }

  async testConnection(): Promise<boolean> {
    try {
      const response = await fetch(
        `${this.baseUrl}/organizations?organization_id=${this.config.orgId}`,
        {
          headers: {
            Authorization: `Zoho-oauthtoken ${this.config.apiKey}`,
          },
        }
      );
      return response.ok;
    } catch (error) {
      console.error('Zoho connection test failed:', error);
      return false;
    }
  }

  async syncInvoice(invoice: InvoiceData): Promise<SyncResult> {
    try {
      const zohoBill = {
        vendor_id: invoice.vendor_name,
        bill_number: invoice.invoice_number,
        date: invoice.date,
        due_date: invoice.date,
        line_items: invoice.line_items.map((item) => ({
          name: item.description,
          description: item.description,
          rate: item.unit_price,
          quantity: item.quantity,
          amount: item.total_price,
        })),
        tax_total: invoice.tax,
        sub_total: invoice.subtotal,
        total: invoice.total_amount,
        currency_code: invoice.currency,
      };

      const response = await fetch(
        `${this.baseUrl}/bills?organization_id=${this.config.orgId}`,
        {
          method: 'POST',
          headers: {
            Authorization: `Zoho-oauthtoken ${this.config.apiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(zohoBill),
        }
      );

      if (response.ok) {
        const data = await response.json();
        return {
          success: true,
          message: 'Invoice synced to Zoho Books successfully',
          externalId: data.bill?.bill_id,
        };
      } else {
        const error = await response.text();
        return {
          success: false,
          message: 'Failed to sync to Zoho Books',
          error,
        };
      }
    } catch (error: any) {
      return {
        success: false,
        message: 'Error syncing to Zoho Books',
        error: error.message,
      };
    }
  }
}

// Main ERP Service Manager
export class ERPIntegrationService {
  private static getConnector(
    provider: string,
    config: ERPConfig
  ):
    | XeroConnector
    | QuickBooksConnector
    | SAPConnector
    | NetSuiteConnector
    | ZohoConnector {
    switch (provider.toLowerCase()) {
      case 'xero':
        return new XeroConnector(config);
      case 'quickbooks':
        return new QuickBooksConnector(config);
      case 'sap':
        return new SAPConnector(config);
      case 'netsuite':
        return new NetSuiteConnector(config);
      case 'zoho':
        return new ZohoConnector(config);
      default:
        throw new Error(`Unsupported provider: ${provider}`);
    }
  }

  static async testConnection(
    provider: string,
    config: ERPConfig
  ): Promise<boolean> {
    try {
      const connector = this.getConnector(provider, config);
      return await connector.testConnection();
    } catch (error) {
      console.error(`Connection test failed for ${provider}:`, error);
      return false;
    }
  }

  static async syncInvoice(
    provider: string,
    config: ERPConfig,
    invoice: InvoiceData
  ): Promise<SyncResult> {
    try {
      const connector = this.getConnector(provider, config);
      return await connector.syncInvoice(invoice);
    } catch (error: any) {
      return {
        success: false,
        message: `Failed to sync to ${provider}`,
        error: error.message,
      };
    }
  }

  static async syncMultipleInvoices(
    provider: string,
    config: ERPConfig,
    invoices: InvoiceData[]
  ): Promise<SyncResult[]> {
    const results: SyncResult[] = [];
    
    for (const invoice of invoices) {
      const result = await this.syncInvoice(provider, config, invoice);
      results.push(result);
      
      // Add a small delay between requests to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    return results;
  }

  static getConnectedIntegrations(): string[] {
    const integrations = localStorage.getItem('integrations');
    if (!integrations) return [];
    
    try {
      const parsed = JSON.parse(integrations);
      return parsed
        .filter((int: any) => int.status === 'connected')
        .map((int: any) => int.id);
    } catch {
      return [];
    }
  }

  static getIntegrationConfig(provider: string): ERPConfig | null {
    const integrations = localStorage.getItem('integrations');
    if (!integrations) return null;
    
    try {
      const parsed = JSON.parse(integrations);
      const integration = parsed.find((int: any) => int.id === provider);
      return integration?.config || null;
    } catch {
      return null;
    }
  }
}

export default ERPIntegrationService;

