import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/prisma/prisma.service';
import { CreatePurchaseOrderDto, UpdatePurchaseOrderDto } from './dto/purchase-order.dto';
import * as ExcelJS from 'exceljs';
import * as PDFDocument from 'pdfkit';
import { formatDate, parseDDMMYYYY } from '../../../utils/dateFormatter';
import { generatePOSampleExcel } from '../../../common/utils/procurement-bulk-import.processor';
import { ImportValidationService } from '../../../common/services/import-validation.service';

const isValidGst = (gst?: string | null): boolean => {
  return Boolean(
    gst &&
      gst.trim() !== '-' &&
      gst.trim() !== '' &&
      gst.trim().toUpperCase() !== 'N/A' &&
      gst.trim().toUpperCase() !== 'NOT AVAILABLE' &&
      gst.trim().toUpperCase() !== 'NOT AVAILABLE' &&
      gst.trim().length >= 10
  );
};

@Injectable()
export class PurchaseOrderService {
  constructor(
    private prisma: PrismaService,
    private importValidator: ImportValidationService,
  ) {}

  async getNextNumber(userId: number): Promise<string> {
    const last = await this.prisma.purchaseOrder.findFirst({
      where: { userId, poNumber: { startsWith: 'PO-' } },
      orderBy: { poNumber: 'desc' },
      select: { poNumber: true },
    });

    if (!last) return 'PO-0001';
    const num = parseInt(last.poNumber.replace('PO-', ''), 10);
    if (isNaN(num)) return 'PO-0001';
    return `PO-${(num + 1).toString().padStart(4, '0')}`;
  }

  async getSupplierDetails(supplierId: number, userId: number) {
    const supplier = await this.prisma.accountMaster.findFirst({
      where: { id: supplierId, userId },
      select: {
        id: true,
        accountName: true,
        addressLine1: true,
        addressLine2: true,
        gstNo: true,
        panNo: true,
        supplierCreditDays: true,
        msmeEnabled: true,
        regType: true,
        state: true,
      },
    });
    if (!supplier) throw new NotFoundException('Supplier not found');
    return supplier;
  }

  async create(createDto: CreatePurchaseOrderDto, userId: number) {
    const poNumber = await this.getNextNumber(userId);

    const supplier = await this.prisma.accountMaster.findFirst({
      where: { id: createDto.supplierId, userId },
    });
    if (!supplier) throw new BadRequestException('Supplier not found');

    const isGstApplicable = isValidGst(createDto.gstNo || supplier.gstNo);

    const items = (createDto.items || []).map((item) => {
      const qty = Number(item.quantity || 0);
      const rate = Number(item.rate || 0);
      const discAmt = Number(item.discountAmount || item.discount || 0);
      const discPct = Number(item.discountPercent || 0);
      const taxPct = Number(item.taxPercent || 0);
      const beforeTax = qty * rate - discAmt;
      const taxAmt = isGstApplicable ? (beforeTax * taxPct) / 100 : 0;
      return {
        productCode: item.productCode,
        productId: item.productId || null,
        productName: item.productName,
        hsnCode: item.hsnCode,
        quantity: qty,
        rate,
        uom: item.uom,
        discountPercent: discPct,
        discountAmount: discAmt,
        taxPercent: taxPct,
        taxAmount: taxAmt,
        totalAmount: beforeTax + taxAmt,
        beforeTaxAmount: beforeTax,
        printDescription: item.printDescription || item.productName,
      };
    });

    const totalTax = items.reduce((sum, item) => sum + item.taxAmount, 0);
    const totalAmt = items.reduce((sum, item) => sum + item.totalAmount, 0);

    const po = await this.prisma.purchaseOrder.create({
      data: {
        poNumber: createDto.poNumber || poNumber,
        supplierName: supplier.accountName,
        address: createDto.address || '',
        gstNumber: createDto.gstNo,
        creditDays: createDto.creditDays,
        poCreationDate: createDto.poCreationDate ? new Date(createDto.poCreationDate) : new Date(),
        expiryDate: new Date(createDto.expiryDate),
        taxAmount: totalTax,
        totalAmount: totalAmt,
        userId,
        items: { create: items },
      },
      include: { items: true },
    });

    return po;
  }

