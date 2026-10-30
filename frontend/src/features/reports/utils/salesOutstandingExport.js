import * as XLSX from 'xlsx';
import html2pdf from 'html2pdf.js';

/**
 * Sanitizes cell values to prevent formula injection in CSV / Excel exports
 */
const sanitizeCellValue = (val) => {
  if (val === null || val === undefined) return '';
  const str = String(val);
  if (/^[=+@-]/.test(str)) {
    return `'${str}`;
  }
  return str;
};

const formatCurrencyNumber = (val) => {
  return Number(val || 0).toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
};

/**
 * Export Sales Outstanding Summary to Excel (.xlsx)
 */
export const exportSalesOutstandingSummaryToExcel = ({
  data = [],
  summary = {},
  asOnDate = '',
}) => {
  const wb = XLSX.utils.book_new();

  // --- SHEET 1: SUMMARY & ACCOUNTS ---
  const rows = [
    ['SALES OUTSTANDING SUMMARY REPORT'],
    ['As On Date:', asOnDate || new Date().toISOString().slice(0, 10)],
    ['Generated On:', new Date().toLocaleString('en-IN')],
    [''],
    ['METRIC SUMMARY'],
    ['Total Accounts Selected', summary.totalAccounts || data.length || 0],
    ['Total Invoiced Amount (₹)', formatCurrencyNumber(summary.totalInvoiced)],
    ['Total Paid Amount (₹)', formatCurrencyNumber(summary.totalPaid)],
    ['Total Outstanding Amount (₹)', formatCurrencyNumber(summary.totalOutstanding)],
    [''],
    [
      'SR NO',
      'ACCOUNT (CUSTOMER NAME)',
      'CUSTOMER CODE',
      'ACCOUNT GROUP',
      'INVOICE AMOUNT (₹)',
      'PAID AMOUNT (₹)',
      'OUTSTANDING AMOUNT (₹)',
    ],
  ];

  data.forEach((row, idx) => {
    rows.push([
      idx + 1,
      sanitizeCellValue(row.accountName),
      sanitizeCellValue(row.customerCode || '—'),
      sanitizeCellValue(Array.isArray(row.groupName) ? row.groupName.join(', ') : row.groupName || '—'),
      Number(row.invoiceAmount || 0),
      Number(row.paidAmount || 0),
      Number(row.outstandingAmount || 0),
    ]);
  });

  // Footer Total Row
  rows.push([
    'TOTAL',
    '',
    '',
    '',
    Number(summary.totalInvoiced || data.reduce((s, r) => s + Number(r.invoiceAmount || 0), 0)),
    Number(summary.totalPaid || data.reduce((s, r) => s + Number(r.paidAmount || 0), 0)),
    Number(summary.totalOutstanding || data.reduce((s, r) => s + Number(r.outstandingAmount || 0), 0)),
  ]);

  const ws = XLSX.utils.aoa_to_sheet(rows);
  ws['!cols'] = [
    { wch: 8 },
    { wch: 32 },
    { wch: 16 },
    { wch: 22 },
    { wch: 20 },
    { wch: 18 },
    { wch: 22 },
  ];

  XLSX.utils.book_append_sheet(wb, ws, 'Outstanding Summary');

  const filename = `Sales_Outstanding_Summary_${asOnDate || new Date().toISOString().slice(0, 10)}.xlsx`;
  XLSX.writeFile(wb, filename);
};

/**
 * Export Customer Outstanding Aging Breakdown to Excel (.xlsx)
 */
