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
 * Professional Multi-Sheet Excel Export (.xlsx)
 */
export const exportCustomerSalesToExcel = ({
  groups = [],
  summary = {},
  filterInfo = {},
  periodLabel = '',
}) => {
  const wb = XLSX.utils.book_new();

  // --- SHEET 1: SUMMARY ---
  const summaryRows = [
    ['ADVANCED CUSTOMER SALES ANALYTICS REPORT'],
    ['Report Period:', periodLabel || 'All Time'],
    ['Generated On:', new Date().toLocaleString('en-IN')],
    [''],
    ['KEY PERFORMANCE INDICATORS (KPIs)'],
    ['Metric', 'Value'],
    ['Total Customers with Sales', summary.totalCustomers || 0],
    ['Total Sales Amount (Net)', formatCurrencyNumber(summary.totalSales)],
    ['Total Sales Orders', summary.totalOrders || 0],
    ['Average Order Value (AOV)', formatCurrencyNumber(summary.averageOrderValue)],
    ['Repeat Customers', summary.repeatCustomers || 0],
    ['New Customers', summary.newCustomers || 0],
    [''],
    ['CUSTOMER TYPE BREAKDOWN'],
    ['Customer Type', 'Customer Count', 'Total Orders', 'Total Sales Amount (₹)'],
  ];

  groups.forEach((g) => {
    summaryRows.push([
      g.customerTypeLabel,
      g.totalCustomers,
      g.totalOrders,
      g.totalSales,
    ]);
  });

  const wsSummary = XLSX.utils.aoa_to_sheet(summaryRows);
  wsSummary['!cols'] = [{ wch: 32 }, { wch: 25 }, { wch: 18 }, { wch: 24 }];
  XLSX.utils.book_append_sheet(wb, wsSummary, 'Summary');

  // --- SHEET 2: CUSTOMER DETAILS ---
  const detailRows = [
    [
      'SR NO',
      'CUSTOMER NAME',
      'CUSTOMER CODE',
      'CUSTOMER TYPE',
      'TOTAL ORDERS',
      'GROSS SALES (₹)',
      'DISCOUNTS (₹)',
      'TAX AMOUNT (₹)',
      'RETURNS / REFUNDS (₹)',
      'NET SALES (₹)',
      'AVERAGE ORDER VALUE (₹)',
      'LAST PURCHASE DATE',
    ],
  ];

  let srNo = 1;
  groups.forEach((g) => {
    (g.customers || []).forEach((c) => {
      detailRows.push([
        srNo++,
        sanitizeCellValue(c.customerName),
        sanitizeCellValue(c.customerCode),
        sanitizeCellValue(c.customerTypeLabel),
        c.totalOrders || 0,
        c.grossSales || 0,
        c.discounts || 0,
        c.taxAmount || 0,
        c.returnsRefunds || 0,
        c.netSales || 0,
        c.averageOrderValue || 0,
        c.lastPurchaseDate || 'N/A',
      ]);
    });
  });

  // Grand Total Row
  detailRows.push([
    '',
    'GRAND TOTAL',
    '',
    '',
    summary.totalOrders || 0,
    groups.reduce((sum, g) => sum + (g.customers || []).reduce((cSum, c) => cSum + (c.grossSales || 0), 0), 0),
    groups.reduce((sum, g) => sum + (g.customers || []).reduce((cSum, c) => cSum + (c.discounts || 0), 0), 0),
    groups.reduce((sum, g) => sum + (g.customers || []).reduce((cSum, c) => cSum + (c.taxAmount || 0), 0), 0),
    0,
    summary.totalSales || 0,
    summary.averageOrderValue || 0,
    '',
  ]);

  const wsDetails = XLSX.utils.aoa_to_sheet(detailRows);
  wsDetails['!cols'] = [
    { wch: 8 },
    { wch: 30 },
    { wch: 18 },
    { wch: 22 },
    { wch: 14 },
    { wch: 18 },
    { wch: 16 },
    { wch: 16 },
    { wch: 22 },
    { wch: 18 },
    { wch: 24 },
    { wch: 20 },
  ];
  XLSX.utils.book_append_sheet(wb, wsDetails, 'Customer Details');

  // --- SHEET 3: MONTHLY SALES MATRIX (if customer monthly data present) ---
  const allCustomers = groups.flatMap((g) => g.customers || []);
  if (allCustomers.length > 0 && allCustomers[0]?.monthlySales?.length > 0) {
    const monthHeaders = (allCustomers[0].monthlySales || []).map((m) => m.monthLabel);
    const matrixHeader = ['CUSTOMER NAME', 'CUSTOMER CODE', 'CUSTOMER TYPE', ...monthHeaders, 'TOTAL (₹)'];
    const matrixRows = [matrixHeader];

    allCustomers.forEach((c) => {
      const row = [
        sanitizeCellValue(c.customerName),
        sanitizeCellValue(c.customerCode),
        sanitizeCellValue(c.customerTypeLabel),
      ];
      (c.monthlySales || []).forEach((m) => {
        row.push(m.salesAmount || 0);
      });
      row.push(c.netSales || 0);
      matrixRows.push(row);
    });

    const wsMatrix = XLSX.utils.aoa_to_sheet(matrixRows);
    wsMatrix['!cols'] = [{ wch: 28 }, { wch: 16 }, { wch: 20 }, ...monthHeaders.map(() => ({ wch: 14 })), { wch: 18 }];
    XLSX.utils.book_append_sheet(wb, wsMatrix, 'Monthly Matrix');
  }

  const filename = `Customer_Sales_Report_${new Date().toISOString().slice(0, 10)}.xlsx`;
  XLSX.writeFile(wb, filename);
};

