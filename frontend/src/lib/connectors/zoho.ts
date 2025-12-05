import { BaseConnector, InvoiceData, ConnectorConfig, SyncResult, ConnectorStatus } from './base';

export class ZohoConnector extends BaseConnector {
  private baseUrl = 'https://books.zoho.com/api/v3';
  private organizationId: string;

  constructor(config: ConnectorConfig) {
    super(config, 'Zoho Books');
    this.organizationId = config.orgId || '';
  }

  async testConnection(): Promise<boolean> {
    if (!this.validateConfig()) {
      return false;
    }

    try {
      this.logInfo('Testing connection...');
      
      const response = await fetch(`${this.baseUrl}/organizations`, {
        method: 'GET',
        headers: {
          'Authorization': `Zoho-oauthtoken ${this.config.apiKey}`,
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
        error: 'API key and organization ID are required',
      };
    }

    try {
      this.logInfo(`Syncing invoice ${invoiceData.invoice_number}...`);

      // Build notes from all available info
      const notesLines: string[] = [
        `Vendor: ${invoiceData.vendor_name}`,
        `Customer: ${invoiceData.customer_name}`,
      ];
      if (invoiceData.metadata) notesLines.push(`\nMetadata: ${invoiceData.metadata}`);
      if (invoiceData.extra_information) notesLines.push(`\nExtra Info: ${invoiceData.extra_information}`);
      
      // Transform to Zoho Books format
      const zohoBill = {
        vendor_id: invoiceData.vendor_name, // In production, need to lookup vendor ID
        bill_number: invoiceData.invoice_number,
        reference_number: invoiceData.metadata || undefined, // PO number, etc.
        date: this.formatDate(invoiceData.date),
        due_date: this.formatDate(invoiceData.date),
        line_items: invoiceData.line_items.map((item) => ({
          name: item.description,
          description: item.description,
          rate: item.unit_price,
          quantity: item.quantity,
          amount: item.total_price,
        })),
        tax_total: invoiceData.tax,
        sub_total: invoiceData.subtotal,
        total: invoiceData.total_amount,
        currency_code: invoiceData.currency,
        notes: notesLines.join('\n'),
      };

      const response = await fetch(`${this.baseUrl}/bills?organization_id=${this.organizationId}`, {
        method: 'POST',
        headers: {
          'Authorization': `Zoho-oauthtoken ${this.config.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(zohoBill),
      });

      if (response.ok) {
        const data = await response.json();
        const billId = data.bill?.bill_id;

        this.logInfo(`Invoice synced successfully: ${billId}`);
        
        return {
          success: true,
          invoiceId: invoiceData.invoice_number,
          externalId: billId,
          message: 'Invoice successfully synced to Zoho Books',
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
    // Convert to Zoho format: YYYY-MM-DD
    try {
      const date = new Date(dateStr);
      return date.toISOString().split('T')[0];
    } catch {
      return dateStr;
    }
  }
}