export const exportSalesOutstandingAgingToExcel = ({
  data = [],
  summary = {},
  asOnDate = '',
  companyName = 'A G CORPORATION',
  slabs = {
    belowDays: 30,
    slab1Min: 30,
    slab1Max: 44,
    slab2Min: 45,
    slab2Max: 59,
    slab3Min: 60,
    slab3Max: 89,
    aboveDays: 90,
  },
}) => {
  const wb = XLSX.utils.book_new();

  const slabBelowLabel = `< ${slabs.belowDays} days`;
  const slab1Label = `${slabs.slab1Min} to ${slabs.slab1Max} days`;
  const slab2Label = `${slabs.slab2Min} to ${slabs.slab2Max} days`;
  const slab3Label = `${slabs.slab3Min} to ${slabs.slab3Max} days`;
  const slabAboveLabel = `≥ ${slabs.aboveDays} days`;

  // --- SHEET 1: AGING MATRIX ---
  const matrixRows = [
    [companyName || 'A G CORPORATION'],
    [`Customer Outstanding as on ${asOnDate || new Date().toISOString().slice(0, 10)}`],
    ['Generated On:', new Date().toLocaleString('en-IN')],
    [''],
    [
      'Account',
      'MSME',
      'Reg Type',
      slabBelowLabel,
      slab1Label,
      slab2Label,
      slab3Label,
      slabAboveLabel,
      'Total',
    ],
  ];

  data.forEach((row) => {
    matrixRows.push([
      sanitizeCellValue(row.displayName || row.accountName),
      row.msmeStatus || (row.msmeEnabled ? 'Yes' : 'No'),
      row.regType || '—',
      row.belowDaysAmount ? Number(row.belowDaysAmount) : '',
      row.slab1Amount ? Number(row.slab1Amount) : '',
      row.slab2Amount ? Number(row.slab2Amount) : '',
      row.slab3Amount ? Number(row.slab3Amount) : '',
      row.aboveDaysAmount ? Number(row.aboveDaysAmount) : '',
      Number(row.totalAgingOutstanding ?? row.outstandingAmount ?? 0),
    ]);
  });

  const agingTotals = summary.agingTotals || {
    belowDays: data.reduce((s, r) => s + Number(r.belowDaysAmount || 0), 0),
    slab1: data.reduce((s, r) => s + Number(r.slab1Amount || 0), 0),
    slab2: data.reduce((s, r) => s + Number(r.slab2Amount || 0), 0),
    slab3: data.reduce((s, r) => s + Number(r.slab3Amount || 0), 0),
    aboveDays: data.reduce((s, r) => s + Number(r.aboveDaysAmount || 0), 0),
    grandTotal: data.reduce((s, r) => s + Number(r.totalAgingOutstanding || r.outstandingAmount || 0), 0),
  };

  // Summary Row
  matrixRows.push([
    'Total',
    '',
    '',
    Number(agingTotals.belowDays || 0),
    Number(agingTotals.slab1 || 0),
    Number(agingTotals.slab2 || 0),
    Number(agingTotals.slab3 || 0),
    Number(agingTotals.aboveDays || 0),
    Number(agingTotals.grandTotal || summary.totalOutstanding || 0),
  ]);

  const wsMatrix = XLSX.utils.aoa_to_sheet(matrixRows);
  wsMatrix['!cols'] = [
    { wch: 38 },
    { wch: 12 },
    { wch: 16 },
    { wch: 18 },
    { wch: 18 },
    { wch: 18 },
    { wch: 18 },
    { wch: 18 },
    { wch: 22 },
  ];
  XLSX.utils.book_append_sheet(wb, wsMatrix, 'Customer Aging');

  // --- SHEET 2: INVOICE BREAKDOWN ---
  const invoiceRows = [
    ['INVOICE-LEVEL AGING BREAKDOWN'],
    ['As On Date:', asOnDate || new Date().toISOString().slice(0, 10)],
    [''],
    [
      'ACCOUNT NAME',
      'CUSTOMER CODE',
      'INVOICE NUMBER',
      'INVOICE DATE',
      'DUE DATE',
      'CREDIT DAYS',
      'DAYS OVERDUE',
      'AGING BUCKET',
      'INVOICE AMOUNT (₹)',
      'PAID AMOUNT (₹)',
      'OUTSTANDING AMOUNT (₹)',
      'STATUS',
    ],
  ];

  data.forEach((acc) => {
    (acc.invoices || []).forEach((inv) => {
      invoiceRows.push([
        sanitizeCellValue(acc.accountName),
        sanitizeCellValue(acc.customerCode || '—'),
        sanitizeCellValue(inv.invoiceNumber),
        inv.invoiceDate || '—',
        inv.dueDate || '—',
        inv.creditDays ?? 0,
        inv.daysOverdue ?? 0,
        inv.agingBucket || '—',
        Number(inv.grandTotal || 0),
        Number(inv.paidAmount || 0),
        Number(inv.outstandingAmount || 0),
        inv.status || 'GENERATED',
      ]);
    });
  });

  const wsInvoices = XLSX.utils.aoa_to_sheet(invoiceRows);
  wsInvoices['!cols'] = [
    { wch: 26 },
    { wch: 16 },
    { wch: 20 },
    { wch: 14 },
    { wch: 14 },
    { wch: 12 },
    { wch: 14 },
    { wch: 16 },
    { wch: 18 },
    { wch: 16 },
    { wch: 22 },
    { wch: 14 },
  ];
  XLSX.utils.book_append_sheet(wb, wsInvoices, 'Invoice Details');

  const filename = `Customer_Outstanding_Aging_${asOnDate || new Date().toISOString().slice(0, 10)}.xlsx`;
  XLSX.writeFile(wb, filename);
};

/**
 * Export HTML element to PDF
 */
export const exportSalesOutstandingToPDF = ({
  elementId,
  filename = 'Sales_Outstanding_Report.pdf',
}) => {
  const element = document.getElementById(elementId);
  if (!element) {
    console.error('Printable element not found for PDF export:', elementId);
    return;
  }

  const opt = {
    margin: [8, 8, 8, 8],
    filename,
    image: { type: 'jpeg', quality: 0.98 },
    html2canvas: { scale: 2, useCORS: true, logging: false, backgroundColor: '#ffffff' },
    jsPDF: { unit: 'mm', format: 'a4', orientation: 'landscape' },
    pagebreak: { mode: ['avoid-all', 'css', 'legacy'] },
  };

  html2pdf().set(opt).from(element).save();
};
