/**
 * Utility to format dates consistently across the application.
 * Standardizes to DD/MM/YYYY format.
 */

export const isLeapYear = (year) => {
    return (year % 4 === 0 && year % 100 !== 0) || (year % 400 === 0);
};

export const isValidDDMMYYYY = (dateStr) => {
    if (!dateStr) return false;
    const regex = /^\d{2}\/\d{2}\/\d{4}$/;
    if (!regex.test(dateStr)) return false;
    
    const [dayStr, monthStr, yearStr] = dateStr.split('/');
    const day = parseInt(dayStr, 10);
    const month = parseInt(monthStr, 10);
    const year = parseInt(yearStr, 10);
    
    if (isNaN(day) || isNaN(month) || isNaN(year)) return false;
    if (year < 1000 || year > 9999) return false;
    if (month < 1 || month > 12) return false;
    
    const maxDays = [31, isLeapYear(year) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
    
    if (day < 1 || day > maxDays[month - 1]) return false;
    return true;
};

export const toDisplayDate = (dateStr) => {
    if (!dateStr) return "";
    
    let date;
    if (dateStr instanceof Date) {
        date = dateStr;
    } else {
        const str = String(dateStr).trim();
        if (/^\d{2}\/\d{2}\/\d{4}$/.test(str)) {
            return str;
        }
        date = new Date(str);
    }
    
    if (isNaN(date.getTime())) return "";
    
    const d = String(date.getDate()).padStart(2, '0');
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const y = String(date.getFullYear());
    return `${d}/${m}/${y}`;
};

export const toIsoDate = (dateStr) => {
    if (!dateStr) return "";
    const str = String(dateStr).trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(str)) {
        return str;
    }
    const separator = str.includes('-') ? '-' : '/';
    const parts = str.split(separator);
    if (parts.length === 3) {
        if (parts[2].length === 4) {
            const day = parts[0].padStart(2, '0');
            const month = parts[1].padStart(2, '0');
            const year = parts[2];
            return `${year}-${month}-${day}`;
        } else if (parts[0].length === 4) {
            const year = parts[0];
            const month = parts[1].padStart(2, '0');
            const day = parts[2].padStart(2, '0');
            return `${year}-${month}-${day}`;
        }
    }
    try {
        const d = new Date(str);
        if (!isNaN(d.getTime())) {
            return d.toISOString().split('T')[0];
        }
    } catch (e) {}
    return "";
};

export const formatDate = (dateStr) => {
    if (!dateStr || dateStr === "N/A" || dateStr === "-") return "-";
    try {
        let date;
        if (dateStr instanceof Date) {
            date = dateStr;
        } else {
            const str = String(dateStr).trim();
            if (/^\d{2}\/\d{2}\/\d{4}$/.test(str)) return str;
            if (/^\d{2}\/\d{2}\/\d{2}$/.test(str)) {
                const parts = str.split('/');
                return `${parts[0]}/${parts[1]}/20${parts[2]}`;
            }
            date = new Date(str);
        }
        if (isNaN(date.getTime())) return dateStr;
        
        const d = String(date.getDate()).padStart(2, '0');
        const m = String(date.getMonth() + 1).padStart(2, '0');
        const y = String(date.getFullYear());
        
        return `${d}/${m}/${y}`;
    } catch (e) {
        return dateStr;
    }
};
