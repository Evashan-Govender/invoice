'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { connectorManager, ConnectorType, InvoiceData } from '@/lib/connectors';
import { getERPLogo } from './ERPIcons';

interface ERPSyncButtonProps {
  invoiceData: InvoiceData;
}

interface ConnectorInfo {
  id: string;
  name: string;
}

const connectorNames: Record<string, string> = {
  xero: 'Xero',
  quickbooks: 'QuickBooks',
  sap: 'SAP Business One',
  netsuite: 'Oracle NetSuite',
  zoho: 'Zoho Books',
};

export default function ERPSyncButton({ invoiceData }: ERPSyncButtonProps) {
  const router = useRouter();
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [showSyncMenu, setShowSyncMenu] = useState(false);
  const [syncing, setSyncing] = useState<string | null>(null);
  const [activeConnectors, setActiveConnectors] = useState<ConnectorInfo[]>([]);
  const [syncResults, setSyncResults] = useState<Map<string, any>>(new Map());

  useEffect(() => {
    const loadConnectors = () => {
      try {
        const stored = localStorage.getItem('integrations');
        if (stored) {
          const integrations = JSON.parse(stored);
          const connected = integrations
            .filter((int: any) => int.status === 'connected')
            .map((int: any) => ({ id: int.id, name: connectorNames[int.id] || int.id }));
          setActiveConnectors(connected);
          connectorManager.loadFromStorage();
        }
      } catch (error) {
        console.error('Failed to load connectors:', error);
      }
    };
    
    loadConnectors();
  }, []);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowSyncMenu(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSyncToConnector = async (connectorId: string) => {
    setSyncing(connectorId);
    try {
      // Use backend API instead of frontend connectors
      // Backend has the OAuth tokens from database
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/integrations/sync`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          provider: connectorId,
          config: {
            // Backend will use stored OAuth tokens from database
            // No need to pass credentials here
          },
          invoice_data: {
            invoice_number: invoiceData.invoice_number,
            vendor_name: invoiceData.vendor_name,
            date: invoiceData.date,
            due_date: invoiceData.due_date,
            total: invoiceData.total_amount,
            subtotal: invoiceData.subtotal,
            tax_amount: invoiceData.tax_amount,
            currency: invoiceData.currency || 'USD',
            line_items: invoiceData.line_items || [],
          }
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.detail || errorData.message || `HTTP ${response.status}: Failed to sync`);
      }

      const result = await response.json();

      const newResults = new Map(syncResults);
      newResults.set(connectorId, result);
      setSyncResults(newResults);
    } catch (error: any) {
      const newResults = new Map(syncResults);
      newResults.set(connectorId, { 
        success: false, 
        message: 'Sync failed',
        error: error.message 
      });
      setSyncResults(newResults);
    } finally {
      setSyncing(null);
    }
  };

  const handleSyncToAll = async () => {
    setSyncing('all');
    try {
      const results = await connectorManager.syncToAll(invoiceData);
      setSyncResults(results);
    } catch (error: any) {
      console.error('Sync all failed:', error);
    } finally {
      setSyncing(null);
    }
  };

  // No connected ERPs - show setup button
  if (activeConnectors.length === 0) {
    return (
      <button
        onClick={() => {
          // Get invoice ID from URL if available
          const invoiceId = window.location.pathname.match(/\/invoices\/(\d+)/)?.[1];
          if (invoiceId) {
            sessionStorage.setItem('fromSettings', 'true');
            router.push(`/settings?from=invoice&invoiceId=${invoiceId}`);
          } else {
            router.push('/settings');
          }
        }}
        className="btn-secondary group"
      >
        <svg className="w-4 h-4 mr-2 text-slate-400 group-hover:text-violet-500 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
        </svg>
        <span className="group-hover:text-violet-600 transition-colors">Connect ERP</span>
      </button>
    );
  }

  const successCount = Array.from(syncResults.values()).filter(r => r?.success).length;
  const hasResults = syncResults.size > 0;

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Main Button */}
      <button
        onClick={() => setShowSyncMenu(!showSyncMenu)}
        disabled={syncing !== null}
        className={`relative ${
          hasResults && successCount === activeConnectors.length
            ? 'btn-success'
            : 'btn-primary'
        } disabled:opacity-70`}
      >
        <span className="flex items-center space-x-2">
          {syncing === 'all' ? (
            <>
              <div className="spinner w-4 h-4"></div>
              <span>Syncing...</span>
            </>
          ) : (
            <>
              {hasResults && successCount === activeConnectors.length ? (
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              ) : (
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
                </svg>
              )}
              <span>
                {hasResults && successCount === activeConnectors.length ? 'Synced' : 'Sync to ERP'}
              </span>
              <svg className={`w-4 h-4 transition-transform duration-200 ${showSyncMenu ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </>
          )}
        </span>
        
        {/* Active integrations indicator */}
        <span className="absolute -top-1.5 -right-1.5 flex h-5 w-5 items-center justify-center">
          <span className="absolute inline-flex h-full w-full rounded-full bg-white/30 animate-ping"></span>
          <span className="relative inline-flex rounded-full h-5 w-5 bg-white text-[10px] font-bold text-violet-600 items-center justify-center shadow">
            {activeConnectors.length}
          </span>
        </span>
      </button>

      {/* Dropdown Menu */}
      {showSyncMenu && (
        <div className="absolute right-0 mt-3 w-80 card shadow-2xl z-50 overflow-hidden animate-dropdown-enter">
          {/* Header */}
          <div className="px-4 py-3 bg-gradient-to-r from-slate-50 to-slate-100 border-b border-slate-200">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <div className="p-1.5 bg-violet-100 rounded-lg">
                  <svg className="w-4 h-4 text-violet-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
                  </svg>
                </div>
                <span className="text-sm font-bold text-slate-700">Sync Invoice</span>
              </div>
              {hasResults && (
                <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${
                  successCount === activeConnectors.length
                    ? 'bg-emerald-100 text-emerald-700'
                    : 'bg-amber-100 text-amber-700'
                }`}>
                  {successCount}/{activeConnectors.length} synced
                </span>
              )}
            </div>
          </div>
          
          {/* Connector List */}
          <div className="py-2">
            {activeConnectors.map((connector) => {
              const result = syncResults.get(connector.id);
              const isLoading = syncing === connector.id;
              
              return (
                <button
                  key={connector.id}
                  onClick={() => handleSyncToConnector(connector.id)}
                  disabled={syncing !== null}
                  className="w-full flex items-center justify-between px-4 py-3 hover:bg-violet-50 transition-colors disabled:opacity-60"
                >
                  <div className="flex items-center space-x-3">
                    {getERPLogo(connector.id, 'w-9 h-9')}
                    <div className="text-left">
                      <p className="text-sm font-semibold text-slate-800">{connector.name}</p>
                      <p className="text-xs text-slate-500">
                        {result?.success ? 'Synced successfully' : result?.error ? 'Sync failed' : 'Click to sync'}
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex items-center">
                    {isLoading ? (
                      <div className="spinner w-5 h-5 border-2 border-violet-600"></div>
                    ) : result?.success ? (
                      <div className="badge-success flex items-center space-x-1">
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                        <span>Done</span>
                      </div>
                    ) : result?.error ? (
                      <div className="badge-danger flex items-center space-x-1">
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                        <span>Failed</span>
                      </div>
                    ) : (
                      <svg className="w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    )}
                  </div>
                </button>
              );
            })}
          </div>

          {/* Sync All Button */}
          {activeConnectors.length > 1 && (
            <div className="px-3 py-3 bg-slate-50 border-t border-slate-200">
              <button
                onClick={handleSyncToAll}
                disabled={syncing !== null}
                className="w-full btn-primary disabled:opacity-60"
              >
                {syncing === 'all' ? (
                  <span className="flex items-center space-x-2">
                    <div className="spinner w-4 h-4"></div>
                    <span>Syncing to all...</span>
                  </span>
                ) : (
                  <>
                    <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                    Sync to All ({activeConnectors.length})
                  </>
                )}
              </button>
            </div>
          )}

          {/* Footer */}
          <div className="px-4 py-2.5 bg-slate-50 border-t border-slate-100">
            <button
              onClick={() => {
                const invoiceId = window.location.pathname.match(/\/invoices\/(\d+)/)?.[1];
                if (invoiceId) {
                  sessionStorage.setItem('fromSettings', 'true');
                  router.push(`/settings?from=invoice&invoiceId=${invoiceId}`);
                } else {
                  router.push('/settings');
                }
              }}
              className="w-full flex items-center justify-center space-x-1 text-xs text-slate-500 hover:text-violet-600 transition-colors font-medium"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              <span>Manage Integrations</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
