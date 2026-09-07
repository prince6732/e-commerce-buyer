// ============================================================
// GST Sales Report Utilities
// Home State: Haryana (for CGST/SGST vs IGST determination)
// ============================================================

export const HOME_STATE = "Haryana";

// 36 Indian States & UTs
export const INDIAN_STATES = [
  "Andaman and Nicobar Islands",
  "Andhra Pradesh",
  "Arunachal Pradesh",
  "Assam",
  "Bihar",
  "Chandigarh",
  "Chhattisgarh",
  "Dadra and Nagar Haveli and Daman and Diu",
  "Delhi",
  "Goa",
  "Gujarat",
  "Haryana",
  "Himachal Pradesh",
  "Jammu and Kashmir",
  "Jharkhand",
  "Karnataka",
  "Kerala",
  "Ladakh",
  "Lakshadweep",
  "Madhya Pradesh",
  "Maharashtra",
  "Manipur",
  "Meghalaya",
  "Mizoram",
  "Nagaland",
  "Odisha",
  "Puducherry",
  "Punjab",
  "Rajasthan",
  "Sikkim",
  "Tamil Nadu",
  "Telangana",
  "Tripura",
  "Uttar Pradesh",
  "Uttarakhand",
  "West Bengal",
];

export type DocumentType = "Invoice" | "Credit Note";
export type OrderStatus =
  | "All"
  | "Processing"
  | "Shipped"
  | "Delivered"
  | "Cancelled"
  | "Returned";
export type PaymentType = "All" | "Prepaid" | "COD";
export type PaymentMethod =
  | "All"
  | "UPI"
  | "Credit Card"
  | "Debit Card"
  | "Net Banking"
  | "Cash";

/** One row in the GST report */
export interface GSTReportRow {
  orderId: string;
  documentType: DocumentType;
  documentNumber: string;
  documentDateTime: string;
  statePOS: string;
  hsnCode: string;
  taxableValue: number;
  shippingCharged: number;
  deductedShipping: number;
  gstRate: number; // e.g. 18 for 18%
  cgstAmount: number;
  sgstAmount: number;
  igstAmount: number;
  roundOff: number;
  grossAmount: number;
  paymentMode: string;
  customerGSTIN: string;
}

/** Filters the user can apply */
export interface GSTReportFilters {
  startDate: string; // "YYYY-MM-DD"
  endDate: string; // "YYYY-MM-DD"
  orderStatus: string;
  customerState: string;
  documentType: string;
  paymentType: string;
  paymentMethod: string;
}

/**
 * Given a raw order from the API, build one or two GSTReportRow entries.
 * - Regular order → one Invoice row
 * - Returned order → one Invoice row + one Credit Note row
 */
export function buildGSTRows(order: any): GSTReportRow[] {
  const rows: GSTReportRow[] = [];

  // ── Basic order fields ──────────────────────────────────────
  const orderId = `#${order.order_number ?? order.orderNumber ?? order.id}`;
  const createdAt: Date = new Date(order.created_at ?? order.createdAt ?? "");
  const docDateTime = formatDateTime(createdAt);

  // Shipping address → extract state
  const shippingAddr: string =
    order.shipping_address ?? order.shippingAddress ?? "";
  const statePOS = extractState(shippingAddr);

  // Payment method
  const rawPayment: string = (
    order.payment_method ??
    order.paymentMethod ??
    ""
  ).toLowerCase();
  const paymentMode = normalizePaymentMode(rawPayment);

  // Customer GSTIN (optional field)
  const customerGSTIN: string = order.customer_gstin ?? order.customerGstin ?? "";

  // Items
  const items: any[] = order.order_items ?? order.orderItems ?? [];
  const shippingFee = parseFloat(order.shipping_fee ?? order.shippingFee ?? 0);

  // For now we treat the whole order as one document with the first item's HSN
  // (Retailers usually have per-item rows; here we aggregate per order as requested)
  const firstItem = items[0] ?? {};
  const hsnCode: string =
    firstItem.hsn ??
    firstItem.hsn_code ??
    firstItem.hsnCode ??
    firstItem.product?.hsn ??
    firstItem.product?.category?.hsn ??
    firstItem.product?.category?.parent?.hsn ??
    firstItem.product?.hsn_code ??
    firstItem.product?.hsnCode ??
    "N/A";

  // GST rate from order or item snapshot or product category
  const gstRateRaw =
    firstItem.taxRate ??
    firstItem.tax_rate ??
    firstItem.product?.gstRate ??
    firstItem.product?.tax_rate ??
    firstItem.product?.category?.gstRate ??
    firstItem.product?.category?.tax_rate ??
    order.gst_rate ??
    order.gstRate ??
    firstItem.gst_rate ??
    firstItem.gstRate ??
    18;
  const gstRate = parseFloat(String(gstRateRaw)) || 18;

  const hasSnapshots = items.some((it: any) => (it.taxableAmount !== undefined && it.taxableAmount !== null) || (it.taxable_amount !== undefined && it.taxable_amount !== null));
  const rawSubtotal = parseFloat(order.subtotal ?? order.total ?? 0);
  const taxableValue = hasSnapshots
    ? items.reduce((sum: number, it: any) => sum + parseFloat(it.taxableAmount ?? it.taxable_amount ?? 0), 0)
    : (rawSubtotal / (1 + (gstRate / 100)));

  // ── Invoice row ─────────────────────────────────────────────
  const invoiceNumber =
    order.invoice_number ??
    order.invoiceNumber ??
    `INV-${order.order_number ?? order.orderNumber ?? order.id}`;
  const invRow = computeGSTRow({
    orderId,
    documentType: "Invoice",
    documentNumber: invoiceNumber,
    documentDateTime: docDateTime,
    statePOS,
    hsnCode,
    taxableValue,
    shippingCharged: shippingFee,
    deductedShipping: 0,
    gstRate,
    paymentMode,
    customerGSTIN,
  });
  rows.push(invRow);

  // ── Credit Note row (if order is returned) ──────────────────
  const status: string = (order.status ?? "").toLowerCase();
  if (status === "returned" || status === "return") {
    // CN document number uses a simple counter — we use order id padded
    const cnNumber = `CN-${String(order.id).padStart(3, "0")}`;
    const returnedAt: Date = new Date(
      order.updated_at ?? order.updatedAt ?? order.created_at ?? order.createdAt ?? ""
    );
    const cnDateTime = formatDateTime(returnedAt);

    const cnRow = computeGSTRow({
      orderId,
      documentType: "Credit Note",
      documentNumber: cnNumber,
      documentDateTime: cnDateTime,
      statePOS,
      hsnCode,
      taxableValue: -taxableValue, // negative
      shippingCharged: 0,
      deductedShipping: shippingFee, // we keep the shipping cost
      gstRate,
      paymentMode,
      customerGSTIN,
    });
    rows.push(cnRow);
  }

  return rows;
}

