import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../../../infrastructure/prisma/prisma.service';
import { CreateGrnDto, UpdateGrnDto } from './dto/grn.dto';
import { PurchaseOrderService } from '../../purchase-order/purchase-order.service';
import * as ExcelJS from 'exceljs';
import * as PDFDocument from 'pdfkit';

@Injectable()
export class GrnService {
  constructor(
    private prisma: PrismaService,
    private poService: PurchaseOrderService
  ) { }

  async create(createDto: CreateGrnDto, userId: number, uploadedFilePath?: string) {
    const bookingDate = createDto.bookingDate ? new Date(createDto.bookingDate) : new Date();

    // Calculations - Use values from accountSummary if provided, otherwise calculate
    let totalQuantity = 0;
    let taxableAmount = 0;

    for (const item of createDto.items) {
      if (item.quantity <= 0 || item.rate <= 0) {
        throw new BadRequestException('Quantity and Rate must be positive');
      }
      totalQuantity += Number(item.quantity);
      taxableAmount += Number(item.quantity) * Number(item.rate);
    }

    const cgstAmount = createDto.accountSummary?.cgst ?? 0;
    const sgstAmount = createDto.accountSummary?.sgst ?? 0;
    const igstAmount = createDto.accountSummary?.igst ?? 0;
    const grandTotal = createDto.grandTotal ?? (taxableAmount + cgstAmount + sgstAmount + igstAmount);

    // Estimate cumulative balance
    const lastGrn = await this.prisma.grn.findFirst({
      where: { userId, supplierName: createDto.supplierName },
      orderBy: { createdAt: 'desc' },
      select: { cumulativeBalance: true },
    });

    const previousBalance = lastGrn ? lastGrn.cumulativeBalance : 0;
    const cumulativeBalance = previousBalance + grandTotal;

    return this.prisma.$transaction(async (tx) => {
      let finalPoId = createDto.poId;
      let finalPoNumber = createDto.poNumber;

      const grn = await tx.grn.create({
        data: {
          grnDate: createDto.grnDate ? new Date(createDto.grnDate) : new Date(),
          bookingDate,
          supplierName: createDto.supplierName,
          address: createDto.address || '',
          gstNumber: createDto.gstNumber || createDto.gstNo || null,
          poNumber: finalPoNumber,
          challanNumber: createDto.challanNumber,
          creditDays: createDto.creditDays || 0,
          totalQuantity,
          taxableAmount,
          cgstAmount,
          sgstAmount,
          igstAmount,
          grandTotal,
          cumulativeBalance,
          userId,
          poId: finalPoId,
          items: {
            create: createDto.items.map(item => ({
              productId: item.productId ? parseInt(item.productId, 10) : null,
              productCode: item.productCode,
              productName: item.productName,
              hsnCode: item.hsnCode,
              totalPoQty: Number(item.totalPoQty || 0),
              receivedPoQty: Number(item.receivedPoQty || 0),
              receivedQty: Number(item.quantity || 0),
              remainingQty: Number(item.remainingQty || 0),
              rate: Number(item.rate),
              uom: item.uom,
              discountPercent: Number(item.discountPercent || 0),
              discountAmount: Number(item.discountAmt || 0),
              taxPercent: Number(item.taxPercent || 0),
              taxAmount: Number(item.taxAmount || 0),
              beforeTaxAmount: Number(item.beforeTaxAmount || 0),
              totalAmount: Number(item.amount || 0),
              amount: Number(item.amount || 0),
              printDescription: item.printDescription,
            })),
          },
        },
        include: { items: true },
      });

      return grn;
    });
  }

  async getSupplierChallans(supplierName: string, userId: number) {
    return this.prisma.grn.findMany({
      where: {
        userId,
        supplierName: { equals: supplierName, mode: 'insensitive' },
        status: { not: 'DELETED' }
      },
      select: {
        id: true,
        challanNumber: true,
        bookingDate: true,
        grandTotal: true
      },
      orderBy: { createdAt: 'desc' }
    });
  }

