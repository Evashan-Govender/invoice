'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { api } from '@/lib/api';
import AlertModal, { AlertType } from '@/components/AlertModal';

interface Invoice {
  id: number;
  filename: string;
  status: string;
  upload_date: string;
  error_message?: string;
  is_duplicate?: boolean;
  duplicate_of_id?: number;
  category?: string;
  detected_language?: string;
  confidence_score?: number;
  vendor_name?: string;
  total_amount?: number;
}

interface Stats {
  totalInvoices: number;
  completed: number;
  pending: number;
  processing: number;
  errors: number;
  duplicates: number;
  successRate: number;
  recentActivity: {
    today: number;
    thisWeek: number;
    thisMonth: number;
  };
  // AI Insights
  avgConfidence: number;
  totalAmount: number;
  topCategories: { name: string; count: number }[];
  languages: { name: string; count: number }[];
}

export default function DashboardPage() {
  const router = useRouter();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [processing, setProcessing] = useState<Set<number>>(new Set());
  const [error, setError] = useState('');
  const [dragActive, setDragActive] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [uploadedFiles, setUploadedFiles] = useState<File[]>([]);
  const [activeView, setActiveView] = useState<'dashboard' | 'upload' | 'invoices'>('dashboard');
  const [selectedInvoices, setSelectedInvoices] = useState<Set<number>>(new Set());
  const [bulkProcessing, setBulkProcessing] = useState(false);
  const [stats, setStats] = useState<Stats>({
    totalInvoices: 0,
    completed: 0,
    pending: 0,
    processing: 0,
    errors: 0,
    duplicates: 0,
    successRate: 0,
    recentActivity: { today: 0, thisWeek: 0, thisMonth: 0 },
    avgConfidence: 0,
    totalAmount: 0,
    topCategories: [],
    languages: [],
  });

  // Learning stats state
  const [learningStats, setLearningStats] = useState<{
    total_corrections: number;
    fields_corrected: Record<string, number>;
    vendor_count: number;
  } | null>(null);

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

  const calculateStats = (invoiceData: Invoice[]) => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
    const monthAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);

    const completed = invoiceData.filter((i) => i.status === 'completed').length;
    const pending = invoiceData.filter((i) => i.status === 'pending').length;
    const processing = invoiceData.filter((i) => i.status === 'processing').length;
    const errors = invoiceData.filter((i) => i.status === 'error').length;
    const duplicates = invoiceData.filter((i) => i.is_duplicate).length;
    
    const todayCount = invoiceData.filter(
      (i) => new Date(i.upload_date) >= today
    ).length;
    const thisWeekCount = invoiceData.filter(
      (i) => new Date(i.upload_date) >= weekAgo
    ).length;
    const thisMonthCount = invoiceData.filter(
      (i) => new Date(i.upload_date) >= monthAgo
    ).length;

    const successRate =
      invoiceData.length > 0
        ? Math.round((completed / invoiceData.length) * 100)
        : 0;

    // AI Insights calculations
    const confidenceScores = invoiceData
      .filter((i) => i.confidence_score != null)
      .map((i) => i.confidence_score as number);
    const avgConfidence = confidenceScores.length > 0
      ? Math.round((confidenceScores.reduce((a, b) => a + b, 0) / confidenceScores.length) * 100)
      : 0;

    const totalAmount = invoiceData
      .filter((i) => i.total_amount != null)
      .reduce((sum, i) => sum + (i.total_amount || 0), 0);

    // Category breakdown
    const categoryMap = new Map<string, number>();
    invoiceData.forEach((i) => {
      if (i.category) {
        categoryMap.set(i.category, (categoryMap.get(i.category) || 0) + 1);
      }
    });
    const topCategories = Array.from(categoryMap.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    // Language breakdown
    const languageMap = new Map<string, number>();
    invoiceData.forEach((i) => {
      if (i.detected_language) {
        languageMap.set(i.detected_language, (languageMap.get(i.detected_language) || 0) + 1);
      }
    });
    const languages = Array.from(languageMap.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count);

    return {
      totalInvoices: invoiceData.length,
      completed,
      pending,
      processing,
      errors,
      duplicates,
      successRate,
      recentActivity: {
        today: todayCount,
        thisWeek: thisWeekCount,
        thisMonth: thisMonthCount,
      },
      avgConfidence,
      totalAmount,
      topCategories,
      languages,
    };
  };

  const loadInvoices = useCallback(async () => {
    try {
      const data = await api.getInvoices();
      setInvoices(data);
      setStats(calculateStats(data));
    } catch (err) {
      console.error('Error loading invoices:', err);
    }
  }, []);

  useEffect(() => {
    const init = async () => {
      try {
        const userData = await api.getCurrentUser();
        setUser(userData);
        await loadInvoices();
        // Load learning stats
        try {
          const learningData = await api.getLearningStats();
          setLearningStats(learningData);
        } catch (e) {
          console.log('Could not load learning stats');
        }
      } catch (err) {
        router.push('/login');
      } finally {
        setLoading(false);
      }
    };
    init();
  }, [router, loadInvoices]);

  // Check URL params for view
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const view = params.get('view');
    if (view === 'invoices') {
      setActiveView('invoices');
    }
  }, []);

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    const files = Array.from(e.dataTransfer.files);
    handleFiles(files);
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const files = Array.from(e.target.files);
      handleFiles(files);
    }
  };

  // Supported file types for upload
  const SUPPORTED_EXTENSIONS = ['.pdf', '.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp', '.tiff'];
  
  const isValidFile = (filename: string) => {
    const ext = filename.toLowerCase().substring(filename.lastIndexOf('.'));
    return SUPPORTED_EXTENSIONS.includes(ext);
  };

  const isImageFile = (filename: string) => {
    const ext = filename.toLowerCase().substring(filename.lastIndexOf('.'));
    return ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp', '.tiff'].includes(ext);
  };

  const handleFiles = async (files: File[]) => {
    setError('');

    if (files.length > 5) {
      setError('Maximum 5 files allowed per upload');
      return;
    }

    const invalidFiles = files.filter((file) => !isValidFile(file.name));
    if (invalidFiles.length > 0) {
      setError('Unsupported file format. Allowed: PDF, JPG, PNG, GIF, WEBP, BMP, TIFF');
      return;
    }

    setUploadedFiles(files);
  };

  const handleUploadConfirm = async () => {
    if (uploadedFiles.length === 0) return;

    setUploading(true);
    try {
      await api.uploadInvoices(uploadedFiles);
      await loadInvoices();
      setUploadedFiles([]);
      setActiveView('invoices');
    } catch (err: any) {
      setError(
        err.response?.data?.detail || 'Error uploading files. Please try again.'
      );
    } finally {
      setUploading(false);
    }
  };

  const handleRemoveFile = (index: number) => {
    setUploadedFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const handleClearFiles = () => {
    setUploadedFiles([]);
    setError('');
  };

  const handleProcess = async (invoiceId: number) => {
    setProcessing((prev) => new Set(prev).add(invoiceId));
    try {
      await api.processInvoice(invoiceId);
      await loadInvoices();
    } catch (err: any) {
      showAlert(
        err.response?.data?.detail ||
          'Error processing invoice. Please try again.',
        'error'
      );
    } finally {
      setProcessing((prev) => {
        const newSet = new Set(prev);
        newSet.delete(invoiceId);
        return newSet;
      });
    }
  };

  const handleBulkProcess = async () => {
    if (selectedInvoices.size === 0) {
      showAlert('Please select at least one invoice to process', 'warning');
      return;
    }

    setBulkProcessing(true);
    const invoiceIds = Array.from(selectedInvoices);
    const pendingInvoices = invoices.filter(inv => inv.status === 'pending' && invoiceIds.includes(inv.id));
    
    try {
      // Process all selected pending invoices
      for (const invoice of pendingInvoices) {
        setProcessing((prev) => new Set(prev).add(invoice.id));
        try {
          await api.processInvoice(invoice.id);
        } catch (err: any) {
          console.error(`Error processing invoice ${invoice.id}:`, err);
        } finally {
          setProcessing((prev) => {
            const newSet = new Set(prev);
            newSet.delete(invoice.id);
            return newSet;
          });
        }
      }
      await loadInvoices();
      setSelectedInvoices(new Set());
      showAlert(`Successfully processed ${pendingInvoices.length} invoice(s)`, 'success');
    } catch (err: any) {
      showAlert('Error processing invoices. Please try again.', 'error');
    } finally {
      setBulkProcessing(false);
    }
  };

  const handleSelectInvoice = (invoiceId: number) => {
    setSelectedInvoices((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(invoiceId)) {
        newSet.delete(invoiceId);
      } else {
        newSet.add(invoiceId);
      }
      return newSet;
    });
  };

  const handleSelectAll = () => {
    const pendingInvoices = invoices.filter(inv => inv.status === 'pending');
    if (selectedInvoices.size === pendingInvoices.length) {
      setSelectedInvoices(new Set());
    } else {
      setSelectedInvoices(new Set(pendingInvoices.map(inv => inv.id)));
    }
  };

  const handleLogout = () => {
    api.logout();
  };

  const handleDelete = async (invoiceId: number) => {
    if (!confirm('Are you sure you want to delete this invoice? This action cannot be undone.')) {
      return;
    }
    
    try {
      await api.deleteInvoice(invoiceId);
      await loadInvoices();
    } catch (err: any) {
      showAlert(err.response?.data?.detail || 'Error deleting invoice', 'error');
    }
  };

  const getStatusBadge = (status: string) => {
    const statusConfig = {
      pending: { class: 'badge-warning', label: 'Pending' },
      processing: { class: 'badge-info', label: 'Processing' },
      completed: { class: 'badge-success', label: 'Completed' },
      error: { class: 'badge-danger', label: 'Error' },
    };
    const config = statusConfig[status as keyof typeof statusConfig] || { class: 'badge-neutral', label: status };
    return (
      <span className={config.class}>
        {config.label}
      </span>
    );
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <div className="spinner w-12 h-12 border-4 border-violet-600 mx-auto"></div>
          <p className="mt-4 text-slate-600 font-medium">Loading dashboard...</p>
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
            <div className="w-11 h-11 bg-gradient-to-br from-violet-600 to-indigo-600 rounded-xl flex items-center justify-center shadow-lg shadow-violet-500/30 p-2">
              <Image 
                src="/AFA-Ranged-Logo-White.png" 
                alt="AFA ZeroTouch AP" 
                width={28} 
                height={28}
                className="object-contain"
              />
            </div>
            <div>
              <h1 className="text-xl font-bold gradient-text">AFA ZeroTouch AP™</h1>
              <p className="text-xs text-slate-400">Powered by Gemini</p>
            </div>
          </div>
        </div>

        <nav className="sidebar-nav">
          <button
            onClick={() => setActiveView('dashboard')}
            className={activeView === 'dashboard' ? 'sidebar-link-active' : 'sidebar-link'}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
            </svg>
            <span>Dashboard</span>
          </button>

          <button
            onClick={() => setActiveView('upload')}
            className={activeView === 'upload' ? 'sidebar-link-active' : 'sidebar-link'}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
            </svg>
            <span>Upload Invoice</span>
          </button>

          <button
            onClick={() => setActiveView('invoices')}
            className={activeView === 'invoices' ? 'sidebar-link-active' : 'sidebar-link'}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <span>Processed Invoices</span>
            {stats.totalInvoices > 0 && (
              <span className="ml-auto bg-violet-600 text-white text-xs font-bold px-2.5 py-1 rounded-full">
                {stats.totalInvoices}
              </span>
            )}
          </button>

          <div className="pt-3 mt-3 border-t border-slate-100">
            <button
              onClick={() => router.push('/settings')}
              className="sidebar-link"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              <span>Settings</span>
            </button>
          </div>
        </nav>

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
            onClick={handleLogout}
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
              <h2 className="text-2xl font-bold text-slate-900">
                {activeView === 'dashboard' && 'Dashboard'}
                {activeView === 'upload' && 'Upload Invoices'}
                {activeView === 'invoices' && 'Processed Invoices'}
              </h2>
              <p className="text-sm text-slate-500 mt-1">
                {activeView === 'dashboard' && 'Overview of your invoice processing'}
                {activeView === 'upload' && 'Upload and process new invoices'}
                {activeView === 'invoices' && 'View and manage processed invoices'}
              </p>
            </div>
            {activeView === 'dashboard' && stats.totalInvoices > 0 && (
              <div className="flex items-center space-x-2 px-4 py-2 bg-emerald-50 border border-emerald-200 rounded-full">
                <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></div>
                <span className="text-sm font-medium text-emerald-700">
                  {stats.successRate}% Success Rate
                </span>
              </div>
            )}
          </div>
        </header>

        <main className="flex-1 overflow-y-auto px-8 py-6">
          {/* Dashboard View */}
          {activeView === 'dashboard' && (
            <div className="animate-fade-in">
              {/* Stats Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                {/* Total Invoices */}
                <div className="card p-6 group hover:shadow-xl transition-all duration-300">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-slate-500">Total Invoices</p>
                      <p className="text-3xl font-bold text-slate-900 mt-2">
                        {stats.totalInvoices}
                      </p>
                    </div>
                    <div className="p-3 bg-gradient-to-br from-blue-100 to-indigo-100 rounded-xl group-hover:scale-110 transition-transform">
                      <svg className="w-8 h-8 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                    </div>
                  </div>
                  <div className="mt-4 flex items-center text-sm">
                    <span className="text-emerald-600 font-medium">+{stats.recentActivity.today}</span>
                    <span className="text-slate-400 ml-2">uploaded today</span>
                  </div>
                </div>

                {/* Completed */}
                <div className="card p-6 group hover:shadow-xl transition-all duration-300">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-slate-500">Completed</p>
                      <p className="text-3xl font-bold text-emerald-600 mt-2">
                        {stats.completed}
                      </p>
                    </div>
                    <div className="p-3 bg-gradient-to-br from-emerald-100 to-teal-100 rounded-xl group-hover:scale-110 transition-transform">
                      <svg className="w-8 h-8 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                  </div>
                  <div className="mt-4">
                    <div className="progress-bar">
                      <div 
                        className="progress-bar-fill bg-gradient-to-r from-emerald-500 to-teal-500"
                        style={{ width: `${stats.totalInvoices > 0 ? (stats.completed / stats.totalInvoices) * 100 : 0}%` }}
                      ></div>
                    </div>
                  </div>
                </div>

                {/* Pending */}
                <div className="card p-6 group hover:shadow-xl transition-all duration-300">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-slate-500">Pending</p>
                      <p className="text-3xl font-bold text-amber-600 mt-2">
                        {stats.pending}
                      </p>
                    </div>
                    <div className="p-3 bg-gradient-to-br from-amber-100 to-orange-100 rounded-xl group-hover:scale-110 transition-transform">
                      <svg className="w-8 h-8 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                  </div>
                  <p className="mt-4 text-sm text-slate-400">Awaiting processing</p>
                </div>

                {/* Errors */}
                <div className="card p-6 group hover:shadow-xl transition-all duration-300">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-slate-500">Errors</p>
                      <p className="text-3xl font-bold text-red-600 mt-2">
                        {stats.errors}
                      </p>
                    </div>
                    <div className="p-3 bg-gradient-to-br from-red-100 to-rose-100 rounded-xl group-hover:scale-110 transition-transform">
                      <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                  </div>
                  <p className="mt-4 text-sm text-slate-400">Requires attention</p>
                </div>

                {/* Duplicates */}
                {stats.duplicates > 0 && (
                  <div className="card p-6 group hover:shadow-xl transition-all duration-300 border-l-4 border-orange-400">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-slate-500">Duplicates</p>
                        <p className="text-3xl font-bold text-orange-600 mt-2">
                          {stats.duplicates}
                        </p>
                      </div>
                      <div className="p-3 bg-gradient-to-br from-orange-100 to-amber-100 rounded-xl group-hover:scale-110 transition-transform">
                        <svg className="w-8 h-8 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                        </svg>
                      </div>
                    </div>
                    <p className="mt-4 text-sm text-slate-400">Potential duplicate invoices</p>
                  </div>
                )}
              </div>

              {/* Charts Row */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Recent Activity */}
                <div className="card p-6">
                  <h3 className="text-lg font-bold text-slate-900 mb-6">Recent Activity</h3>
                  <div className="space-y-5">
                    {[
                      { label: 'Today', value: stats.recentActivity.today, color: 'bg-violet-500' },
                      { label: 'This Week', value: stats.recentActivity.thisWeek, color: 'bg-indigo-500' },
                      { label: 'This Month', value: stats.recentActivity.thisMonth, color: 'bg-purple-500' },
                    ].map((item, i) => (
                      <div key={i} className="flex items-center justify-between">
                        <div className="flex items-center space-x-3">
                          <div className={`w-3 h-3 rounded-full ${item.color}`}></div>
                          <span className="text-sm text-slate-600">{item.label}</span>
                        </div>
                        <span className="text-lg font-bold text-slate-900">{item.value}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Processing Status */}
                <div className="card p-6">
                  <h3 className="text-lg font-bold text-slate-900 mb-6">Processing Status</h3>
                  <div className="space-y-4">
                    {[
                      { label: 'Completed', value: stats.completed, total: stats.totalInvoices, color: 'from-emerald-500 to-teal-500', textColor: 'text-emerald-600' },
                      { label: 'Pending', value: stats.pending, total: stats.totalInvoices, color: 'from-amber-500 to-orange-500', textColor: 'text-amber-600' },
                      { label: 'Errors', value: stats.errors, total: stats.totalInvoices, color: 'from-red-500 to-rose-500', textColor: 'text-red-600' },
                    ].map((item, i) => (
                      <div key={i}>
                        <div className="flex justify-between text-sm mb-2">
                          <span className="text-slate-600 font-medium">{item.label}</span>
                          <span className={`font-bold ${item.textColor}`}>{item.value}/{item.total}</span>
                        </div>
                        <div className="progress-bar">
                          <div
                            className={`progress-bar-fill bg-gradient-to-r ${item.color}`}
                            style={{ width: `${item.total > 0 ? (item.value / item.total) * 100 : 0}%` }}
                          ></div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Success Rate */}
                <div className="stat-card-gradient">
                  <h3 className="text-lg font-bold mb-6">Success Rate</h3>
                  <div className="flex items-center justify-center">
                    <div className="relative">
                      <svg className="w-36 h-36 transform -rotate-90">
                        <circle
                          cx="72"
                          cy="72"
                          r="60"
                          stroke="rgba(255,255,255,0.2)"
                          strokeWidth="10"
                          fill="none"
                        />
                        <circle
                          cx="72"
                          cy="72"
                          r="60"
                          stroke="white"
                          strokeWidth="10"
                          fill="none"
                          strokeDasharray={`${2 * Math.PI * 60}`}
                          strokeDashoffset={`${2 * Math.PI * 60 * (1 - stats.successRate / 100)}`}
                          strokeLinecap="round"
                          className="transition-all duration-1000 ease-out"
                        />
                      </svg>
                      <div className="absolute inset-0 flex items-center justify-center">
                        <span className="text-4xl font-bold">{stats.successRate}%</span>
                      </div>
                    </div>
                  </div>
                  <p className="text-center text-sm mt-6 text-violet-100">
                    {stats.completed} of {stats.totalInvoices} processed successfully
                  </p>
                </div>
              </div>

              {/* AI Insights Section */}
              {stats.completed > 0 && (
                <div className="mt-8">
                  <h3 className="text-lg font-bold text-slate-900 mb-4 flex items-center space-x-2">
                    <svg className="w-5 h-5 text-violet-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                    </svg>
                    <span>AI Insights</span>
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                    {/* Average Confidence */}
                    <div className="card p-6">
                      <div className="flex items-center justify-between mb-4">
                        <p className="text-sm font-medium text-slate-500">AI Confidence</p>
                        <div className={`w-3 h-3 rounded-full ${
                          stats.avgConfidence >= 80 ? 'bg-emerald-500' : 
                          stats.avgConfidence >= 60 ? 'bg-amber-500' : 'bg-red-500'
                        }`}></div>
                      </div>
                      <p className={`text-3xl font-bold ${
                        stats.avgConfidence >= 80 ? 'text-emerald-600' : 
                        stats.avgConfidence >= 60 ? 'text-amber-600' : 'text-red-600'
                      }`}>
                        {stats.avgConfidence}%
                      </p>
                      <p className="text-xs text-slate-400 mt-2">Average extraction confidence</p>
                    </div>

                    {/* Total Amount Processed */}
                    <div className="card p-6">
                      <p className="text-sm font-medium text-slate-500 mb-4">Total Amount</p>
                      <p className="text-3xl font-bold text-slate-900">
                        ${stats.totalAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </p>
                      <p className="text-xs text-slate-400 mt-2">Total invoiced amount</p>
                    </div>

                    {/* Top Categories */}
                    <div className="card p-6">
                      <p className="text-sm font-medium text-slate-500 mb-3">Top Categories</p>
                      {stats.topCategories.length > 0 ? (
                        <div className="space-y-2">
                          {stats.topCategories.slice(0, 3).map((cat, i) => (
                            <div key={i} className="flex items-center justify-between">
                              <span className="text-sm text-slate-700 truncate">{cat.name}</span>
                              <span className="text-xs font-semibold text-violet-600 bg-violet-100 px-2 py-0.5 rounded-full">{cat.count}</span>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-sm text-slate-400">No categories yet</p>
                      )}
                    </div>

                    {/* Languages Detected */}
                    <div className="card p-6">
                      <p className="text-sm font-medium text-slate-500 mb-3">Languages Detected</p>
                      {stats.languages.length > 0 ? (
                        <div className="flex flex-wrap gap-2">
                          {stats.languages.map((lang, i) => (
                            <span key={i} className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-sky-100 text-sky-700">
                              {lang.name} ({lang.count})
                            </span>
                          ))}
                        </div>
                      ) : (
                        <p className="text-sm text-slate-400">No languages detected</p>
                      )}
                    </div>
                  </div>

                  {/* Learning Stats Section */}
                  {learningStats && (learningStats.total_corrections > 0 || learningStats.vendor_count > 0) && (
                    <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* Corrections Made */}
                      <div className="card p-5 border-l-4 border-indigo-500">
                        <div className="flex items-center space-x-3">
                          <div className="p-2 bg-indigo-100 rounded-lg">
                            <svg className="w-5 h-5 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                            </svg>
                          </div>
                          <div>
                            <p className="text-2xl font-bold text-slate-900">{learningStats.total_corrections}</p>
                            <p className="text-xs text-slate-500">Corrections made (AI learning)</p>
                          </div>
                        </div>
                        {learningStats.fields_corrected && Object.keys(learningStats.fields_corrected).length > 0 && (
                          <div className="mt-3 flex flex-wrap gap-1">
                            {Object.entries(learningStats.fields_corrected).slice(0, 4).map(([field, count]) => (
                              <span key={field} className="text-xs px-2 py-0.5 bg-indigo-50 text-indigo-600 rounded">
                                {field}: {count}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Vendors Recognized */}
                      <div className="card p-5 border-l-4 border-teal-500">
                        <div className="flex items-center space-x-3">
                          <div className="p-2 bg-teal-100 rounded-lg">
                            <svg className="w-5 h-5 text-teal-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                            </svg>
                          </div>
                          <div>
                            <p className="text-2xl font-bold text-slate-900">{learningStats.vendor_count}</p>
                            <p className="text-xs text-slate-500">Vendors in database</p>
                          </div>
                        </div>
                        <p className="mt-2 text-xs text-slate-400">
                          Vendors are auto-recognized for faster processing
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Upload View */}
          {activeView === 'upload' && (
            <div className="max-w-4xl mx-auto animate-fade-in">
              {error && (
                <div className="alert-error mb-6 animate-fade-in">
                  <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span>{error}</span>
                </div>
              )}

              {/* Drop Zone */}
              <div
                onDragEnter={handleDrag}
                onDragLeave={handleDrag}
                onDragOver={handleDrag}
                onDrop={handleDrop}
                className={`border-2 border-dashed rounded-2xl p-16 text-center transition-all duration-300 mb-8 ${
                  dragActive
                    ? 'border-violet-500 bg-violet-50 scale-[1.02]'
                    : 'border-slate-300 hover:border-violet-400 bg-white hover:bg-violet-50/50'
                }`}
              >
                <div className={`w-20 h-20 mx-auto mb-6 rounded-2xl flex items-center justify-center transition-colors ${
                  dragActive ? 'bg-violet-100' : 'bg-slate-100'
                }`}>
                  <svg
                    className={`w-10 h-10 transition-colors ${dragActive ? 'text-violet-600' : 'text-slate-400'}`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                  </svg>
                </div>
                <label htmlFor="file-upload" className="cursor-pointer">
                  <span className="text-violet-600 hover:text-violet-700 font-semibold text-2xl">
                    Click to upload
                  </span>
                  <p className="text-slate-500 mt-3 text-lg">or drag and drop your files here</p>
                </label>
                <input
                  id="file-upload"
                  type="file"
                  multiple
                  accept=".pdf,.jpg,.jpeg,.png,.gif,.webp,.bmp,.tiff"
                  className="hidden"
                  onChange={handleFileInput}
                  disabled={uploading}
                />
                <p className="text-sm text-slate-400 mt-6">
                  PDF or Image files • Maximum 5 files per upload
                </p>
                <div className="flex flex-wrap justify-center gap-2 mt-3">
                  <span className="px-2 py-1 bg-red-100 text-red-700 text-xs rounded-md font-medium">PDF</span>
                  <span className="px-2 py-1 bg-blue-100 text-blue-700 text-xs rounded-md font-medium">JPG</span>
                  <span className="px-2 py-1 bg-green-100 text-green-700 text-xs rounded-md font-medium">PNG</span>
                  <span className="px-2 py-1 bg-purple-100 text-purple-700 text-xs rounded-md font-medium">GIF</span>
                  <span className="px-2 py-1 bg-orange-100 text-orange-700 text-xs rounded-md font-medium">WEBP</span>
                </div>
              </div>

              {/* Bulk Upload from Folder */}
              <div className="card p-6 mb-8">
                <div className="flex items-center space-x-3 mb-4">
                  <div className="w-10 h-10 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl flex items-center justify-center">
                    <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                    </svg>
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-slate-900">Bulk Upload from Folder</h3>
                    <p className="text-sm text-slate-500">Upload up to 5 invoices from a folder</p>
                  </div>
                </div>
                <input
                  id="folder-upload"
                  type="file"
                  multiple
                  {...({ webkitdirectory: '', directory: '' } as any)}
                  accept=".pdf,.jpg,.jpeg,.png,.gif,.webp,.bmp,.tiff"
                  className="hidden"
                  onChange={(e) => {
                    if (e.target.files) {
                      const files = Array.from(e.target.files).slice(0, 5);
                      handleFiles(files);
                    }
                  }}
                  disabled={uploading}
                />
                <label htmlFor="folder-upload" className="cursor-pointer">
                  <div className="border-2 border-dashed border-indigo-300 rounded-xl p-8 text-center hover:bg-indigo-50 transition-colors">
                    <svg className="w-12 h-12 text-indigo-500 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                    </svg>
                    <p className="text-indigo-600 font-semibold text-lg mb-2">Select Folder</p>
                    <p className="text-sm text-slate-500">Choose a folder containing invoice files (max 5 files)</p>
                  </div>
                </label>
                {uploadedFiles.length > 0 && (
                  <div className="mt-4">
                    <button
                      onClick={() => setActiveView('invoices')}
                      className="btn-secondary w-full"
                    >
                      <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                      View Uploaded Invoices
                    </button>
                  </div>
                )}
              </div>

              {/* File List */}
              {uploadedFiles.length > 0 && (
                <div className="card p-6 animate-slide-up">
                  <div className="flex justify-between items-center mb-6">
                    <h3 className="text-lg font-bold text-slate-900">
                      Selected Files ({uploadedFiles.length})
                    </h3>
                    <button
                      onClick={handleClearFiles}
                      className="btn-ghost text-slate-500"
                    >
                      Clear All
                    </button>
                  </div>
                  <div className="space-y-3 mb-6">
                    {uploadedFiles.map((file, index) => (
                      <div
                        key={index}
                        className="flex items-center justify-between p-4 bg-slate-50 rounded-xl border border-slate-200 hover:border-violet-200 transition-colors"
                      >
                        <div className="flex items-center space-x-4 flex-1 min-w-0">
                          <div className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 ${
                            isImageFile(file.name) 
                              ? 'bg-gradient-to-br from-blue-500 to-indigo-600' 
                              : 'bg-gradient-to-br from-red-500 to-rose-600'
                          }`}>
                            {isImageFile(file.name) ? (
                              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                              </svg>
                            ) : (
                              <svg className="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4zm2 6a1 1 0 011-1h6a1 1 0 110 2H7a1 1 0 01-1-1zm1 3a1 1 0 100 2h6a1 1 0 100-2H7z" clipRule="evenodd" />
                              </svg>
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-slate-900 truncate">
                              {file.name}
                            </p>
                            <p className="text-xs text-slate-500">
                              {(file.size / 1024 / 1024).toFixed(2)} MB • {isImageFile(file.name) ? 'Image' : 'PDF'}
                            </p>
                          </div>
                        </div>
                        <button
                          onClick={() => handleRemoveFile(index)}
                          className="btn-icon text-red-500 hover:bg-red-50 hover:text-red-600"
                          disabled={uploading}
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </div>
                    ))}
                  </div>

                  {!uploading ? (
                    <button
                      onClick={handleUploadConfirm}
                      className="w-full btn-primary py-4 text-base"
                    >
                      <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                      </svg>
                      Upload & Process {uploadedFiles.length} {uploadedFiles.length === 1 ? 'Invoice' : 'Invoices'}
                    </button>
                  ) : (
                    <div className="text-center py-8">
                      <div className="spinner w-12 h-12 border-4 border-violet-600 mx-auto mb-4"></div>
                      <p className="text-slate-700 text-lg font-medium">Uploading your invoices...</p>
                      <p className="text-sm text-slate-500 mt-2">Please wait, this may take a moment</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Invoices List View */}
          {activeView === 'invoices' && (
            <div className="animate-fade-in">
              {invoices.length === 0 ? (
                <div className="card p-16 text-center">
                  <div className="w-20 h-20 bg-slate-100 rounded-2xl flex items-center justify-center mx-auto mb-6">
                    <svg className="w-10 h-10 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                  </div>
                  <h3 className="text-xl font-bold text-slate-900 mb-2">No invoices yet</h3>
                  <p className="text-slate-500 mb-8">Upload your first invoice to get started</p>
                  <button
                    onClick={() => setActiveView('upload')}
                    className="btn-primary px-8 py-3"
                  >
                    <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                    </svg>
                    Upload Invoice
                  </button>
                </div>
              ) : (
                <>
                  {/* Bulk Actions Bar */}
                  {selectedInvoices.size > 0 && (
                    <div className="mb-4 p-4 bg-violet-50 border border-violet-200 rounded-xl flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <span className="text-sm font-semibold text-violet-900">
                          {selectedInvoices.size} invoice{selectedInvoices.size !== 1 ? 's' : ''} selected
                        </span>
                        <button
                          onClick={() => setSelectedInvoices(new Set())}
                          className="text-sm text-violet-600 hover:text-violet-700 font-medium"
                        >
                          Clear selection
                        </button>
                      </div>
                      <button
                        onClick={handleBulkProcess}
                        disabled={bulkProcessing}
                        className="btn-primary"
                      >
                        {bulkProcessing ? (
                          <span className="flex items-center space-x-2">
                            <div className="spinner w-4 h-4"></div>
                            <span>Processing...</span>
                          </span>
                        ) : (
                          <>
                            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                            </svg>
                            Process Selected
                          </>
                        )}
                      </button>
                    </div>
                  )}

                  <div className="table-container">
                    <table className="table">
                      <thead className="table-header">
                        <tr>
                          <th className="table-header-cell w-12">
                            <input
                              type="checkbox"
                              checked={invoices.filter(inv => inv.status === 'pending').length > 0 && 
                                      selectedInvoices.size === invoices.filter(inv => inv.status === 'pending').length}
                              onChange={handleSelectAll}
                              className="w-4 h-4 text-violet-600 border-slate-300 rounded focus:ring-violet-500"
                            />
                          </th>
                          <th className="table-header-cell">Invoice</th>
                          <th className="table-header-cell">Vendor / Category</th>
                          <th className="table-header-cell">Amount</th>
                          <th className="table-header-cell">Status</th>
                          <th className="table-header-cell">Confidence</th>
                          <th className="table-header-cell">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="table-body">
                        {invoices.map((invoice) => (
                          <tr key={invoice.id} className="table-row">
                            <td className="table-cell">
                              {invoice.status === 'pending' && (
                                <input
                                  type="checkbox"
                                  checked={selectedInvoices.has(invoice.id)}
                                  onChange={() => handleSelectInvoice(invoice.id)}
                                  className="w-4 h-4 text-violet-600 border-slate-300 rounded focus:ring-violet-500"
                                />
                              )}
                            </td>
                            <td className="table-cell">
                              <div className="flex items-center space-x-3">
                              <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${
                                isImageFile(invoice.filename)
                                  ? 'bg-gradient-to-br from-blue-500 to-indigo-600'
                                  : 'bg-gradient-to-br from-red-500 to-rose-600'
                              }`}>
                                {isImageFile(invoice.filename) ? (
                                  <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                  </svg>
                                ) : (
                                  <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 20 20">
                                    <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" clipRule="evenodd" />
                                  </svg>
                                )}
                              </div>
                              <div className="min-w-0">
                                <p className="font-semibold text-slate-900 truncate max-w-[180px]">{invoice.filename}</p>
                                <p className="text-xs text-slate-400">{new Date(invoice.upload_date).toLocaleDateString()}</p>
                              </div>
                            </div>
                          </td>
                          <td className="table-cell">
                            <div className="min-w-0">
                              {invoice.vendor_name ? (
                                <p className="font-medium text-slate-900 truncate max-w-[150px]">{invoice.vendor_name}</p>
                              ) : (
                                <p className="text-slate-400 text-sm">—</p>
                              )}
                              {invoice.category && (
                                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-violet-100 text-violet-700 mt-1">
                                  {invoice.category}
                                </span>
                              )}
                              {invoice.detected_language && invoice.detected_language !== 'English' && (
                                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-sky-100 text-sky-700 mt-1 ml-1">
                                  {invoice.detected_language}
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="table-cell">
                            {invoice.total_amount != null ? (
                              <span className="font-semibold text-slate-900">
                                {invoice.total_amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                              </span>
                            ) : (
                              <span className="text-slate-400">—</span>
                            )}
                          </td>
                          <td className="table-cell">
                            <div className="flex items-center space-x-2">
                              {getStatusBadge(invoice.status)}
                              {invoice.is_duplicate && (
                                <span 
                                  className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-orange-100 text-orange-700 border border-orange-200"
                                  title={invoice.duplicate_of_id ? `Duplicate of invoice #${invoice.duplicate_of_id}` : 'Potential duplicate detected'}
                                >
                                  <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                                  </svg>
                                  Dup
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="table-cell">
                            {invoice.confidence_score != null ? (
                              <div className="flex items-center space-x-2">
                                <div className="w-16 h-2 bg-slate-200 rounded-full overflow-hidden">
                                  <div 
                                    className={`h-full rounded-full ${
                                      invoice.confidence_score >= 0.8 ? 'bg-emerald-500' :
                                      invoice.confidence_score >= 0.6 ? 'bg-amber-500' : 'bg-red-500'
                                    }`}
                                    style={{ width: `${invoice.confidence_score * 100}%` }}
                                  ></div>
                                </div>
                                <span className={`text-xs font-semibold ${
                                  invoice.confidence_score >= 0.8 ? 'text-emerald-600' :
                                  invoice.confidence_score >= 0.6 ? 'text-amber-600' : 'text-red-600'
                                }`}>
                                  {Math.round(invoice.confidence_score * 100)}%
                                </span>
                              </div>
                            ) : (
                              <span className="text-slate-400 text-sm">—</span>
                            )}
                          </td>
                          <td className="table-cell">
                            <div className="flex items-center space-x-2">
                              {invoice.status === 'pending' && (
                                <button
                                  onClick={() => handleProcess(invoice.id)}
                                  disabled={processing.has(invoice.id)}
                                  className="btn-primary py-1.5 px-4 text-xs"
                                >
                                  {processing.has(invoice.id) ? (
                                    <span className="flex items-center space-x-1">
                                      <div className="spinner w-3 h-3"></div>
                                      <span>Processing...</span>
                                    </span>
                                  ) : 'Process'}
                                </button>
                              )}
                              {invoice.status === 'completed' && (
                                <button
                                  onClick={() => {
                                    // Store that we're coming from invoice list
                                    sessionStorage.setItem('invoiceListSource', 'true');
                                    router.push(`/invoices/${invoice.id}`);
                                  }}
                                  className="btn-success py-1.5 px-4 text-xs"
                                >
                                  View & Edit
                                </button>
                              )}
                              {invoice.status === 'error' && (
                                <>
                                  <button
                                    onClick={() => handleProcess(invoice.id)}
                                    disabled={processing.has(invoice.id)}
                                    className="inline-flex items-center px-4 py-1.5 text-xs font-semibold text-white bg-gradient-to-r from-amber-500 to-orange-500 rounded-lg shadow hover:from-amber-600 hover:to-orange-600"
                                  >
                                    Retry
                                  </button>
                                  {invoice.error_message && (
                                    <span
                                      className="text-red-500 cursor-help"
                                      title={invoice.error_message}
                                    >
                                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                      </svg>
                                    </span>
                                  )}
                                </>
                              )}
                              {/* Delete Button */}
                              <button
                                onClick={() => handleDelete(invoice.id)}
                                className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                title="Delete invoice"
                              >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                </svg>
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                </>
              )}
            </div>
          )}
        </main>
      </div>

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
