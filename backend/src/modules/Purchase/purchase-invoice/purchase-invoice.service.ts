import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/prisma/prisma.service';
import { CreatePurchaseInvoiceDto, UpdatePurchaseInvoiceDto } from './dto/purchase-invoice.dto';
import { Prisma, PIStatus } from '@prisma/client';
import { PurchaseOrderService } from '../purchase-order/purchase-order.service';
import * as ExcelJS from 'exceljs';
import * as PDFDocument from 'pdfkit';

@Injectable()
export class PurchaseInvoiceService {
  constructor(
    private prisma: PrismaService,
    private poService: PurchaseOrderService
  ) {}

  async getSuppliers(userId: number) {
    return this.prisma.accountMaster.findMany({
      where: {
        userId,
        groupName: { has: 'SUNDRY_CREDITORS' },
        status: 'ACTIVE',
      },
      select: {
        id: true,
        accountName: true,
        supplierCreditDays: true,
        addressLine1: true,
        addressLine2: true,
        gstNo: true,
        panNo: true,
      },
      orderBy: { accountName: 'asc' },
    });
  }

  async getSupplierPOs(supplierName: string, userId: number) {
    return this.prisma.purchaseOrder.findMany({
      where: {
        userId,
        supplierName,
        status: { not: 'DELETED' },
      },
      select: {
        id: true,
        poNumber: true,
      },
      orderBy: { poNumber: 'desc' },
    });
  }

  async generateInvoiceNumber(): Promise<string> {
    const lastInvoice = await this.prisma.purchaseInvoice.findFirst({
      where: { invoiceNumber: { startsWith: 'INV-' } },
      orderBy: { invoiceNumber: 'desc' },
      select: { invoiceNumber: true },
    });

    if (!lastInvoice) {
      return 'INV-0001';
    }

    const lastNumber = parseInt(lastInvoice.invoiceNumber.replace('INV-', ''), 10);
    if (isNaN(lastNumber)) return 'INV-0001';
    return `INV-${(lastNumber + 1).toString().padStart(4, '0')}`;
  }

  async create(createDto: CreatePurchaseInvoiceDto, userId: number, uploadedFilePath?: string) {
    const invoiceNumber = createDto.invoiceNumber || (await this.generateInvoiceNumber());

    const existing = await this.prisma.purchaseInvoice.findUnique({
      where: { invoiceNumber },
    });
    if (existing) throw new BadRequestException(`Internal Invoice number ${invoiceNumber} already exists`);

    const challanNumber = createDto.challanNumber || createDto.supplierInvoiceNumber;
    const bookingDate = createDto.bookingDate ? new Date(createDto.bookingDate) : new Date();

    // Calculations
    let totalQuantity = 0;
    let taxableAmount = 0;

    for (const item of createDto.items) {
      if (item.quantity <= 0 || item.rate <= 0) {
        throw new BadRequestException('Quantity and Rate must be positive');
      }
      totalQuantity += Number(item.quantity);
      taxableAmount += Number(item.quantity) * Number(item.rate);
    }

    const cgstAmount = (taxableAmount * 9) / 100;
    const sgstAmount = (taxableAmount * 9) / 100;
    const grandTotal = taxableAmount + cgstAmount + sgstAmount;

    const lastInvoice = await this.prisma.purchaseInvoice.findFirst({
      where: { userId, supplierName: createDto.supplierName },
      orderBy: { createdAt: 'desc' },
      select: { cumulativeBalance: true },
    });

    const previousBalance = lastInvoice ? lastInvoice.cumulativeBalance : 0;
    const cumulativeBalance = previousBalance + grandTotal;

    return this.prisma.$transaction(async (tx) => {
      let finalPoId = createDto.poId;
      let finalPoNumber = createDto.poNumber;

      // REQUIREMENT: Automatically create PO if not selected
      if (!finalPoId) {
        // Find supplier details for PO
        const supplier = await tx.accountMaster.findFirst({
          where: { accountName: createDto.supplierName, userId }
        });

        if (!supplier) {
          throw new BadRequestException(`Supplier '${createDto.supplierName}' not found in Account Master. Action cancelled.`);
        }

        const poNumber = await this.poService.generatePONumber();
        const expiryDate = new Date(bookingDate);
        expiryDate.setDate(expiryDate.getDate() + (createDto.creditDays || 30));

        // Use the PO calculation logic (defaults to 18% tax from PI logic: 9+9)
        const poItems = createDto.items.map(item => this.poService.calculateItemValues({
          ...item,
          taxPercent: 18,
          discountPercent: 0,
          discountAmount: 0,
        }));

        const po = await tx.purchaseOrder.create({
          data: {
            poNumber,
            supplierName: supplier.accountName,
            address: createDto.address || supplier.addressLine1,
            creditDays: createDto.creditDays,
            poCreationDate: bookingDate,
            expiryDate: expiryDate,
            gstNumber: supplier.gstNo,
            panNumber: supplier.panNo,
            totalAmount: taxableAmount,
            taxAmount: cgstAmount + sgstAmount,
            grandTotal: grandTotal,
            userId,
            status: 'INVOICE_GENERATED', // Immediately marked as completed
            items: {
              create: poItems.map(item => ({
                productCode: item.productCode,
                productName: item.productName,
                hsnCode: '', 
                quantity: item.quantity,
                rate: item.rate,
                uom: item.uom,
                discountPercent: 0,
                discountAmount: 0,
                taxPercent: 18,
                taxAmount: item.taxAmount,
                totalAmount: item.totalAmount,
              })),
            },
          },
        });
        finalPoId = po.id;
        finalPoNumber = po.poNumber;
      } else {
        // Switch existing PO status
        await tx.purchaseOrder.update({
          where: { id: finalPoId },
          data: { status: 'INVOICE_GENERATED' }
        });
      }

      const invoice = await tx.purchaseInvoice.create({
        data: {
          invoiceNumber,
          supplierInvoiceNumber: createDto.supplierInvoiceNumber,
          supplierInvoiceDate: new Date(createDto.supplierInvoiceDate),
          invoiceDate: new Date(),
          bookingDate,
          supplierName: createDto.supplierName,
          address: createDto.address,
          poNumber: finalPoNumber,
          challanNumber,
          creditDays: createDto.creditDays,
          status: PIStatus.GENERATED,
          uploadedFilePath: uploadedFilePath || null,
          totalQuantity: totalQuantity,
          taxableAmount: taxableAmount,
          cgstAmount: cgstAmount,
          sgstAmount: sgstAmount,
          grandTotal: grandTotal,
          cumulativeBalance: cumulativeBalance,
          userId,
          poId: finalPoId,
          items: {
            create: createDto.items.map(item => ({
              productCode: item.productCode,
              productName: item.productName,
              quantity: item.quantity,
              rate: item.rate,
              uom: item.uom,
            })),
          },
        },
        include: { items: true },
      });

      return invoice;
    });
  }

