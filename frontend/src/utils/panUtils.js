/**
 * Utility functions for PAN Card validation and input formatting.
 *
 * Validation Rules:
 * 1. PAN must contain exactly 10 characters.
 * 2. Format: AAAAA9999A
 *    - Characters 1–5: Uppercase English letters (A–Z).
 *    - Characters 6–9: Digits (0–9).
 *    - Character 10: Uppercase English letter (A–Z).
 * 3. 4th character must be validated according to PAN holder type:
 *    - P = Individual
 *    - C = Company
 *    - H = HUF
 *    - F = Firm / LLP
 *    For an Individual seller/buyer, the 4th character must be P.
 * 4. Automatically convert entered PAN to uppercase.
 * 5. Do not allow spaces, special characters, or invalid characters.
 */

// Mapping of PAN holder types to their required 4th character
export const PAN_HOLDER_TYPES = {
  INDIVIDUAL: 'P',
  COMPANY: 'C',
  HUF: 'H',
  FIRM: 'F',
  LLP: 'F',
};

/**
 * Sanitizes input string for PAN field:
 * - Automatically converts entered characters to UPPERCASE.
 * - Disallows spaces, special characters, or invalid characters (only A-Z and 0-9 allowed).
 * - Truncates to max 10 characters.
 *
 * @param {string} value
 * @returns {string}
 */
export function sanitizePanInput(value) {
  if (!value) return '';
  return String(value)
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, 10);
}

/**
 * Validates a PAN card string according to Income Tax Department PAN rules.
 *
 * @param {string} pan - The PAN string to validate.
 * @param {string|null} holderType - Optional holder type ('INDIVIDUAL' | 'COMPANY' | 'HUF' | 'FIRM' | 'LLP' | 'P' | 'C' | 'H' | 'F' | string).
 * @param {boolean} required - Whether PAN is mandatory (default: true).
 * @returns {{ isValid: boolean, error: string | null }}
 */
export function validatePan(pan, holderType = null, required = true) {
  if (!pan || !String(pan).trim()) {
    if (!required) return { isValid: true, error: null };
    return { isValid: false, error: 'PAN number is required.' };
  }

  const rawPan = String(pan).trim();

  // Check for spaces or special characters in the raw input
  if (/[^A-Za-z0-9]/.test(rawPan)) {
    return { isValid: false, error: 'Spaces and special characters are not allowed in PAN.' };
  }

  const upperPan = rawPan.toUpperCase();

  // Rule 1: PAN must contain exactly 10 characters.
  if (upperPan.length !== 10) {
    return { isValid: false, error: 'PAN must contain exactly 10 characters.' };
  }

  // Rule 2 & Format check: AAAAA9999A
  // Characters 1–5: uppercase letters (A–Z)
  const first5 = upperPan.substring(0, 5);
  if (!/^[A-Z]{5}$/.test(first5)) {
    return { isValid: false, error: 'First 5 characters of PAN must be uppercase English letters (A–Z).' };
  }

  // Characters 6–9: digits (0–9)
  const next4Digits = upperPan.substring(5, 9);
  if (!/^[0-9]{4}$/.test(next4Digits)) {
    return { isValid: false, error: 'Characters 6–9 of PAN must be digits (0–9).' };
  }

  // Character 10: uppercase letter (A–Z)
  const lastChar = upperPan.charAt(9);
  if (!/^[A-Z]$/.test(lastChar)) {
    return { isValid: false, error: '10th character of PAN must be an uppercase English letter (A–Z).' };
  }

  // Rule 3: 4th character validation (P = Individual, C = Company, H = HUF, F = Firm/LLP)
  const fourthChar = upperPan.charAt(3);
  const validFourthChars = ['P', 'C', 'H', 'F'];

  if (!validFourthChars.includes(fourthChar)) {
    return {
      isValid: false,
      error: 'Invalid 4th character in PAN. Must be P (Individual), C (Company), H (HUF), or F (Firm/LLP).',
    };
  }

  // Check holder type specific matching if provided
  if (holderType) {
    const normalizedType = String(holderType).trim().toUpperCase();

    if (normalizedType === 'INDIVIDUAL' || normalizedType === 'P' || normalizedType.includes('INDIVIDUAL')) {
      if (fourthChar !== 'P') {
        return { isValid: false, error: 'For an Individual seller/buyer, the 4th character of PAN must be P.' };
      }
    } else if (normalizedType === 'COMPANY' || normalizedType === 'C') {
      if (fourthChar !== 'C') {
        return { isValid: false, error: 'For a Company, the 4th character of PAN must be C.' };
      }
    } else if (normalizedType === 'HUF' || normalizedType === 'H') {
      if (fourthChar !== 'H') {
        return { isValid: false, error: 'For HUF, the 4th character of PAN must be H.' };
      }
    } else if (normalizedType === 'FIRM' || normalizedType === 'LLP' || normalizedType === 'F') {
      if (fourthChar !== 'F') {
        return { isValid: false, error: 'For a Firm / LLP, the 4th character of PAN must be F.' };
      }
    }
  }

  return { isValid: true, error: null };
}

/**
 * Boolean helper for quick PAN validity check.
 *
 * @param {string} pan
 * @param {string|null} holderType
 * @returns {boolean}
 */
export function isValidPan(pan, holderType = null) {
  return validatePan(pan, holderType, true).isValid;
}
