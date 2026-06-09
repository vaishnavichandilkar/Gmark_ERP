/**
 * GST Helper Utility (Frontend)
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

export const GST_STATE_CODES = {
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
export function isValidGst(gst) {
  if (!gst) return false;
  const trimmed = String(gst).trim().toUpperCase();
  if (trimmed === 'N/A' || trimmed === 'NOT AVAILABLE' || trimmed === '-') return false;
  if (trimmed.length < 10) return false;
  return true;
}

/**
 * Extract the 2-digit state code from a GST number.
 * Returns null if the GST is invalid or the code is not numeric.
 */
export function extractStateCode(gst) {
  if (!isValidGst(gst)) return null;
  const code = String(gst).trim().substring(0, 2);
  return /^\d{2}$/.test(code) ? code : null;
}

/**
 * Get the state name from a GST number.
 * Returns null if the code cannot be determined.
 */
export function getStateFromGst(gst) {
  const code = extractStateCode(gst);
  if (!code) return null;
  return GST_STATE_CODES[code] || null;
}

function buildNoneResult() {
  return {
    gstType: 'NONE',
    gstRate: 0,
    cgstPercent: 0,
    sgstPercent: 0,
    igstPercent: 0,
    cgstAmount: 0,
    sgstAmount: 0,
    igstAmount: 0,
    totalGstAmount: 0,
    finalAmount: 0,
  };
}

/**
 * Split a pre-calculated tax amount into CGST/SGST or IGST based on GST numbers or states.
 */
export function splitTaxAmount(gst1, gst2, state1, state2, totalTaxAmount, baseAmount, totalGstPercent) {
  const code1 = extractStateCode(gst1);
  const code2 = extractStateCode(gst2);

  let isInterState;

  if (code1 && code2) {
    isInterState = code1 !== code2;
  } else if ((code1 && !code2) || (!code1 && code2)) {
    // RULE 4: If only ONE GST Number is available, assume Intrastate
    isInterState = false;
  } else {
    isInterState = (state1 || '').trim().toLowerCase() !== (state2 || '').trim().toLowerCase();
  }

  if (isInterState) {
    return {
      gstType: 'IGST',
      gstRate: totalGstPercent,
      cgstPercent: 0,
      sgstPercent: 0,
      igstPercent: totalGstPercent,
      cgstAmount: 0,
      sgstAmount: 0,
      igstAmount: totalTaxAmount,
      totalGstAmount: totalTaxAmount,
      finalAmount: baseAmount + totalTaxAmount,
    };
  } else {
    const halfTax = totalTaxAmount / 2;
    const halfPct = totalGstPercent / 2;
    return {
      gstType: 'CGST_SGST',
      gstRate: totalGstPercent,
      cgstPercent: halfPct,
      sgstPercent: halfPct,
      igstPercent: 0,
      cgstAmount: halfTax,
      sgstAmount: halfTax,
      igstAmount: 0,
      totalGstAmount: totalTaxAmount,
      finalAmount: baseAmount + totalTaxAmount,
    };
  }
}

/**
 * Determine GST type and compute tax amounts for a Sales Invoice.
 *
 * @param {string} userGst Seller's (user/company) GST number
 * @param {string} customerGst Customer's GST number (may be null/undefined for non-GST customers)
 * @param {string} userState Seller's state name (fallback when GST code unavailable)
 * @param {string} customerState Customer's state name (fallback)
 * @param {number} taxableAmount Total taxable base amount
 * @param {number} totalGstPercent The total GST percentage
 * @param {number} preCalculatedTaxAmount Optional pre-calculated tax amount
 */
export function determineSalesGst(userGst, customerGst, userState, customerState, taxableAmount, totalGstPercent = 0, preCalculatedTaxAmount = undefined) {
  // Rule: Apply GST only if User (seller) has a valid GST number
  if (!isValidGst(userGst)) {
    return buildNoneResult();
  }

  const taxAmount = preCalculatedTaxAmount !== undefined 
    ? preCalculatedTaxAmount 
    : (taxableAmount * totalGstPercent) / 100;

  return splitTaxAmount(userGst, customerGst, userState, customerState, taxAmount, taxableAmount, totalGstPercent);
}

/**
 * Determine GST type and compute tax amounts for a Purchase Invoice/GRN.
 *
 * @param {string} supplierGst Supplier's GST number
 * @param {string} userGst Buyer's (user/company) GST number
 * @param {string} userState Buyer's state name (fallback)
 * @param {string} supplierState Supplier's state name (fallback)
 * @param {number} taxableAmount Total taxable base amount
 * @param {number} totalGstPercent The total GST percentage
 * @param {number} preCalculatedTaxAmount Optional pre-calculated tax amount
 */
export function determinePurchaseGst(supplierGst, userGst, userState, supplierState, taxableAmount, totalGstPercent = 0, preCalculatedTaxAmount = undefined) {
  // Rule: Apply GST only if Supplier has a valid GST number
  if (!isValidGst(supplierGst)) {
    return buildNoneResult();
  }

  const taxAmount = preCalculatedTaxAmount !== undefined 
    ? preCalculatedTaxAmount 
    : (taxableAmount * totalGstPercent) / 100;

  return splitTaxAmount(userGst, supplierGst, userState, supplierState, taxAmount, taxableAmount, totalGstPercent);
}
