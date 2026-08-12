import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { parseDDMMYYYY, formatDate } from '../../utils/dateFormatter';
import * as ExcelJS from 'exceljs';

export interface RowValidationError {
  row: number;
  documentNo?: string;
  partyName?: string;
  productName?: string;
  status: 'Failed';
  error: string;
}

export interface AccountMasterLookup {
  id: number;
  accountName: string;
  addressLine1: string;
  addressLine2?: string | null;
  gstNo?: string | null;
  panNo?: string | null;
  state?: string | null;
  supplierCreditDays?: number | null;
  customerCreditDays?: number | null;
  customerType?: string | null;
  supplierStatus?: string;
  customerStatus?: string;
  groupName?: string[];
  supplierCode?: string | null;
  customerCode?: string | null;
}

export interface ProductMasterLookup {
  id: number;
  product_name: string;
  product_code: string;
  description?: string | null;
  hsn_description?: string | null;
  hsn_code: string;
  tax_rate: number;
  uom: {
    unit_name: string;
  };
}

export type SupplierValidationResult =
  | { valid: true; error?: undefined; data: { id: number; name: string; creditDays: number; address: string; gstNo: string; panNo: string; state: string } }
  | { valid: false; error: string; data?: undefined };

export type CustomerValidationResult =
  | { valid: true; error?: undefined; data: { id: number; name: string; creditDays: number; address: string; gstNo: string; panNo: string; state: string; customerType?: string | null } }
  | { valid: false; error: string; data?: undefined };

export type ProductValidationResult =
  | { valid: true; error?: undefined; data: ProductMasterLookup }
  | { valid: false; error: string; data?: undefined };

export type DateValidationResult =
  | { valid: true; error?: undefined; date: Date }
  | { valid: false; error: string; date?: undefined };

export type DocNumberValidationResult =
  | { valid: true; error?: undefined }
  | { valid: false; error: string };

export type CustomerTypeValidationResult =
  | { valid: true; error?: undefined; isWritten: boolean }
  | { valid: false; error: string; isWritten?: undefined };

