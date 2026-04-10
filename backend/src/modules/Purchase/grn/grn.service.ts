import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/prisma/prisma.service';
import { CreateGrnDto, UpdateGrnDto } from './dto/grn.dto';
import { PurchaseOrderService } from '../purchase-order/purchase-order.service';
import * as ExcelJS from 'exceljs';
import * as PDFDocument from 'pdfkit';

@Injectable()
export class GrnService {
  constructor(
    private prisma: PrismaService,
    private poService: PurchaseOrderService
  ) {}

  async generateGrnNumber(): Promise<string> {
    const lastGrn = await this.prisma.grn.findFirst({
      where: { grnNumber: { startsWith: 'GRN-' } },
      orderBy: { grnNumber: 'desc' },
      select: { grnNumber: true },
    });

    if (!lastGrn) {
      return 'GRN-0001';
    }

    const lastNumber = parseInt(lastGrn.grnNumber.replace('GRN-', ''), 10);
    if (isNaN(lastNumber)) return 'GRN-0001';
    return `GRN-${(lastNumber + 1).toString().padStart(4, '0')}`;
  }

  async create(createDto: CreateGrnDto, userId: number, uploadedFilePath?: string) {
    const grnNumber = await this.generateGrnNumber();
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

    // Estimate cumulative balance (simple implementation)
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

      if (!finalPoId && createDto.supplierName) {
        // Option to auto-create PO if needed, or just link if poNumber provided
        // For now, let's keep it simple or follow PI logic if required
      }

      const grn = await tx.grn.create({
        data: {
          grnNumber,
          grnDate: new Date(),
          bookingDate,
          supplierName: createDto.supplierName,
          address: createDto.address || '',
          poNumber: finalPoNumber,
          challanNumber: createDto.challanNumber,
          creditDays: createDto.creditDays || 0,
          uploadedFilePath: uploadedFilePath || null,
          totalQuantity,
          taxableAmount,
          cgstAmount,
          sgstAmount,
          grandTotal,
          cumulativeBalance,
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

      return grn;
    });
  }

  async findAll(query: { search?: string, userId: number }) {
    return this.prisma.grn.findMany({
      where: {
        userId: query.userId,
        ...(query.search ? {
          OR: [
            { grnNumber: { contains: query.search, mode: 'insensitive' } },
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

    if (updateDto.items) {
      totalQuantity = 0;
      taxableAmount = 0;
      for (const item of updateDto.items) {
        totalQuantity += Number(item.quantity);
        taxableAmount += Number(item.quantity) * Number(item.rate);
      }
      grandTotal = taxableAmount + (taxableAmount * 0.18); // Simplified 18%
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
          bookingDate: updateDto.bookingDate ? new Date(updateDto.bookingDate) : existing.bookingDate,
          uploadedFilePath: uploadedFilePath || existing.uploadedFilePath,
          totalQuantity,
          taxableAmount,
          grandTotal,
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
    });
  }

  async remove(id: number, userId: number) {
    const existing = await this.prisma.grn.findUnique({ where: { id } });
    if (!existing || existing.userId !== userId) throw new NotFoundException('GRN not found');
    return this.prisma.grn.delete({ where: { id } });
  }

  async exportGrns(format: string, query: { search?: string, userId: number }) {
    const grns = await this.findAll(query);

    if (format === 'xlsx') {
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet('GRNs');
      worksheet.columns = [
        { header: 'GRN No', key: 'grnNumber', width: 15 },
        { header: 'Supplier', key: 'supplierName', width: 25 },
        { header: 'Challan No', key: 'challanNumber', width: 15 },
        { header: 'Date', key: 'grnDate', width: 15 },
        { header: 'Total Qty', key: 'totalQuantity', width: 12 },
        { header: 'Grand Total', key: 'grandTotal', width: 15 },
      ];
      grns.forEach(g => {
        worksheet.addRow({
          ...g,
          grnDate: g.grnDate.toLocaleDateString(),
        });
      });
      const buffer = await workbook.xlsx.writeBuffer();
      return {
        buffer: Buffer.from(buffer),
        filename: `grns_${Date.now()}.xlsx`,
        mimetype: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      };
    } else {
      // PDF export logic similar to PI
      return new Promise<any>((resolve) => {
        const doc = new PDFDocument({ margin: 30, size: 'A4', layout: 'landscape' });
        const buffers: Buffer[] = [];
        doc.on('data', buffers.push.bind(buffers));
        doc.on('end', () => resolve({ buffer: Buffer.concat(buffers), filename: `grns_${Date.now()}.pdf`, mimetype: 'application/pdf' }));
        doc.fontSize(20).text('Goods Receipt Notes Report', { align: 'center' });
        doc.moveDown();
        // ... add table logic if needed ...
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
        doc.on('end', () => resolve({ buffer: Buffer.concat(buffers), filename: `GRN_${grn.grnNumber}.pdf`, mimetype: 'application/pdf' }));
        doc.text(`GRN: ${grn.grnNumber}`, 20, 20);
        // ... rest of print logic ...
        doc.end();
    });
  }
}
