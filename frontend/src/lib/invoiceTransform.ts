// Invoice transformation utilities for different ERP formats

export interface InvoiceData {
  invoice_number: string;
  date: string;
  vendor_name: string;
  vendor_address: string;
  customer_name: string;
  customer_address: string;
  currency: string;
  subtotal: number;
  tax: number;
  total_amount: number;
  line_items: Array<{
    description: string;
    quantity: number;
    unit_price: number;
    total_price: number;
  }>;
}

// QuickBooks format
export function transformToQuickBooks(data: InvoiceData) {
  return {
    TxnDate: data.date,
    RefNumber: data.invoice_number,
    VendorRef: {
      name: data.vendor_name,
    },
    VendorAddress: {
      Line1: data.vendor_address,
    },
    APAccountRef: {
      name: "Accounts Payable",
    },
    TotalAmt: data.total_amount,
    Line: data.line_items.map((item, index) => ({
      Id: (index + 1).toString(),
      LineNum: index + 1,
      Description: item.description,
      Amount: item.total_price,
      DetailType: "ItemBasedExpenseLineDetail",
      ItemBasedExpenseLineDetail: {
        Qty: item.quantity,
        UnitPrice: item.unit_price,
      },
    })),
    TxnTaxDetail: {
      TotalTax: data.tax,
    },
  };
}

// SAP format
export function transformToSAP(data: InvoiceData) {
  return {
    InvoiceHeader: {
      InvoiceNumber: data.invoice_number,
      InvoiceDate: data.date,
      Currency: data.currency,
      VendorCode: data.vendor_name,
      TotalAmount: data.total_amount,
      TaxAmount: data.tax,
      NetAmount: data.subtotal,
    },
    VendorDetails: {
      Name: data.vendor_name,
      Address: data.vendor_address,
    },
    CustomerDetails: {
      Name: data.customer_name,
      Address: data.customer_address,
    },
    LineItems: data.line_items.map((item, index) => ({
      ItemNumber: index + 1,
      Description: item.description,
      Quantity: item.quantity,
      UnitPrice: item.unit_price,
      Amount: item.total_price,
    })),
  };
}

// Tally ERP format
export function transformToTally(data: InvoiceData) {
  return {
    ENVELOPE: {
      HEADER: {
        TALLYREQUEST: "Import Data",
      },
      BODY: {
        IMPORTDATA: {
          REQUESTDESC: {
            REPORTNAME: "Vouchers",
            STATICVARIABLES: {
              SVCURRENTCOMPANY: "Your Company Name",
            },
          },
          REQUESTDATA: {
            TALLYMESSAGE: {
              VOUCHER: {
                DATE: data.date,
                VOUCHERTYPENAME: "Purchase",
                VOUCHERNUMBER: data.invoice_number,
                PARTYLEDGERNAME: data.vendor_name,
                EFFECTIVEDATE: data.date,
                "ALLLEDGERENTRIES.LIST": [
                  {
                    LEDGERNAME: data.vendor_name,
                    ISDEEMEDPOSITIVE: "Yes",
                    AMOUNT: -data.total_amount,
                  },
                  ...data.line_items.map((item) => ({
                    LEDGERNAME: item.description,
                    ISDEEMEDPOSITIVE: "No",
                    AMOUNT: item.total_price,
                  })),
                  {
                    LEDGERNAME: "Tax",
                    ISDEEMEDPOSITIVE: "No",
                    AMOUNT: data.tax,
                  },
                ],
              },
            },
          },
        },
      },
    },
  };
}

// Zoho Books format
export function transformToZoho(data: InvoiceData) {
  return {
    vendor_id: data.vendor_name,
    invoice_number: data.invoice_number,
    date: data.date,
    due_date: data.date,
    line_items: data.line_items.map((item) => ({
      name: item.description,
      description: item.description,
      rate: item.unit_price,
      quantity: item.quantity,
      amount: item.total_price,
    })),
    tax_total: data.tax,
    sub_total: data.subtotal,
    total: data.total_amount,
    currency_code: data.currency,
    notes: `Vendor: ${data.vendor_name}\nCustomer: ${data.customer_name}`,
  };
}

// CSV format
export function transformToCSV(data: InvoiceData): string {
  const header = [
    "Invoice Number",
    "Date",
    "Vendor Name",
    "Vendor Address",
    "Customer Name",
    "Customer Address",
    "Currency",
    "Item Description",
    "Quantity",
    "Unit Price",
    "Line Total",
    "Subtotal",
    "Tax",
    "Total Amount",
  ].join(",");

  const rows = data.line_items.map((item, index) => {
    return [
      data.invoice_number,
      data.date,
      `"${data.vendor_name}"`,
      `"${data.vendor_address}"`,
      `"${data.customer_name}"`,
      `"${data.customer_address}"`,
      data.currency,
      `"${item.description}"`,
      item.quantity,
      item.unit_price,
      item.total_price,
      index === 0 ? data.subtotal : "",
      index === 0 ? data.tax : "",
      index === 0 ? data.total_amount : "",
    ].join(",");
  });

  return [header, ...rows].join("\n");
}

