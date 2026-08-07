import * as ExcelJS from 'exceljs';

// ============================================================================
// TYPES & INTERFACES (PURCHASE DOCUMENTS)
// ============================================================================

export type ProcurementModuleType = 'PI' | 'PO' | 'GRN';

export interface ValidationError {
  row_number: number;
  column_name: string;
  error_reason: string;
}

export interface CalculationResult {
  lineSubtotal: number;
  discountAmount: number;
  netLineTotal: number;
}

export interface BaseParsedItem extends CalculationResult {
  productName: string;
  qty: number;
  rate: number;
  discountAmountInput: number;
  discountPercentInput: number;
}

export interface ParsedPurchaseInvoiceItem extends BaseParsedItem {
  invoiceNo: string;
  invoiceDate: string;
  bookingDate: string;
  supplierName: string;
  poNumber?: string;
  grnNumber?: string;
}

export interface ParsedPurchaseOrderItem extends BaseParsedItem {
  poNumber: string;
  poDate: string;
  poExpiryDate: string;
  supplierName: string;
}

export interface ParsedGRNItem extends BaseParsedItem {
  grnNo: string;
  grnDate: string;
  poNo?: string;
  supplierName: string;
}

// ============================================================================
// COMPUTATION ENGINE
// ============================================================================

export function calculateLineTotal(qty: number, rate: number, discountAmt: number = 0, discountPct: number = 0): CalculationResult {
  const lineSubtotal = qty * rate;
  const pctDiscount = lineSubtotal * (discountPct / 100);
  const totalDiscount = discountAmt + pctDiscount;
  const netLineTotal = Math.max(0, lineSubtotal - totalDiscount);

  return {
    lineSubtotal: Number(lineSubtotal.toFixed(2)),
    discountAmount: Number(totalDiscount.toFixed(2)),
    netLineTotal: Number(netLineTotal.toFixed(2)),
  };
}

// Helper to validate YYYY-MM-DD date strings
export function isValidDate(dateStr: any): boolean {
  if (!dateStr) return false;
  if (dateStr instanceof Date) return !isNaN(dateStr.getTime());
  const str = String(dateStr).trim();
  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
  if (!dateRegex.test(str)) return false;
  const d = new Date(str);
  return !isNaN(d.getTime());
}

export function formatDateStr(dateVal: any): string {
  if (!dateVal) return '';
  if (dateVal instanceof Date) {
    return dateVal.toISOString().split('T')[0];
  }
  const str = String(dateVal).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) return str;
  const parsed = new Date(str);
  if (!isNaN(parsed.getTime())) {
    return parsed.toISOString().split('T')[0];
  }
  return str;
}

// ============================================================================
// ============================================================================
// HELPER TO STYLE REQUIRED COLUMNS AS RED IN EXCEL
// ============================================================================

export function styleHeaderRow(ws: ExcelJS.Worksheet, headers: string[]) {
  const headerRow = ws.getRow(1);
  headerRow.height = 28;
  headers.forEach((headerText, index) => {
    const cell = headerRow.getCell(index + 1);
    const isRequired = headerText.includes('*');
    cell.value = headerText;
    cell.font = {
      bold: true,
      color: { argb: isRequired ? 'FF9F1239' : 'FF334155' }, // Deep crimson for required (*), Slate for optional
      size: 11,
      name: 'Calibri'
    };
    cell.alignment = { vertical: 'middle', horizontal: 'center' };
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: isRequired ? 'FFFEE2E2' : 'FFF8FAFC' }, // Ultra-light soft red (#FEE2E2) for required (*), Off-white (#F8FAFC) for optional
    };
    cell.border = {
      top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
      left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
      bottom: { style: 'medium', color: { argb: isRequired ? 'FFFECDD3' : 'FFE2E8F0' } },
      right: { style: 'thin', color: { argb: 'FFE2E8F0' } },
    };
  });
}

// ============================================================================
// SAMPLE FILE GENERATORS
// ============================================================================

