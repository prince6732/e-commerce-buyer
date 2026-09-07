export interface TaxSource {
  hsn?: string | null;
  cgst?: string | number | null;
  sgst?: string | number | null;
  igst?: string | number | null;
  gstRate?: string | number | null;
  tax_rate?: string | number | null;
  taxRate?: string | number | null;
  category?: {
    hsn?: string | null;
    cgst?: string | number | null;
    sgst?: string | number | null;
    igst?: string | number | null;
    gstRate?: string | number | null;
    tax_rate?: string | number | null;
    parent?: {
      hsn?: string | null;
      cgst?: string | number | null;
      sgst?: string | number | null;
      igst?: string | number | null;
    } | null;
  } | null;
}

export interface TaxCalculationResult {
  hsn: string | null;
  taxRate: string;
  taxableAmount: string;
  taxAmount: string;
  cgstRate: string;
  cgstAmount: string;
  sgstRate: string;
  sgstAmount: string;
  igstRate: string;
  igstAmount: string;
  isLocal: boolean;
}

export const HOME_STATE = 'Haryana';

export const INDIAN_STATES = [
  'Andaman and Nicobar Islands',
  'Andhra Pradesh',
  'Arunachal Pradesh',
  'Assam',
  'Bihar',
  'Chandigarh',
  'Chhattisgarh',
  'Dadra and Nagar Haveli and Daman and Diu',
  'Delhi',
  'Goa',
  'Gujarat',
  'Haryana',
  'Himachal Pradesh',
  'Jammu and Kashmir',
  'Jharkhand',
  'Karnataka',
  'Kerala',
  'Ladakh',
  'Lakshadweep',
  'Madhya Pradesh',
  'Maharashtra',
  'Manipur',
  'Meghalaya',
  'Mizoram',
  'Nagaland',
  'Odisha',
  'Puducherry',
  'Punjab',
  'Rajasthan',
  'Sikkim',
  'Tamil Nadu',
  'Telangana',
  'Tripura',
  'Uttar Pradesh',
  'Uttarakhand',
  'West Bengal',
];

export function extractState(address: string | any): string {
  if (!address) return 'Unknown';
  let addrStr = '';
  if (typeof address === 'string') {
    try {
      const parsed = JSON.parse(address);
      if (typeof parsed === 'object' && parsed !== null) {
        if (parsed.state) return String(parsed.state).trim();
        addrStr = Object.values(parsed).join(' ');
      } else {
        addrStr = address;
      }
    } catch {
      addrStr = address;
    }
  } else if (typeof address === 'object' && address !== null) {
    if (address.state) return String(address.state).trim();
    addrStr = Object.values(address).join(' ');
  }

  const lower = addrStr.toLowerCase();
  for (const s of INDIAN_STATES) {
    if (lower.includes(s.toLowerCase())) return s;
  }
  const parts = addrStr.split(',').map((p) => p.trim());
  return parts.length >= 2 ? parts[parts.length - 2] || 'Unknown' : 'Unknown';
}

export function isLocalState(address: string | any): boolean {
  const state = extractState(address);
  return state.toLowerCase().includes(HOME_STATE.toLowerCase());
}

export function round2(num: number): number {
  return Math.round((num + Number.EPSILON) * 100) / 100;
}

export function calculateItemTax(
  source: TaxSource | null | undefined,
  grossAmount: number,
  shippingAddress?: string | any,
): TaxCalculationResult {
  // 1. Resolve HSN
  const hsn =
    source?.hsn ||
    source?.category?.hsn ||
    source?.category?.parent?.hsn ||
    null;

  // 2. Resolve Tax Rates
  const rawCgst = source?.cgst ?? source?.category?.cgst ?? source?.category?.parent?.cgst ?? null;
  const rawSgst = source?.sgst ?? source?.category?.sgst ?? source?.category?.parent?.sgst ?? null;
  const rawIgst = source?.igst ?? source?.category?.igst ?? source?.category?.parent?.igst ?? null;
  const rawGstRate =
    source?.gstRate ??
    source?.tax_rate ??
    source?.taxRate ??
    source?.category?.gstRate ??
    source?.category?.tax_rate ??
    null;

  const cgstVal = rawCgst !== null && rawCgst !== undefined && rawCgst !== '' ? parseFloat(String(rawCgst)) : null;
  const sgstVal = rawSgst !== null && rawSgst !== undefined && rawSgst !== '' ? parseFloat(String(rawSgst)) : null;
  const igstVal = rawIgst !== null && rawIgst !== undefined && rawIgst !== '' ? parseFloat(String(rawIgst)) : null;
  const gstRateVal = rawGstRate !== null && rawGstRate !== undefined && rawGstRate !== '' ? parseFloat(String(rawGstRate)) : null;

  let totalRate = 18.0;
  if (igstVal !== null && !isNaN(igstVal) && igstVal > 0) {
    totalRate = igstVal;
  } else if (cgstVal !== null && sgstVal !== null && (!isNaN(cgstVal) || !isNaN(sgstVal))) {
    totalRate = (cgstVal || 0) + (sgstVal || 0);
  } else if (gstRateVal !== null && !isNaN(gstRateVal) && gstRateVal > 0) {
    totalRate = gstRateVal;
  }

  // 3. Inclusive Tax Breakdown
  const taxable = round2(grossAmount / (1 + totalRate / 100));
  const totalTax = round2(grossAmount - taxable);

  const local = isLocalState(shippingAddress);

  if (local) {
    // Delhi intra-state: CGST (50%) + SGST (50%), IGST = 0
    const halfRate = round2(totalRate / 2);
    const halfTax = round2(totalTax / 2);
    const otherHalfTax = round2(totalTax - halfTax);

    return {
      hsn: hsn ? String(hsn).trim() : null,
      taxRate: totalRate.toFixed(2),
      taxableAmount: taxable.toFixed(2),
      taxAmount: totalTax.toFixed(2),
      cgstRate: (cgstVal !== null && !isNaN(cgstVal) ? cgstVal : halfRate).toFixed(2),
      cgstAmount: halfTax.toFixed(2),
      sgstRate: (sgstVal !== null && !isNaN(sgstVal) ? sgstVal : halfRate).toFixed(2),
      sgstAmount: otherHalfTax.toFixed(2),
      igstRate: '0.00',
      igstAmount: '0.00',
      isLocal: true,
    };
  } else {
    // Inter-state: IGST = 100%, CGST = 0, SGST = 0
    return {
      hsn: hsn ? String(hsn).trim() : null,
      taxRate: totalRate.toFixed(2),
      taxableAmount: taxable.toFixed(2),
      taxAmount: totalTax.toFixed(2),
      cgstRate: '0.00',
      cgstAmount: '0.00',
      sgstRate: '0.00',
      sgstAmount: '0.00',
      igstRate: totalRate.toFixed(2),
      igstAmount: totalTax.toFixed(2),
      isLocal: false,
    };
  }
}
