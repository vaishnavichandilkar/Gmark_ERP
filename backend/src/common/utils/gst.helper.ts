/**
 * GST Helper Utility
 * Centralized GST logic for both Sales Invoice and Purchase Invoice modules.
 *
 * Rules:
 *   Sales  : GST applicable ONLY if User (seller) has a valid GST number.
 *   Purchase: GST applicable ONLY if Supplier has a valid GST number.
 *
 *   If applicable, compare state codes (first 2 digits of GST number):
 *     Same state  → CGST (50%) + SGST (50%)
 *     Diff state  → IGST (100%)
 *
 *   Fallback when GST numbers are missing/invalid: compare state names.
 */

/** Map of Indian GST state codes → state names */
export const GST_STATE_CODES: Record<string, string> = {
  '01': 'Jammu And Kashmir',
  '02': 'Himachal Pradesh',
  '03': 'Punjab',
  '04': 'Chandigarh',
  '05': 'Uttarakhand',
  '06': 'Haryana',
  '07': 'Delhi',
  '08': 'Rajasthan',
  '09': 'Uttar Pradesh',
  '10': 'Bihar',
  '11': 'Sikkim',
  '12': 'Arunachal Pradesh',
  '13': 'Nagaland',
  '14': 'Manipur',
  '15': 'Mizoram',
  '16': 'Tripura',
  '17': 'Meghalaya',
  '18': 'Assam',
  '19': 'West Bengal',
  '20': 'Jharkhand',
  '21': 'Odisha',
  '22': 'Chattisgarh',
  '23': 'Madhya Pradesh',
  '24': 'Gujarat',
  '25': 'Daman And Diu',
  '26': 'Dadra And Nagar Haveli And Daman And Diu',
  '27': 'Maharashtra',
  '28': 'Andhra Pradesh',
  '29': 'Karnataka',
  '30': 'Goa',
  '31': 'Lakshadweep',
  '32': 'Kerala',
  '33': 'Tamil Nadu',
  '34': 'Puducherry',
  '35': 'Andaman And Nicobar Islands',
  '36': 'Telangana',
  '37': 'Andhra Pradesh (New)',
  '38': 'Ladakh',
  '97': 'Other Territory',
  '99': 'Centre Jurisdiction',
};

/**
 * Validate a GST number.
 * A valid GST number must be ≥ 15 characters (standard) and not a placeholder like 'N/A'.
 * We accept ≥ 10 chars as a pragmatic lower bound (to tolerate minor data issues).
 */
export function isValidGst(gst: string | null | undefined): boolean {
  if (!gst) return false;
  const trimmed = gst.trim().toUpperCase();
  if (trimmed === 'N/A' || trimmed === 'NOT AVAILABLE' || trimmed === '-') return false;
  if (trimmed.length < 10) return false;
  return true;
}

/**
 * Extract the 2-digit state code from a GST number.
 * Returns null if the GST is invalid or the code is not numeric.
 */
export function extractStateCode(gst: string | null | undefined): string | null {
  if (!isValidGst(gst)) return null;
  const code = gst!.trim().substring(0, 2);
  return /^\d{2}$/.test(code) ? code : null;
}

/**
 * Get the state name from a GST number.
 * Returns null if the code cannot be determined.
 */
export function getStateFromGst(gst: string | null | undefined): string | null {
  const code = extractStateCode(gst);
  if (!code) return null;
  return GST_STATE_CODES[code] || null;
}

export type GstType = 'CGST_SGST' | 'IGST' | 'NONE';

export interface GstResult {
  /** CGST_SGST → intra-state, IGST → inter-state, NONE → not applicable */
  gstType: GstType;
  isInterState: boolean;
  cgstAmount: number;
  sgstAmount: number;
  igstAmount: number;
  totalGstAmount: number;
  taxableAmount: number;
  finalInvoiceAmount: number;
}

/**
 * Determine GST type and compute tax amounts for a Sales Invoice.
 *
 * @param userGst         Seller's (user/company) GST number
 * @param customerGst   Customer's GST number (may be null/undefined for non-GST customers)
 * @param userState     Seller's state name (fallback when GST code unavailable)
 * @param customerState Customer's state name (fallback)
 * @param taxableAmount Total taxable base amount (material + direct expenses)
 * @param totalGstPercent The total GST percentage (e.g., 18 for 18%)
 */