export async function generatePISampleExcel(): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  const ws = workbook.addWorksheet('Purchase Invoice Sample');
  ws.views = [{ state: 'frozen', ySplit: 1 }];

  const headers = [
    'Invoice No*',
    'Invoice Date*',
    'Booking Date*',
    'Supplier Name*',
    'PO Number',
    'GRN Number',
    'Product Name*',
    'Qty*',
    'Rate*',
    'Discount (Amount)',
    'Discount (%)',
  ];

  styleHeaderRow(ws, headers);
  ws.columns = headers.map(() => ({ width: 22 }));

  const today = new Date().toISOString().split('T')[0];
  ws.addRow([
    'INV-2026-001',
    today,
    today,
    'Sample Supplier',
    'PO-2026-001',
    'GRN-2026-001',
    'Sample Product SKU',
    10,
    150,
    0,
    5,
  ]);

  return Buffer.from(await workbook.xlsx.writeBuffer());
}

export async function generatePOSampleExcel(): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  const ws = workbook.addWorksheet('Purchase Order Sample');
  ws.views = [{ state: 'frozen', ySplit: 1 }];

  const headers = [
    'PO Number*',
    'PO Date*',
    'PO Expiry Date*',
    'Supplier Name*',
    'Product Name*',
    'Qty*',
    'Rate*',
    'Discount (Amount)',
    'Discount (%)',
  ];

  styleHeaderRow(ws, headers);
  ws.columns = headers.map(() => ({ width: 22 }));

  const today = new Date();
  const poDateStr = today.toISOString().split('T')[0];
  const expDate = new Date(Date.now() + 30 * 86400000);
  const expDateStr = expDate.toISOString().split('T')[0];

  ws.addRow([
    'PO-2026-001',
    poDateStr,
    expDateStr,
    'Sample Supplier',
    'Sample Product SKU',
    20,
    250,
    50,
    0,
  ]);

  return Buffer.from(await workbook.xlsx.writeBuffer());
}

export async function generateGRNSampleExcel(): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  const ws = workbook.addWorksheet('GRN Sample');
  ws.views = [{ state: 'frozen', ySplit: 1 }];

  const headers = [
    'GRN No*',
    'GRN Date*',
    'PO NO',
    'Supplier Name*',
    'Product Name*',
    'Qty*',
    'Rate*',
    'Discount (Amount)',
    'Discount (%)',
  ];

  styleHeaderRow(ws, headers);
  ws.columns = headers.map(() => ({ width: 22 }));

  const today = new Date().toISOString().split('T')[0];
  ws.addRow([
    'GRN-2026-001',
    today,
    'PO-2026-001',
    'Sample Supplier',
    'Sample Product SKU',
    15,
    180,
    0,
    2,
  ]);

  return Buffer.from(await workbook.xlsx.writeBuffer());
}

// ============================================================================
// ROW VALIDATOR & PARSER ENGINE
// ============================================================================

