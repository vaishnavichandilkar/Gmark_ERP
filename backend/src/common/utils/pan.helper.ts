/**
 * Centralized PAN Validation Utility
 *
 * Rules:
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

export function sanitizePan(value: string | null | undefined): string {
  if (!value) return '';
  return String(value)
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, 10);
}

export interface PanValidationResult {
  isValid: boolean;
  error: string | null;
}

export function validatePan(
  pan: string | null | undefined,
  holderType?: string | null,
  required: boolean = true,
): PanValidationResult {
  if (!pan || !String(pan).trim()) {
    if (!required) return { isValid: true, error: null };
    return { isValid: false, error: 'PAN number is required' };
  }

  const rawPan = String(pan).trim();

  // Check for spaces or special characters
  if (/[^A-Za-z0-9]/.test(rawPan)) {
    return { isValid: false, error: 'Spaces and special characters are not allowed in PAN' };
  }

  const upperPan = rawPan.toUpperCase();

  // 1. PAN length must be exactly 10 characters
  if (upperPan.length !== 10) {
    return { isValid: false, error: 'PAN must contain exactly 10 characters' };
  }

  // 2. Format checks: AAAAA9999A
  // Characters 1–5: uppercase letters (A–Z)
  if (!/^[A-Z]{5}$/.test(upperPan.substring(0, 5))) {
    return { isValid: false, error: 'Characters 1–5 of PAN must be uppercase English letters (A–Z)' };
  }

  // Characters 6–9: digits (0–9)
  if (!/^[0-9]{4}$/.test(upperPan.substring(5, 9))) {
    return { isValid: false, error: 'Characters 6–9 of PAN must be digits (0–9)' };
  }

  // Character 10: uppercase letter (A–Z)
  if (!/^[A-Z]$/.test(upperPan.charAt(9))) {
    return { isValid: false, error: '10th character of PAN must be an uppercase English letter (A–Z)' };
  }

  // 3. 4th character validation: P = Individual, C = Company, H = HUF, F = Firm / LLP
  const fourthChar = upperPan.charAt(3);
  const validFourthChars = ['P', 'C', 'H', 'F'];

  if (!validFourthChars.includes(fourthChar)) {
    return {
      isValid: false,
      error: 'Invalid 4th character in PAN. Must be P (Individual), C (Company), H (HUF), or F (Firm/LLP)',
    };
  }

  if (holderType) {
    const normalizedType = String(holderType).trim().toUpperCase();

    if (normalizedType === 'INDIVIDUAL' || normalizedType === 'P' || normalizedType.includes('INDIVIDUAL')) {
      if (fourthChar !== 'P') {
        return { isValid: false, error: 'For an Individual seller/buyer, the 4th character of PAN must be P' };
      }
    } else if (normalizedType === 'COMPANY' || normalizedType === 'C') {
      if (fourthChar !== 'C') {
        return { isValid: false, error: 'For a Company, the 4th character of PAN must be C' };
      }
    } else if (normalizedType === 'HUF' || normalizedType === 'H') {
      if (fourthChar !== 'H') {
        return { isValid: false, error: 'For HUF, the 4th character of PAN must be H' };
      }
    } else if (normalizedType === 'FIRM' || normalizedType === 'LLP' || normalizedType === 'F') {
      if (fourthChar !== 'F') {
        return { isValid: false, error: 'For a Firm / LLP, the 4th character of PAN must be F' };
      }
    }
  }

  return { isValid: true, error: null };
}

export function isValidPan(pan: string | null | undefined, holderType?: string | null): boolean {
  return validatePan(pan, holderType, true).isValid;
}