// ── Computation helpers ─────────────────────────────────────────────

interface ComputeParams {
  orderId: string;
  documentType: DocumentType;
  documentNumber: string;
  documentDateTime: string;
  statePOS: string;
  hsnCode: string;
  taxableValue: number; // can be negative for CN
  shippingCharged: number;
  deductedShipping: number;
  gstRate: number;
  paymentMode: string;
  customerGSTIN: string;
}

export function computeGSTRow(p: ComputeParams): GSTReportRow {
  const isLocal = p.statePOS.toLowerCase() === HOME_STATE.toLowerCase();
  const gstFraction = p.gstRate / 100;

  // Tax amounts based on taxable value (which may be negative for CN)
  const totalGSTAmount = round2(Math.abs(p.taxableValue) * gstFraction);
  const sign = p.taxableValue < 0 ? -1 : 1;

  let cgst = 0,
    sgst = 0,
    igst = 0;
  if (isLocal) {
    cgst = round2((totalGSTAmount / 2) * sign);
    sgst = round2((totalGSTAmount / 2) * sign);
  } else {
    igst = round2(totalGSTAmount * sign);
  }

  // Gross before rounding
  const grossBeforeRound =
    p.taxableValue + p.shippingCharged - p.deductedShipping + cgst + sgst + igst;

  // Round-off: nearest rupee
  const roundedGross = Math.round(grossBeforeRound);
  const roundOff = round2(roundedGross - grossBeforeRound);

  return {
    orderId: p.orderId,
    documentType: p.documentType,
    documentNumber: p.documentNumber,
    documentDateTime: p.documentDateTime,
    statePOS: p.statePOS,
    hsnCode: p.hsnCode,
    taxableValue: round2(p.taxableValue),
    shippingCharged: round2(p.shippingCharged),
    deductedShipping: round2(p.deductedShipping),
    gstRate: p.gstRate,
    cgstAmount: cgst,
    sgstAmount: sgst,
    igstAmount: igst,
    roundOff: roundOff,
    grossAmount: round2(roundedGross),
    paymentMode: p.paymentMode,
    customerGSTIN: p.customerGSTIN,
  };
}

// ── Excel export ─────────────────────────────────────────────────────

