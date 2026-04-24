/**
 * Utility to format dates consistently across the application.
 * Standardizes to DD/MM/YY format as per user requirements.
 */
export const formatDate = (dateStr) => {
    if (!dateStr || dateStr === "N/A" || dateStr === "-") return "-";
    try {
        const date = new Date(dateStr);
        if (isNaN(date.getTime())) return dateStr;
        
        const d = String(date.getDate()).padStart(2, '0');
        const m = String(date.getMonth() + 1).padStart(2, '0');
        // Get last two digits of year
        const y = String(date.getFullYear()).slice(-2);
        
        return `${d}/${m}/${y}`;
    } catch (e) {
        return dateStr;
    }
};
