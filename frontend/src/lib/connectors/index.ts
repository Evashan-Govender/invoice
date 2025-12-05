// Connector factory and manager

import { BaseConnector, InvoiceData, ConnectorConfig, SyncResult } from './base';
import { XeroConnector } from './xero';
import { QuickBooksConnector } from './quickbooks';
import { SAPConnector } from './sap';
import { NetSuiteConnector } from './netsuite';
import { ZohoConnector } from './zoho';

export type ConnectorType = 'xero' | 'quickbooks' | 'sap' | 'netsuite' | 'zoho';

export class ConnectorManager {
  private static instance: ConnectorManager;
  private connectors: Map<string, BaseConnector> = new Map();

  private constructor() {}

  static getInstance(): ConnectorManager {
    if (!ConnectorManager.instance) {
      ConnectorManager.instance = new ConnectorManager();
    }
    return ConnectorManager.instance;
  }

  /**
   * Create and register a new connector
   */
  createConnector(type: ConnectorType, config: ConnectorConfig): BaseConnector {
    let connector: BaseConnector;

    switch (type) {
      case 'xero':
        connector = new XeroConnector(config);
        break;
      case 'quickbooks':
        connector = new QuickBooksConnector(config);
        break;
      case 'sap':
        connector = new SAPConnector(config);
        break;
      case 'netsuite':
        connector = new NetSuiteConnector(config);
        break;
      case 'zoho':
        connector = new ZohoConnector(config);
        break;
      default:
        throw new Error(`Unknown connector type: ${type}`);
    }

    this.connectors.set(type, connector);
    return connector;
  }

  /**
   * Get an existing connector
   */
  getConnector(type: ConnectorType): BaseConnector | undefined {
    return this.connectors.get(type);
  }

  /**
   * Remove a connector
   */
  removeConnector(type: ConnectorType): void {
    this.connectors.delete(type);
  }

  /**
   * Test connection for a specific connector
   */
  async testConnection(type: ConnectorType): Promise<boolean> {
    const connector = this.connectors.get(type);
    if (!connector) {
      throw new Error(`Connector ${type} not initialized`);
    }
    return connector.testConnection();
  }

  /**
   * Sync invoice to a specific connector
   */
  async syncInvoice(type: ConnectorType, invoiceData: InvoiceData): Promise<SyncResult> {
    const connector = this.connectors.get(type);
    if (!connector) {
      throw new Error(`Connector ${type} not initialized`);
    }
    return connector.syncInvoice(invoiceData);
  }

  /**
   * Sync invoice to all active connectors
   */
  async syncToAll(invoiceData: InvoiceData): Promise<Map<string, SyncResult>> {
    const results = new Map<string, SyncResult>();

    for (const [type, connector] of this.connectors.entries()) {
      try {
        const result = await connector.syncInvoice(invoiceData);
        results.set(type, result);
      } catch (error: any) {
        results.set(type, {
          success: false,
          invoiceId: invoiceData.invoice_number,
          message: 'Failed to sync',
          error: error.message,
        });
      }
    }

    return results;
  }

  /**
   * Get status of all connectors
   */
  async getAllStatus(): Promise<Map<string, any>> {
    const statuses = new Map<string, any>();

    for (const [type, connector] of this.connectors.entries()) {
      try {
        const status = await connector.getStatus();
        statuses.set(type, status);
      } catch (error) {
        statuses.set(type, {
          connected: false,
          error: 'Failed to get status',
        });
      }
    }

    return statuses;
  }

  /**
   * Load connectors from localStorage
   */
  loadFromStorage(): void {
    try {
      const stored = localStorage.getItem('integrations');
      if (stored) {
        const integrations = JSON.parse(stored);
        integrations.forEach((integration: any) => {
          if (integration.status === 'connected' && integration.config) {
            this.createConnector(integration.id as ConnectorType, integration.config);
          }
        });
      }
    } catch (error) {
      console.error('Failed to load connectors from storage:', error);
    }
  }

  /**
   * Get list of all active connectors
   */
  getActiveConnectors(): string[] {
    return Array.from(this.connectors.keys());
  }

  /**
   * Check if a connector is active
   */
  isConnectorActive(type: ConnectorType): boolean {
    return this.connectors.has(type);
  }
}

// Export singleton instance
export const connectorManager = ConnectorManager.getInstance();

// Export all connector types
export { XeroConnector, QuickBooksConnector, SAPConnector, NetSuiteConnector, ZohoConnector };
export type { InvoiceData, ConnectorConfig, SyncResult };

