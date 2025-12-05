// Field coordinate mappings for PDF highlighting
// These coordinates are approximate and should be adjusted based on actual invoice layouts
// Coordinates are in PDF points (72 points = 1 inch)

export interface HighlightRegion {
  page: number;
  x: number;
  y: number;
  width: number;
  height: number;
}

export const fieldCoordinates: Record<string, HighlightRegion> = {
  'Invoice Number': {
    page: 1,
    x: 400,
    y: 50,
    width: 150,
    height: 20,
  },
  'Invoice Date': {
    page: 1,
    x: 400,
    y: 80,
    width: 150,
    height: 20,
  },
  'Vendor Name': {
    page: 1,
    x: 50,
    y: 120,
    width: 250,
    height: 20,
  },
  'Vendor Address': {
    page: 1,
    x: 50,
    y: 145,
    width: 250,
    height: 60,
  },
  'Customer Name': {
    page: 1,
    x: 350,
    y: 120,
    width: 250,
    height: 20,
  },
  'Customer Address': {
    page: 1,
    x: 350,
    y: 145,
    width: 250,
    height: 60,
  },
  'Subtotal': {
    page: 1,
    x: 450,
    y: 600,
    width: 100,
    height: 20,
  },
  'Tax': {
    page: 1,
    x: 450,
    y: 625,
    width: 100,
    height: 20,
  },
  'Total Amount': {
    page: 1,
    x: 450,
    y: 650,
    width: 100,
    height: 25,
  },
};

// Generate line item coordinates dynamically
export function getLineItemCoordinates(itemIndex: number, field: string): HighlightRegion {
  const baseY = 250; // Starting Y position for line items table
  const rowHeight = 25;
  const y = baseY + (itemIndex * rowHeight);

  const columnOffsets: Record<string, { x: number; width: number }> = {
    'Description': { x: 50, width: 250 },
    'Quantity': { x: 310, width: 60 },
    'Unit Price': { x: 380, width: 80 },
    'Total Price': { x: 470, width: 80 },
  };

  const column = columnOffsets[field] || columnOffsets['Description'];

  return {
    page: 1,
    x: column.x,
    y: y,
    width: column.width,
    height: rowHeight - 2,
  };
}

// Parse field name to get coordinates
export function getCoordinatesForField(fieldName: string): HighlightRegion | null {
  // Check if it's a line item field
  const lineItemMatch = fieldName.match(/Line Item (\d+) - (.+)/);
  if (lineItemMatch) {
    const itemIndex = parseInt(lineItemMatch[1]) - 1;
    const field = lineItemMatch[2];
    return getLineItemCoordinates(itemIndex, field);
  }

  // Check for regular fields
  return fieldCoordinates[fieldName] || null;
}