  async findAll() {
    return this.prisma.purchaseInvoice.findMany({
      include: { items: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: number) {
    const invoice = await this.prisma.purchaseInvoice.findUnique({
      where: { id },
      include: { items: true },
    });

    if (!invoice) throw new NotFoundException(`Invoice ID ${id} not found`);
    return invoice;
  }

  async update(id: number, updateDto: UpdatePurchaseInvoiceDto, uploadedFilePath?: string) {
    const existing = await this.prisma.purchaseInvoice.findUnique({
      where: { id },
      include: { items: true },
    });

    if (!existing) throw new NotFoundException(`Invoice ID ${id} not found`);

    let totalQuantity = existing.totalQuantity;
    let taxableAmount = existing.taxableAmount;
    let cgstAmount = existing.cgstAmount;
    let sgstAmount = existing.sgstAmount;
    let grandTotal = existing.grandTotal;

    if (updateDto.items) {
      totalQuantity = 0;
      taxableAmount = 0;
      for (const item of updateDto.items) {
        if (item.quantity <= 0 || item.rate <= 0) {
          throw new BadRequestException('Quantity and Rate must be positive');
        }
        totalQuantity += Number(item.quantity);
        taxableAmount += Number(item.quantity) * Number(item.rate);
      }
      cgstAmount = (taxableAmount * 9) / 100;
      sgstAmount = (taxableAmount * 9) / 100;
      grandTotal = taxableAmount + cgstAmount + sgstAmount;
    }

    let cumulativeBalance = existing.cumulativeBalance;
    if (updateDto.items) {
      const difference = grandTotal - existing.grandTotal;
      cumulativeBalance = existing.cumulativeBalance + difference;
    }

    return this.prisma.$transaction(async (tx) => {
      if (updateDto.items) {
        await tx.purchaseInvoiceItem.deleteMany({
          where: { purchaseInvoiceId: id },
        });
      }

      if (updateDto.poId !== undefined && updateDto.poId !== existing.poId) {
        if (existing.poId) {
          await tx.purchaseOrder.update({
            where: { id: existing.poId },
            data: { status: 'PENDING' }
          });
        }
        if (updateDto.poId) {
          await tx.purchaseOrder.update({
            where: { id: updateDto.poId },
            data: { status: 'INVOICE_GENERATED' }
          });
        }
      }

      const updated = await tx.purchaseInvoice.update({
        where: { id },
        data: {
          supplierInvoiceNumber: updateDto.supplierInvoiceNumber ?? existing.supplierInvoiceNumber,
          supplierInvoiceDate: updateDto.supplierInvoiceDate ? new Date(updateDto.supplierInvoiceDate) : existing.supplierInvoiceDate,
          bookingDate: updateDto.bookingDate ? new Date(updateDto.bookingDate) : existing.bookingDate,
          supplierName: updateDto.supplierName ?? existing.supplierName,
          address: updateDto.address ?? existing.address,
          poNumber: updateDto.poNumber ?? existing.poNumber,
          challanNumber: updateDto.challanNumber ?? existing.challanNumber,
          creditDays: updateDto.creditDays ?? existing.creditDays,
          status: (updateDto.status as any) ?? existing.status,
          uploadedFilePath: uploadedFilePath || existing.uploadedFilePath,
          totalQuantity,
          taxableAmount,
          cgstAmount,
          sgstAmount,
          grandTotal,
          cumulativeBalance,
          poId: updateDto.poId !== undefined ? updateDto.poId : existing.poId,
          items: updateDto.items ? {
            create: updateDto.items.map(item => ({
              productCode: item.productCode,
              productName: item.productName,
              quantity: item.quantity,
              rate: item.rate,
              uom: item.uom,
            }))
          } : undefined,
        },
        include: { items: true },
      });

      return updated;
    });
  }

  private numberToWords(num: number): string {
    const a = ['', 'One ', 'Two ', 'Three ', 'Four ', 'Five ', 'Six ', 'Seven ', 'Eight ', 'Nine ', 'Ten ', 'Eleven ', 'Twelve ', 'Thirteen ', 'Fourteen ', 'Fifteen ', 'Sixteen ', 'Seventeen ', 'Eighteen ', 'Nineteen '];
    const b = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
    const inWords = (n: any): string => {
      if ((n = n.toString()).length > 9) return 'overflow';
      const nArray = ('000000000' + n).substr(-9).match(/^(\d{2})(\d{2})(\d{2})(\d{1})(\d{2})$/);
      if (!nArray) return '';
      let str = '';
      str += Number(nArray[1]) !== 0 ? (a[Number(nArray[1])] || b[Number(nArray[1][0])] + ' ' + a[Number(nArray[1][1])]) + 'Crore ' : '';
      str += Number(nArray[2]) !== 0 ? (a[Number(nArray[2])] || b[Number(nArray[2][0])] + ' ' + a[Number(nArray[2][1])]) + 'Lakh ' : '';
      str += Number(nArray[3]) !== 0 ? (a[Number(nArray[3])] || b[Number(nArray[3][0])] + ' ' + a[Number(nArray[3][1])]) + 'Thousand ' : '';
      str += Number(nArray[4]) !== 0 ? (a[Number(nArray[4])] || b[Number(nArray[4][0])] + ' ' + a[Number(nArray[4][1])]) + 'Hundred ' : '';
      str += Number(nArray[5]) !== 0 ? ((str !== '') ? 'and ' : '') + (a[Number(nArray[5])] || b[Number(nArray[5][0])] + ' ' + a[Number(nArray[5][1])]) : '';
      return str;
    };
    const whole = Math.floor(num);
    const fraction = Math.round((num - whole) * 100);
    let res = inWords(whole) + 'Rupees ';
    if (fraction > 0) res += 'and ' + inWords(fraction) + 'Paise ';
    return res + 'Only';
  }

  async downloadSample() {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Purchase Invoice Sample');
    const headers = [
      'Supplier Name*', 'Supplier Invoice No*', 'Supplier Invoice Date (YYYY-MM-DD)*', 'Booking Date (YYYY-MM-DD)', 
      'Address*', 'Credit Days*', 'CH No', 'PO No', 'Product Code*', 'Quantity*', 'Rate*', 'UOM*'
    ];
    worksheet.addRow(headers);
    worksheet.addRow(['SilverPeak Traders', 'INV-555', '2026-03-01', '2026-03-02', '24 Market Street', 30, 'CH-001', 'PO00001', 'P01', 10, 100, 'Ton']);
    
    const headerRow = worksheet.getRow(1);
    headerRow.font = { bold: true };
    headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD3D3D3' } };
    worksheet.columns = headers.map(() => ({ width: 22 }));

    const buffer = await workbook.xlsx.writeBuffer();
    return {
      buffer: Buffer.from(buffer),
      filename: 'purchase_invoice_sample.xlsx',
      mimetype: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    };
  }

  async exportPurchaseInvoices(format: string, query: { search?: string }) {
    const invoices = await this.prisma.purchaseInvoice.findMany({
      where: query.search ? {
        OR: [
          { invoiceNumber: { contains: query.search, mode: 'insensitive' } },
          { supplierName: { contains: query.search, mode: 'insensitive' } },
          { supplierInvoiceNumber: { contains: query.search, mode: 'insensitive' } },
        ]
      } : {},
      include: { items: true },
      orderBy: { createdAt: 'desc' },
    });

    if (format === 'xlsx') {
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet('Purchase Invoices');
      worksheet.columns = [
        { header: 'Invoice No', key: 'invoiceNumber', width: 15 },
        { header: 'Supplier Name', key: 'supplierName', width: 25 },
        { header: 'Booking Date', key: 'bookingDate', width: 15 },
        { header: 'Invoice Date', key: 'supplierInvoiceDate', width: 15 },
        { header: 'PO No', key: 'poNumber', width: 12 },
        { header: 'Credit Days', key: 'creditDays', width: 12 },
        { header: 'Taxable Amt', key: 'taxableAmount', width: 15 },
        { header: 'Tax Amt', key: 'taxAmt', width: 15 },
        { header: 'Grand Total', key: 'grandTotal', width: 15 },
        { header: 'Status', key: 'status', width: 12 },
      ];
      invoices.forEach(inv => {
        worksheet.addRow({
          ...inv,
          bookingDate: inv.bookingDate.toLocaleDateString(),
          supplierInvoiceDate: inv.supplierInvoiceDate.toLocaleDateString(),
          taxAmt: inv.cgstAmount + inv.sgstAmount,
        });
      });
      const buffer = await workbook.xlsx.writeBuffer();
      return {
        buffer: Buffer.from(buffer),
        filename: `purchase_invoices_${Date.now()}.xlsx`,
        mimetype: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      };
    } else {
      return new Promise<any>((resolve) => {
        const doc = new PDFDocument({ margin: 30, size: 'A4', layout: 'landscape' });
        const buffers: Buffer[] = [];
        doc.on('data', buffers.push.bind(buffers));
        doc.on('end', () => resolve({ buffer: Buffer.concat(buffers), filename: `purchase_invoices_${Date.now()}.pdf`, mimetype: 'application/pdf' }));

        doc.fontSize(20).text('Purchase Invoices Report', { align: 'center' });
        doc.moveDown();
        const headers = ['Inv No', 'Supplier', 'Booking Date', 'Inv Date', 'PO No', 'Taxable', 'Tax', 'Total', 'Status'];
        const colX = [30, 100, 220, 300, 380, 450, 520, 600, 680];
        doc.fontSize(10).font('Helvetica-Bold');
        headers.forEach((h, i) => doc.text(h, colX[i], 80));
        doc.font('Helvetica').fontSize(8);
        let y = 100;
        invoices.forEach(inv => {
          doc.text(inv.invoiceNumber, colX[0], y);
          doc.text(inv.supplierName.substring(0, 20), colX[1], y);
          doc.text(inv.bookingDate.toLocaleDateString(), colX[2], y);
          doc.text(inv.supplierInvoiceDate.toLocaleDateString(), colX[3], y);
          doc.text(inv.poNumber || '-', colX[4], y);
          doc.text(inv.taxableAmount.toFixed(2), colX[5], y);
          doc.text((inv.cgstAmount + inv.sgstAmount).toFixed(2), colX[6], y);
          doc.text(inv.grandTotal.toFixed(2), colX[7], y);
          doc.text(inv.status, colX[8], y);
          y += 20;
          if (y > 550) { doc.addPage({ layout: 'landscape' }); y = 50; }
        });
        doc.end();
      });
    }
  }

  async importPurchaseInvoices(buffer: Buffer, userId: number) {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer as any);
    const worksheet = workbook.getWorksheet(1);
    const rowCount = worksheet.rowCount;
    if (rowCount < 2) throw new BadRequestException('No data to import');

    let imported = 0;
    let failed = 0;
    const errors: string[] = [];

    for (let i = 2; i <= rowCount; i++) {
      const row = worksheet.getRow(i);
      try {
        const supplierName = String(row.getCell(1).value || '').trim();
        const supplierInvoiceNumber = String(row.getCell(2).value || '').trim();
        const supplierInvoiceDate = String(row.getCell(3).value || '').trim();
        if (!supplierInvoiceNumber || supplierInvoiceNumber === 'Supplier Invoice No*') continue;

        const dto: CreatePurchaseInvoiceDto = {
          supplierName,
          supplierInvoiceNumber,
          supplierInvoiceDate: new Date(supplierInvoiceDate).toISOString().split('T')[0],
          bookingDate: row.getCell(4).value ? new Date(String(row.getCell(4).value)).toISOString().split('T')[0] : undefined,
          address: String(row.getCell(5).value || '').trim(),
          creditDays: parseInt(String(row.getCell(6).value || 0), 10),
          challanNumber: String(row.getCell(7).value || '').trim(),
          poNumber: String(row.getCell(8).value || '').trim(),
          items: [{
            productCode: String(row.getCell(9).value || '').trim(),
            productName: 'Imported Item',
            quantity: parseFloat(String(row.getCell(10).value || 0)),
            rate: parseFloat(String(row.getCell(11).value || 0)),
            uom: String(row.getCell(12).value || 'NOS').trim(),
          }]
        };

        await this.create(dto, userId);
        imported++;
      } catch (err) {
        failed++;
        errors.push(`Row ${i}: ${err.message}`);
      }
    }
    return { success: true, message: `Imported ${imported} invoices. ${failed} failed.`, errors };
  }

  async printPurchaseInvoice(id: number, userId: number) {
    const inv = await this.prisma.purchaseInvoice.findUnique({
      where: { id },
      include: { items: true, user: { include: { shopDetail: true } } },
    });
    if (!inv) throw new NotFoundException('Invoice not found');

    const business = inv.user.shopDetail;
    const amountInWords = this.numberToWords(inv.grandTotal);

    return new Promise<any>((resolve) => {
      const doc = new PDFDocument({ margin: 20, size: 'A4' });
      const buffers: Buffer[] = [];
      doc.on('data', buffers.push.bind(buffers));
      doc.on('end', () => resolve({ buffer: Buffer.concat(buffers), filename: `PI_${inv.invoiceNumber}.pdf`, mimetype: 'application/pdf' }));

      const pageWidth = 555;
      let y = 20;

      doc.rect(20, y, pageWidth, 780).stroke();
      doc.fillColor('#000000').fontSize(20).font('Helvetica-Bold').text(business?.shopName || 'COMPANY NAME', 20, y + 20, { align: 'center', width: pageWidth });
      y += 50;
      doc.fontSize(10).font('Helvetica').text(`${business?.address || ''}, ${business?.district || ''}, ${business?.state || ''}`, 20, y, { align: 'center', width: pageWidth });
      y += 20;
      doc.fontSize(12).font('Helvetica-Bold').text('PURCHASE INVOICE', 20, y, { align: 'center', width: pageWidth });
      y += 30;

      doc.fontSize(9).text(`Inv No: ${inv.invoiceNumber}`, 30, y);
      doc.text(`Booking Date: ${inv.bookingDate.toLocaleDateString()}`, 300, y);
      y += 20;
      doc.text(`Supplier: ${inv.supplierName}`, 30, y);
      doc.text(`Inv Date: ${inv.supplierInvoiceDate.toLocaleDateString()}`, 300, y);
      y += 40;

      const colX = [30, 200, 300, 400, 480];
      doc.font('Helvetica-Bold').text('Item', colX[0], y);
      doc.text('Qty', colX[1], y);
      doc.text('Rate', colX[2], y);
      doc.text('UOM', colX[3], y);
      doc.text('Total', colX[4], y);
      y += 20;
      doc.font('Helvetica');
      inv.items.forEach(item => {
        doc.text(item.productName, colX[0], y);
        doc.text(item.quantity.toString(), colX[1], y);
        doc.text(item.rate.toString(), colX[2], y);
        doc.text(item.uom, colX[3], y);
        doc.text((item.quantity * item.rate).toFixed(2), colX[4], y);
        y += 20;
      });

      y += 40;
      doc.font('Helvetica-Bold').text(`Taxable Amt: ${inv.taxableAmount.toFixed(2)}`, 350, y);
      y += 20;
      doc.text(`CGST (9%): ${inv.cgstAmount.toFixed(2)}`, 350, y);
      y += 20;
      doc.text(`SGST (9%): ${inv.sgstAmount.toFixed(2)}`, 350, y);
      y += 20;
      doc.fontSize(12).text(`Grand Total: ${inv.grandTotal.toFixed(2)}`, 350, y);
      y += 40;
      doc.fontSize(10).text(`Amount in Words: ${amountInWords}`, 30, y);

      doc.end();
    });
  }
}