  async findAll(
    query: { filter?: string; search?: string },
    userId: number,
  ) {
    const now = new Date();
    const soon = new Date();
    soon.setDate(soon.getDate() + 7);

    const where: any = { userId };

    if (query.filter && query.filter !== 'all') {
      if (query.filter === 'deleted') {
        where.status = 'DELETED';
      } else if (query.filter === 'pending') {
        where.status = 'PENDING';
        where.expiryDate = { gte: now };
      } else if (query.filter === 'expiring') {
        where.status = 'PENDING';
        where.expiryDate = { gte: now, lte: soon };
      } else if (query.filter === 'expired') {
        where.status = 'PENDING';
        where.expiryDate = { lt: now };
      } else if (query.filter === 'completed') {
        where.status = { in: ['GRN_COMPLETED', 'INVOICE_COMPLETED'] };
      }
    } else {
      where.status = { not: 'DELETED' };
    }

    if (query.search) {
      where.OR = [
        { poNumber: { contains: query.search, mode: 'insensitive' } },
        { supplierName: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    return this.prisma.purchaseOrder.findMany({
      where,
      include: { 
        items: true,
        grn: { where: { status: { not: 'DELETED' } }, include: { items: true } },
        purchaseInvoices: { where: { status: { not: 'DELETED' } }, include: { items: true } }
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: number, userId: number) {
    const po = await this.prisma.purchaseOrder.findFirst({
      where: { id, userId },
      include: { 
        items: true,
        grn: { where: { status: { not: 'DELETED' } }, include: { items: true } },
        purchaseInvoices: { where: { status: { not: 'DELETED' } }, include: { items: true } }
      },
    });
    if (!po) throw new NotFoundException(`Purchase Order ID ${id} not found`);
    return po;
  }

  async update(id: number, updateDto: UpdatePurchaseOrderDto, userId: number) {
    const existing = await this.findOne(id, userId);

    let supplierName = existing.supplierName;
    if (updateDto.supplierId) {
      const supplier = await this.prisma.accountMaster.findFirst({
        where: { id: updateDto.supplierId, userId },
      });
      if (!supplier) throw new BadRequestException('Supplier not found');
      supplierName = supplier.accountName;
    }

    const isGstApplicable = isValidGst(updateDto.gstNo ?? (existing as any).gstNumber);

    const items = updateDto.items
      ? updateDto.items.map((item) => {
          const qty = Number(item.quantity || 0);
          const rate = Number(item.rate || 0);
          const discAmt = Number(item.discountAmount || item.discount || 0);
          const discPct = Number(item.discountPercent || 0);
          const taxPct = Number(item.taxPercent || 0);
          const beforeTax = qty * rate - discAmt;
          const taxAmt = isGstApplicable ? (beforeTax * taxPct) / 100 : 0;
          return {
            productCode: item.productCode,
            productId: item.productId || null,
            productName: item.productName,
            hsnCode: item.hsnCode,
            quantity: qty,
            rate,
            uom: item.uom,
            discountPercent: discPct,
            discountAmount: discAmt,
            taxPercent: taxPct,
            taxAmount: taxAmt,
            totalAmount: beforeTax + taxAmt,
            beforeTaxAmount: beforeTax,
            printDescription: item.printDescription || item.productName,
          };
        })
      : undefined;

    const totalTax = items ? items.reduce((sum, item) => sum + item.taxAmount, 0) : undefined;
    const totalAmt = items ? items.reduce((sum, item) => sum + item.totalAmount, 0) : undefined;

    return this.prisma.$transaction(async (tx) => {
      if (items) {
        await tx.purchaseOrderItem.deleteMany({ where: { purchaseOrderId: id } });
      }

      return tx.purchaseOrder.update({
        where: { id },
        data: {
          supplierName,
          address: updateDto.address ?? existing.address,
          gstNumber: updateDto.gstNo ?? (existing as any).gstNumber,
          creditDays: updateDto.creditDays ?? existing.creditDays,
          poNumber: updateDto.poNumber ?? existing.poNumber,
          poCreationDate: updateDto.poCreationDate
            ? new Date(updateDto.poCreationDate)
            : existing.poCreationDate,
          expiryDate: updateDto.expiryDate
            ? new Date(updateDto.expiryDate)
            : existing.expiryDate,
          status: updateDto.status ?? existing.status,
          ...(totalTax !== undefined ? { taxAmount: totalTax } : {}),
          ...(totalAmt !== undefined ? { totalAmount: totalAmt } : {}),
          ...(items ? { items: { create: items } } : {}),
        },
        include: { items: true },
      });
    });
  }

  async softDelete(id: number, userId: number) {
    const po = await this.findOne(id, userId);
    return this.prisma.purchaseOrder.update({
      where: { id: po.id },
      data: { status: 'DELETED' },
    });
  }

  async downloadSample(): Promise<{ buffer: Buffer; filename: string; mimetype: string }> {
    const buffer = await generatePOSampleExcel();
    return {
      buffer,
      filename: 'purchase_order_sample.xlsx',
      mimetype: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    };
  }

  async importPurchaseOrders(fileBuffer: Buffer, userId: number) {
    if (!fileBuffer || fileBuffer.length === 0) {
      throw new BadRequestException('Empty or invalid file uploaded');
    }

    const workbook = new ExcelJS.Workbook();
    try {
      await workbook.xlsx.load(fileBuffer as any);
    } catch (error) {
      throw new BadRequestException('Invalid Excel file format. Please upload a valid .xlsx file.');
    }
    const worksheet = workbook.worksheets[0];
    if (!worksheet) {
      throw new BadRequestException('Invalid Excel file format');
    }

    const rowCount = worksheet.rowCount;
    if (rowCount < 2) {
      throw new BadRequestException('No data found to import');
    }

    let headerRowIndex = -1;
    const colMap: Record<string, number> = {};

    for (let r = 1; r <= Math.min(rowCount, 10); r++) {
      const row = worksheet.getRow(r);
      let found = false;
      row.eachCell((cell, colNumber) => {
        const val = String(cell.value || '').trim().toLowerCase();
        if (val.includes('po number') || val.includes('po no')) { colMap['poNumber'] = colNumber; found = true; }
        if (val.includes('po date')) colMap['poDate'] = colNumber;
        if (val.includes('expiry date') || val.includes('po expiry')) colMap['expiryDate'] = colNumber;
        if (val.includes('supplier name') || val.includes('supplier')) colMap['supplierName'] = colNumber;
        if (val.includes('product name') || val.includes('product')) colMap['productName'] = colNumber;
        if (val.includes('product code')) colMap['productCode'] = colNumber;
        if (val.includes('quantity') || val.includes('qty')) colMap['quantity'] = colNumber;
        if (val.includes('rate') || val.includes('price')) colMap['rate'] = colNumber;
        if (val.includes('discount (₹)') || val.includes('discount amount') || val.includes('discount rs')) colMap['discountAmount'] = colNumber;
        if (val.includes('discount (%)') || val.includes('discount percent')) colMap['discountPercent'] = colNumber;
      });
      if (found) {
        headerRowIndex = r;
        break;
      }
    }

    // Scan first 10 rows to detect if user uploaded a GRN, SO, or wrong template
    let isGrnFile = false;
    let isSoFile = false;

    for (let r = 1; r <= Math.min(rowCount, 10); r++) {
      const row = worksheet.getRow(r);
      row.eachCell((cell) => {
        const val = String(cell.value || '').trim().toLowerCase();
        if (val.includes('grn no') || val.includes('grn number') || val.includes('supplier challan')) {
          isGrnFile = true;
        }
        if (val.includes('so no') || val.includes('so number')) {
          isSoFile = true;
        }
      });
    }

    if (isGrnFile || isSoFile || !colMap['poNumber']) {
      throw new BadRequestException('Invalid template format');
    }

    const mandatoryCols = ['poNumber', 'supplierName', 'productName', 'quantity', 'rate'];
    const missing = mandatoryCols.filter(col => !colMap[col]);
    if (headerRowIndex === -1 || missing.length > 0) {
      throw new BadRequestException('Invalid template format');
    }

    const getVal = (row: ExcelJS.Row, key: string, defaultVal: any = '') => {
      const colIdx = colMap[key];
      if (!colIdx) return defaultVal;
      const cell = row.getCell(colIdx);
      let val = cell.value;
      if (val && typeof val === 'object' && 'result' in val) {
        val = (val as any).result;
      }
      if (val && (val instanceof Date || Object.prototype.toString.call(val) === '[object Date]' || typeof (val as any).getTime === 'function')) {
        return val;
      }
      return String(val !== undefined && val !== null ? val : '').trim();
    };

    const [{ supplierMap }, { productCodeMap, productNameMap }, existingPos, userShop, userGstDoc] = await Promise.all([
      this.importValidator.fetchAccountMasterData(userId),
      this.importValidator.fetchProductMasterData(userId),
      this.prisma.purchaseOrder.findMany({
        where: { userId, status: { not: 'DELETED' } },
        select: { poNumber: true },
      }),
      this.prisma.shopDetail.findUnique({ where: { userId } }),
      this.prisma.sellerDocument.findFirst({
        where: { uploadedByUserId: userId, type: 'GST' },
        orderBy: { createdAt: 'desc' },
        select: { name: true },
      }),
    ]);

    const dbPoNumbers = new Set(existingPos.map(p => p.poNumber.toLowerCase().trim()));
    const importedPoNumbersInFile = new Set<string>();

    const groupMap = new Map<string, any[]>();

    for (let r = headerRowIndex + 1; r <= rowCount; r++) {
      const row = worksheet.getRow(r);
      const poNumber = getVal(row, 'poNumber');
      if (!poNumber || poNumber === '-') continue;

      const item = {
        rowNum: r,
        originalRowValues: row.values,
        poNumber,
        poDateStr: getVal(row, 'poDate'),
        expiryDateStr: getVal(row, 'expiryDate'),
        supplierName: getVal(row, 'supplierName'),
        productName: getVal(row, 'productName'),
        productCode: getVal(row, 'productCode'),
        quantityStr: getVal(row, 'quantity'),
        rateStr: getVal(row, 'rate'),
        discountAmountStr: getVal(row, 'discountAmount'),
        discountPercentStr: getVal(row, 'discountPercent'),
      };

      if (!groupMap.has(poNumber)) {
        groupMap.set(poNumber, []);
      }
      groupMap.get(poNumber)!.push(item);
    }

    if (groupMap.size === 0) {
      throw new BadRequestException('Invalid template format');
    }

    const successRows: any[] = [];
    const failedRows: { rowNum: number; values: any[]; error: string }[] = [];

    const userGst = userGstDoc?.name;
    const companyState = (userShop?.state || '').trim().toLowerCase();
    const isGstApplicable = isValidGst(userGst);

    for (const [poNumber, rows] of groupMap.entries()) {
      const groupErrors: string[] = [];
      const firstRow = rows[0];

      const docNoValidation = this.importValidator.validateDocumentNumber(
        'PO',
        poNumber,
        dbPoNumbers,
        importedPoNumbersInFile,
        firstRow.rowNum
      );
      if (!docNoValidation.valid) {
        groupErrors.push(docNoValidation.error);
      }

      const suppValidation = this.importValidator.validateSupplier(firstRow.supplierName, supplierMap, 'PO');
      let supplierData: any = null;
      if (!suppValidation.valid) {
        groupErrors.push(suppValidation.error);
      } else {
        supplierData = suppValidation.data;
      }

      let parsedExpiryDate: Date = new Date();
      if (firstRow.expiryDateStr) {
        const dateVal = this.importValidator.validateImportDate(firstRow.expiryDateStr, 'PO Expiry Date');
        if (!dateVal.valid) {
          groupErrors.push(dateVal.error);
        } else {
          parsedExpiryDate = dateVal.date;
        }
      }

      let parsedPoDate: Date = new Date();
      if (firstRow.poDateStr) {
        const poDateVal = this.importValidator.validateImportDate(firstRow.poDateStr, 'PO Date');
        if (poDateVal.valid) {
          parsedPoDate = poDateVal.date;
        }
      }

      const processedItems: any[] = [];
      let totalAmount = 0;
      let totalTaxAmount = 0;

      for (const row of rows) {
        const prodVal = this.importValidator.validateProduct(
          row.productName,
          row.productCode,
          productCodeMap,
          productNameMap
        );

        if (!prodVal.valid) {
          groupErrors.push(`Row ${row.rowNum}: ${prodVal.error}`);
          continue;
        }

        const prod = prodVal.data;
        const qty = parseFloat(row.quantityStr);
        const rate = parseFloat(row.rateStr);

        if (isNaN(qty) || qty <= 0) groupErrors.push(`Row ${row.rowNum}: Quantity must be greater than 0.`);
        if (isNaN(rate) || rate < 0) groupErrors.push(`Row ${row.rowNum}: Rate must be 0 or positive.`);

        const discountAmt = parseFloat(row.discountAmountStr || '0');
        const discountPct = parseFloat(row.discountPercentStr || '0');
        if (isNaN(discountAmt) || discountAmt < 0) groupErrors.push(`Row ${row.rowNum}: Discount amount must be positive.`);
        if (isNaN(discountPct) || discountPct < 0 || discountPct > 100) groupErrors.push(`Row ${row.rowNum}: Discount percent must be between 0 and 100.`);

        if (groupErrors.length > 0) continue;

        const baseTotal = qty * rate;
        let finalDiscPercent = discountPct;
        let finalDiscAmount = discountAmt;

        if (finalDiscAmount > 0 && finalDiscPercent === 0) {
          finalDiscPercent = baseTotal > 0 ? (finalDiscAmount / baseTotal) * 100 : 0;
        } else {
          finalDiscAmount = (baseTotal * finalDiscPercent) / 100;
        }

        const beforeTaxAmount = baseTotal - finalDiscAmount;
        const taxRate = Number(prod.tax_rate || 0);
        const supplierGst = supplierData?.gstNo;
        const supplierState = (supplierData?.state || '').trim().toLowerCase();

        const isInterState = this.importValidator.determineIsInterState(
          userGst,
          companyState,
          supplierGst,
          supplierState
        );

        const taxAmount = isGstApplicable ? ((beforeTaxAmount * taxRate) / 100) : 0;
        const totalItemAmount = beforeTaxAmount + taxAmount;

        totalAmount += beforeTaxAmount;
        totalTaxAmount += taxAmount;

        processedItems.push({
          productId: prod.id,
          productCode: prod.product_code,
          productName: prod.product_name,
          printDescription: prod.description || prod.hsn_description || prod.product_name,
          hsnCode: prod.hsn_code || '',
          quantity: qty,
          rate,
          uom: prod.uom?.unit_name || 'Nos',
          discountPercent: finalDiscPercent,
          discountAmount: finalDiscAmount,
          taxPercent: taxRate,
          taxAmount,
          beforeTaxAmount,
          totalAmount: totalItemAmount,
        });
      }

      if (groupErrors.length > 0) {
        const combinedErrorMsg = groupErrors.join(' | ');
        for (const row of rows) {
          failedRows.push({
            rowNum: row.rowNum,
            values: row.originalRowValues,
            error: combinedErrorMsg,
          });
        }
      } else {
        try {
          await this.prisma.$transaction(async (tx) => {
            await tx.purchaseOrder.create({
              data: {
                poNumber,
                supplierName: supplierData.name,
                address: supplierData.address,
                creditDays: supplierData.creditDays,
                gstNumber: supplierData.gstNo,
                poCreationDate: parsedPoDate,
                expiryDate: parsedExpiryDate,
                totalAmount: totalAmount + totalTaxAmount,
                taxAmount: totalTaxAmount,
                userId,
                status: 'PENDING',
                items: {
                  create: processedItems.map(item => ({
                    productId: item.productId,
                    productCode: item.productCode,
                    productName: item.productName,
                    printDescription: item.printDescription,
                    hsnCode: item.hsnCode,
                    quantity: item.quantity,
                    rate: item.rate,
                    uom: item.uom,
                    discountPercent: item.discountPercent,
                    discountAmount: item.discountAmount,
                    taxPercent: item.taxPercent,
                    taxAmount: item.taxAmount,
                    beforeTaxAmount: item.beforeTaxAmount,
                    totalAmount: item.totalAmount,
                  })),
                },
              },
            });
          });

          importedPoNumbersInFile.add(poNumber.toLowerCase());
          for (const row of rows) {
            successRows.push(row);
          }
        } catch (dbError: any) {
          const dbErrMsg = `Database Save Failed: ${dbError.message || dbError}`;
          for (const row of rows) {
            failedRows.push({
              rowNum: row.rowNum,
              values: row.originalRowValues,
              error: dbErrMsg,
            });
          }
        }
      }
    }

    const headers = [
      'PO Number*', 'PO Date*', 'PO Expiry Date*', 'Supplier Name*',
      'Product Name*', 'Product Code', 'Qty*', 'Rate*', 'Discount (₹)', 'Discount (%)'
    ];

    return this.importValidator.buildResponseSummary(headers, successRows, failedRows);
  }

  async exportPurchaseOrders(
    userId: number,
    format: string,
    query: { filter?: string; search?: string },
  ): Promise<{ buffer: Buffer; filename: string; mimetype: string }> {
    const pos = await this.findAll(query, userId);

    const now = new Date();
    const pad = (n: number) => n.toString().padStart(2, '0');
    const timestamp = `${pad(now.getDate())}/${pad(now.getMonth() + 1)}/${now.getFullYear()}, ${pad(now.getHours())}:${pad(now.getMinutes())}`;

    if (format === 'xlsx') {
      const workbook = new ExcelJS.Workbook();
      const ws = workbook.addWorksheet('Purchase Orders');
      ws.views = [{ state: 'frozen', ySplit: 5 }];
      ws.columns = [
        { header: 'PO Number', key: 'poNumber', width: 15 },
        { header: 'Supplier', key: 'supplierName', width: 30 },
        { header: 'PO Date', key: 'poCreationDate', width: 15 },
        { header: 'Expiry Date', key: 'expiryDate', width: 15 },
        { header: 'Credit Days', key: 'creditDays', width: 12 },
        { header: 'Status', key: 'status', width: 18 },
      ];

      pos.forEach((po) => {
        ws.addRow({
          poNumber: po.poNumber,
          supplierName: po.supplierName,
          poCreationDate: formatDate(po.poCreationDate),
          expiryDate: formatDate(po.expiryDate),
          creditDays: po.creditDays,
          status: po.status,
        });
      });

      ws.spliceRows(1, 0, [], [], [], []);
      ws.mergeCells('A1:F1');
      const titleCell = ws.getCell('A1');
      titleCell.value = 'ERP';
      titleCell.font = { size: 18, bold: true };
      titleCell.alignment = { horizontal: 'center', vertical: 'middle' };

      ws.mergeCells('A2:F2');
      ws.getCell('A2').value = 'Purchase Orders Report';
      ws.getCell('A2').font = { size: 14 };
      ws.getCell('A2').alignment = { horizontal: 'center', vertical: 'middle' };

      ws.mergeCells('A3:F3');
      ws.getCell('A3').value = `Exported on: ${timestamp}`;
      ws.getCell('A3').font = { size: 10 };
      ws.getCell('A3').alignment = { horizontal: 'right' };

      const headerRow = ws.getRow(5);
      headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4472C4' } };
      headerRow.alignment = { horizontal: 'center', vertical: 'middle' };
      headerRow.height = 25;

      const buffer = Buffer.from(await workbook.xlsx.writeBuffer());
      return { buffer, filename: `purchase_orders_${Date.now()}.xlsx`, mimetype: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' };
    } else {
      return new Promise<any>((resolve) => {
        const doc = new PDFDocument({ margin: 20, size: 'A4', layout: 'landscape' });
        const buffers: Buffer[] = [];
        doc.on('data', buffers.push.bind(buffers));
        doc.on('end', () =>
          resolve({ buffer: Buffer.concat(buffers), filename: `purchase_orders_${Date.now()}.pdf`, mimetype: 'application/pdf' }),
        );

        doc.fontSize(18).font('Helvetica-Bold').text('ERP', { align: 'center' });
        doc.fontSize(14).font('Helvetica').text('Purchase Orders Report', { align: 'center' });
        doc.moveDown(0.5);
        doc.fontSize(10).text(`Exported on: ${timestamp}`, { align: 'right' });
        doc.moveDown();

        const tableTop = 100;
        const colX = [20, 120, 280, 380, 480, 560];
        const headers = ['PO Number', 'Supplier', 'PO Date', 'Expiry Date', 'Credit Days', 'Status'];

        doc.rect(15, tableTop - 5, 760, 20).fill('#4472C4');
        doc.fontSize(8).font('Helvetica-Bold').fillColor('#FFFFFF');
        headers.forEach((h, i) => doc.text(h, colX[i], tableTop));

        let y = tableTop + 20;
        doc.fillColor('#000000').font('Helvetica');
        pos.forEach((po, idx) => {
          if (y > 550) {
            doc.addPage({ margin: 20, size: 'A4', layout: 'landscape' });
            y = 40;
          }
          if (idx % 2 === 1) {
            doc.rect(15, y - 3, 760, 15).fill('#F2F2F2').fillColor('#000000');
          }
          doc.fontSize(7);
          doc.text(po.poNumber, colX[0], y);
          doc.text(po.supplierName.substring(0, 30), colX[1], y, { width: 150 });
          doc.text(formatDate(po.poCreationDate), colX[2], y);
          doc.text(formatDate(po.expiryDate), colX[3], y);
          doc.text(String(po.creditDays), colX[4], y);
          doc.text(po.status, colX[5], y);
          y += 20;
        });

        doc.end();
      });
    }
  }

  async printPurchaseOrder(id: number, userId: number): Promise<{ buffer: Buffer; filename: string; mimetype: string }> {
    const po = await this.prisma.purchaseOrder.findFirst({
      where: { id, userId },
      include: {
        items: true,
        user: { include: { shopDetail: true } },
      },
    });
    if (!po) throw new NotFoundException('Purchase Order not found');

    return new Promise<any>((resolve) => {
      const doc = new PDFDocument({ margin: 40, size: 'A4' });
      const buffers: Buffer[] = [];
      doc.on('data', buffers.push.bind(buffers));
      doc.on('end', () =>
        resolve({ buffer: Buffer.concat(buffers), filename: `PO_${po.poNumber}.pdf`, mimetype: 'application/pdf' }),
      );

      const shop = (po as any).user?.shopDetail;
      const companyName = shop?.shopName || 'ERP';

      // Header
      doc.fontSize(18).font('Helvetica-Bold').text(companyName, { align: 'center' });
      doc.fontSize(12).font('Helvetica').text('PURCHASE ORDER', { align: 'center' });
      doc.moveDown();

      // PO Details
      doc.fontSize(10);
      doc.text(`PO Number: ${po.poNumber}`, { continued: true });
      doc.text(`   PO Date: ${formatDate(po.poCreationDate)}`, { align: 'right' });
      doc.text(`Supplier: ${po.supplierName}`);
      if (po.address) doc.text(`Address: ${po.address}`);
      if ((po as any).gstNo) doc.text(`GST No: ${(po as any).gstNo}`);
      doc.text(`Credit Days: ${po.creditDays}`);
      doc.text(`Expiry Date: ${formatDate(po.expiryDate)}`);
      doc.moveDown();

      // Table header
      const tableTop = doc.y;
      const colX = [40, 120, 240, 310, 370, 430, 490];
      const headers = ['#', 'Product', 'HSN', 'Qty', 'Rate', 'Tax%', 'Amount'];
      doc.rect(35, tableTop - 5, 520, 18).fill('#4472C4');
      doc.fontSize(8).font('Helvetica-Bold').fillColor('#FFFFFF');
      headers.forEach((h, i) => doc.text(h, colX[i], tableTop));

      let y = tableTop + 18;
      doc.fillColor('#000000').font('Helvetica').fontSize(8);

      let grandTotal = 0;
      (po.items || []).forEach((item, idx) => {
        if (y > 720) {
          doc.addPage({ margin: 40, size: 'A4' });
          y = 40;
        }
        if (idx % 2 === 1) {
          doc.rect(35, y - 3, 520, 14).fill('#F2F2F2').fillColor('#000000');
        }
        const amt = item.totalAmount || 0;
        grandTotal += Number(amt);
        doc.text(String(idx + 1), colX[0], y);
        doc.text(item.productName.substring(0, 20), colX[1], y, { width: 110 });
        doc.text(item.hsnCode || '-', colX[2], y);
        doc.text(String(item.quantity), colX[3], y);
        doc.text(Number(item.rate).toFixed(2), colX[4], y);
        doc.text(`${item.taxPercent}%`, colX[5], y);
        doc.text(Number(amt).toFixed(2), colX[6], y);
        y += 16;
      });

      doc.moveDown(2);
      doc.font('Helvetica-Bold').fontSize(10);
      doc.text(`Grand Total: ₹${grandTotal.toFixed(2)}`, { align: 'right' });
      doc.moveDown(2);
      doc.font('Helvetica').fontSize(9).text('Authorized Signature: ____________________', { align: 'right' });

      doc.end();
    });
  }
}
