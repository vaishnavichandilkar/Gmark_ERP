import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/prisma/prisma.service';
import { CreatePurchaseOrderDto, UpdatePurchaseOrderDto } from './dto/purchase-order.dto';
import * as ExcelJS from 'exceljs';
import * as PDFDocument from 'pdfkit';
import { formatDate, parseDDMMYYYY } from '../../../utils/dateFormatter';

const isValidGst = (gst?: string | null): boolean => {
  return Boolean(
    gst &&
      gst.trim() !== '-' &&
      gst.trim() !== '' &&
      gst.trim().toUpperCase() !== 'N/A' &&
      gst.trim().toUpperCase() !== 'NOT AVAILABLE' &&
      gst.trim().length >= 10
  );
};

@Injectable()
export class PurchaseOrderService {
  constructor(private prisma: PrismaService) {}

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
        grn: { select: { id: true } },
        purchaseInvoices: { select: { id: true } }
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: number, userId: number) {
    const po = await this.prisma.purchaseOrder.findFirst({
      where: { id, userId },
      include: { 
        items: true,
        grn: { select: { id: true } },
        purchaseInvoices: { select: { id: true } }
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
    const workbook = new ExcelJS.Workbook();
    const ws = workbook.addWorksheet('Purchase Orders');

    ws.columns = [
      { header: 'Supplier ID', key: 'supplierId', width: 15 },
      { header: 'Credit Days', key: 'creditDays', width: 15 },
      { header: 'Address', key: 'address', width: 30 },
      { header: 'GST No', key: 'gstNo', width: 20 },
      { header: 'PO Date', key: 'poCreationDate', width: 15 },
      { header: 'Expiry Date', key: 'expiryDate', width: 15 },
      { header: 'Product Code', key: 'productCode', width: 15 },
      { header: 'Product Name', key: 'productName', width: 25 },
      { header: 'HSN Code', key: 'hsnCode', width: 12 },
      { header: 'Quantity', key: 'quantity', width: 12 },
      { header: 'Rate', key: 'rate', width: 12 },
      { header: 'UOM', key: 'uom', width: 10 },
      { header: 'Tax %', key: 'taxPercent', width: 10 },
    ];

    ws.addRow({
      supplierId: 1,
      creditDays: 30,
      address: '123 Supplier St',
      gstNo: '27AAAAA0000A1Z5',
      poCreationDate: new Date().toISOString().split('T')[0],
      expiryDate: new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0],
      productCode: 'PROD001',
      productName: 'Sample Product',
      hsnCode: '8471',
      quantity: 10,
      rate: 100,
      uom: 'PCS',
      taxPercent: 18,
    });

    const buffer = Buffer.from(await workbook.xlsx.writeBuffer());
    return {
      buffer,
      filename: 'purchase_order_sample.xlsx',
      mimetype: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    };
  }

  async importPurchaseOrders(fileBuffer: Buffer, userId: number) {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(fileBuffer as any);
    const ws = workbook.worksheets[0];

    const rows: any[] = [];
    ws.eachRow((row, rowNum) => {
      if (rowNum === 1) return; // skip header
      const values = row.values as any[];
      rows.push({
        supplierId: values[1],
        creditDays: values[2],
        address: values[3],
        gstNo: values[4],
        poCreationDate: parseDDMMYYYY(values[5]),
        expiryDate: parseDDMMYYYY(values[6]),
        productCode: values[7],
        productName: values[8],
        hsnCode: values[9],
        quantity: values[10],
        rate: values[11],
        uom: values[12],
        taxPercent: values[13],
      });
    });

    const results = [];
    for (const row of rows) {
      try {
        const po = await this.create(
          {
            supplierId: Number(row.supplierId),
            creditDays: Number(row.creditDays),
            address: row.address,
            gstNo: row.gstNo,
            poCreationDate: row.poCreationDate,
            expiryDate: row.expiryDate,
            items: [
              {
                productCode: row.productCode,
                productName: row.productName,
                hsnCode: row.hsnCode || '',
                quantity: Number(row.quantity),
                rate: Number(row.rate),
                uom: row.uom,
                taxPercent: Number(row.taxPercent),
                discountPercent: 0,
                discountAmount: 0,
              },
            ],
          },
          userId,
        );
        results.push({ success: true, po });
      } catch (e) {
        results.push({ success: false, error: e.message, row });
      }
    }

    return { imported: results.filter((r) => r.success).length, errors: results.filter((r) => !r.success) };
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
