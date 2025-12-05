import { BaseConnector, InvoiceData, ConnectorConfig, SyncResult, ConnectorStatus } from './base';

export class SAPConnector extends BaseConnector {
  private baseUrl: string;

  constructor(config: ConnectorConfig) {
    super(config, 'SAP');
    // SAP endpoint is typically customer-specific
    this.baseUrl = config.orgId || 'https://api.sap.com';
  }

  async testConnection(): Promise<boolean> {
    if (!this.validateConfig()) {
      return false;
    }

    try {
      this.logInfo('Testing connection...');
      
      const response = await fetch(`${this.baseUrl}/sap/opu/odata/sap/API_BUSINESS_PARTNER/A_BusinessPartner`, {
        method: 'GET',
        headers: {
          'Authorization': `Basic ${btoa(`${this.config.apiKey}:${this.config.apiSecret}`)}`,
          'Accept': 'application/json',
        },
      });

      if (response.ok) {
        this.logInfo('Connection successful');
        return true;
      } else {
        this.logError(`Connection failed: ${response.status}`);
        return false;
      }
    } catch (error) {
      this.logError(error);
      return false;
    }
  }

  async syncInvoice(invoiceData: InvoiceData): Promise<SyncResult> {
    if (!this.validateConfig()) {
      return {
        success: false,
        message: 'Invalid configuration',
        error: 'API key and secret are required',
      };
    }

    try {
      this.logInfo(`Syncing invoice ${invoiceData.invoice_number}...`);

      // Transform to SAP format
      const sapDocument = {
        InvoiceHeader: {
          InvoiceNumber: invoiceData.invoice_number,
          InvoiceDate: this.formatDate(invoiceData.date),
          Currency: invoiceData.currency,
          VendorCode: invoiceData.vendor_name,
          TotalAmount: invoiceData.total_amount,
          TaxAmount: invoiceData.tax,
          NetAmount: invoiceData.subtotal,
          Reference: invoiceData.metadata || '', // PO numbers, payment terms, etc.
          HeaderText: invoiceData.extra_information || '', // Additional notes
        },
        VendorDetails: {
          Name: invoiceData.vendor_name,
          Address: invoiceData.vendor_address,
        },
        CustomerDetails: {
          Name: invoiceData.customer_name,
          Address: invoiceData.customer_address,
        },
        LineItems: invoiceData.line_items.map((item, index) => ({
          ItemNumber: index + 1,
          Description: item.description,
          Quantity: item.quantity,
          UnitPrice: item.unit_price,
          Amount: item.total_price,
          TaxCode: 'V0', // Default tax code
          GLAccount: '5000', // Default expense account
        })),
      };

      const response = await fetch(`${this.baseUrl}/sap/opu/odata/sap/API_SUPPLIERINVOICE_PROCESS_SRV/A_SupplierInvoice`, {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${btoa(`${this.config.apiKey}:${this.config.apiSecret}`)}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify(sapDocument),
      });

      if (response.ok) {
        const data = await response.json();
        const docId = data.d?.SupplierInvoice;

        this.logInfo(`Invoice synced successfully: ${docId}`);
        
        return {
          success: true,
          invoiceId: invoiceData.invoice_number,
          externalId: docId,
          message: 'Invoice successfully synced to SAP',
        };
      } else {
        const errorData = await response.json();
        this.logError(errorData);
        
        return {
          success: false,
          invoiceId: invoiceData.invoice_number,
          message: 'Failed to sync invoice',
          error: errorData.error?.message?.value || 'Unknown error',
        };
      }
    } catch (error: any) {
      this.logError(error);
      return {
        success: false,
        invoiceId: invoiceData.invoice_number,
        message: 'Exception during sync',
        error: error.message,
      };
    }
  }

  async getStatus(): Promise<ConnectorStatus> {
    try {
      const connected = await this.testConnection();
      
      return {
        connected,
        lastSync: new Date(),
        syncCount: 0,
        errors: 0,
      };
    } catch (error) {
      return {
        connected: false,
        syncCount: 0,
        errors: 0,
      };
    }
  }

  private formatDate(dateStr: string): string {
    // Convert to SAP format: YYYYMMDD
    try {
      const date = new Date(dateStr);
      return date.toISOString().split('T')[0].replace(/-/g, '');
    } catch {
      return dateStr;
    }
  }
}

