/**
 * Serial Number and Package Number Utility for Manufacturer Module
 *
 * Provisional Format: YYMMDDNNNN-PP
 * - YY: 2-digit Year (e.g. 26)
 * - MM: 2-digit Month (01-12)
 * - DD: 2-digit Day (01-31)
 * - NNNN: 4-digit daily sequence per plant (0001 - 9999, overflow expands to 5+ digits)
 * - PP: 2-character Plant Code (e.g. AB)
 *
 * NOTE: This format is marked PROVISIONAL pending final business rule confirmation.
 */

export interface ParsedPackageNumber {
    year: number;          // Full 4-digit year (e.g. 2026)
    yearShort: string;     // 2-digit year string (e.g. "26")
    month: number;         // 1-12
    monthStr: string;      // 2-digit month string (e.g. "10")
    day: number;           // 1-31
    dayStr: string;        // 2-digit day string (e.g. "16")
    sequence: number;      // Integer sequence (e.g. 1, 9999, 10000)
    sequenceStr: string;   // Padded sequence string (e.g. "0001", "9999", "10000")
    plantCode: string;     // 2-character plant code (e.g. "AB")
    isOverflow: boolean;   // true if sequence > 9999
    raw: string;           // Original raw string
}

/**
 * Validates a plant code.
 * Standard rule: Exactly 2 uppercase alphanumeric characters (e.g. "AB", "P1").
 */
export function validatePlantCode(code: string): boolean {
    if (!code || typeof code !== 'string') return false;
    return /^[A-Z0-9]{2}$/.test(code.trim().toUpperCase());
}

/**
 * Checks if a daily sequence has exceeded the standard 4-digit limit (9999).
 */
export function isSequenceOverflow(sequence: number): boolean {
    return sequence > 9999;
}

/**
 * Formats a package serial number according to the provisional format YYMMDDNNNN-PP.
 *
 * @param date The weighing/capture date
 * @param sequence The allocated sequential integer (> 0)
 * @param plantCode The 2-character plant code
 * @returns The formatted package number (e.g. "2610160001-AB")
 */
export function formatPackageNumber(date: Date, sequence: number, plantCode: string): string {
    if (!date || !(date instanceof Date) || isNaN(date.getTime())) {
        throw new Error('Invalid capture date provided for package number generation');
    }

    if (!Number.isInteger(sequence) || sequence <= 0) {
        throw new Error(`Invalid sequence number: ${sequence}. Sequence must be a positive integer.`);
    }

    const cleanPlant = plantCode ? plantCode.trim().toUpperCase() : '';
    if (!validatePlantCode(cleanPlant)) {
        throw new Error(`Invalid plant code: "${plantCode}". Must be exactly 2 alphanumeric characters (e.g. "AB").`);
    }

    const yearFull = date.getFullYear();
    const yy = String(yearFull).slice(-2);
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    const dd = String(date.getDate()).padStart(2, '0');

    // Standard sequence is padded to at least 4 digits.
    // If sequence exceeds 9999 (e.g. 10000), it naturally expands.
    const nnnn = String(sequence).padStart(4, '0');

    return `${yy}${mm}${dd}${nnnn}-${cleanPlant}`;
}

/**
 * Parses and validates an existing package serial number.
 *
 * @param packageNumber The package number string (e.g. "2610160001-AB")
 * @returns Parsed package components or null if invalid
 */
export function parsePackageNumber(packageNumber: string): ParsedPackageNumber | null {
    if (!packageNumber || typeof packageNumber !== 'string') {
        return null;
    }

    const match = packageNumber.trim().toUpperCase().match(/^(\d{2})(\d{2})(\d{2})(\d{4,})-([A-Z0-9]{2})$/);
    if (!match) {
        return null;
    }

    const [, yyStr, mmStr, ddStr, seqStr, plantCode] = match;

    const shortYear = parseInt(yyStr, 10);
    const fullYear = 2000 + shortYear;
    const month = parseInt(mmStr, 10);
    const day = parseInt(ddStr, 10);
    const sequence = parseInt(seqStr, 10);

    // Validate calendar ranges
    if (month < 1 || month > 12) return null;
    if (day < 1 || day > 31) return null;

    // Check month-day validity (e.g. Feb 30 is invalid)
    const testDate = new Date(fullYear, month - 1, day);
    if (testDate.getFullYear() !== fullYear ||
        testDate.getMonth() !== (month - 1) ||
        testDate.getDate() !== day) {
        return null;
    }

    return {
        year: fullYear,
        yearShort: yyStr,
        month,
        monthStr: mmStr,
        day,
        dayStr: ddStr,
        sequence,
        sequenceStr: seqStr,
        plantCode,
        isOverflow: isSequenceOverflow(sequence),
        raw: packageNumber.trim().toUpperCase(),
    };
}

/**
 * Standardizes packaging timestamp to Indian Standard Time (Asia/Kolkata).
 * Output format: "23 Oct 2026, 03:15:30 PM"
 */
export function formatPackagingTimestamp(date: Date = new Date()): string {
    return new Intl.DateTimeFormat('en-IN', {
        timeZone: 'Asia/Kolkata',
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: true,
    }).format(date);
}
