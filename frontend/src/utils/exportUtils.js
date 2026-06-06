import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';

export const exportToPDF = (title, columns, data, filename, customDoc = null) => {
    // Landscape Mode helps fit large tables (as Account Master does)
    const doc = customDoc || new jsPDF({ orientation: 'landscape' });
    const pageWidth = doc.internal.pageSize.getWidth();

    const now = new Date();
    const pad = (n) => n.toString().padStart(2, '0');
    const hours = now.getHours();
    const ampm = hours >= 12 ? 'pm' : 'am';
    const formattedHours = hours % 12 || 12;
    const timestamp = `${pad(now.getDate())}/${pad(now.getMonth() + 1)}/${now.getFullYear()}, ${pad(formattedHours)}:${pad(now.getMinutes())}:${pad(now.getSeconds())} ${ampm}`;

    // 1. "ERP" Main Title
    doc.setFontSize(18);
    doc.setFont("helvetica", "bold");
    doc.text("ERP", pageWidth / 2, 15, { align: "center" });

    // 2. Report Subtitle
    if (title) {
        doc.setFontSize(14);
        doc.setFont("helvetica", "normal");
        doc.text(title, pageWidth / 2, 23, { align: "center" });
    }

    // 3. Exported On Timestamp
    doc.setFontSize(10);
    doc.text(`Exported on: ${timestamp}`, pageWidth - 14, 31, { align: "right" });

    autoTable(doc, {
        startY: 35,
        head: columns ? [columns] : undefined,
        body: data,
        theme: 'grid',
        showHead: 'everyPage',
        headStyles: { fillColor: '#4472C4', textColor: '#FFFFFF', fontStyle: 'bold' },
        alternateRowStyles: { fillColor: '#F2F2F2' },
        styles: { fontSize: 8, font: 'helvetica' }
    });

    doc.save(filename);
};

export const exportToExcel = (data, sheetName, filename) => {
    const now = new Date();
    const pad = (n) => n.toString().padStart(2, '0');
    const hours = now.getHours();
    const ampm = hours >= 12 ? 'pm' : 'am';
    const formattedHours = hours % 12 || 12;
    const timestamp = `${pad(now.getDate())}/${pad(now.getMonth() + 1)}/${now.getFullYear()}, ${pad(formattedHours)}:${pad(now.getMinutes())}:${pad(now.getSeconds())} ${ampm}`;

    const numCols = data.length > 0 ? Object.keys(data[0]).length : 1;

    // Create Worksheet and inject Data at Row 5
    const ws = XLSX.utils.json_to_sheet(data, { origin: "A5" });

    // Freeze top 5 rows (ERP Title, Report subtitle, Timestamp, spacing, and header row)
    ws['!views'] = [
        { state: 'frozen', ySplit: 5 }
    ];

    // Prepend Titles & Timestamps
    XLSX.utils.sheet_add_aoa(ws, [
        ["ERP"],
        [`${sheetName} Report`],
        [`Exported on: ${timestamp}`],
        []
    ], { origin: "A1" });

    // Merge Cells across all width columns for titles
    if (!ws["!merges"]) ws["!merges"] = [];
    ws["!merges"].push({ s: { r: 0, c: 0 }, e: { r: 0, c: Math.max(0, numCols - 1) } });
    ws["!merges"].push({ s: { r: 1, c: 0 }, e: { r: 1, c: Math.max(0, numCols - 1) } });
    ws["!merges"].push({ s: { r: 2, c: 0 }, e: { r: 2, c: Math.max(0, numCols - 1) } });

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, sheetName);
    XLSX.writeFile(wb, filename);
};
