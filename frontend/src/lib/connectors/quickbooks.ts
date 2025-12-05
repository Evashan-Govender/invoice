import { BaseConnector, InvoiceData, ConnectorConfig, SyncResult, ConnectorStatus } from './base';

export class QuickBooksConnector extends BaseConnector {
  private baseUrl = 'https://quickbooks.api.intuit.com/v3/company';

  constructor(config: ConnectorConfig) {
    super(config, 'QuickBooks');
  }

  async testConnection(): Promise<boolean> {
    if (!this.validateConfig()) {
      return false;
    }

    try {
      this.logInfo('Testing connection...');
      
      const response = await fetch(`${this.baseUrl}/${this.config.orgId}/companyinfo/${this.config.orgId}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${this.config.apiKey}`,
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
        error: 'API key, secret, and organization ID are required',
      };
    }

    try {
      this.logInfo(`Syncing invoice ${invoiceData.invoice_number}...`);

      // Build memo/notes from metadata and extra info
      const memoLines: string[] = [];
      if (invoiceData.metadata) memoLines.push(`Metadata: ${invoiceData.metadata}`);
      if (invoiceData.extra_information) memoLines.push(`Notes: ${invoiceData.extra_information}`);
      
      // Transform to QuickBooks format
      const qbBill = {
        TxnDate: this.formatDate(invoiceData.date),
        VendorRef: {
          name: invoiceData.vendor_name,
        },
        APAccountRef: {
          name: 'Accounts Payable',
        },
        Line: invoiceData.line_items.map((item, index) => ({
          Id: String(index + 1),
          LineNum: index + 1,
          Description: item.description,
          Amount: item.total_price,
          DetailType: 'ItemBasedExpenseLineDetail',
          ItemBasedExpenseLineDetail: {
            Qty: item.quantity,
            UnitPrice: item.unit_price,
          },
        })),
        TxnTaxDetail: {
          TotalTax: invoiceData.tax,
        },
        DocNumber: invoiceData.invoice_number,
        TotalAmt: invoiceData.total_amount,
        CurrencyRef: {
          value: invoiceData.currency,
        },
        PrivateNote: memoLines.join('\n') || undefined, // Internal memo/notes
      };

      const response = await fetch(`${this.baseUrl}/${this.config.orgId}/bill`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.config.apiKey}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify(qbBill),
      });

      if (response.ok) {
        const data = await response.json();
        const billId = data.Bill?.Id;

        this.logInfo(`Invoice synced successfully: ${billId}`);
        
        return {
          success: true,
          invoiceId: invoiceData.invoice_number,
          externalId: billId,
          message: 'Invoice successfully synced to QuickBooks',
        };
      } else {
        const errorData = await response.json();
        this.logError(errorData);
        
        return {
          success: false,
          invoiceId: invoiceData.invoice_number,
          message: 'Failed to sync invoice',
          error: errorData.Fault?.Error?.[0]?.Message || 'Unknown error',
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
    // Convert to QuickBooks format: YYYY-MM-DD
    try {
      const date = new Date(dateStr);
      return date.toISOString().split('T')[0];
    } catch {
      return dateStr;
    }
  }
}

