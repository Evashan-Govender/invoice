'use client';

import { useState, useEffect } from 'react';

interface PDFViewerProps {
  pdfUrl: string;
}

export default function PDFViewer({ pdfUrl }: PDFViewerProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    setLoading(true);
    setError('');
  }, [pdfUrl]);

  const handleLoad = () => {
    setLoading(false);
  };

  const handleError = () => {
    setLoading(false);
    setError('Error loading PDF');
  };

  return (
    <div className="h-full flex flex-col bg-sb-grey-2-10">
      <div className="flex-1 relative overflow-auto">
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center bg-sb-grey-2-10 z-10">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-sb-blue mx-auto"></div>
              <p className="mt-4 text-sb-grey-2">Loading PDF...</p>
            </div>
          </div>
        )}

        {error && (
          <div className="absolute inset-0 flex items-center justify-center bg-sb-grey-2-10 z-10">
            <div className="text-center text-red-600">
              <p>{error}</p>
              <a 
                href={pdfUrl} 
                target="_blank" 
                rel="noopener noreferrer"
                className="mt-4 inline-block px-4 py-2 bg-sb-blue text-white rounded hover:bg-sb-dark-blue"
              >
                Open PDF in New Tab
              </a>
            </div>
          </div>
        )}

        <iframe
          src={`${pdfUrl}#toolbar=0&navpanes=0`}
          className="w-full h-full border-0"
          style={{ minHeight: '100%' }}
          onLoad={handleLoad}
          onError={handleError}
          title="Invoice PDF"
          allow="fullscreen"
        />
      </div>
    </div>
  );
}