@Injectable()
export class ImportValidationService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Pre-loads Account Master records for Suppliers and Customers for a specific user
   */
  async fetchAccountMasterData(userId: number) {
    const accounts = await this.prisma.accountMaster.findMany({
      where: { userId, status: 'ACTIVE' },
    });

    const supplierMap = new Map<string, AccountMasterLookup>();
    const customerMap = new Map<string, AccountMasterLookup>();

    for (const acc of accounts) {
      const isSupplier =
        acc.supplierStatus === 'ACTIVE' ||
        (acc.groupName && acc.groupName.includes('SUNDRY_CREDITORS')) ||
        Boolean(acc.supplierCode);

      const isCustomer =
        acc.customerStatus === 'ACTIVE' ||
        (acc.groupName && acc.groupName.includes('SUNDRY_DEBTORS')) ||
        Boolean(acc.customerCode);

      const key = acc.accountName.toLowerCase().trim();
      if (isSupplier) supplierMap.set(key, acc as AccountMasterLookup);
      if (isCustomer) customerMap.set(key, acc as AccountMasterLookup);
    }

    return { supplierMap, customerMap };
  }

  /**
   * Pre-loads Product Master records for a specific user
   */
  async fetchProductMasterData(userId: number) {
    const products = await this.prisma.product.findMany({
      where: { created_by: userId, status: 'ACTIVE', is_deleted: false },
      include: { uom: true },
    });

    const productCodeMap = new Map<string, ProductMasterLookup>();
    const productNameMap = new Map<string, ProductMasterLookup>();

    for (const prod of products) {
      const codeKey = prod.product_code.toLowerCase().trim();
      const nameKey = prod.product_name.toLowerCase().trim();
      const lookup: ProductMasterLookup = {
        id: prod.id,
        product_name: prod.product_name,
        product_code: prod.product_code,
        description: prod.description,
        hsn_description: prod.hsn_description,
        hsn_code: prod.hsn_code,
        tax_rate: prod.tax_rate,
        uom: {
          unit_name: prod.uom?.unit_name || 'Nos',
        },
      };
      if (codeKey) productCodeMap.set(codeKey, lookup);
      if (nameKey) productNameMap.set(nameKey, lookup);
    }

    return { productCodeMap, productNameMap };
  }

  /**
   * Validates Supplier against Account Master
   */
  validateSupplier(
    supplierName: string,
    supplierMap: Map<string, AccountMasterLookup>,
    docType: string = 'Document'
  ): SupplierValidationResult {
    const rawName = String(supplierName || '').trim();
    if (!rawName) {
      return {
        valid: false,
        error: docType === 'PO' || docType === 'Purchase Order'
          ? "Supplier Name is required before importing the Purchase Order."
          : "Supplier Name is required."
      };
    }

    const matched = supplierMap.get(rawName.toLowerCase());
    if (!matched) {
      const docLabel = docType === 'PO' || docType === 'Purchase Order' ? 'Purchase Order' : docType;
      return {
        valid: false,
        error: docType === 'PO' || docType === 'Purchase Order'
          ? `Supplier '${rawName}' is not available in Account Master. Please add the supplier before importing the Purchase Order.`
          : `Supplier '${rawName}' is not available in Account Master. Please add the supplier in Account Master before importing this document.`
      };
    }

    const address = matched.addressLine1 + (matched.addressLine2 ? ', ' + matched.addressLine2 : '');
    return {
      valid: true,
      data: {
        id: matched.id,
        name: matched.accountName,
        creditDays: matched.supplierCreditDays || 0,
        address,
        gstNo: matched.gstNo || '',
        panNo: matched.panNo || '',
        state: matched.state || '',
      },
    };
  }

  /**
   * Validates Customer against Account Master
   */
  validateCustomer(
    customerName: string,
    customerMap: Map<string, AccountMasterLookup>,
    docType: string = 'Document'
  ): CustomerValidationResult {
    const rawName = String(customerName || '').trim();
    if (!rawName) {
      return {
        valid: false,
        error: docType === 'SO' || docType === 'Sales Order'
          ? "Customer Name is required before importing the Sales Order."
          : "Customer Name is required."
      };
    }

    const matched = customerMap.get(rawName.toLowerCase());
    if (!matched) {
      return {
        valid: false,
        error: docType === 'SO' || docType === 'Sales Order'
          ? `Customer '${rawName}' is not available in Account Master. Please add the customer before importing the Sales Order.`
          : `Customer '${rawName}' is not available in Account Master. Please add the customer in Account Master before importing this document.`
      };
    }

    const address = matched.addressLine1 + (matched.addressLine2 ? ', ' + matched.addressLine2 : '');
    return {
      valid: true,
      data: {
        id: matched.id,
        name: matched.accountName,
        creditDays: matched.customerCreditDays || 0,
        address,
        gstNo: matched.gstNo || '',
        panNo: matched.panNo || '',
        state: matched.state || '',
        customerType: matched.customerType || null,
      },
    };
  }

  /**
   * Validates Product against Product Master (and checks Name vs Code consistency)
   */
  validateProduct(
    productName: string,
    productCode: string | undefined | null,
    productCodeMap: Map<string, ProductMasterLookup>,
    productNameMap: Map<string, ProductMasterLookup>
  ): ProductValidationResult {
    const rawName = String(productName || '').trim();
    const rawCode = String(productCode || '').trim();

    if (!rawName && !rawCode) {
      return { valid: false, error: 'Product Name or Product Code is required.' };
    }

    let prodByCode: ProductMasterLookup | undefined;
    let prodByName: ProductMasterLookup | undefined;

    if (rawCode) {
      prodByCode = productCodeMap.get(rawCode.toLowerCase());
    }

    if (rawName) {
      prodByName = productNameMap.get(rawName.toLowerCase());
    }

    if (rawCode) {
      if (!prodByCode) {
        return {
          valid: false,
          error: `Product '${rawName}' / Product Code '${rawCode}' is not available in Product Master. Please add the product in Product Master before importing this document.`,
        };
      }
      if (rawName && prodByName && prodByCode.id !== prodByName.id) {
        return {
          valid: false,
          error: `Product Name '${rawName}' and Product Code '${rawCode}' do not match the same Product Master record.`,
        };
      }
      return { valid: true, data: prodByCode };
    }

    if (!prodByName) {
      return {
        valid: false,
        error: `Product '${rawName}' is not available in Product Master. Please add the product in Product Master before importing this document.`,
      };
    }

    return { valid: true, data: prodByName };
  }

  /**
   * Validates import date format (DD/MM/YYYY).
   * Note: Standard transaction date business rules (past dates, expiry sequence) are ignored during import.
   */
  validateImportDate(dateVal: any, fieldName: string): DateValidationResult {
    if (!dateVal && dateVal !== 0) {
      return { valid: false, error: `${fieldName} is required and must be in DD/MM/YYYY format.` };
    }

    const parsed = parseDDMMYYYY(dateVal);
    if (!parsed || isNaN(parsed.getTime())) {
      return { valid: false, error: `Invalid ${fieldName} format. Please use DD/MM/YYYY.` };
    }

    return { valid: true, date: parsed };
  }

  /**
   * Validates Document Number uniqueness against database and current file.
   */
  validateDocumentNumber(
    docType: string,
    docNumber: string,
    existingDbSet: Set<string>,
    fileSet: Set<string>,
    rowNum: number
  ): DocNumberValidationResult {
    const rawNo = String(docNumber || '').trim();
    if (!rawNo) {
      return { valid: false, error: `${docType} Number is required.` };
    }

    const key = rawNo.toLowerCase();

    if (existingDbSet.has(key)) {
      if (docType === 'PO' || docType === 'Purchase Order') {
        return { valid: false, error: `Purchase Order Number '${rawNo}' already exists. Please use a different PO Number.` };
      }
      return { valid: false, error: `${docType} Number '${rawNo}' already exists. Please use a unique document number.` };
    }

    if (fileSet.has(key)) {
      return { valid: false, error: `Duplicate ${docType} Number '${rawNo}' found in the uploaded file. It is already used in row ${rowNum}.` };
    }

    return { valid: true };
  }

  /**
   * Validates Customer Type rules for Sales Order
   */
  validateCustomerType(
    customerTypeFromMaster: string | null | undefined,
    poFields: {
      poNumber?: string;
      poDateStr?: string;
      poExpiryDateStr?: string;
      poAmtExclTaxStr?: string;
      poAmtInclTaxStr?: string;
    }
  ): CustomerTypeValidationResult {
    const custTypeStr = String(customerTypeFromMaster || '').trim().toLowerCase();
    const isWritten = custTypeStr === 'written';

    if (isWritten) {
      const hasDate = Boolean(poFields.poDateStr && poFields.poDateStr.trim());
      const hasExpDate = Boolean(poFields.poExpiryDateStr && poFields.poExpiryDateStr.trim());
      const hasAmtExcl = Boolean(poFields.poAmtExclTaxStr && poFields.poAmtExclTaxStr.trim());
      const hasAmtIncl = Boolean(poFields.poAmtInclTaxStr && poFields.poAmtInclTaxStr.trim());

      if (!hasDate || !hasExpDate || !hasAmtExcl || !hasAmtIncl) {
        return {
          valid: false,
          error: 'Customer Type is Written, so Customer PO Date, Customer PO Expiry Date, Customer PO Amount (Excl. Tax), and Customer PO Amount (Incl. Tax) are required.',
        };
      }
    }

    return { valid: true, isWritten };
  }

  /**
   * Universal GST Inter-State Determination Logic
   */
  determineIsInterState(
    userGst?: string | null,
    companyState?: string | null,
    partyGst?: string | null,
    partyState?: string | null
  ): boolean {
    const gstStateCodes: Record<string, string> = {
      '01': 'jammu and kashmir',
      '02': 'himachal pradesh',
      '03': 'punjab',
      '04': 'chandigarh',
      '05': 'uttarakhand',
      '06': 'haryana',
      '07': 'delhi',
      '08': 'rajasthan',
      '09': 'uttar pradesh',
      '10': 'bihar',
      '11': 'sikkim',
      '12': 'arunachal pradesh',
      '13': 'nagaland',
      '14': 'manipur',
      '15': 'mizoram',
      '16': 'tripura',
      '17': 'meghalaya',
      '18': 'assam',
      '19': 'west bengal',
      '20': 'jharkhand',
      '21': 'odisha',
      '22': 'chhattisgarh',
      '23': 'madhya pradesh',
      '24': 'gujarat',
      '26': 'dadra and nagar haveli and daman and diu',
      '27': 'maharashtra',
      '29': 'karnataka',
      '30': 'goa',
      '31': 'lakshadweep',
      '32': 'kerala',
      '33': 'tamil nadu',
      '34': 'puducherry',
      '35': 'andaman and nicobar islands',
      '36': 'telangana',
      '37': 'andhra pradesh',
      '38': 'ladakh',
    };

    const userCode = String(userGst || '').trim().substring(0, 2);
    const partyCode = String(partyGst || '').trim().substring(0, 2);
    const cState = String(companyState || '').trim().toLowerCase().replace(/\s+/g, '');
    const pState = String(partyState || '').trim().toLowerCase().replace(/\s+/g, '');

    // 1. Compare GST 2-digit prefixes if both are valid digits
    if (/^\d{2}$/.test(userCode) && /^\d{2}$/.test(partyCode)) {
      return userCode !== partyCode;
    }

    // 2. Compare User GST prefix state vs Party State string
    if (/^\d{2}$/.test(userCode) && pState) {
      const uStateFromCode = (gstStateCodes[userCode] || '').replace(/\s+/g, '');
      if (uStateFromCode) {
        return uStateFromCode !== pState;
      }
    }

    // 3. Compare Party GST prefix state vs Company State string
    if (/^\d{2}$/.test(partyCode) && cState) {
      const pStateFromCode = (gstStateCodes[partyCode] || '').replace(/\s+/g, '');
      if (pStateFromCode) {
        return cState !== pStateFromCode;
      }
    }

    // 4. Compare state strings directly
    if (cState && pState) {
      return cState !== pState;
    }

    return false;
  }

  /**
   * Builds standardized response workbooks (Success & Error reports) and summary object
   */
  async buildResponseSummary(
    headers: string[],
    successRows: any[],
    failedRows: { rowNum: number; values: any[]; error: string }[]
  ) {
    const totalRows = successRows.length + failedRows.length;

    // Build Success Excel Workbook
    const successWb = new ExcelJS.Workbook();
    const successWs = successWb.addWorksheet('Success Reports');
    successWs.addRow(headers);
    successWs.getRow(1).font = { bold: true };
    successWs.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD3D3D3' } };

    successRows.forEach(r => {
      const rawVals = r.originalRowValues ? r.originalRowValues.slice(1) : Object.values(r);
      successWs.addRow(rawVals);
    });

    const successBuffer = await successWb.xlsx.writeBuffer();
    const successFile = Buffer.from(successBuffer).toString('base64');

    // Build Error Excel Workbook
    const failedWb = new ExcelJS.Workbook();
    const failedWs = failedWb.addWorksheet('Error Reports');
    failedWs.addRow([...headers, 'Error Description']);
    failedWs.getRow(1).font = { bold: true };
    failedWs.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFC7CE' } };

    failedRows.forEach(f => {
      const rawVals = f.values ? f.values.slice(1) : [];
      failedWs.addRow([...rawVals, f.error]);
    });

    const failedBuffer = await failedWb.xlsx.writeBuffer();
    const errorFile = Buffer.from(failedBuffer).toString('base64');

    const errors: RowValidationError[] = failedRows.map(f => ({
      row: f.rowNum,
      status: 'Failed',
      error: f.error,
    }));

    return {
      success: failedRows.length === 0,
      summary: {
        totalRows,
        successful: successRows.length,
        failed: failedRows.length,
      },
      totalRows,
      successful: successRows.length,
      failed: failedRows.length,
      successFile,
      errorFile,
      errors,
    };
  }
}
