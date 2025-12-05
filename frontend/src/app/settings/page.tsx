'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { api } from '@/lib/api';
import { connectorManager, ConnectorType } from '@/lib/connectors';
import { getERPLogo } from '@/components/ERPIcons';
import AlertModal, { AlertType } from '@/components/AlertModal';

interface Integration {
  id: string;
  name: string;
  description: string;
  status: 'connected' | 'disconnected';
  apiKey?: string;
  config?: any;
  features?: string[];
}

interface UserSettings {
  gemini_api_key_set: boolean;
  gmail_enabled: boolean;
  gmail_email: string | null;
  gmail_connected: boolean;
  smtp_enabled: boolean;
  smtp_email: string | null;
  smtp_connected: boolean;
  auto_process: boolean;
  email_notifications: boolean;
  auto_sync_erp: boolean;
}

interface EmailProvider {
  id: string;
  name: string;
  imap_host: string;
  imap_port: number;
  smtp_host: string;
  smtp_port: number;
  use_ssl: boolean;
  help_url: string;
}

// Default email providers - used as fallback if API fails
const defaultEmailProviders: EmailProvider[] = [
  {
    id: 'gmail',
    name: 'Gmail',
    imap_host: 'imap.gmail.com',
    imap_port: 993,
    smtp_host: 'smtp.gmail.com',
    smtp_port: 587,
    use_ssl: true,
    help_url: 'https://support.google.com/accounts/answer/185833'
  },
  {
    id: 'outlook',
    name: 'Outlook / Microsoft 365',
    imap_host: 'outlook.office365.com',
    imap_port: 993,
    smtp_host: 'smtp.office365.com',
    smtp_port: 587,
    use_ssl: true,
    help_url: 'https://support.microsoft.com/en-us/account-billing/using-app-passwords'
  },
  {
    id: 'yahoo',
    name: 'Yahoo Mail',
    imap_host: 'imap.mail.yahoo.com',
    imap_port: 993,
    smtp_host: 'smtp.mail.yahoo.com',
    smtp_port: 587,
    use_ssl: true,
    help_url: 'https://help.yahoo.com/kb/generate-third-party-passwords-sln15241.html'
  },
  {
    id: 'icloud',
    name: 'iCloud Mail',
    imap_host: 'imap.mail.me.com',
    imap_port: 993,
    smtp_host: 'smtp.mail.me.com',
    smtp_port: 587,
    use_ssl: true,
    help_url: 'https://support.apple.com/en-us/HT204397'
  },
  {
    id: 'custom',
    name: 'Custom / Other',
    imap_host: '',
    imap_port: 993,
    smtp_host: '',
    smtp_port: 587,
    use_ssl: true,
    help_url: ''
  }
];

const integrationData: Integration[] = [
  {
    id: 'xero',
    name: 'Xero',
    description: 'Beautiful accounting software for small businesses. Sync invoices, bills, and contacts seamlessly.',
    status: 'disconnected',
    features: ['Invoice Sync', 'Bill Creation', 'Contact Management', 'Bank Reconciliation'],
  },
  {
    id: 'quickbooks',
    name: 'QuickBooks',
    description: 'The leading accounting platform for growing businesses. Automate your invoice workflow.',
    status: 'disconnected',
    features: ['Invoice Import', 'Expense Tracking', 'Tax Calculation', 'Multi-currency'],
  },
  {
    id: 'sap',
    name: 'SAP Business One',
    description: 'Enterprise-grade ERP integration for large organizations with complex requirements.',
    status: 'disconnected',
    features: ['Purchase Orders', 'Vendor Management', 'GL Posting', 'Cost Centers'],
  },
  {
    id: 'netsuite',
    name: 'Oracle NetSuite',
    description: 'Cloud-based ERP for modern enterprises. Full financial automation and reporting.',
    status: 'disconnected',
    features: ['Vendor Bills', 'Approval Workflows', 'Custom Fields', 'Subsidiaries'],
  },
  {
    id: 'zoho',
    name: 'Zoho Books',
    description: 'Comprehensive accounting suite with powerful automation and collaboration features.',
    status: 'disconnected',
    features: ['Bill Management', 'Payment Tracking', 'GST Compliance', 'Reports'],
  },
];