export function determineSalesGst(
  userGst: string | null | undefined,
  customerGst: string | null | undefined,
  userState: string,
  customerState: string,
  taxableAmount: number,
  totalGstPercent: number = 0,
  preCalculatedTaxAmount?: number
): GstResult {
  // Rule: Apply GST only if User (seller) has a valid GST number
  if (!isValidGst(userGst)) {
    return buildNoneResult(taxableAmount);
  }

  const taxAmount = preCalculatedTaxAmount !== undefined 
    ? preCalculatedTaxAmount 
    : (taxableAmount * totalGstPercent) / 100;

  return splitTaxAmount(userGst, customerGst, userState, customerState, taxAmount, taxableAmount);
}

export function determinePurchaseGst(
  supplierGst: string | null | undefined,
  userGst: string | null | undefined,
  userState: string,
  supplierState: string,
  taxableAmount: number,
  totalGstPercent: number = 0,
  preCalculatedTaxAmount?: number
): GstResult {
  // Rule: Apply GST only if Supplier has a valid GST number
  if (!isValidGst(supplierGst)) {
    return buildNoneResult(taxableAmount);
  }

  const taxAmount = preCalculatedTaxAmount !== undefined 
    ? preCalculatedTaxAmount 
    : (taxableAmount * totalGstPercent) / 100;

  return splitTaxAmount(userGst, supplierGst, userState, supplierState, taxAmount, taxableAmount);
}

// ─── Private helpers ──────────────────────────────────────────────────────────

function computeGst(
  gst1: string | null | undefined,
  gst2: string | null | undefined,
  state1: string,
  state2: string,
  taxableAmount: number,
  totalGstPercent: number
): GstResult {
  const code1 = extractStateCode(gst1);
  const code2 = extractStateCode(gst2);

  let isInterState: boolean;

  if (code1 && code2) {
    // Primary comparison: state codes from GST numbers
    isInterState = code1 !== code2;
  } else {
    // Fallback: compare state names (case-insensitive)
    isInterState =
      (state1 || '').trim().toLowerCase() !== (state2 || '').trim().toLowerCase();
  }

  const totalTaxAmount = (taxableAmount * totalGstPercent) / 100;

  if (isInterState) {
    return {
      gstType: 'IGST',
      isInterState: true,
      cgstAmount: 0,
      sgstAmount: 0,
      igstAmount: totalTaxAmount,
      totalGstAmount: totalTaxAmount,
      taxableAmount,
      finalInvoiceAmount: taxableAmount + totalTaxAmount,
    };
  } else {
    const half = totalTaxAmount / 2;
    return {
      gstType: 'CGST_SGST',
      isInterState: false,
      cgstAmount: half,
      sgstAmount: half,
      igstAmount: 0,
      totalGstAmount: totalTaxAmount,
      taxableAmount,
      finalInvoiceAmount: taxableAmount + totalTaxAmount,
    };
  }
}

function buildNoneResult(taxableAmount: number): GstResult {
  return {
    gstType: 'NONE',
    isInterState: false,
    cgstAmount: 0,
    sgstAmount: 0,
    igstAmount: 0,
    totalGstAmount: 0,
    taxableAmount,
    finalInvoiceAmount: taxableAmount,
  };
}

/**
 * Split a pre-calculated tax amount into CGST/SGST or IGST based on GST numbers or states.
 */
export function splitTaxAmount(
  gst1: string | null | undefined,
  gst2: string | null | undefined,
  state1: string,
  state2: string,
  totalTaxAmount: number,
  baseAmount: number
): GstResult {
  const code1 = extractStateCode(gst1);
  const code2 = extractStateCode(gst2);

  let isInterState: boolean;

  if (code1 && code2) {
    isInterState = code1 !== code2;
  } else {
    isInterState = (state1 || '').trim().toLowerCase() !== (state2 || '').trim().toLowerCase();
  }

  if (isInterState) {
    return {
      gstType: 'IGST',
      isInterState: true,
      cgstAmount: 0,
      sgstAmount: 0,
      igstAmount: totalTaxAmount,
      totalGstAmount: totalTaxAmount,
      taxableAmount: baseAmount,
      finalInvoiceAmount: baseAmount + totalTaxAmount,
    };
  } else {
    const half = totalTaxAmount / 2;
    return {
      gstType: 'CGST_SGST',
      isInterState: false,
      cgstAmount: half,
      sgstAmount: half,
      igstAmount: 0,
      totalGstAmount: totalTaxAmount,
      taxableAmount: baseAmount,
      finalInvoiceAmount: baseAmount + totalTaxAmount,
    };
  }
}
