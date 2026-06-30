/**
 * Central utility for date formatting and parsing on the backend.
 * All user-facing exports (PDF, Excel) must strictly format dates as DD/MM/YYYY.
 * Excel imports and service layer operations should utilize parseDDMMYYYY to safely parse dates.
 */

export function formatDate(date: Date | string | number | null | undefined): string {
  if (date === null || date === undefined || date === 'N/A' || date === '-') return '-';
  try {
    let d: Date;
    if (date instanceof Date) {
      d = date;
    } else {
      const str = String(date).trim();
      if (!str) return '-';
      if (/^\d{2}\/\d{2}\/\d{4}$/.test(str)) return str;
      d = new Date(str);
    }
    if (isNaN(d.getTime())) return '-';
    
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = String(d.getFullYear());
    return `${day}/${month}/${year}`;
  } catch (e) {
    return '-';
  }
}

export function parseDDMMYYYY(dateStr: any): Date | null {
  if (dateStr === null || dateStr === undefined) return null;
  if (dateStr instanceof Date) {
    return isNaN(dateStr.getTime()) ? null : dateStr;
  }
  
  const str = String(dateStr).trim();
  if (!str) return null;
  
  // Check if it's Excel serialized date number (e.g. 45293)
  if (/^\d+(\.\d+)?$/.test(str)) {
    const serial = parseFloat(str);
    // Excel serial date starts on 1900-01-01
    // 25569 is Unix epoch offset (1970-01-01)
    const utcDays = serial - 25569;
    const d = new Date(Math.round(utcDays * 86400 * 1000));
    if (!isNaN(d.getTime())) {
      return d;
    }
  }
  
  // DD/MM/YYYY or D/M/YYYY (supports slash or dash separators)
  const dmyRegex = /^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/;
  const dmyMatch = str.match(dmyRegex);
  if (dmyMatch) {
    const day = parseInt(dmyMatch[1], 10);
    const month = parseInt(dmyMatch[2], 10) - 1; // 0-indexed
    const year = parseInt(dmyMatch[3], 10);
    const d = new Date(year, month, day);
    if (!isNaN(d.getTime()) && d.getDate() === day && d.getMonth() === month && d.getFullYear() === year) {
      return d;
    }
    return null;
  }
  
  // YYYY-MM-DD or YYYY/MM/DD
  const ymdRegex = /^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})$/;
  const ymdMatch = str.match(ymdRegex);
  if (ymdMatch) {
    const year = parseInt(ymdMatch[1], 10);
    const month = parseInt(ymdMatch[2], 10) - 1;
    const day = parseInt(ymdMatch[3], 10);
    const d = new Date(year, month, day);
    if (!isNaN(d.getTime()) && d.getDate() === day && d.getMonth() === month && d.getFullYear() === year) {
      return d;
    }
    return null;
  }
  
  const parsed = new Date(str);
  if (!isNaN(parsed.getTime())) return parsed;
  
  return null;
}