export async function downloadGSTExcel(rows: GSTReportRow[], filename = "GST_Sales_Report.xlsx") {
  // Dynamic import so it doesn't bloat SSR
  const XLSX = await import("xlsx");

  const headers = [
    "Order ID",
    "Document Type",
    "Document Number",
    "Document Date & Time",
    "State (POS)",
    "HSN Code",
    "Taxable Value (₹)",
    "Shipping Charged (₹)",
    "Deducted Shipping (₹)",
    "GST Rate (%)",
    "CGST Amount (₹)",
    "SGST Amount (₹)",
    "IGST Amount (₹)",
    "Round-Off (₹)",
    "Gross Amount (₹)",
    "Payment Mode",
    "Customer GSTIN",
  ];

  const data = rows.map((r) => [
    r.orderId,
    r.documentType,
    r.documentNumber,
    r.documentDateTime,
    r.statePOS,
    r.hsnCode,
    r.taxableValue,
    r.shippingCharged,
    r.deductedShipping,
    `${r.gstRate}%`,
    r.cgstAmount,
    r.sgstAmount,
    r.igstAmount,
    r.roundOff,
    r.grossAmount,
    r.paymentMode,
    r.customerGSTIN,
  ]);

  const wsData = [headers, ...data];
  const ws = XLSX.utils.aoa_to_sheet(wsData);

  // Column widths
  ws["!cols"] = [
    { wch: 12 }, // Order ID
    { wch: 14 }, // Document Type
    { wch: 14 }, // Document Number
    { wch: 22 }, // Document Date & Time
    { wch: 18 }, // State (POS)
    { wch: 12 }, // HSN Code
    { wch: 18 }, // Taxable Value
    { wch: 18 }, // Shipping Charged
    { wch: 20 }, // Deducted Shipping
    { wch: 12 }, // GST Rate
    { wch: 16 }, // CGST Amount
    { wch: 16 }, // SGST Amount
    { wch: 16 }, // IGST Amount
    { wch: 16 }, // Round-Off
    { wch: 16 }, // Gross Amount
    { wch: 16 }, // Payment Mode
    { wch: 20 }, // Customer GSTIN
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "GST Sales Report");
  XLSX.writeFile(wb, filename);
}

// ── Formatting helpers ───────────────────────────────────────────────

export function formatDateTime(d: Date): string {
  if (isNaN(d.getTime())) return "N/A";
  const day = String(d.getDate()).padStart(2, "0");
  const months = [
    "Jan", "Feb", "Mar", "Apr", "May", "Jun",
    "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
  ];
  const month = months[d.getMonth()];
  const year = d.getFullYear();
  let hours = d.getHours();
  const minutes = String(d.getMinutes()).padStart(2, "0");
  const ampm = hours >= 12 ? "PM" : "AM";
  hours = hours % 12 || 12;
  return `${day}-${month}-${year} ${hours}:${minutes} ${ampm}`;
}

/** Extract state from a shipping address string */
export function extractState(address: string): string {
  if (!address) return "Unknown";
  // Check each known state name in the address (case-insensitive)
  const lower = address.toLowerCase();
  for (const state of INDIAN_STATES) {
    if (lower.includes(state.toLowerCase())) {
      return state;
    }
  }
  // Try to get the second-to-last comma-separated segment as state
  const parts = address.split(",").map((p) => p.trim());
  if (parts.length >= 2) {
    return parts[parts.length - 2] || "Unknown";
  }
  return "Unknown";
}

/** Normalize payment method string */
export function normalizePaymentMode(raw: string): string {
  const r = raw.toLowerCase();
  if (r.includes("upi") || r.includes("gpay") || r.includes("phonepe") || r.includes("paytm")) return "UPI";
  if (r.includes("credit")) return "Credit Card";
  if (r.includes("debit")) return "Debit Card";
  if (r.includes("net") || r.includes("netbank") || r.includes("neft") || r.includes("imps")) return "Net Banking";
  if (r.includes("cod") || r.includes("cash")) return "Cash";
  if (r.includes("card")) return "Debit Card";
  return raw || "Other";
}

/** Round to 2 decimal places */
export function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/** Compute grand totals for footer */
export function computeTotals(rows: GSTReportRow[]) {
  return rows.reduce(
    (acc, r) => ({
      taxableValue: round2(acc.taxableValue + r.taxableValue),
      shippingCharged: round2(acc.shippingCharged + r.shippingCharged),
      deductedShipping: round2(acc.deductedShipping + r.deductedShipping),
      cgstAmount: round2(acc.cgstAmount + r.cgstAmount),
      sgstAmount: round2(acc.sgstAmount + r.sgstAmount),
      igstAmount: round2(acc.igstAmount + r.igstAmount),
      roundOff: round2(acc.roundOff + r.roundOff),
      grossAmount: round2(acc.grossAmount + r.grossAmount),
    }),
    {
      taxableValue: 0,
      shippingCharged: 0,
      deductedShipping: 0,
      cgstAmount: 0,
      sgstAmount: 0,
      igstAmount: 0,
      roundOff: 0,
      grossAmount: 0,
    }
  );
}

/** Filter rows by the UI filters */
export function applyFilters(rows: GSTReportRow[], filters: GSTReportFilters): GSTReportRow[] {
  return rows.filter((row) => {
    // Document type
    if (filters.documentType && filters.documentType !== "All") {
      if (filters.documentType === "Invoices Only (Sales)" && row.documentType !== "Invoice") return false;
      if (filters.documentType === "Credit Notes Only (Returns)" && row.documentType !== "Credit Note") return false;
    }

    // Customer state
    if (filters.customerState && filters.customerState !== "All") {
      if (row.statePOS !== filters.customerState) return false;
    }

    // Payment method
    if (filters.paymentMethod && filters.paymentMethod !== "All") {
      if (row.paymentMode !== filters.paymentMethod) return false;
    }

    // Payment type (COD vs Prepaid)
    if (filters.paymentType && filters.paymentType !== "All") {
      const isCOD = row.paymentMode === "Cash";
      if (filters.paymentType === "COD" && !isCOD) return false;
      if (filters.paymentType === "Prepaid" && isCOD) return false;
    }

    return true;
  });
}