export function validateAndParseRow(
  type: ProcurementModuleType,
  row: Record<string, any>,
  rowNum: number,
  masterData: {
    suppliers: Set<string>;
    products: Set<string>;
    poNumbers?: Set<string>;
    grnNumbers?: Set<string>;
  }
): { valid: true; parsed: any } | { valid: false; errors: ValidationError[] } {
  const errors: ValidationError[] = [];

  const getVal = (keys: string[]): any => {
    for (const k of keys) {
      for (const rk of Object.keys(row)) {
        if (rk.toLowerCase().replace(/[^a-z0-9]/g, '') === k.toLowerCase().replace(/[^a-z0-9]/g, '')) {
          const v = row[rk];
          if (v !== undefined && v !== null && String(v).trim() !== '') {
            return v;
          }
        }
      }
    }
    return null;
  };

  const getNum = (keys: string[], defaultVal: number = 0): number => {
    const raw = getVal(keys);
    if (raw === null || raw === undefined || String(raw).trim() === '') return defaultVal;
    const n = parseFloat(String(raw).replace(/[^0-9.-]/g, ''));
    return isNaN(n) ? defaultVal : n;
  };

  // Master validations
  const supplierName = String(getVal(['Supplier Name', 'SupplierName', 'Supplier']) || '').trim();
  if (!supplierName) {
    errors.push({ row_number: rowNum, column_name: 'Supplier Name', error_reason: 'Supplier Name is required' });
  } else if (masterData.suppliers.size > 0 && !masterData.suppliers.has(supplierName.toLowerCase())) {
    errors.push({ row_number: rowNum, column_name: 'Supplier Name', error_reason: `Supplier '${supplierName}' does not exist in Supplier Master` });
  }

  const productName = String(getVal(['Product Name', 'ProductName', 'Product']) || '').trim();
  if (!productName) {
    errors.push({ row_number: rowNum, column_name: 'Product Name', error_reason: 'Product Name is required' });
  } else if (masterData.products.size > 0 && !masterData.products.has(productName.toLowerCase())) {
    errors.push({ row_number: rowNum, column_name: 'Product Name', error_reason: `Product '${productName}' does not exist in Product Master` });
  }

  const qty = getNum(['Qty', 'Quantity'], -1);
  if (qty <= 0) {
    errors.push({ row_number: rowNum, column_name: 'Qty', error_reason: 'Qty must be a numeric value strictly greater than 0' });
  }

  const rate = getNum(['Rate', 'Price', 'UnitPrice'], -1);
  if (rate < 0) {
    errors.push({ row_number: rowNum, column_name: 'Rate', error_reason: 'Rate must be a non-negative numeric value (>= 0)' });
  }

  const discountAmountInput = getNum(['Discount (Amount)', 'Discount Amount', 'DiscountAmt'], 0);
  if (discountAmountInput < 0) {
    errors.push({ row_number: rowNum, column_name: 'Discount (Amount)', error_reason: 'Discount Amount must be non-negative (>= 0)' });
  }

  const discountPercentInput = getNum(['Discount (%)', 'Discount %', 'DiscountPercent'], 0);
  if (discountPercentInput < 0 || discountPercentInput > 100) {
    errors.push({ row_number: rowNum, column_name: 'Discount (%)', error_reason: 'Discount (%) must be between 0 and 100' });
  }

  const calc = calculateLineTotal(qty, rate, discountAmountInput, discountPercentInput);

  if (type === 'PI') {
    const invoiceNo = String(getVal(['Invoice No', 'Invoice Number', 'InvoiceNo', 'Supplier Invoice No']) || '').trim();
    if (!invoiceNo) {
      errors.push({ row_number: rowNum, column_name: 'Invoice No', error_reason: 'Invoice No is required' });
    }

    const rawInvDate = getVal(['Invoice Date', 'InvoiceDate', 'Supplier Invoice Date']);
    const invoiceDate = formatDateStr(rawInvDate);
    if (!isValidDate(invoiceDate)) {
      errors.push({ row_number: rowNum, column_name: 'Invoice Date', error_reason: 'Invoice Date is required and must be in YYYY-MM-DD format' });
    }

    const rawBookingDate = getVal(['Booking Date', 'BookingDate']);
    const bookingDate = formatDateStr(rawBookingDate);
    if (!isValidDate(bookingDate)) {
      errors.push({ row_number: rowNum, column_name: 'Booking Date', error_reason: 'Booking Date is required and must be in YYYY-MM-DD format' });
    }

    const poNumber = String(getVal(['PO Number', 'PONumber', 'PO No', 'PONO']) || '').trim() || undefined;
    if (poNumber && masterData.poNumbers && masterData.poNumbers.size > 0 && !masterData.poNumbers.has(poNumber.toLowerCase())) {
      errors.push({ row_number: rowNum, column_name: 'PO Number', error_reason: `Referenced PO Number '${poNumber}' does not exist` });
    }

    const grnNumber = String(getVal(['GRN Number', 'GRNNumber', 'GRN No', 'GRNNo']) || '').trim() || undefined;
    if (grnNumber && masterData.grnNumbers && masterData.grnNumbers.size > 0 && !masterData.grnNumbers.has(grnNumber.toLowerCase())) {
      errors.push({ row_number: rowNum, column_name: 'GRN Number', error_reason: `Referenced GRN Number '${grnNumber}' does not exist` });
    }

    if (errors.length > 0) return { valid: false, errors };

    const parsed: ParsedPurchaseInvoiceItem = {
      invoiceNo,
      invoiceDate,
      bookingDate,
      supplierName,
      poNumber,
      grnNumber,
      productName,
      qty,
      rate,
      discountAmountInput,
      discountPercentInput,
      ...calc,
    };
    return { valid: true, parsed };

  } else if (type === 'PO') {
    const poNumber = String(getVal(['PO Number', 'PONumber', 'PO No']) || '').trim();
    if (!poNumber) {
      errors.push({ row_number: rowNum, column_name: 'PO Number', error_reason: 'PO Number is required' });
    }

    const rawPoDate = getVal(['PO Date', 'PODate']);
    const poDate = formatDateStr(rawPoDate);
    if (!isValidDate(poDate)) {
      errors.push({ row_number: rowNum, column_name: 'PO Date', error_reason: 'PO Date is required and must be in YYYY-MM-DD format' });
    }

    const rawPoExpDate = getVal(['PO Expiry Date', 'POExpiryDate', 'Expiry Date']);
    const poExpiryDate = formatDateStr(rawPoExpDate);
    if (!isValidDate(poExpiryDate)) {
      errors.push({ row_number: rowNum, column_name: 'PO Expiry Date', error_reason: 'PO Expiry Date is required and must be in YYYY-MM-DD format' });
    } else if (isValidDate(poDate) && new Date(poExpiryDate) < new Date(poDate)) {
      errors.push({ row_number: rowNum, column_name: 'PO Expiry Date', error_reason: 'PO Expiry Date must be greater than or equal to PO Date' });
    }

    if (errors.length > 0) return { valid: false, errors };

    const parsed: ParsedPurchaseOrderItem = {
      poNumber,
      poDate,
      poExpiryDate,
      supplierName,
      productName,
      qty,
      rate,
      discountAmountInput,
      discountPercentInput,
      ...calc,
    };
    return { valid: true, parsed };

  } else if (type === 'GRN') {
    const grnNo = String(getVal(['GRN No', 'GRNNo', 'GRN Number']) || '').trim();
    if (!grnNo) {
      errors.push({ row_number: rowNum, column_name: 'GRN No', error_reason: 'GRN No is required' });
    }

    const rawGrnDate = getVal(['GRN Date', 'GRNDate']);
    const grnDate = formatDateStr(rawGrnDate);
    if (!isValidDate(grnDate)) {
      errors.push({ row_number: rowNum, column_name: 'GRN Date', error_reason: 'GRN Date is required and must be in YYYY-MM-DD format' });
    }

    const poNo = String(getVal(['PO NO', 'PONO', 'PO Number', 'PONumber']) || '').trim() || undefined;
    if (poNo && masterData.poNumbers && masterData.poNumbers.size > 0 && !masterData.poNumbers.has(poNo.toLowerCase())) {
      errors.push({ row_number: rowNum, column_name: 'PO NO', error_reason: `Referenced PO NO '${poNo}' does not exist` });
    }

    if (errors.length > 0) return { valid: false, errors };

    const parsed: ParsedGRNItem = {
      grnNo,
      grnDate,
      poNo,
      supplierName,
      productName,
      qty,
      rate,
      discountAmountInput,
      discountPercentInput,
      ...calc,
    };
    return { valid: true, parsed };
  }

  return { valid: false, errors: [{ row_number: rowNum, column_name: 'Document Type', error_reason: 'Unsupported document type' }] };
}