  async findAll(query: { search?: string, supplierId?: string, userId: number }) {
    let supplierName: string | undefined;
    if (query.supplierId) {
      const account = await this.prisma.accountMaster.findUnique({
        where: { id: parseInt(query.supplierId, 10) }
      });
      supplierName = account?.accountName;
    }

    return this.prisma.grn.findMany({
      where: {
        userId: query.userId,
        ...(supplierName ? { supplierName } : {}),
        ...(query.search ? {
          OR: [
            { supplierName: { contains: query.search, mode: 'insensitive' } },
            { challanNumber: { contains: query.search, mode: 'insensitive' } },
          ]
        } : {})
      },
      include: { items: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: number) {
    const grn = await this.prisma.grn.findUnique({
      where: { id },
      include: { items: true },
    });
    if (!grn) throw new NotFoundException(`GRN ID ${id} not found`);
    return grn;
  }

  async update(id: number, updateDto: UpdateGrnDto, uploadedFilePath?: string) {
    const existing = await this.prisma.grn.findUnique({
      where: { id },
      include: { items: true },
    });
    if (!existing) throw new NotFoundException(`GRN ID ${id} not found`);

    let totalQuantity = existing.totalQuantity;
    let taxableAmount = existing.taxableAmount;
    let grandTotal = existing.grandTotal;
    let cgstAmount = existing.cgstAmount;
    let sgstAmount = existing.sgstAmount;
    let igstAmount = existing.igstAmount;

    if (updateDto.items) {
      totalQuantity = 0;
      taxableAmount = 0;
      for (const item of updateDto.items) {
        totalQuantity += Number(item.quantity);
        taxableAmount += Number(item.quantity) * Number(item.rate);
      }
      
      if (updateDto.accountSummary) {
        cgstAmount = updateDto.accountSummary.cgst;
        sgstAmount = updateDto.accountSummary.sgst;
        igstAmount = updateDto.accountSummary.igst;
        grandTotal = updateDto.accountSummary.grandTotal;
      } else {
        // Fallback or maintain existing logic if needed
        grandTotal = taxableAmount + cgstAmount + sgstAmount + igstAmount;
      }
    }

    return this.prisma.$transaction(async (tx) => {
      if (updateDto.items) {
        await tx.grnItem.deleteMany({ where: { grnId: id } });
      }

      return tx.grn.update({
        where: { id },
        data: {
          supplierName: updateDto.supplierName ?? existing.supplierName,
          address: updateDto.address ?? existing.address,
          challanNumber: updateDto.challanNumber ?? existing.challanNumber,
          grnDate: updateDto.grnDate ? new Date(updateDto.grnDate) : existing.grnDate,
          creditDays: updateDto.creditDays ?? existing.creditDays,
          gstNumber: updateDto.gstNumber ?? existing.gstNumber,
          poId: updateDto.poId ?? existing.poId,
          poNumber: updateDto.poNumber ?? existing.poNumber,
          bookingDate: updateDto.bookingDate ? new Date(updateDto.bookingDate) : existing.bookingDate,
          totalQuantity,
          taxableAmount,
          cgstAmount,
          sgstAmount,
          igstAmount,
          grandTotal,
          items: updateDto.items ? {
            create: updateDto.items.map(item => ({
              productId: item.productId ? parseInt(item.productId, 10) : null,
              productCode: item.productCode,
              productName: item.productName,
              hsnCode: item.hsnCode,
              totalPoQty: Number(item.totalPoQty || 0),
              receivedPoQty: Number(item.receivedPoQty || 0),
              receivedQty: Number(item.quantity || 0),
              remainingQty: Number(item.remainingQty || 0),
              rate: Number(item.rate),
              uom: item.uom,
              discountPercent: Number(item.discountPercent || 0),
              discountAmount: Number(item.discountAmt || 0),
              taxPercent: Number(item.taxPercent || 0),
              taxAmount: Number(item.taxAmount || 0),
              beforeTaxAmount: Number(item.beforeTaxAmount || 0),
              totalAmount: Number(item.amount || 0),
              amount: Number(item.amount || 0),
              printDescription: item.printDescription,
            }))
          } : undefined,
        },
        include: { items: true },
      });
    });
  }

  async remove(id: number, userId: number) {
    const existing = await this.prisma.grn.findUnique({ where: { id } });
    if (!existing || existing.userId !== userId) throw new NotFoundException('GRN not found');
    return this.prisma.grn.delete({ where: { id } });
  }

  async exportGrns(format: string, query: { search?: string, userId: number }) {
    const grns = await this.findAll(query);

    const now = new Date();
    const pad = (n: number) => n.toString().padStart(2, '0');
    const hours = now.getHours();
    const ampm = hours >= 12 ? 'pm' : 'am';
    const formattedHours = hours % 12 || 12;
    const d = pad(now.getUTCDate());
    const m = pad(now.getUTCMonth() + 1);
    const yyyy = now.getUTCFullYear();
    const hr = pad(formattedHours);
    const min = pad(now.getUTCMinutes());
    const sec = pad(now.getUTCSeconds());
    const timestamp = `${d}/${m}/${yyyy}, ${hr}:${min}:${sec} ${ampm}`;

    if (format === 'xlsx') {
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet('GRNs');
      worksheet.columns = [
        { header: 'Supplier Name', key: 'supplierName', width: 30 },
        { header: 'Supplier Challan No', key: 'challanNumber', width: 22 },
        { header: 'Booking Date', key: 'bookingDate', width: 15 },
        { header: 'PO No', key: 'poNumber', width: 15 },
        { header: 'Total Qty', key: 'totalQuantity', width: 12 },
        { header: 'Taxable Amt', key: 'taxableAmount', width: 15 },
        { header: 'Grand Total', key: 'grandTotal', width: 15 },
        { header: 'Status', key: 'status', width: 12 },
      ];

      grns.forEach(g => {
        worksheet.addRow({
          supplierName: g.supplierName,
          challanNumber: g.challanNumber || '-',
          bookingDate: g.bookingDate.toLocaleDateString(),
          poNumber: g.poNumber || '-',
          totalQuantity: g.totalQuantity,
          taxableAmount: g.taxableAmount,
          grandTotal: g.grandTotal,
          status: g.status === 'DELETED' ? 'Deleted' : 'Generated',
        });
      });

      worksheet.spliceRows(1, 0, [], [], [], []);
      worksheet.mergeCells('A1:H1');
      const titleCell = worksheet.getCell('A1');
      titleCell.value = 'ERP';
      titleCell.font = { size: 18, bold: true };
      titleCell.alignment = { horizontal: 'center', vertical: 'middle' };

      worksheet.mergeCells('A2:H2');
      const subtitleCell = worksheet.getCell('A2');
      subtitleCell.value = 'Goods Receipt Note Report';
      subtitleCell.font = { size: 14 };
      subtitleCell.alignment = { horizontal: 'center', vertical: 'middle' };

      worksheet.mergeCells('A3:H3');
      const timestampCell = worksheet.getCell('A3');
      timestampCell.value = `Exported on: ${timestamp}`;
      timestampCell.font = { size: 10 };
      timestampCell.alignment = { horizontal: 'right', vertical: 'middle' };

      const headerRow = worksheet.getRow(5);
      headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      headerRow.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF4472C4' }
      };
      headerRow.alignment = { horizontal: 'center', vertical: 'middle' };
      headerRow.height = 25;

      const buffer = await workbook.xlsx.writeBuffer();
      return {
        buffer: Buffer.from(buffer),
        filename: `grns_${Date.now()}.xlsx`,
        mimetype: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      };
    } else {
      return new Promise<any>((resolve) => {
        const doc = new PDFDocument({ margin: 20, size: 'A4', layout: 'landscape' });
        const buffers: Buffer[] = [];
        doc.on('data', buffers.push.bind(buffers));
        doc.on('end', () => resolve({ buffer: Buffer.concat(buffers), filename: `grns_${Date.now()}.pdf`, mimetype: 'application/pdf' }));

        doc.fontSize(18).font('Helvetica-Bold').text('ERP', { align: 'center' });
        doc.fontSize(14).font('Helvetica').text('Goods Receipt Note Report', { align: 'center' });
        doc.moveDown(0.5);
        doc.fontSize(10).text(`Exported on: ${timestamp}`, { align: 'right' });
        doc.moveDown();

        const tableTop = 100;
        const colX = [20, 170, 280, 360, 440, 520, 590, 660];
        const headers = ['Supplier Name', 'Challan No', 'Book Date', 'PO No', 'Total Qty', 'Taxable', 'Total', 'Status'];

        doc.rect(15, tableTop - 5, 735, 20).fill('#4472C4');
        doc.fontSize(8).font('Helvetica-Bold').fillColor('#FFFFFF');
        headers.forEach((h, i) => doc.text(h, colX[i], tableTop));

        let y = tableTop + 20;
        doc.fillColor('#000000').font('Helvetica');

        grns.forEach((g, index) => {
          if (y > 550) {
            doc.addPage({ margin: 20, size: 'A4', layout: 'landscape' });
            y = 40;
            doc.rect(15, y - 5, 735, 20).fill('#4472C4');
            doc.fontSize(8).font('Helvetica-Bold').fillColor('#FFFFFF');
            headers.forEach((h, i) => doc.text(h, colX[i], y));
            y += 20;
            doc.fillColor('#000000').font('Helvetica');
          }

          if (index % 2 === 1) {
            doc.rect(15, y - 3, 735, 15).fill('#F2F2F2').fillColor('#000000');
          }

          doc.fontSize(7);
          doc.text(g.supplierName.substring(0, 30), colX[0], y, { width: 140 });
          doc.text(g.challanNumber || '-', colX[1], y);
          doc.text(g.bookingDate.toLocaleDateString(), colX[2], y);
          doc.text(g.poNumber || '-', colX[3], y);
          doc.text(String(g.totalQuantity), colX[4], y);
          doc.text(g.taxableAmount.toFixed(2), colX[5], y);
          doc.text(g.grandTotal.toFixed(2), colX[6], y);
          doc.text(g.status === 'DELETED' ? 'Deleted' : 'Generated', colX[7], y);
          y += 20;
        });

        doc.end();
      });
    }
  }

  async printGrn(id: number, userId: number) {
    const grn = await this.prisma.grn.findUnique({
      where: { id },
      include: { items: true, user: { include: { shopDetail: true } } },
    });
    if (!grn) throw new NotFoundException('GRN not found');

    return new Promise<any>((resolve) => {
      const doc = new PDFDocument({ margin: 20, size: 'A4' });
      const buffers: Buffer[] = [];
      doc.on('data', buffers.push.bind(buffers));
      doc.on('end', () => resolve({ buffer: Buffer.concat(buffers), filename: `GRN_${grn.challanNumber}.pdf`, mimetype: 'application/pdf' }));
      doc.text(`Challan: ${grn.challanNumber}`, 20, 20);
      // ... rest of print logic ...
      doc.end();
    });
  }
}
