// Base connector interface for all ERP integrations

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
  metadata?: string;
  extra_information?: string;
}

export interface ConnectorConfig {
  apiKey: string;
  apiSecret: string;
  orgId?: string;
  autoSync?: boolean;
}

export interface SyncResult {
  success: boolean;
  invoiceId?: string;
  externalId?: string;
  message: string;
  error?: string;
}

export interface ConnectorStatus {
  connected: boolean;
  lastSync?: Date;
  syncCount: number;
  errors: number;
}

export abstract class BaseConnector {
  protected config: ConnectorConfig;
  protected name: string;

  constructor(config: ConnectorConfig, name: string) {
    this.config = config;
    this.name = name;
  }

  abstract testConnection(): Promise<boolean>;
  abstract syncInvoice(invoiceData: InvoiceData): Promise<SyncResult>;
  abstract getStatus(): Promise<ConnectorStatus>;

  protected validateConfig(): boolean {
    return !!(this.config.apiKey && this.config.apiSecret);
  }

  protected logError(error: any): void {
    console.error(`[${this.name}] Error:`, error);
  }

  protected logInfo(message: string): void {
    console.log(`[${this.name}] ${message}`);
  }
}

