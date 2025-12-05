import { BaseConnector, InvoiceData, ConnectorConfig, SyncResult, ConnectorStatus } from './base';

export class NetSuiteConnector extends BaseConnector {
  private accountId: string;
  private baseUrl: string;

  constructor(config: ConnectorConfig) {
    super(config, 'NetSuite');
    this.accountId = config.orgId || '';
    this.baseUrl = `https://${this.accountId}.suitetalk.api.netsuite.com/services/rest/record/v1`;
  }

  async testConnection(): Promise<boolean> {
    if (!this.validateConfig()) {
      return false;
    }

    try {
      this.logInfo('Testing connection...');
      
      const response = await fetch(`${this.baseUrl}/account/${this.accountId}`, {
        method: 'GET',
        headers: {
          'Authorization': `NLAuth nlauth_account=${this.accountId}, nlauth_email=${this.config.apiKey}, nlauth_signature=${this.config.apiSecret}`,
          'Content-Type': 'application/json',
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
        error: 'API key, secret, and account ID are required',
      };
    }

    try {
      this.logInfo(`Syncing invoice ${invoiceData.invoice_number}...`);

      // Build memo from all available info
      const memoLines: string[] = [`Imported from Invoice AI - ${invoiceData.vendor_name}`];
      if (invoiceData.metadata) memoLines.push(`Metadata: ${invoiceData.metadata}`);
      if (invoiceData.extra_information) memoLines.push(`Notes: ${invoiceData.extra_information}`);
      
      // Transform to NetSuite format
      const nsVendorBill = {
        tranId: invoiceData.invoice_number,
        tranDate: this.formatDate(invoiceData.date),
        entity: {
          name: invoiceData.vendor_name,
        },
        currency: {
          name: invoiceData.currency,
        },
        item: invoiceData.line_items.map((item, index) => ({
          item: {
            name: item.description,
          },
          quantity: item.quantity,
          rate: item.unit_price,
          amount: item.total_price,
          line: index + 1,
        })),
        taxTotal: invoiceData.tax,
        total: invoiceData.total_amount,
        memo: memoLines.join(' | '),
        externalId: invoiceData.invoice_number, // For reference tracking
      };

      const response = await fetch(`${this.baseUrl}/vendorBill`, {
        method: 'POST',
        headers: {
          'Authorization': `NLAuth nlauth_account=${this.accountId}, nlauth_email=${this.config.apiKey}, nlauth_signature=${this.config.apiSecret}`,
          'Content-Type': 'application/json',
          'prefer': 'return=representation',
        },
        body: JSON.stringify(nsVendorBill),
      });

      if (response.ok) {
        const data = await response.json();
        const billId = data.id;

        this.logInfo(`Invoice synced successfully: ${billId}`);
        
        return {
          success: true,
          invoiceId: invoiceData.invoice_number,
          externalId: billId,
          message: 'Invoice successfully synced to NetSuite',
        };
      } else {
        const errorData = await response.json();
        this.logError(errorData);
        
        return {
          success: false,
          invoiceId: invoiceData.invoice_number,
          message: 'Failed to sync invoice',
          error: errorData.title || 'Unknown error',
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
    // Convert to NetSuite format: MM/DD/YYYY
    try {
      const date = new Date(dateStr);
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      const year = date.getFullYear();
      return `${month}/${day}/${year}`;
    } catch {
      return dateStr;
    }
  }
}