export default function SettingsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<'integrations' | 'api' | 'gmail' | 'smtp' | 'preferences'>('integrations');
  const [integrations, setIntegrations] = useState<Integration[]>(integrationData);
  const [selectedIntegration, setSelectedIntegration] = useState<Integration | null>(null);
  const [showConfigModal, setShowConfigModal] = useState(false);
  const [configForm, setConfigForm] = useState({
    apiKey: '',
    apiSecret: '',
    orgId: '',
    autoSync: false,
  });

  // SMTP/IMAP state
  const [emailProviders, setEmailProviders] = useState<EmailProvider[]>(defaultEmailProviders);
  const [selectedProvider, setSelectedProvider] = useState<string>('gmail');
  const [smtpForm, setSmtpForm] = useState({
    email: '',
    password: '',
    imap_host: '',
    imap_port: 993,
    smtp_host: '',
    smtp_port: 587,
    use_ssl: true,
  });
  const [testingSmtp, setTestingSmtp] = useState(false);
  const [checkingSmtp, setCheckingSmtp] = useState(false);

  // Settings state
  const [settings, setSettings] = useState<UserSettings | null>(null);
  const [geminiKey, setGeminiKey] = useState('');
  const [geminiKeyMasked, setGeminiKeyMasked] = useState('');
  const [showGeminiKey, setShowGeminiKey] = useState(false);
  const [preferences, setPreferences] = useState({
    auto_process: true,
    email_notifications: false,
    auto_sync_erp: false,
  });

  // Alert modal state
  const [alertModal, setAlertModal] = useState<{
    isOpen: boolean;
    title?: string;
    message: string;
    type: AlertType;
  }>({
    isOpen: false,
    message: '',
    type: 'info',
  });

  const showAlert = useCallback((message: string, type: AlertType = 'info', title?: string) => {
    setAlertModal({ isOpen: true, message, type, title });
  }, []);

  const closeAlert = useCallback(() => {
    setAlertModal(prev => ({ ...prev, isOpen: false }));
  }, []);

  // Handle Gmail OAuth callback
  useEffect(() => {
    const handleGmailCallback = async () => {
      const gmailSuccess = searchParams.get('gmail_success');
      const gmailData = searchParams.get('gmail_data');
      const gmailError = searchParams.get('gmail_error');

      if (gmailError) {
        showAlert(`Gmail connection failed: ${gmailError}`, 'error');
        // Clear URL params
        router.replace('/settings');
        setActiveTab('gmail');
        return;
      }

      if (gmailSuccess && gmailData) {
        try {
          const data = JSON.parse(decodeURIComponent(gmailData));
          
          // Save to backend
          await api.connectGmail({
            access_token: data.access_token,
            refresh_token: data.refresh_token,
            token_expiry: data.token_expiry,
            email: data.email,
          });

          // Update local state
          setSettings(prev => prev ? {
            ...prev,
            gmail_connected: true,
            gmail_enabled: true,
            gmail_email: data.email,
          } : null);

          showAlert('Gmail connected successfully!', 'success');
          
          // Clear URL params
          router.replace('/settings');
          setActiveTab('gmail');
        } catch (error: any) {
          showAlert(`Failed to save Gmail connection: ${error.message}`, 'error');
          router.replace('/settings');
        }
      }
    };

    handleGmailCallback();
  }, [searchParams, router]);

  useEffect(() => {
    const init = async () => {
      try {
        const userData = await api.getCurrentUser();
        setUser(userData);
        
        // Load settings from backend
        try {
          const settingsData = await api.getSettings();
          setSettings(settingsData);
          setPreferences({
            auto_process: settingsData.auto_process,
            email_notifications: settingsData.email_notifications,
            auto_sync_erp: settingsData.auto_sync_erp,
          });
          
          // Get masked Gemini key
          const keyData = await api.getGeminiKey();
          if (keyData.is_set) {
            setGeminiKeyMasked(keyData.api_key_masked);
          }
          
          // Load email providers
          try {
            const providers = await api.getEmailProviders();
            if (providers && providers.length > 0) {
              setEmailProviders(providers);
              // Set default provider config
              const gmailProvider = providers.find((p: EmailProvider) => p.id === 'gmail');
              if (gmailProvider) {
                setSmtpForm(prev => ({
                  ...prev,
                  imap_host: gmailProvider.imap_host,
                  imap_port: gmailProvider.imap_port,
                  smtp_host: gmailProvider.smtp_host,
                  smtp_port: gmailProvider.smtp_port,
                  use_ssl: gmailProvider.use_ssl,
                }));
              }
            }
          } catch (e) {
            console.log('Email providers not available, using defaults');
            // Keep using defaultEmailProviders which is already set as initial state
            const gmailProvider = defaultEmailProviders.find(p => p.id === 'gmail');
            if (gmailProvider) {
              setSmtpForm(prev => ({
                ...prev,
                imap_host: gmailProvider.imap_host,
                imap_port: gmailProvider.imap_port,
                smtp_host: gmailProvider.smtp_host,
                smtp_port: gmailProvider.smtp_port,
                use_ssl: gmailProvider.use_ssl,
              }));
            }
          }
        } catch (e) {
          console.log('Settings not available yet');
        }
        
        const savedIntegrations = localStorage.getItem('integrations');
        if (savedIntegrations) {
          const saved = JSON.parse(savedIntegrations);
          setIntegrations(integrationData.map(int => {
            const savedInt = saved.find((s: any) => s.id === int.id);
            return savedInt ? { ...int, ...savedInt } : int;
          }));
        }
        
        connectorManager.loadFromStorage();
      } catch (err) {
        router.push('/login');
      } finally {
        setLoading(false);
      }
    };
    init();
  }, [router]);

  const handleConnectIntegration = (integration: Integration) => {
    setSelectedIntegration(integration);
    setConfigForm({
      apiKey: integration.config?.apiKey || '',
      apiSecret: integration.config?.apiSecret || '',
      orgId: integration.config?.orgId || '',
      autoSync: integration.config?.autoSync || false,
    });
    setShowConfigModal(true);
  };

  const handleDisconnectIntegration = (integrationId: string) => {
    const updated = integrations.map(int =>
      int.id === integrationId
        ? { ...int, status: 'disconnected' as const, apiKey: undefined, config: undefined }
        : int
    );
    setIntegrations(updated);
    localStorage.setItem('integrations', JSON.stringify(updated));
    connectorManager.removeConnector(integrationId as ConnectorType);
  };

  const handleSaveIntegration = async () => {
    if (!selectedIntegration) return;

    setSaving(true);
    try {
      const connector = connectorManager.createConnector(
        selectedIntegration.id as ConnectorType,
        configForm
      );

      const isConnected = await connector.testConnection();
      
      if (!isConnected) {
        showAlert('Connection test failed. Please verify your credentials and try again.', 'error');
        setSaving(false);
        return;
      }

      const updated = integrations.map(int =>
        int.id === selectedIntegration.id
          ? { ...int, status: 'connected' as const, apiKey: configForm.apiKey, config: configForm }
          : int
      );
      setIntegrations(updated);
      localStorage.setItem('integrations', JSON.stringify(updated));
      
      setShowConfigModal(false);
    } catch (error: any) {
      showAlert(`Failed to connect: ${error.message}`, 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleTestConnection = async () => {
    if (!selectedIntegration) return;

    setSaving(true);
    try {
      const connector = connectorManager.createConnector(
        selectedIntegration.id as ConnectorType,
        configForm
      );
      
      const isConnected = await connector.testConnection();
      
      if (isConnected) {
        showAlert(`Connection to ${selectedIntegration.name} successful!`, 'success');
      } else {
        showAlert(`Connection to ${selectedIntegration.name} failed. Please check your credentials.`, 'error');
      }
    } catch (error: any) {
      showAlert(`Error testing connection: ${error.message}`, 'error');
    } finally {
      setSaving(false);
    }
  };

  // Gemini API Key handlers
  const handleSaveGeminiKey = async () => {
    if (!geminiKey.trim()) {
      showAlert('Please enter a valid API key', 'warning');
      return;
    }
    
    setSaving(true);
    try {
      await api.saveGeminiKey(geminiKey);
      const keyData = await api.getGeminiKey();
      setGeminiKeyMasked(keyData.api_key_masked);
      setGeminiKey('');
      setSettings(prev => prev ? { ...prev, gemini_api_key_set: true } : null);
      showAlert('Gemini API key saved successfully!', 'success');
    } catch (error: any) {
      showAlert(`Error saving API key: ${error.response?.data?.detail || error.message}`, 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteGeminiKey = async () => {
    if (!confirm('Are you sure you want to delete your Gemini API key?')) return;
    
    setSaving(true);
    try {
      await api.deleteGeminiKey();
      setGeminiKeyMasked('');
      setSettings(prev => prev ? { ...prev, gemini_api_key_set: false } : null);
      showAlert('Gemini API key deleted', 'success');
    } catch (error: any) {
      showAlert(`Error deleting API key: ${error.response?.data?.detail || error.message}`, 'error');
    } finally {
      setSaving(false);
    }
  };

  // Preferences handlers
  const handleUpdatePreference = async (key: keyof typeof preferences) => {
    const newValue = !preferences[key];
    setPreferences(prev => ({ ...prev, [key]: newValue }));
    
    try {
      await api.updatePreferences({ [key]: newValue });
    } catch (error: any) {
      // Revert on error
      setPreferences(prev => ({ ...prev, [key]: !newValue }));
      showAlert(`Error updating preference: ${error.response?.data?.detail || error.message}`, 'error');
    }
  };

  const [checkingGmail, setCheckingGmail] = useState(false);

  // Gmail handlers
  const handleCheckGmail = async () => {
    setCheckingGmail(true);
    try {
      const result = await api.checkGmailForInvoices();
      if (result.processed > 0) {
        showAlert(`Found ${result.processed} new invoice(s)! Check your dashboard.`, 'success');
      } else {
        showAlert('No new invoices found in your Gmail.', 'info');
      }
    } catch (error: any) {
      showAlert(`Error checking Gmail: ${error.response?.data?.detail || error.message}`, 'error');
    } finally {
      setCheckingGmail(false);
    }
  };

  const handleConnectGmail = () => {
    // Gmail OAuth flow - we'll use Google's OAuth
    const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
    if (!clientId) {
      showAlert('Google OAuth not configured. Please set NEXT_PUBLIC_GOOGLE_CLIENT_ID in your environment.', 'warning');
      return;
    }
    
    const redirectUri = `${window.location.origin}/api/auth/gmail/callback`;
    // Include email and profile scopes to get user info
    const scopes = [
      'https://www.googleapis.com/auth/gmail.readonly',
      'https://www.googleapis.com/auth/gmail.modify',
      'https://www.googleapis.com/auth/userinfo.email',
      'https://www.googleapis.com/auth/userinfo.profile'
    ];
    const scope = encodeURIComponent(scopes.join(' '));
    const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${clientId}&redirect_uri=${redirectUri}&response_type=code&scope=${scope}&access_type=offline&prompt=consent`;
    
    window.location.href = authUrl;
  };

  const handleDisconnectGmail = async () => {
    if (!confirm('Are you sure you want to disconnect Gmail?')) return;
    
    setSaving(true);
    try {
      await api.disconnectGmail();
      setSettings(prev => prev ? { 
        ...prev, 
        gmail_enabled: false, 
        gmail_connected: false, 
        gmail_email: null 
      } : null);
      showAlert('Gmail disconnected', 'success');
    } catch (error: any) {
      showAlert(`Error disconnecting Gmail: ${error.response?.data?.detail || error.message}`, 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleGmail = async () => {
    setSaving(true);
    try {
      const result = await api.toggleGmail();
      setSettings(prev => prev ? { ...prev, gmail_enabled: result.enabled } : null);
    } catch (error: any) {
      showAlert(`Error toggling Gmail: ${error.response?.data?.detail || error.message}`, 'error');
    } finally {
      setSaving(false);
    }
  };

  // SMTP/IMAP handlers
  const handleProviderChange = (providerId: string) => {
    setSelectedProvider(providerId);
    const provider = emailProviders.find(p => p.id === providerId);
    if (provider && providerId !== 'custom') {
      setSmtpForm(prev => ({
        ...prev,
        imap_host: provider.imap_host,
        imap_port: provider.imap_port,
        smtp_host: provider.smtp_host,
        smtp_port: provider.smtp_port,
        use_ssl: provider.use_ssl,
      }));
    }
  };

  const handleTestSmtp = async () => {
    if (!smtpForm.email || !smtpForm.password) {
      showAlert('Please enter email and password', 'warning');
      return;
    }
    
    setTestingSmtp(true);
    try {
      const result = await api.testSmtpConnection({
        email: smtpForm.email,
        password: smtpForm.password,
        imap_host: smtpForm.imap_host,
        imap_port: smtpForm.imap_port,
        use_ssl: smtpForm.use_ssl,
      });
      
      if (result.success) {
        showAlert('Connection test successful! You can now connect.', 'success');
      } else {
        showAlert(`Connection failed: ${result.message}`, 'error');
      }
    } catch (error: any) {
      showAlert(`Error testing connection: ${error.response?.data?.detail || error.message}`, 'error');
    } finally {
      setTestingSmtp(false);
    }
  };

  const handleConnectSmtp = async () => {
    if (!smtpForm.email || !smtpForm.password) {
      showAlert('Please enter email and password', 'warning');
      return;
    }
    
    setSaving(true);
    try {
      await api.connectSmtp(smtpForm);
      setSettings(prev => prev ? {
        ...prev,
        smtp_connected: true,
        smtp_enabled: true,
        smtp_email: smtpForm.email,
      } : null);
      showAlert('Email connected successfully!', 'success');
    } catch (error: any) {
      showAlert(`Error connecting email: ${error.response?.data?.detail || error.message}`, 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleDisconnectSmtp = async () => {
    if (!confirm('Are you sure you want to disconnect this email?')) return;
    
    setSaving(true);
    try {
      await api.disconnectSmtp();
      setSettings(prev => prev ? {
        ...prev,
        smtp_enabled: false,
        smtp_connected: false,
        smtp_email: null,
      } : null);
      setSmtpForm({
        email: '',
        password: '',
        imap_host: emailProviders.find(p => p.id === 'gmail')?.imap_host || '',
        imap_port: 993,
        smtp_host: emailProviders.find(p => p.id === 'gmail')?.smtp_host || '',
        smtp_port: 587,
        use_ssl: true,
      });
      showAlert('Email disconnected', 'success');
    } catch (error: any) {
      showAlert(`Error disconnecting email: ${error.response?.data?.detail || error.message}`, 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleSmtp = async () => {
    setSaving(true);
    try {
      const result = await api.toggleSmtp();
      setSettings(prev => prev ? { ...prev, smtp_enabled: result.enabled } : null);
    } catch (error: any) {
      showAlert(`Error toggling email: ${error.response?.data?.detail || error.message}`, 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleCheckSmtp = async () => {
    setCheckingSmtp(true);
    try {
      const result = await api.checkSmtpForInvoices();
      if (result.processed > 0) {
        showAlert(`Found ${result.processed} new invoice(s)! Check your dashboard.`, 'success');
      } else {
        showAlert('No new invoices found in your email.', 'info');
      }
    } catch (error: any) {
      showAlert(`Error checking email: ${error.response?.data?.detail || error.message}`, 'error');
    } finally {
      setCheckingSmtp(false);
    }
  };

  const connectedCount = integrations.filter(i => i.status === 'connected').length;

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <div className="spinner w-12 h-12 border-4 border-violet-600 mx-auto"></div>
          <p className="mt-4 text-slate-600 font-medium">Loading settings...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex">
      {/* Sidebar */}
      <aside className="sidebar">
        <div className="sidebar-brand">
          <div className="flex items-center space-x-3">
            <div className="w-11 h-11 bg-gradient-to-br from-violet-600 to-indigo-600 rounded-xl flex items-center justify-center shadow-lg shadow-violet-500/30">
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <div>
              <h1 className="text-xl font-bold gradient-text">Invoice AI</h1>
              <p className="text-xs text-slate-400">Powered by Gemini</p>
            </div>
          </div>
        </div>

        <nav className="sidebar-nav">
          <button
            onClick={() => router.push('/dashboard')}
            className="sidebar-link"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
            </svg>
            <span>Dashboard</span>
          </button>

          <button className="sidebar-link-active">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            <span>Settings</span>
          </button>
        </nav>

        {/* Settings Submenu */}
        <div className="px-4 mt-4">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Settings Menu</p>
          <div className="space-y-1">
            <button
              onClick={() => setActiveTab('integrations')}
              className={`w-full flex items-center space-x-3 px-3 py-2 rounded-lg text-sm transition-colors ${
                activeTab === 'integrations' 
                  ? 'bg-violet-100 text-violet-700 font-medium' 
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 14v6m-3-3h6M6 10h2a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v2a2 2 0 002 2zm10 0h2a2 2 0 002-2V6a2 2 0 00-2-2h-2a2 2 0 00-2 2v2a2 2 0 002 2zM6 20h2a2 2 0 002-2v-2a2 2 0 00-2-2H6a2 2 0 00-2 2v2a2 2 0 002 2z" />
              </svg>
              <span>ERP Integrations</span>
            </button>
            <button
              onClick={() => setActiveTab('api')}
              className={`w-full flex items-center space-x-3 px-3 py-2 rounded-lg text-sm transition-colors ${
                activeTab === 'api' 
                  ? 'bg-violet-100 text-violet-700 font-medium' 
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
              </svg>
              <span>API Keys</span>
            </button>
            <button
              onClick={() => setActiveTab('gmail')}
              className={`w-full flex items-center space-x-3 px-3 py-2 rounded-lg text-sm transition-colors ${
                activeTab === 'gmail' 
                  ? 'bg-violet-100 text-violet-700 font-medium' 
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
              <span>Gmail Integration</span>
            </button>
            <button
              onClick={() => setActiveTab('smtp')}
              className={`w-full flex items-center space-x-3 px-3 py-2 rounded-lg text-sm transition-colors ${
                activeTab === 'smtp' 
                  ? 'bg-violet-100 text-violet-700 font-medium' 
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 4H6a2 2 0 00-2 2v12a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-2m-4-1v8m0 0l3-3m-3 3L9 8m-5 5h2.586a1 1 0 01.707.293l2.414 2.414a1 1 0 00.707.293h3.172a1 1 0 00.707-.293l2.414-2.414a1 1 0 01.707-.293H20" />
              </svg>
              <span>SMTP/IMAP Email</span>
            </button>
            <button
              onClick={() => setActiveTab('preferences')}
              className={`w-full flex items-center space-x-3 px-3 py-2 rounded-lg text-sm transition-colors ${
                activeTab === 'preferences' 
                  ? 'bg-violet-100 text-violet-700 font-medium' 
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
              </svg>
              <span>Preferences</span>
            </button>
          </div>
        </div>

        <div className="sidebar-footer">
          <div className="flex items-center space-x-3 px-3 py-3 bg-slate-50 rounded-xl mb-3">
            <div className="w-10 h-10 bg-gradient-to-br from-violet-500 to-indigo-500 rounded-full flex items-center justify-center shadow-md">
              <span className="text-white font-semibold text-sm">
                {user?.email?.charAt(0).toUpperCase()}
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-slate-800 truncate">
                {user?.email?.split('@')[0]}
              </p>
              <p className="text-xs text-slate-500 truncate">{user?.email}</p>
            </div>
          </div>
          <button
            onClick={() => api.logout()}
            className="w-full flex items-center justify-center space-x-2 px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 rounded-xl transition-all duration-200 border border-transparent hover:border-red-100 font-medium"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
            <span>Sign Out</span>
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="header">
          <div className="header-content">
            <div>
              <h2 className="text-2xl font-bold text-slate-900">Settings</h2>
              <p className="text-sm text-slate-500 mt-1">Manage your integrations and preferences</p>
            </div>
            {connectedCount > 0 && (
              <div className="flex items-center space-x-2 px-4 py-2 bg-emerald-50 border border-emerald-200 rounded-full">
                <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></div>
                <span className="text-sm font-medium text-emerald-700">
                  {connectedCount} Integration{connectedCount > 1 ? 's' : ''} Active
                </span>
              </div>
            )}
          </div>
        </header>

        <main className="flex-1 overflow-y-auto px-8 py-6">
          {/* Integrations Tab */}
          {activeTab === 'integrations' && (
            <div className="space-y-6 animate-fade-in">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-bold text-slate-900">Accounting Software</h3>
                  <p className="text-sm text-slate-500 mt-1">
                    Connect your accounting platform to automatically sync extracted invoice data
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-5">
                {integrations.map((integration) => (
                  <div
                    key={integration.id}
                    className={`card-hover relative group ${
                      integration.status === 'connected'
                        ? 'border-emerald-200 shadow-emerald-100'
                        : ''
                    }`}
                  >
                    {/* Status Badge */}
                    {integration.status === 'connected' && (
                      <div className="absolute top-4 right-4">
                        <div className="badge-success flex items-center space-x-1.5">
                          <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full"></div>
                          <span>Connected</span>
                        </div>
                      </div>
                    )}

                    <div className="p-6">
                      {/* Logo & Name */}
                      <div className="flex items-center space-x-4 mb-4">
                        <div className="transform group-hover:scale-105 transition-transform duration-300">
                          {getERPLogo(integration.id, 'w-14 h-14')}
                        </div>
                        <div>
                          <h4 className="text-lg font-bold text-slate-900">{integration.name}</h4>
                          <p className="text-xs text-slate-400 uppercase tracking-wide">
                            {integration.id === 'sap' ? 'Enterprise ERP' : 'Accounting'}
                          </p>
                        </div>
                      </div>

                      {/* Description */}
                      <p className="text-sm text-slate-600 leading-relaxed mb-4">
                        {integration.description}
                      </p>

                      {/* Features */}
                      {integration.features && (
                        <div className="flex flex-wrap gap-1.5 mb-5">
                          {integration.features.slice(0, 3).map((feature) => (
                            <span key={feature} className="badge-neutral text-xs">
                              {feature}
                            </span>
                          ))}
                          {integration.features.length > 3 && (
                            <span className="badge-neutral text-xs">
                              +{integration.features.length - 3} more
                            </span>
                          )}
                        </div>
                      )}

                      {/* Actions */}
                      <div className="flex space-x-2">
                        {integration.status === 'disconnected' ? (
                          <button
                            onClick={() => handleConnectIntegration(integration)}
                            className="flex-1 btn-primary"
                          >
                            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                            </svg>
                            Connect
                          </button>
                        ) : (
                          <>
                            <button
                              onClick={() => handleConnectIntegration(integration)}
                              className="flex-1 btn-secondary"
                            >
                              <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                              </svg>
                              Configure
                            </button>
                            <button
                              onClick={() => handleDisconnectIntegration(integration.id)}
                              className="btn-icon text-red-500 hover:bg-red-50"
                            >
                              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                              </svg>
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* API Keys Tab */}
          {activeTab === 'api' && (
            <div className="max-w-2xl animate-fade-in">
              <div className="mb-6">
                <h3 className="text-lg font-bold text-slate-900">API Configuration</h3>
                <p className="text-sm text-slate-500 mt-1">
                  Manage API keys for AI-powered invoice processing
                </p>
              </div>

              <div className="card overflow-hidden">
                <div className="p-6 space-y-5">
                  {/* Current Key Status */}
                  {settings?.gemini_api_key_set && geminiKeyMasked && (
                    <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-3">
                          <div className="p-2 bg-emerald-100 rounded-lg">
                            <svg className="w-5 h-5 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                          </div>
                          <div>
                            <p className="text-sm font-semibold text-emerald-800">API Key Configured</p>
                            <p className="text-xs text-emerald-600 font-mono">{geminiKeyMasked}</p>
                          </div>
                        </div>
                        <button
                          onClick={handleDeleteGeminiKey}
                          disabled={saving}
                          className="text-red-600 hover:text-red-700 text-sm font-medium"
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  )}

                  <div>
                    <label className="label">
                      {settings?.gemini_api_key_set ? 'Update Gemini API Key' : 'Gemini API Key'}
                    </label>
                    <div className="relative">
                      <input
                        type={showGeminiKey ? 'text' : 'password'}
                        value={geminiKey}
                        onChange={(e) => setGeminiKey(e.target.value)}
                        placeholder={settings?.gemini_api_key_set ? 'Enter new key to update' : 'Enter your Gemini API key'}
                        className="input pr-12"
                      />
                      <button 
                        onClick={() => setShowGeminiKey(!showGeminiKey)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 btn-icon"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          {showGeminiKey ? (
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                          ) : (
                            <>
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                            </>
                          )}
                        </svg>
                      </button>
                    </div>
                    <p className="mt-2 text-xs text-slate-500">
                      Required for AI-powered invoice data extraction using Google Gemini Vision
                    </p>
                  </div>

                  <div className="alert-info">
                    <div className="p-1.5 bg-sky-100 rounded-lg">
                      <svg className="w-4 h-4 text-sky-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                    <div className="text-sm">
                      <p className="font-semibold text-sky-900 mb-1">How to get your Gemini API key:</p>
                      <ol className="list-decimal list-inside space-y-0.5 text-xs text-sky-700">
                        <li>Go to <a href="https://makersuite.google.com/app/apikey" target="_blank" rel="noopener noreferrer" className="underline">Google AI Studio</a></li>
                        <li>Sign in with your Google account</li>
                        <li>Click "Create API key"</li>
                        <li>Copy and paste your key here</li>
                      </ol>
                    </div>
                  </div>
                </div>

                <div className="px-6 py-4 bg-slate-50 border-t border-slate-100">
                  <button 
                    onClick={handleSaveGeminiKey}
                    disabled={!geminiKey.trim() || saving}
                    className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {saving ? (
                      <span className="flex items-center space-x-2">
                        <div className="spinner w-4 h-4"></div>
                        <span>Saving...</span>
                      </span>
                    ) : (
                      'Save API Key'
                    )}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Gmail Integration Tab */}
          {activeTab === 'gmail' && (
            <div className="max-w-2xl animate-fade-in">
              <div className="mb-6">
                <h3 className="text-lg font-bold text-slate-900">Gmail Integration</h3>
                <p className="text-sm text-slate-500 mt-1">
                  Automatically scan your inbox for invoices and process them
                </p>
              </div>

              <div className="card overflow-hidden">
                <div className="p-6 space-y-5">
                  {/* Connection Status */}
                  {settings?.gmail_connected ? (
                    <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-3">
                          <div className="p-2 bg-emerald-100 rounded-lg">
                            <svg className="w-5 h-5 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                            </svg>
                          </div>
                          <div>
                            <p className="text-sm font-semibold text-emerald-800">Gmail Connected</p>
                            <p className="text-xs text-emerald-600">{settings.gmail_email}</p>
                          </div>
                        </div>
                        <div className="flex items-center space-x-3">
                          {/* Toggle */}
                          <button
                            onClick={handleToggleGmail}
                            disabled={saving}
                            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                              settings.gmail_enabled ? 'bg-emerald-600' : 'bg-slate-200'
                            }`}
                          >
                            <span
                              className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform shadow-sm ${
                                settings.gmail_enabled ? 'translate-x-6' : 'translate-x-1'
                              }`}
                            />
                          </button>
                          <button
                            onClick={handleDisconnectGmail}
                            disabled={saving}
                            className="text-red-600 hover:text-red-700 text-sm font-medium"
                          >
                            Disconnect
                          </button>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="text-center py-8">
                      <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
                        <svg className="w-8 h-8 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                        </svg>
                      </div>
                      <h4 className="text-lg font-semibold text-slate-800 mb-2">Connect Your Gmail</h4>
                      <p className="text-sm text-slate-500 mb-6 max-w-md mx-auto">
                        Allow Invoice AI to scan your inbox for invoices and automatically process them
                      </p>
                      <button
                        onClick={handleConnectGmail}
                        className="btn-primary inline-flex items-center space-x-2"
                      >
                        <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                          <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                          <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                          <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                          <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                        </svg>
                        <span>Connect with Google</span>
                      </button>
                    </div>
                  )}

                  {settings?.gmail_connected && (
                    <>
                      {/* Manual Check Button */}
                      <div className="flex items-center justify-between p-4 bg-slate-50 rounded-xl">
                        <div>
                          <p className="text-sm font-medium text-slate-800">Check for new invoices</p>
                          <p className="text-xs text-slate-500">Manually scan your inbox now</p>
                        </div>
                        <button
                          onClick={handleCheckGmail}
                          disabled={checkingGmail || !settings.gmail_enabled}
                          className="btn-primary disabled:opacity-50"
                        >
                          {checkingGmail ? (
                            <span className="flex items-center space-x-2">
                              <div className="spinner w-4 h-4"></div>
                              <span>Checking...</span>
                            </span>
                          ) : (
                            <>
                              <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                              </svg>
                              Check Now
                            </>
                          )}
                        </button>
                      </div>

                      <div className="border-t border-slate-100 pt-5">
                        <h4 className="text-sm font-semibold text-slate-800 mb-3">How it works</h4>
                        <ul className="space-y-4">
                          <li className="flex items-start space-x-3">
                            <div className="w-9 h-9 bg-gradient-to-br from-sky-400 to-blue-500 rounded-xl flex items-center justify-center flex-shrink-0 shadow-md">
                              <svg className="w-4.5 h-4.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                              </svg>
                            </div>
                            <div>
                              <p className="text-sm font-medium text-slate-800">Monitor Inbox</p>
                              <p className="text-xs text-slate-500">Scans new emails for invoice attachments</p>
                            </div>
                          </li>
                          <li className="flex items-start space-x-3">
                            <div className="w-9 h-9 bg-gradient-to-br from-amber-400 to-orange-500 rounded-xl flex items-center justify-center flex-shrink-0 shadow-md">
                              <svg className="w-4.5 h-4.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                              </svg>
                            </div>
                            <div>
                              <p className="text-sm font-medium text-slate-800">Extract PDFs</p>
                              <p className="text-xs text-slate-500">Automatically downloads PDF invoices</p>
                            </div>
                          </li>
                          <li className="flex items-start space-x-3">
                            <div className="w-9 h-9 bg-gradient-to-br from-violet-500 to-purple-600 rounded-xl flex items-center justify-center flex-shrink-0 shadow-md">
                              <svg className="w-4.5 h-4.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                              </svg>
                            </div>
                            <div>
                              <p className="text-sm font-medium text-slate-800">AI Processing</p>
                              <p className="text-xs text-slate-500">Extracts data using Gemini Vision</p>
                            </div>
                          </li>
                          <li className="flex items-start space-x-3">
                            <div className="w-9 h-9 bg-gradient-to-br from-emerald-400 to-teal-500 rounded-xl flex items-center justify-center flex-shrink-0 shadow-md">
                              <svg className="w-4.5 h-4.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                              </svg>
                            </div>
                            <div>
                              <p className="text-sm font-medium text-slate-800">Ready to Review</p>
                              <p className="text-xs text-slate-500">Invoices appear in your dashboard</p>
                            </div>
                          </li>
                        </ul>
                      </div>

                      <div className="alert-info">
                        <div className="p-1.5 bg-sky-100 rounded-lg">
                          <svg className="w-4 h-4 text-sky-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                        </div>
                        <div className="text-sm">
                          <p className="font-semibold text-sky-900 mb-1">Privacy Note</p>
                          <p className="text-xs text-sky-700">
                            We only access emails with PDF attachments and never store the email content itself.
                            Only extracted invoice data is saved.
                          </p>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* SMTP/IMAP Integration Tab */}
          {activeTab === 'smtp' && (
            <div className="max-w-2xl animate-fade-in">
              <div className="mb-6">
                <h3 className="text-lg font-bold text-slate-900">SMTP/IMAP Email Integration</h3>
                <p className="text-sm text-slate-500 mt-1">
                  Connect any email account to automatically scan for invoice PDFs
                </p>
              </div>

              <div className="card overflow-hidden">
                <div className="p-6 space-y-5">
                  {/* Connection Status */}
                  {settings?.smtp_connected ? (
                    <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-3">
                          <div className="p-2 bg-emerald-100 rounded-lg">
                            <svg className="w-5 h-5 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                            </svg>
                          </div>
                          <div>
                            <p className="text-sm font-semibold text-emerald-800">Email Connected</p>
                            <p className="text-xs text-emerald-600">{settings.smtp_email}</p>
                          </div>
                        </div>
                        <div className="flex items-center space-x-3">
                          {/* Toggle */}
                          <button
                            onClick={handleToggleSmtp}
                            disabled={saving}
                            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                              settings.smtp_enabled ? 'bg-emerald-600' : 'bg-slate-200'
                            }`}
                          >
                            <span
                              className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform shadow-sm ${
                                settings.smtp_enabled ? 'translate-x-6' : 'translate-x-1'
                              }`}
                            />
                          </button>
                          <button
                            onClick={handleDisconnectSmtp}
                            disabled={saving}
                            className="text-red-600 hover:text-red-700 text-sm font-medium"
                          >
                            Disconnect
                          </button>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <>
                      {/* Email Provider Selection */}
                      <div>
                        <label className="label">Email Provider</label>
                        <select
                          value={selectedProvider}
                          onChange={(e) => handleProviderChange(e.target.value)}
                          className="input"
                        >
                          {emailProviders.map((provider) => (
                            <option key={provider.id} value={provider.id}>
                              {provider.name}
                            </option>
                          ))}
                        </select>
                      </div>

                      {/* Email & Password */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className="label">Email Address</label>
                          <input
                            type="email"
                            value={smtpForm.email}
                            onChange={(e) => setSmtpForm({ ...smtpForm, email: e.target.value })}
                            placeholder="your@email.com"
                            className="input"
                          />
                        </div>
                        <div>
                          <label className="label">App Password</label>
                          <input
                            type="password"
                            value={smtpForm.password}
                            onChange={(e) => setSmtpForm({ ...smtpForm, password: e.target.value })}
                            placeholder="Enter app password"
                            className="input"
                          />
                        </div>
                      </div>

                      {/* Server Configuration (for custom) */}
                      {selectedProvider === 'custom' && (
                        <div className="space-y-4 p-4 bg-slate-50 rounded-xl">
                          <p className="text-sm font-medium text-slate-700">Custom Server Settings</p>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                              <label className="label">IMAP Host</label>
                              <input
                                type="text"
                                value={smtpForm.imap_host}
                                onChange={(e) => setSmtpForm({ ...smtpForm, imap_host: e.target.value })}
                                placeholder="imap.example.com"
                                className="input"
                              />
                            </div>
                            <div>
                              <label className="label">IMAP Port</label>
                              <input
                                type="number"
                                value={smtpForm.imap_port}
                                onChange={(e) => setSmtpForm({ ...smtpForm, imap_port: parseInt(e.target.value) })}
                                className="input"
                              />
                            </div>
                            <div>
                              <label className="label">SMTP Host</label>
                              <input
                                type="text"
                                value={smtpForm.smtp_host}
                                onChange={(e) => setSmtpForm({ ...smtpForm, smtp_host: e.target.value })}
                                placeholder="smtp.example.com"
                                className="input"
                              />
                            </div>
                            <div>
                              <label className="label">SMTP Port</label>
                              <input
                                type="number"
                                value={smtpForm.smtp_port}
                                onChange={(e) => setSmtpForm({ ...smtpForm, smtp_port: parseInt(e.target.value) })}
                                className="input"
                              />
                            </div>
                          </div>
                          <label className="flex items-center space-x-3 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={smtpForm.use_ssl}
                              onChange={(e) => setSmtpForm({ ...smtpForm, use_ssl: e.target.checked })}
                              className="w-5 h-5 text-violet-600 border-slate-300 rounded focus:ring-violet-500"
                            />
                            <span className="text-sm text-slate-700">Use SSL/TLS</span>
                          </label>
                        </div>
                      )}

                      {/* Help Info */}
                      <div className="alert-info">
                        <div className="p-1.5 bg-sky-100 rounded-lg">
                          <svg className="w-4 h-4 text-sky-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                        </div>
                        <div className="text-sm">
                          <p className="font-semibold text-sky-900 mb-1">Important: Use App Passwords</p>
                          <p className="text-xs text-sky-700 mb-2">
                            Most email providers require app-specific passwords for IMAP access. Regular passwords won&apos;t work.
                          </p>
                          <ul className="list-disc list-inside space-y-0.5 text-xs text-sky-700">
                            <li>Gmail: Enable 2FA, then generate app password in Google Account settings</li>
                            <li>Outlook: Enable 2FA, then create app password in Microsoft account</li>
                            <li>Yahoo: Enable 2FA, then generate app password in Yahoo settings</li>
                          </ul>
                        </div>
                      </div>

                      {/* Action Buttons */}
                      <div className="flex space-x-3 pt-2">
                        <button
                          onClick={handleTestSmtp}
                          disabled={testingSmtp || !smtpForm.email || !smtpForm.password}
                          className="btn-secondary disabled:opacity-50"
                        >
                          {testingSmtp ? (
                            <span className="flex items-center space-x-2">
                              <div className="spinner w-4 h-4"></div>
                              <span>Testing...</span>
                            </span>
                          ) : (
                            <>
                              <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                              </svg>
                              Test Connection
                            </>
                          )}
                        </button>
                        <button
                          onClick={handleConnectSmtp}
                          disabled={saving || !smtpForm.email || !smtpForm.password}
                          className="btn-primary disabled:opacity-50"
                        >
                          {saving ? (
                            <span className="flex items-center space-x-2">
                              <div className="spinner w-4 h-4"></div>
                              <span>Connecting...</span>
                            </span>
                          ) : (
                            <>
                              <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                              </svg>
                              Connect Email
                            </>
                          )}
                        </button>
                      </div>
                    </>
                  )}

                  {settings?.smtp_connected && (
                    <>
                      {/* Manual Check Button */}
                      <div className="flex items-center justify-between p-4 bg-slate-50 rounded-xl">
                        <div>
                          <p className="text-sm font-medium text-slate-800">Check for new invoices</p>
                          <p className="text-xs text-slate-500">Manually scan your inbox now</p>
                        </div>
                        <button
                          onClick={handleCheckSmtp}
                          disabled={checkingSmtp || !settings.smtp_enabled}
                          className="btn-primary disabled:opacity-50"
                        >
                          {checkingSmtp ? (
                            <span className="flex items-center space-x-2">
                              <div className="spinner w-4 h-4"></div>
                              <span>Checking...</span>
                            </span>
                          ) : (
                            <>
                              <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                              </svg>
                              Check Now
                            </>
                          )}
                        </button>
                      </div>

                      <div className="border-t border-slate-100 pt-5">
                        <h4 className="text-sm font-semibold text-slate-800 mb-3">How it works</h4>
                        <ul className="space-y-4">
                          <li className="flex items-start space-x-3">
                            <div className="w-9 h-9 bg-gradient-to-br from-sky-400 to-blue-500 rounded-xl flex items-center justify-center flex-shrink-0 shadow-md">
                              <svg className="w-4.5 h-4.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                              </svg>
                            </div>
                            <div>
                              <p className="text-sm font-medium text-slate-800">Scan Inbox via IMAP</p>
                              <p className="text-xs text-slate-500">Connects to any email server using IMAP protocol</p>
                            </div>
                          </li>
                          <li className="flex items-start space-x-3">
                            <div className="w-9 h-9 bg-gradient-to-br from-amber-400 to-orange-500 rounded-xl flex items-center justify-center flex-shrink-0 shadow-md">
                              <svg className="w-4.5 h-4.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                              </svg>
                            </div>
                            <div>
                              <p className="text-sm font-medium text-slate-800">Extract PDF Attachments</p>
                              <p className="text-xs text-slate-500">Downloads PDF invoices from email attachments</p>
                            </div>
                          </li>
                          <li className="flex items-start space-x-3">
                            <div className="w-9 h-9 bg-gradient-to-br from-violet-500 to-purple-600 rounded-xl flex items-center justify-center flex-shrink-0 shadow-md">
                              <svg className="w-4.5 h-4.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                              </svg>
                            </div>
                            <div>
                              <p className="text-sm font-medium text-slate-800">AI Processing</p>
                              <p className="text-xs text-slate-500">Extracts data using Gemini Vision</p>
                            </div>
                          </li>
                          <li className="flex items-start space-x-3">
                            <div className="w-9 h-9 bg-gradient-to-br from-emerald-400 to-teal-500 rounded-xl flex items-center justify-center flex-shrink-0 shadow-md">
                              <svg className="w-4.5 h-4.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                              </svg>
                            </div>
                            <div>
                              <p className="text-sm font-medium text-slate-800">Ready to Review</p>
                              <p className="text-xs text-slate-500">Invoices appear in your dashboard</p>
                            </div>
                          </li>
                        </ul>
                      </div>

                      <div className="alert-info">
                        <div className="p-1.5 bg-sky-100 rounded-lg">
                          <svg className="w-4 h-4 text-sky-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                        </div>
                        <div className="text-sm">
                          <p className="font-semibold text-sky-900 mb-1">Privacy Note</p>
                          <p className="text-xs text-sky-700">
                            Your email credentials are stored securely. We only access emails with PDF attachments
                            and never store the email content itself. Only extracted invoice data is saved.
                          </p>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Preferences Tab */}
          {activeTab === 'preferences' && (
            <div className="max-w-2xl animate-fade-in">
              <div className="mb-6">
                <h3 className="text-lg font-bold text-slate-900">Preferences</h3>
                <p className="text-sm text-slate-500 mt-1">
                  Customize your Invoice AI experience
                </p>
              </div>

              <div className="card divide-y divide-slate-100">
                <div className="flex items-center justify-between p-5">
                  <div>
                    <h4 className="text-sm font-semibold text-slate-900">Auto-process uploads</h4>
                    <p className="text-xs text-slate-500 mt-0.5">Automatically process invoices after upload</p>
                  </div>
                  <button
                    onClick={() => handleUpdatePreference('auto_process')}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                      preferences.auto_process ? 'bg-violet-600' : 'bg-slate-200'
                    }`}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform shadow-sm ${
                        preferences.auto_process ? 'translate-x-6' : 'translate-x-1'
                      }`}
                    />
                  </button>
                </div>
                <div className="flex items-center justify-between p-5">
                  <div>
                    <h4 className="text-sm font-semibold text-slate-900">Email notifications</h4>
                    <p className="text-xs text-slate-500 mt-0.5">Get notified when processing completes</p>
                  </div>
                  <button
                    onClick={() => handleUpdatePreference('email_notifications')}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                      preferences.email_notifications ? 'bg-violet-600' : 'bg-slate-200'
                    }`}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform shadow-sm ${
                        preferences.email_notifications ? 'translate-x-6' : 'translate-x-1'
                      }`}
                    />
                  </button>
                </div>
                <div className="flex items-center justify-between p-5">
                  <div>
                    <h4 className="text-sm font-semibold text-slate-900">Auto-sync to ERP</h4>
                    <p className="text-xs text-slate-500 mt-0.5">Automatically sync processed invoices to connected ERPs</p>
                  </div>
                  <button
                    onClick={() => handleUpdatePreference('auto_sync_erp')}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                      preferences.auto_sync_erp ? 'bg-violet-600' : 'bg-slate-200'
                    }`}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform shadow-sm ${
                        preferences.auto_sync_erp ? 'translate-x-6' : 'translate-x-1'
                      }`}
                    />
                  </button>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>

      {/* Configuration Modal */}
      {showConfigModal && selectedIntegration && (
        <div className="modal-overlay" onClick={() => setShowConfigModal(false)}>
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-hidden animate-modal-enter" onClick={e => e.stopPropagation()}>
            {/* Modal Header */}
            <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center space-x-4">
                {getERPLogo(selectedIntegration.id, 'w-10 h-10')}
                <div>
                  <h3 className="text-lg font-bold text-slate-900">
                    Connect {selectedIntegration.name}
                  </h3>
                  <p className="text-xs text-slate-500">Enter your API credentials</p>
                </div>
              </div>
              <button onClick={() => setShowConfigModal(false)} className="btn-icon">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-5 overflow-y-auto max-h-[60vh]">
              <div>
                <label className="label">
                  API Key <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={configForm.apiKey}
                  onChange={(e) => setConfigForm({ ...configForm, apiKey: e.target.value })}
                  placeholder="Enter your API key"
                  className="input"
                />
              </div>

              <div>
                <label className="label">
                  API Secret <span className="text-red-500">*</span>
                </label>
                <input
                  type="password"
                  value={configForm.apiSecret}
                  onChange={(e) => setConfigForm({ ...configForm, apiSecret: e.target.value })}
                  placeholder="Enter your API secret"
                  className="input"
                />
              </div>

              <div>
                <label className="label">
                  Organization ID <span className="text-slate-400 font-normal">(Optional)</span>
                </label>
                <input
                  type="text"
                  value={configForm.orgId}
                  onChange={(e) => setConfigForm({ ...configForm, orgId: e.target.value })}
                  placeholder="Enter organization ID"
                  className="input"
                />
              </div>

              <label className="flex items-center space-x-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={configForm.autoSync}
                  onChange={(e) => setConfigForm({ ...configForm, autoSync: e.target.checked })}
                  className="w-5 h-5 text-violet-600 border-slate-300 rounded focus:ring-violet-500"
                />
                <span className="text-sm text-slate-700">Automatically sync new invoices</span>
              </label>

              <div className="alert-info">
                <div className="p-1.5 bg-sky-100 rounded-lg">
                  <svg className="w-4 h-4 text-sky-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div className="text-sm">
                  <p className="font-semibold text-sky-900 mb-1">How to get credentials:</p>
                  <ol className="list-decimal list-inside space-y-0.5 text-xs text-sky-700">
                    <li>Log in to your {selectedIntegration.name} account</li>
                    <li>Navigate to Settings → API / Integrations</li>
                    <li>Generate or copy your API credentials</li>
                  </ol>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
              <button
                onClick={handleTestConnection}
                disabled={!configForm.apiKey || !configForm.apiSecret || saving}
                className="btn-ghost disabled:opacity-50"
              >
                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Test Connection
              </button>
              <div className="flex space-x-3">
                <button onClick={() => setShowConfigModal(false)} className="btn-secondary">
                  Cancel
                </button>
                <button
                  onClick={handleSaveIntegration}
                  disabled={!configForm.apiKey || !configForm.apiSecret || saving}
                  className="btn-primary disabled:opacity-50"
                >
                  {saving ? (
                    <span className="flex items-center space-x-2">
                      <div className="spinner w-4 h-4"></div>
                      <span>Connecting...</span>
                    </span>
                  ) : (
                    <>
                      <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                      </svg>
                      Connect
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Alert Modal */}
      <AlertModal
        isOpen={alertModal.isOpen}
        onClose={closeAlert}
        title={alertModal.title}
        message={alertModal.message}
        type={alertModal.type}
      />
    </div>
  );
}