// Excel format (TSV for easy Excel import)
export function transformToExcel(data: InvoiceData): string {
  const rows = [
    ["Invoice Details", ""],
    ["Invoice Number", data.invoice_number],
    ["Date", data.date],
    ["Currency", data.currency],
    ["", ""],
    ["Vendor Information", ""],
    ["Vendor Name", data.vendor_name],
    ["Vendor Address", data.vendor_address],
    ["", ""],
    ["Customer Information", ""],
    ["Customer Name", data.customer_name],
    ["Customer Address", data.customer_address],
    ["", ""],
    ["Line Items", "", "", ""],
    ["Description", "Quantity", "Unit Price", "Total"],
    ...data.line_items.map((item) => [
      item.description,
      item.quantity.toString(),
      item.unit_price.toString(),
      item.total_price.toString(),
    ]),
    ["", ""],
    ["Subtotal", "", "", data.subtotal.toString()],
    ["Tax", "", "", data.tax.toString()],
    ["Total Amount", "", "", data.total_amount.toString()],
  ];

  return rows.map((row) => row.join("\t")).join("\n");
}

// XML format
export function transformToXML(data: InvoiceData): string {
  const lineItemsXML = data.line_items
    .map(
      (item, index) => `
    <LineItem id="${index + 1}">
      <Description>${escapeXML(item.description)}</Description>
      <Quantity>${item.quantity}</Quantity>
      <UnitPrice>${item.unit_price}</UnitPrice>
      <TotalPrice>${item.total_price}</TotalPrice>
    </LineItem>`
    )
    .join("");

  return `<?xml version="1.0" encoding="UTF-8"?>
<Invoice>
  <Header>
    <InvoiceNumber>${escapeXML(data.invoice_number)}</InvoiceNumber>
    <Date>${data.date}</Date>
    <Currency>${data.currency}</Currency>
  </Header>
  <Vendor>
    <Name>${escapeXML(data.vendor_name)}</Name>
    <Address>${escapeXML(data.vendor_address)}</Address>
  </Vendor>
  <Customer>
    <Name>${escapeXML(data.customer_name)}</Name>
    <Address>${escapeXML(data.customer_address)}</Address>
  </Customer>
  <LineItems>${lineItemsXML}
  </LineItems>
  <Totals>
    <Subtotal>${data.subtotal}</Subtotal>
    <Tax>${data.tax}</Tax>
    <TotalAmount>${data.total_amount}</TotalAmount>
  </Totals>
</Invoice>`;
}

// Helper function to escape XML special characters
function escapeXML(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

// NetSuite format
export function transformToNetSuite(data: InvoiceData) {
  return {
    tranId: data.invoice_number,
    tranDate: data.date,
    entity: {
      name: data.vendor_name,
    },
    currency: {
      name: data.currency,
    },
    item: data.line_items.map((item) => ({
      item: {
        name: item.description,
      },
      quantity: item.quantity,
      rate: item.unit_price,
      amount: item.total_price,
    })),
    taxTotal: data.tax,
    total: data.total_amount,
  };
}

// Standard JSON format (our internal format)
export function transformToStandardJSON(data: InvoiceData) {
  return data;
}

// Get all available formats
export const availableFormats = [
  { id: "json", name: "JSON (Standard)", extension: "json" },
  { id: "quickbooks", name: "QuickBooks", extension: "json" },
  { id: "sap", name: "SAP", extension: "json" },
  { id: "tally", name: "Tally ERP", extension: "xml" },
  { id: "zoho", name: "Zoho Books", extension: "json" },
  { id: "netsuite", name: "NetSuite", extension: "json" },
  { id: "csv", name: "CSV (Excel Compatible)", extension: "csv" },
  { id: "excel", name: "Excel (Tab-Separated)", extension: "txt" },
  { id: "xml", name: "XML (Generic)", extension: "xml" },
];

// Main transformation function
export function transformInvoice(data: InvoiceData, format: string): string {
  let result: any;

  switch (format) {
    case "quickbooks":
      result = transformToQuickBooks(data);
      return JSON.stringify(result, null, 2);
    case "sap":
      result = transformToSAP(data);
      return JSON.stringify(result, null, 2);
    case "tally":
      result = transformToTally(data);
      return JSON.stringify(result, null, 2);
    case "zoho":
      result = transformToZoho(data);
      return JSON.stringify(result, null, 2);
    case "netsuite":
      result = transformToNetSuite(data);
      return JSON.stringify(result, null, 2);
    case "csv":
      return transformToCSV(data);
    case "excel":
      return transformToExcel(data);
    case "xml":
      return transformToXML(data);
    case "json":
    default:
      return JSON.stringify(transformToStandardJSON(data), null, 2);
  }
}

// Download function
export function downloadTransformedInvoice(
  data: InvoiceData,
  format: string,
  filename: string
) {
  const content = transformInvoice(data, format);
  const formatInfo = availableFormats.find((f) => f.id === format);
  const extension = formatInfo?.extension || "txt";
  const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${filename}.${extension}`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

