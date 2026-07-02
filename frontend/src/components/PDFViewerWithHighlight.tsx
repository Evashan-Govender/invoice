'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import 'react-pdf/dist/esm/Page/AnnotationLayer.css';
import 'react-pdf/dist/esm/Page/TextLayer.css';

// Configure PDF.js worker
pdfjs.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.js`;

interface PDFViewerWithHighlightProps {
  pdfUrl: string;
  highlightRegion?: {
    page: number;
    x: number;
    y: number;
    width: number;
    height: number;
  } | null;
  activeField?: string;
}

export default function PDFViewerWithHighlight({ 
  pdfUrl, 
  highlightRegion,
  activeField 
}: PDFViewerWithHighlightProps) {
  const [numPages, setNumPages] = useState<number>(0);
  const [pageNumber, setPageNumber] = useState<number>(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [containerWidth, setContainerWidth] = useState<number>(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Measure container width for responsive PDF sizing
  const updateContainerWidth = useCallback(() => {
    if (containerRef.current) {
      const width = containerRef.current.clientWidth - 32; // Subtract padding
      setContainerWidth(width);
    }
  }, []);

  useEffect(() => {
    updateContainerWidth();
    window.addEventListener('resize', updateContainerWidth);
    return () => window.removeEventListener('resize', updateContainerWidth);
  }, [updateContainerWidth]);

  function onDocumentLoadSuccess({ numPages }: { numPages: number }) {
    setNumPages(numPages);
    setLoading(false);
    setError('');
  }

  function onDocumentLoadError(error: Error) {
    setLoading(false);
    setError('Error loading PDF: ' + error.message);
    console.error('PDF load error:', error);
  }

  // Auto-scroll to highlighted region
  useEffect(() => {
    if (highlightRegion && highlightRegion.page !== pageNumber) {
      setPageNumber(highlightRegion.page);
    }
  }, [highlightRegion, pageNumber]);

  // Draw highlight overlay
  useEffect(() => {
    if (!canvasRef.current || !highlightRegion) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Clear previous highlights
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw highlight rectangle if on current page
    if (highlightRegion.page === pageNumber) {
      ctx.fillStyle = 'rgba(255, 235, 59, 0.3)'; // Yellow with transparency
      ctx.strokeStyle = 'rgba(255, 193, 7, 0.8)'; // Darker yellow border
      ctx.lineWidth = 2;

      const { x, y, width, height } = highlightRegion;
      
      // Draw filled rectangle
      ctx.fillRect(x, y, width, height);
      // Draw border
      ctx.strokeRect(x, y, width, height);

      // Add pulsing animation
      canvas.style.animation = 'pulse 1s ease-in-out';
      setTimeout(() => {
        canvas.style.animation = '';
      }, 1000);
    }
  }, [highlightRegion, pageNumber]);

  const changePage = (offset: number) => {
    setPageNumber((prevPageNumber) => {
      const newPage = prevPageNumber + offset;
      return Math.min(Math.max(1, newPage), numPages);
    });
  };

  return (
    <div className="h-full flex flex-col bg-sb-grey-2-10">
      {/* Active Field Indicator */}
      {activeField && (
        <div className="bg-amber-50 border-b-2 border-amber-400 px-4 py-2 flex-shrink-0">
          <p className="text-sm font-medium text-amber-800 flex items-center">
            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            Editing: <span className="font-bold ml-1">{activeField}</span>
          </p>
        </div>
      )}

      {/* PDF Controls */}
      {!loading && !error && numPages > 0 && (
        <div className="bg-white border-b border-sb-grey-2-20 px-4 py-2.5 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center space-x-3">
            <button
              onClick={() => changePage(-1)}
              disabled={pageNumber <= 1}
              className="px-3 py-1.5 bg-sb-grey-2-10 hover:bg-sb-grey-2-20 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg text-sm font-medium transition-colors"
            >
              ← Previous
            </button>
            <span className="text-sm text-sb-grey-2 font-medium">
              Page <span className="text-sb-grey-1">{pageNumber}</span> of <span className="text-sb-grey-1">{numPages}</span>
            </span>
            <button
              onClick={() => changePage(1)}
              disabled={pageNumber >= numPages}
              className="px-3 py-1.5 bg-sb-grey-2-10 hover:bg-sb-grey-2-20 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg text-sm font-medium transition-colors"
            >
              Next →
            </button>
          </div>
          <a
            href={pdfUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-sb-blue hover:text-sb-dark-blue font-medium flex items-center"
          >
            Open in New Tab
            <svg className="w-4 h-4 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
            </svg>
          </a>
        </div>
      )}

      {/* PDF Viewer - Scrollable container */}
      <div 
        ref={containerRef}
        className="flex-1 overflow-auto p-4 relative"
      >
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center bg-sb-grey-2-10">
            <div className="text-center">
              <div className="spinner w-12 h-12 border-4 border-sb-blue mx-auto"></div>
              <p className="mt-4 text-sb-grey-2 font-medium">Loading PDF...</p>
            </div>
          </div>
        )}

        {error && (
          <div className="absolute inset-0 flex items-center justify-center bg-sb-grey-2-10">
            <div className="text-center">
              <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <p className="text-red-600 mb-4">{error}</p>
              <a
                href={pdfUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="btn-primary"
              >
                Open PDF in New Tab
              </a>
            </div>
          </div>
        )}

        <div className="flex justify-center">
          <div className="relative shadow-xl rounded-lg overflow-hidden bg-white">
            <Document
              file={pdfUrl}
              onLoadSuccess={onDocumentLoadSuccess}
              onLoadError={onDocumentLoadError}
              loading=""
              error=""
            >
              {containerWidth > 0 && (
                <Page
                  pageNumber={pageNumber}
                  renderTextLayer={true}
                  renderAnnotationLayer={true}
                  width={Math.min(containerWidth, 800)}
                />
              )}
            </Document>

            {/* Highlight overlay canvas */}
            <canvas
              ref={canvasRef}
              className="absolute top-0 left-0 pointer-events-none"
              style={{
                width: '100%',
                height: '100%',
              }}
            />
          </div>
        </div>
      </div>

      <style jsx>{`
        @keyframes pulse {
          0%, 100% {
            opacity: 1;
          }
          50% {
            opacity: 0.7;
          }
        }
      `}</style>
    </div>
  );
}
