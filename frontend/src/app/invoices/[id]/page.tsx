'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import PDFViewerWithHighlight from '@/components/PDFViewerWithHighlight';
import ImageViewer from '@/components/ImageViewer';
import InvoiceForm from '@/components/InvoiceForm';
import LineItemsTable from '@/components/LineItemsTable';
import ERPSyncButton from '@/components/ERPSyncButton';
import { getCoordinatesForField } from '@/lib/fieldCoordinates';
import { availableFormats, transformInvoice, downloadTransformedInvoice } from '@/lib/invoiceTransform';

interface PageProps {
  params: {
    id: string;
  };
}

export default function InvoiceDetailPage({ params }: PageProps) {
  const router = useRouter();
  const invoiceId = parseInt(params.id);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [invoice, setInvoice] = useState<any>(null);
  const [invoiceMetadata, setInvoiceMetadata] = useState<{
    confidence_scores?: Record<string, number>;
    category?: string;
    detected_language?: string;
    is_duplicate?: boolean;
    duplicate_of_id?: number;
  }>({});
  const [extractedData, setExtractedData] = useState<any>(null);
  const [editedData, setEditedData] = useState<any>(null);
  const [error, setError] = useState('');
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [copySuccess, setCopySuccess] = useState(false);
  const [showJSON, setShowJSON] = useState(false);
  const [showTransform, setShowTransform] = useState(false);
  const [selectedFormat, setSelectedFormat] = useState('json');
  const [transformedData, setTransformedData] = useState('');
  const [activeSection, setActiveSection] = useState<string>('');
  const [highlightRegion, setHighlightRegion] = useState<any>(null);
  
  // Translation state
  const [supportedLanguages, setSupportedLanguages] = useState<string[]>([]);
  const [selectedLanguage, setSelectedLanguage] = useState<string>('');
  const [translating, setTranslating] = useState(false);
  const [translatedInvoiceData, setTranslatedInvoiceData] = useState<any>(null);

  const handleFieldFocus = (fieldName: string) => {
    setActiveSection(fieldName);
    const coordinates = getCoordinatesForField(fieldName);
    setHighlightRegion(coordinates);
  };

  useEffect(() => {
    const loadInvoice = async () => {
      try {
        const data = await api.getInvoice(invoiceId);
        setInvoice(data.invoice);
        
        if (data.data) {
          const initialData = data.data.amended_json || data.data.extracted_json;
          setExtractedData(data.data.extracted_json);
          setEditedData(initialData);
          // Set AI metadata
          setInvoiceMetadata({
            confidence_scores: data.data.confidence_scores,
            category: data.data.category,
            detected_language: data.data.detected_language,
            is_duplicate: data.data.is_duplicate,
            duplicate_of_id: data.data.duplicate_of_id,
          });
        }
        
        // Load supported languages
        try {
          const langData = await api.getSupportedLanguages();
          setSupportedLanguages(langData.languages || []);
        } catch (e) {
          console.log('Could not load languages');
        }
      } catch (err: any) {
        setError(
          err.response?.data?.detail ||
            'Error loading invoice. Please try again.'
        );
      } finally {
        setLoading(false);
      }
    };

    loadInvoice();
  }, [invoiceId]);

  const handleHeaderChange = (newData: any) => {
    setEditedData({ ...editedData, ...newData });
    setSaveSuccess(false);
  };

  const handleLineItemsChange = (items: any[]) => {
    setEditedData({ ...editedData, line_items: items });
    setSaveSuccess(false);
  };

  const handleSave = async () => {
    setSaving(true);
    setSaveSuccess(false);
    setError('');

    try {
      await api.updateInvoiceData(invoiceId, editedData);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err: any) {
      setError(
        err.response?.data?.detail || 'Error saving data. Please try again.'
      );
    } finally {
      setSaving(false);
    }
  };

  const handleCopyJSON = async () => {
    try {
      const jsonString = JSON.stringify(editedData, null, 2);
      await navigator.clipboard.writeText(jsonString);
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 3000);
    } catch (err) {
      setError('Failed to copy JSON to clipboard');
    }
  };

  const handleTransform = () => {
    if (editedData) {
      const transformed = transformInvoice(editedData, selectedFormat);
      setTransformedData(transformed);
      setShowTransform(true);
    }
  };

  const handleCopyTransformed = async () => {
    try {
      await navigator.clipboard.writeText(transformedData);
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 3000);
    } catch (err) {
      setError('Failed to copy to clipboard');
    }
  };

  const handleDownloadTransformed = () => {
    if (editedData && invoice) {
      const dataToTransform = translatedInvoiceData || editedData;
      const filename = invoice.filename.replace('.pdf', '');
      const langSuffix = translatedInvoiceData ? `_${selectedLanguage}` : '';
      downloadTransformedInvoice(dataToTransform, selectedFormat, filename + langSuffix);
    }
  };

  const handleTranslate = async () => {
    if (!editedData || !selectedLanguage) return;
    
    setTranslating(true);
    setError('');
    
    try {
      const result = await api.translateInvoiceData(editedData, selectedLanguage);
      if (result.success) {
        setTranslatedInvoiceData(result.translated_data);
        // Update the transformed preview with translated data
        const transformed = transformInvoice(result.translated_data, selectedFormat);
        setTransformedData(transformed);
      } else {
        setError('Translation failed');
      }
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Translation failed. Please try again.');
    } finally {
      setTranslating(false);
    }
  };

  const handleResetTranslation = () => {
    setTranslatedInvoiceData(null);
    setSelectedLanguage('');
    if (editedData) {
      const transformed = transformInvoice(editedData, selectedFormat);
      setTransformedData(transformed);
    }
  };

  const isImageFile = (filename: string) => {
    const ext = filename.toLowerCase().substring(filename.lastIndexOf('.'));
    return ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp', '.tiff'].includes(ext);
  };

  const handleBack = () => {
    // Check if we came from settings
    const fromSettings = sessionStorage.getItem('fromSettings') === 'true';
    if (fromSettings) {
      sessionStorage.removeItem('fromSettings');
      router.back();
    } else {
      // Go to invoice list in dashboard
      router.push('/dashboard?view=invoices');
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-50 via-violet-50/30 to-slate-100">
        <div className="text-center">
          <div className="spinner w-12 h-12 border-4 border-violet-600 mx-auto"></div>
          <p className="mt-4 text-slate-600 font-medium">Loading invoice...</p>
        </div>
      </div>
    );
  }

  if (error && !invoice) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-50 via-violet-50/30 to-slate-100">
        <div className="card p-8 text-center max-w-md">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <p className="text-red-600 mb-6">{error}</p>
          <button onClick={handleBack} className="btn-primary">
            Back to Dashboard
          </button>
        </div>
      </div>
    );
  }

  const pdfUrl = api.getInvoicePdfUrl(invoiceId);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-violet-50/30 to-slate-100">
      {/* Header */}
      <header className="header border-b border-slate-200 shadow-sm">
        <div className="max-w-full mx-auto px-6 py-4 flex justify-between items-center">
          <div className="flex items-center space-x-4">
            <button
              onClick={handleBack}
              className="btn-ghost flex items-center space-x-2"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
              <span>Back</span>
            </button>
            <div className="h-6 w-px bg-slate-200"></div>
            <div>
              <h1 className="text-xl font-bold text-slate-900 flex items-center space-x-2">
                <div className="w-8 h-8 bg-gradient-to-br from-red-500 to-rose-600 rounded-lg flex items-center justify-center flex-shrink-0">
                  <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" clipRule="evenodd" />
                  </svg>
                </div>
                <span>{invoice?.filename}</span>
              </h1>
              <div className="flex items-center space-x-2 mt-1">
                {/* AI Confidence Badge */}
                {invoiceMetadata.confidence_scores?.overall != null && (
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${
                    invoiceMetadata.confidence_scores.overall >= 0.8 
                      ? 'bg-emerald-100 text-emerald-700' 
                      : invoiceMetadata.confidence_scores.overall >= 0.6 
                        ? 'bg-amber-100 text-amber-700' 
                        : 'bg-red-100 text-red-700'
                  }`}>
                    <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    {Math.round(invoiceMetadata.confidence_scores.overall * 100)}% Confidence
                  </span>
                )}
                {/* Category Badge */}
                {invoiceMetadata.category && (
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-violet-100 text-violet-700">
                    <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                    </svg>
                    {invoiceMetadata.category}
                  </span>
                )}
                {/* Language Badge */}
                {invoiceMetadata.detected_language && (
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-sky-100 text-sky-700">
                    <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5h12M9 3v2m1.048 9.5A18.022 18.022 0 016.412 9m6.088 9h7M11 21l5-10 5 10M12.751 5C11.783 10.77 8.07 15.61 3 18.129" />
                    </svg>
                    {invoiceMetadata.detected_language}
                  </span>
                )}
                {/* Duplicate Badge */}
                {invoiceMetadata.is_duplicate && (
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-orange-100 text-orange-700">
                    <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                    </svg>
                    Duplicate{invoiceMetadata.duplicate_of_id ? ` of #${invoiceMetadata.duplicate_of_id}` : ''}
                  </span>
                )}
              </div>
            </div>
          </div>
          <div className="flex items-center space-x-3">
            {saveSuccess && (
              <div className="flex items-center space-x-2 px-4 py-2 bg-emerald-50 border border-emerald-200 rounded-full animate-fade-in">
                <svg className="w-4 h-4 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <span className="text-emerald-700 text-sm font-medium">Saved successfully</span>
              </div>
            )}
            {copySuccess && (
              <div className="flex items-center space-x-2 px-4 py-2 bg-sky-50 border border-sky-200 rounded-full animate-fade-in">
                <svg className="w-4 h-4 text-sky-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <span className="text-sky-700 text-sm font-medium">Copied to clipboard</span>
              </div>
            )}
            <ERPSyncButton invoiceData={editedData} />
            <button
              onClick={() => setShowJSON(true)}
              className="btn-secondary"
            >
              <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
              </svg>
              View JSON
            </button>
            <button
              onClick={handleCopyJSON}
              className="btn-secondary"
            >
              <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
              Copy JSON
            </button>
            <button
              onClick={handleTransform}
              className="inline-flex items-center px-5 py-2.5 font-semibold text-white text-sm bg-gradient-to-r from-purple-600 to-fuchsia-600 hover:from-purple-700 hover:to-fuchsia-700 rounded-xl shadow-lg shadow-purple-500/25 transition-all"
            >
              <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
              </svg>
              Transform
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="btn-primary"
            >
              {saving ? (
                <span className="flex items-center space-x-2">
                  <div className="spinner w-4 h-4"></div>
                  <span>Saving...</span>
                </span>
              ) : (
                <>
                  <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  Save Changes
                </>
              )}
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-full h-[calc(100vh-80px)] flex">
        {/* PDF/Image Viewer - Left Side */}
        <div className="w-1/2 h-full border-r border-slate-200 bg-white overflow-hidden">
          {invoice && isImageFile(invoice.filename) ? (
            <ImageViewer 
              imageUrl={pdfUrl} 
              filename={invoice.filename}
            />
          ) : (
            <PDFViewerWithHighlight 
              pdfUrl={pdfUrl} 
              highlightRegion={highlightRegion}
              activeField={activeSection}
            />
          )}
        </div>

        {/* Data Editor - Right Side */}
        <div className="w-1/2 overflow-y-auto bg-slate-50">
          <div className="p-6 space-y-6">
            {error && (
              <div className="alert-error animate-fade-in">
                <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span>{error}</span>
              </div>
            )}

            {!editedData ? (
              <div className="card p-12 text-center">
                <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg className="w-8 h-8 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
                <p className="text-slate-500">
                  No extracted data available. Please process the invoice first.
                </p>
              </div>
            ) : (
              <>
                {/* AI Confidence Scores Panel */}
                {invoiceMetadata.confidence_scores && Object.keys(invoiceMetadata.confidence_scores).length > 0 && (
                  <div className="card p-4 bg-gradient-to-r from-slate-50 to-violet-50 border border-violet-100">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center space-x-2">
                        <svg className="w-5 h-5 text-violet-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                        </svg>
                        <span className="text-sm font-semibold text-slate-700">AI Extraction Confidence</span>
                      </div>
                      {invoiceMetadata.confidence_scores.overall != null && (
                        <span className={`text-sm font-bold ${
                          invoiceMetadata.confidence_scores.overall >= 0.8 ? 'text-emerald-600' :
                          invoiceMetadata.confidence_scores.overall >= 0.6 ? 'text-amber-600' : 'text-red-600'
                        }`}>
                          Overall: {Math.round(invoiceMetadata.confidence_scores.overall * 100)}%
                        </span>
                      )}
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-2">
                      {Object.entries(invoiceMetadata.confidence_scores)
                        .filter(([key]) => key !== 'overall')
                        .map(([field, score]) => {
                          const numScore = typeof score === 'number' ? score : 0;
                          return (
                            <div key={field} className="bg-white rounded-lg p-2 border border-slate-200">
                              <p className="text-xs text-slate-500 truncate capitalize">{field.replace(/_/g, ' ')}</p>
                              <div className="flex items-center space-x-2 mt-1">
                                <div className="flex-1 h-1.5 bg-slate-200 rounded-full overflow-hidden">
                                  <div 
                                    className={`h-full rounded-full ${
                                      numScore >= 0.8 ? 'bg-emerald-500' :
                                      numScore >= 0.6 ? 'bg-amber-500' : 'bg-red-500'
                                    }`}
                                    style={{ width: `${numScore * 100}%` }}
                                  ></div>
                                </div>
                                <span className={`text-xs font-semibold ${
                                  numScore >= 0.8 ? 'text-emerald-600' :
                                  numScore >= 0.6 ? 'text-amber-600' : 'text-red-600'
                                }`}>
                                  {Math.round(numScore * 100)}%
                                </span>
                              </div>
                            </div>
                          );
                        })}
                    </div>
                  </div>
                )}

                {/* Invoice Header Form */}
                <InvoiceForm
                  data={editedData}
                  onChange={handleHeaderChange}
                  onFieldFocus={handleFieldFocus}
                />

                <div className="border-t border-slate-200"></div>

                {/* Line Items Table */}
                <LineItemsTable
                  items={editedData.line_items || []}
                  onChange={handleLineItemsChange}
                  onFieldFocus={handleFieldFocus}
                />

                {/* Save Button at Bottom */}
                <div className="flex justify-end items-center space-x-3 pt-6 border-t border-slate-200">
                  <ERPSyncButton invoiceData={editedData} />
                  <button
                    onClick={() => setShowJSON(true)}
                    className="btn-secondary"
                  >
                    <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
                    </svg>
                    View JSON
                  </button>
                  <button
                    onClick={handleCopyJSON}
                    className="btn-secondary"
                  >
                    <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                    </svg>
                    Copy JSON
                  </button>
                  <button
                    onClick={handleTransform}
                    className="inline-flex items-center px-5 py-2.5 font-semibold text-white text-sm bg-gradient-to-r from-purple-600 to-fuchsia-600 hover:from-purple-700 hover:to-fuchsia-700 rounded-xl shadow-lg shadow-purple-500/25 transition-all"
                  >
                    <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                    </svg>
                    Transform & Export
                  </button>
                  <button
                    onClick={handleSave}
                    disabled={saving}
                    className="btn-primary px-8"
                  >
                    {saving ? (
                      <span className="flex items-center space-x-2">
                        <div className="spinner w-4 h-4"></div>
                        <span>Saving...</span>
                      </span>
                    ) : 'Save All Changes'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </main>

      {/* JSON Preview Modal */}
      {showJSON && (
        <div className="modal-overlay" onClick={() => setShowJSON(false)}>
          <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[80vh] flex flex-col animate-modal-enter" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center p-5 border-b border-slate-100">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-gradient-to-br from-slate-600 to-slate-700 rounded-xl flex items-center justify-center">
                  <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
                  </svg>
                </div>
                <h3 className="text-lg font-bold text-slate-900">Invoice Data (JSON)</h3>
              </div>
              <div className="flex items-center space-x-2">
                <button onClick={handleCopyJSON} className="btn-primary py-2 px-4 text-sm">
                  <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                  Copy
                </button>
                <button onClick={() => setShowJSON(false)} className="btn-icon">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
            <div className="flex-1 overflow-auto p-5">
              <pre className="bg-slate-900 text-slate-100 p-6 rounded-xl text-sm font-mono overflow-auto">
                {JSON.stringify(editedData, null, 2)}
              </pre>
            </div>
          </div>
        </div>
      )}

      {/* Transform & Export Modal */}
      {showTransform && (
        <div className="modal-overlay" onClick={() => setShowTransform(false)}>
          <div className="bg-white rounded-2xl shadow-2xl max-w-6xl w-full max-h-[90vh] flex flex-col animate-modal-enter" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center p-5 border-b border-slate-100">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-gradient-to-br from-purple-600 to-fuchsia-600 rounded-xl flex items-center justify-center">
                  <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                  </svg>
                </div>
                <h3 className="text-lg font-bold text-slate-900">Transform & Export Invoice</h3>
              </div>
              <button onClick={() => setShowTransform(false)} className="btn-icon">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            
            <div className="flex-1 overflow-auto p-6 flex gap-6">
              {/* Left: Format Selection */}
              <div className="w-1/3">
                <h4 className="font-bold text-slate-900 mb-4">Select Format</h4>
                <div className="space-y-2">
                  {availableFormats.map((format) => (
                    <label
                      key={format.id}
                      className={`block p-4 border-2 rounded-xl cursor-pointer transition-all ${
                        selectedFormat === format.id
                          ? 'border-purple-500 bg-purple-50 shadow-md shadow-purple-100'
                          : 'border-slate-200 hover:border-purple-300 hover:bg-purple-50/50'
                      }`}
                    >
                      <div className="flex items-center space-x-3">
                        <input
                          type="radio"
                          name="format"
                          value={format.id}
                          checked={selectedFormat === format.id}
                          onChange={(e) => {
                            setSelectedFormat(e.target.value);
                            const dataToTransform = translatedInvoiceData || editedData;
                            const transformed = transformInvoice(dataToTransform, e.target.value);
                            setTransformedData(transformed);
                          }}
                          className="w-4 h-4 text-purple-600 border-slate-300 focus:ring-purple-500"
                        />
                        <span className="font-semibold text-slate-900">{format.name}</span>
                        <span className="text-xs text-slate-500 bg-slate-100 px-2 py-0.5 rounded">.{format.extension}</span>
                      </div>
                    </label>
                  ))}
                </div>

                {/* Language Translation Section */}
                <div className="mt-6 pt-6 border-t border-slate-200">
                  <h4 className="font-bold text-slate-900 mb-3 flex items-center space-x-2">
                    <svg className="w-5 h-5 text-sky-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5h12M9 3v2m1.048 9.5A18.022 18.022 0 016.412 9m6.088 9h7M11 21l5-10 5 10M12.751 5C11.783 10.77 8.07 15.61 3 18.129" />
                    </svg>
                    <span>Translate</span>
                  </h4>
                  
                  {translatedInvoiceData ? (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between p-3 bg-sky-50 border border-sky-200 rounded-lg">
                        <div className="flex items-center space-x-2">
                          <svg className="w-4 h-4 text-sky-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                          <span className="text-sm font-medium text-sky-700">Translated to {selectedLanguage}</span>
                        </div>
                        <button
                          onClick={handleResetTranslation}
                          className="text-xs text-sky-600 hover:text-sky-700 font-medium"
                        >
                          Reset
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <select
                        value={selectedLanguage}
                        onChange={(e) => setSelectedLanguage(e.target.value)}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-transparent"
                      >
                        <option value="">Select target language...</option>
                        {supportedLanguages.map((lang) => (
                          <option key={lang} value={lang}>{lang}</option>
                        ))}
                      </select>
                      <button
                        onClick={handleTranslate}
                        disabled={!selectedLanguage || translating}
                        className={`w-full py-2.5 px-4 rounded-lg font-semibold text-sm flex items-center justify-center space-x-2 transition-all ${
                          selectedLanguage && !translating
                            ? 'bg-gradient-to-r from-sky-500 to-cyan-500 text-white hover:from-sky-600 hover:to-cyan-600 shadow-lg shadow-sky-500/25'
                            : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                        }`}
                      >
                        {translating ? (
                          <>
                            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                            <span>Translating...</span>
                          </>
                        ) : (
                          <>
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5h12M9 3v2m1.048 9.5A18.022 18.022 0 016.412 9m6.088 9h7M11 21l5-10 5 10M12.751 5C11.783 10.77 8.07 15.61 3 18.129" />
                            </svg>
                            <span>Translate Invoice</span>
                          </>
                        )}
                      </button>
                    </div>
                  )}
                </div>
                
                <div className="mt-6 space-y-3">
                  <button
                    onClick={handleCopyTransformed}
                    className="w-full btn-primary"
                  >
                    <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                    </svg>
                    Copy to Clipboard
                  </button>
                  <button
                    onClick={handleDownloadTransformed}
                    className="w-full btn-success"
                  >
                    <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                    </svg>
                    Download File
                  </button>
                </div>
              </div>
              
              {/* Right: Preview */}
              <div className="flex-1">
                <div className="flex items-center justify-between mb-4">
                  <h4 className="font-bold text-slate-900">Preview</h4>
                  {translatedInvoiceData && (
                    <span className="text-xs font-medium text-sky-600 bg-sky-100 px-2 py-1 rounded-full">
                      Translated to {selectedLanguage}
                    </span>
                  )}
                </div>
                <div className="bg-slate-900 text-slate-100 p-6 rounded-xl h-[calc(100%-2rem)] overflow-auto">
                  <pre className="text-sm font-mono">
                    {transformedData}
                  </pre>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
