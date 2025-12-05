import { BaseConnector, InvoiceData, ConnectorConfig, SyncResult, ConnectorStatus } from './base';

export class XeroConnector extends BaseConnector {
  private baseUrl = 'https://api.xero.com/api.xro/2.0';

  constructor(config: ConnectorConfig) {
    super(config, 'Xero');
  }

  async testConnection(): Promise<boolean> {
    if (!this.validateConfig()) {
      return false;
    }

    try {
      this.logInfo('Testing connection...');
      
      // POC Demo Mode: Accept any credentials for testing purposes
      // In production, this would make a real OAuth2 API call
      await new Promise(resolve => setTimeout(resolve, 1000)); // Simulate network delay
      
      this.logInfo('Connection successful (Demo Mode)');
      return true;
      
      /* Production code would be:
      const response = await fetch(`${this.baseUrl}/Organisation`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${this.config.apiKey}`,
          'Accept': 'application/json',
          'Xero-tenant-id': this.config.orgId || '',
        },
      });

      if (response.ok) {
        this.logInfo('Connection successful');
        return true;
      } else {
        this.logError(`Connection failed: ${response.status}`);
        return false;
      }
      */
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

      // Transform to Xero format
      const xeroInvoice = {
        Type: 'ACCPAY', // Accounts Payable (Bill)
        Contact: {
          Name: invoiceData.vendor_name,
        },
        Date: this.formatDate(invoiceData.date),
        DueDate: this.formatDate(invoiceData.date),
        InvoiceNumber: invoiceData.invoice_number,
        Reference: invoiceData.metadata || '', // PO numbers, payment terms, etc.
        LineAmountTypes: 'Exclusive',
        LineItems: invoiceData.line_items.map((item, index) => ({
          Description: item.description,
          Quantity: item.quantity,
          UnitAmount: item.unit_price,
          AccountCode: '200', // Default expense account
          TaxType: 'OUTPUT', // Default tax type
          LineAmount: item.total_price,
        })),
        CurrencyCode: invoiceData.currency,
        Status: 'DRAFT',
        // Extra information as internal notes
        ...(invoiceData.extra_information && { 
          // Xero doesn't have a direct notes field on invoices, 
          // but we can log it for reference
        }),
      };

      // POC Demo Mode: Simulate successful sync
      await new Promise(resolve => setTimeout(resolve, 1500)); // Simulate network delay
      
      const demoExternalId = `XERO-INV-${Date.now()}`;
      this.logInfo(`Invoice synced successfully (Demo Mode): ${demoExternalId}`);
      console.log('Xero Invoice Data:', JSON.stringify(xeroInvoice, null, 2));
      if (invoiceData.metadata) console.log('Metadata:', invoiceData.metadata);
      if (invoiceData.extra_information) console.log('Extra Info:', invoiceData.extra_information);
      
      return {
        success: true,
        invoiceId: invoiceData.invoice_number,
        externalId: demoExternalId,
        message: 'Invoice successfully synced to Xero (Demo Mode)',
      };
      
      /* Production code would be:
      const response = await fetch(`${this.baseUrl}/Invoices`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.config.apiKey}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'Xero-tenant-id': this.config.orgId || '',
        },
        body: JSON.stringify({ Invoices: [xeroInvoice] }),
      });

      if (response.ok) {
        const data = await response.json();
        const xeroInvoiceId = data.Invoices?.[0]?.InvoiceID;

        this.logInfo(`Invoice synced successfully: ${xeroInvoiceId}`);
        
        return {
          success: true,
          invoiceId: invoiceData.invoice_number,
          externalId: xeroInvoiceId,
          message: 'Invoice successfully synced to Xero',
        };
      } else {
        const errorData = await response.json();
        this.logError(errorData);
        
        return {
          success: false,
          invoiceId: invoiceData.invoice_number,
          message: 'Failed to sync invoice',
          error: errorData.message || 'Unknown error',
        };
      }
      */
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
      
      // In production, fetch actual statistics from storage/database
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
    // Convert to Xero format: YYYY-MM-DD
    try {
      const date = new Date(dateStr);
      return date.toISOString().split('T')[0];
    } catch {
      return dateStr;
    }
  }
}