/**
 * Clean UTF-8 CSV Export (.csv)
 */
export const exportCustomerSalesToCSV = ({
  groups = [],
  periodLabel = '',
}) => {
  const headers = [
    'Customer Name',
    'Customer Code',
    'Customer Type',
    'Total Orders',
    'Gross Sales (INR)',
    'Discounts (INR)',
    'Tax Amount (INR)',
    'Returns / Refunds (INR)',
    'Net Sales (INR)',
    'Average Order Value (INR)',
    'Last Purchase Date',
  ];

  const rows = [];
  groups.forEach((g) => {
    (g.customers || []).forEach((c) => {
      rows.push([
        `"${sanitizeCellValue(c.customerName).replace(/"/g, '""')}"`,
        `"${sanitizeCellValue(c.customerCode).replace(/"/g, '""')}"`,
        `"${sanitizeCellValue(c.customerTypeLabel).replace(/"/g, '""')}"`,
        c.totalOrders || 0,
        (c.grossSales || 0).toFixed(2),
        (c.discounts || 0).toFixed(2),
        (c.taxAmount || 0).toFixed(2),
        (c.returnsRefunds || 0).toFixed(2),
        (c.netSales || 0).toFixed(2),
        (c.averageOrderValue || 0).toFixed(2),
        `"${c.lastPurchaseDate || 'N/A'}"`,
      ]);
    });
  });

  const csvContent = '\uFEFF' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\r\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `Customer_Sales_Report_${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};

/**
 * Professional Printable PDF Export (.pdf)
 */
export const exportCustomerSalesToPDF = ({
  elementId = 'customer-sales-report-table-printable',
  reportTitle = 'Customer Sales Report',
}) => {
  const element =
    document.getElementById(elementId) ||
    document.getElementById('customer-sales-report-table-printable') ||
    document.getElementById('customer-sales-report-printable');
  if (!element) {
    console.error('Printable element not found for PDF export:', elementId);
    return;
  }

  const opt = {
    margin: [8, 8, 8, 8],
    filename: `Customer_Sales_Report_${new Date().toISOString().slice(0, 10)}.pdf`,
    image: { type: 'jpeg', quality: 0.98 },
    html2canvas: { scale: 2, useCORS: true, logging: false, backgroundColor: '#ffffff' },
    jsPDF: { unit: 'mm', format: 'a4', orientation: 'landscape' },
    pagebreak: { mode: ['avoid-all', 'css', 'legacy'] },
  };

  html2pdf().set(opt).from(element).save();
};
