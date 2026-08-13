'use client';

interface LineItem {
  description: string;
  quantity: number;
  unit_price: number;
  total_price: number;
}

interface LineItemsTableProps {
  items: LineItem[];
  onChange: (items: LineItem[]) => void;
  onFieldFocus?: (fieldName: string) => void;
}

export default function LineItemsTable({ items, onChange, onFieldFocus }: LineItemsTableProps) {
  const handleItemChange = (index: number, field: keyof LineItem, value: any) => {
    const newItems = [...items];
    newItems[index] = { ...newItems[index], [field]: value };
    onChange(newItems);
  };

  const handleAddRow = () => {
    onChange([
      ...items,
      { description: '', quantity: 0, unit_price: 0, total_price: 0 },
    ]);
  };

  const handleRemoveRow = (index: number) => {
    const newItems = items.filter((_, i) => i !== index);
    onChange(newItems);
  };

  return (
    <div className="card p-6">
      <div className="flex justify-between items-center mb-6">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 bg-gradient-to-br from-sb-green to-sb-green rounded-xl flex items-center justify-center">
            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
          </div>
          <div>
            <h3 className="text-lg font-bold text-sb-grey-1">Line Items</h3>
            <p className="text-sm text-sb-grey-2">{items.length} item{items.length !== 1 ? 's' : ''}</p>
          </div>
        </div>
        <button
          onClick={handleAddRow}
          className="btn-primary py-2"
        >
          <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
          </svg>
          Add Row
        </button>
      </div>

      <div className="table-container">
        <table className="table">
          <thead className="table-header">
            <tr>
              <th className="table-header-cell">Description</th>
              <th className="table-header-cell w-28 text-right">Quantity</th>
              <th className="table-header-cell w-36 text-right">Unit Price</th>
              <th className="table-header-cell w-36 text-right">Total</th>
              <th className="table-header-cell w-16 text-center">Action</th>
            </tr>
          </thead>
          <tbody className="table-body">
            {items.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-6 py-12 text-center">
                  <div className="w-16 h-16 bg-sb-grey-2-10 rounded-full flex items-center justify-center mx-auto mb-4">
                    <svg className="w-8 h-8 text-sb-grey-2-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                    </svg>
                  </div>
                  <p className="text-sb-grey-2 font-medium mb-1">No line items</p>
                  <p className="text-sb-grey-2-50 text-sm">Click "Add Row" to add items</p>
                </td>
              </tr>
            ) : (
              items.map((item, index) => (
                <tr key={index} className="table-row group">
                  <td className="px-4 py-3">
                    <input
                      type="text"
                      value={item.description}
                      onChange={(e) =>
                        handleItemChange(index, 'description', e.target.value)
                      }
                      onFocus={() => onFieldFocus && onFieldFocus(`Line Item ${index + 1} - Description`)}
                      className="w-full px-3 py-2 bg-transparent border border-transparent rounded-lg focus:bg-white focus:border-sb-light-blue focus:ring-2 focus:ring-sb-blue-10 outline-none transition-all"
                      placeholder="Item description"
                    />
                  </td>
                  <td className="px-4 py-3">
                    <input
                      type="number"
                      value={item.quantity}
                      onChange={(e) =>
                        handleItemChange(
                          index,
                          'quantity',
                          parseFloat(e.target.value) || 0
                        )
                      }
                      className="w-full px-3 py-2 bg-transparent border border-transparent rounded-lg focus:bg-white focus:border-sb-light-blue focus:ring-2 focus:ring-sb-blue-10 outline-none transition-all text-right font-mono"
                    />
                  </td>
                  <td className="px-4 py-3">
                    <input
                      type="number"
                      step="0.01"
                      value={item.unit_price}
                      onChange={(e) =>
                        handleItemChange(
                          index,
                          'unit_price',
                          parseFloat(e.target.value) || 0
                        )
                      }
                      className="w-full px-3 py-2 bg-transparent border border-transparent rounded-lg focus:bg-white focus:border-sb-light-blue focus:ring-2 focus:ring-sb-blue-10 outline-none transition-all text-right font-mono"
                    />
                  </td>
                  <td className="px-4 py-3">
                    <input
                      type="number"
                      step="0.01"
                      value={item.total_price}
                      onChange={(e) =>
                        handleItemChange(
                          index,
                          'total_price',
                          parseFloat(e.target.value) || 0
                        )
                      }
                      className="w-full px-3 py-2 bg-sb-blue-5 border border-sb-blue-10 rounded-lg focus:bg-white focus:border-sb-light-blue focus:ring-2 focus:ring-sb-blue-10 outline-none transition-all text-right font-mono font-semibold text-sb-dark-blue"
                    />
                  </td>
                  <td className="px-4 py-3 text-center">
                    <button
                      onClick={() => handleRemoveRow(index)}
                      className="p-2 text-sb-grey-2-50 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all opacity-0 group-hover:opacity-100"
                      title="Remove row"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Summary Footer */}
      {items.length > 0 && (
        <div className="mt-4 pt-4 border-t border-sb-grey-2-10 flex justify-end">
          <div className="w-64 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-sb-grey-2">Subtotal ({items.length} items)</span>
              <span className="font-mono font-medium text-sb-grey-2">
                {items.reduce((sum, item) => sum + (item.total_price || 0), 0).toFixed(2)}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
