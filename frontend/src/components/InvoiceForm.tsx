'use client';

interface InvoiceFormProps {
  data: any;
  onChange: (data: any) => void;
  onFieldFocus?: (fieldName: string) => void;
}

export default function InvoiceForm({ data, onChange, onFieldFocus }: InvoiceFormProps) {
  const handleChange = (field: string, value: any) => {
    onChange({ ...data, [field]: value });
  };

  const handleFocus = (fieldName: string) => {
    if (onFieldFocus) {
      onFieldFocus(fieldName);
    }
  };

  return (
    <div className="card p-6">
      <div className="flex items-center space-x-3 mb-6">
        <div className="w-10 h-10 bg-gradient-to-br from-violet-500 to-indigo-600 rounded-xl flex items-center justify-center">
          <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
        </div>
        <div>
          <h3 className="text-lg font-bold text-slate-900">Invoice Header</h3>
          <p className="text-sm text-slate-500">Basic invoice information</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <div>
          <label className="label">Invoice Number</label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
              <svg className="w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 20l4-16m2 16l4-16M6 9h14M4 15h14" />
              </svg>
            </div>
            <input
              type="text"
              value={data.invoice_number || ''}
              onChange={(e) => handleChange('invoice_number', e.target.value)}
              onFocus={() => handleFocus('Invoice Number')}
              className="input pl-12"
              placeholder="INV-0001"
            />
          </div>
        </div>

        <div>
          <label className="label">Invoice Date</label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
              <svg className="w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
            <input
              type="date"
              value={data.date || ''}
              onChange={(e) => {
                const dateValue = e.target.value;
                if (dateValue) {
                  handleChange('date', dateValue);
                }
              }}
              onFocus={() => handleFocus('Invoice Date')}
              className="input pl-12"
              required
            />
          </div>
        </div>

        <div>
          <label className="label">Vendor Name</label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
              <svg className="w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
              </svg>
            </div>
            <input
              type="text"
              value={data.vendor_name || ''}
              onChange={(e) => handleChange('vendor_name', e.target.value)}
              onFocus={() => handleFocus('Vendor Name')}
              className="input pl-12"
              placeholder="Vendor Company Ltd"
            />
          </div>
        </div>

        <div>
          <label className="label">Customer Name</label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
              <svg className="w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
            </div>
            <input
              type="text"
              value={data.customer_name || ''}
              onChange={(e) => handleChange('customer_name', e.target.value)}
              onFocus={() => handleFocus('Customer Name')}
              className="input pl-12"
              placeholder="Customer Inc."
            />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mt-5">
        <div>
          <label className="label">Vendor Address</label>
          <textarea
            value={data.vendor_address || ''}
            onChange={(e) => handleChange('vendor_address', e.target.value)}
            rows={3}
            className="textarea"
            placeholder="123 Business Street, City, Country"
          />
        </div>

        <div>
          <label className="label">Customer Address</label>
          <textarea
            value={data.customer_address || ''}
            onChange={(e) => handleChange('customer_address', e.target.value)}
            rows={3}
            className="textarea"
            placeholder="456 Customer Avenue, City, Country"
          />
        </div>
      </div>

      {/* Financial Details */}
      <div className="mt-6 pt-6 border-t border-slate-200">
        <h4 className="text-sm font-bold text-slate-700 uppercase tracking-wide mb-4">Financial Details</h4>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div>
            <label className="label">Currency</label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                <svg className="w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <input
                type="text"
                value={data.currency || ''}
                onChange={(e) => handleChange('currency', e.target.value)}
                className="input pl-12"
                placeholder="USD"
              />
            </div>
          </div>

          <div>
            <label className="label">Subtotal</label>
            <input
              type="number"
              step="0.01"
              value={data.subtotal || 0}
              onChange={(e) =>
                handleChange('subtotal', parseFloat(e.target.value) || 0)
              }
              className="input text-right font-mono"
            />
          </div>

          <div>
            <label className="label">Tax</label>
            <input
              type="number"
              step="0.01"
              value={data.tax || 0}
              onChange={(e) =>
                handleChange('tax', parseFloat(e.target.value) || 0)
              }
              className="input text-right font-mono"
            />
          </div>

          <div>
            <label className="label">Total Amount</label>
            <input
              type="number"
              step="0.01"
              value={data.total_amount || 0}
              onChange={(e) =>
                handleChange('total_amount', parseFloat(e.target.value) || 0)
              }
              className="input text-right font-mono font-bold text-violet-700 bg-violet-50 border-violet-200 focus:border-violet-400 focus:ring-violet-100"
            />
          </div>
        </div>
      </div>

      {/* Additional Information */}
      <div className="mt-6 pt-6 border-t border-slate-200">
        <div className="flex items-center space-x-3 mb-4">
          <div className="w-8 h-8 bg-gradient-to-br from-amber-500 to-orange-500 rounded-lg flex items-center justify-center">
            <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h4 className="text-sm font-bold text-slate-700 uppercase tracking-wide">Additional Information</h4>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div>
            <label className="label">
              <span className="flex items-center space-x-2">
                <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                </svg>
                <span>Metadata</span>
              </span>
            </label>
            <textarea
              value={data.metadata || ''}
              onChange={(e) => handleChange('metadata', e.target.value)}
              onFocus={() => handleFocus('Metadata')}
              rows={4}
              className="textarea"
              placeholder="Payment terms, PO number, reference codes, categories, tags..."
            />
            <p className="mt-1.5 text-xs text-slate-400">Other information about the invoice (payment terms, references, etc.)</p>
          </div>

          <div>
            <label className="label">
              <span className="flex items-center space-x-2">
                <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <span>Extra Information</span>
              </span>
            </label>
            <textarea
              value={data.extra_information || ''}
              onChange={(e) => handleChange('extra_information', e.target.value)}
              onFocus={() => handleFocus('Extra Information')}
              rows={4}
              className="textarea"
              placeholder="Special notes, delivery instructions, additional remarks..."
            />
            <p className="mt-1.5 text-xs text-slate-400">Any extra details or notes about this invoice</p>
          </div>
        </div>
      </div>
    </div>
  );
}
