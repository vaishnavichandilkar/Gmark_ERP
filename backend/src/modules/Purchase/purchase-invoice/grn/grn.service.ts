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

  private async calculateGrnTotals(dto: CreateGrnDto, userId: number, existingId?: number) {
    const bookingDate = dto.bookingDate ? new Date(dto.bookingDate) : new Date();

    const company = await this.prisma.shopDetail.findUnique({
      where: { userId },
      select: { state: true }
    });

    const supplier = await this.prisma.accountMaster.findFirst({
      where: {
        userId,
        accountName: { equals: dto.supplierName, mode: 'insensitive' }
      },
      select: { state: true, gstNo: true }
    });

    if (!company) throw new BadRequestException('Company shop details not found');
    if (!supplier) throw new BadRequestException(`Supplier '${dto.supplierName}' not found in Account Master`);

    // Fetch user's registered GST
    const userGstDoc = await this.prisma.sellerDocument.findFirst({
        where: { uploadedByUserId: userId, type: 'GST' },
        select: { name: true }
    });
    const userGst = userGstDoc?.name;

    const companyState = (company.state || "").trim().toLowerCase();
    const supplierState = (supplier.state || "").trim().toLowerCase();
    const supplierGst = dto.gstNumber || supplier.gstNo;

    let isGstApplicable = true;
    let isRcm = false;
    let isInterState = false;

    const userCode = userGst ? userGst.substring(0, 2) : null;
    const supplierCode = supplierGst ? supplierGst.substring(0, 2) : null;

    if (userGst && supplierGst) {
        // Case 1: Both have GST
        if (/^\d{2}$/.test(userCode) && /^\d{2}$/.test(supplierCode)) {
            isInterState = userCode !== supplierCode;
        } else {
            isInterState = companyState !== supplierState;
        }
    } else if (userGst && !supplierGst) {
        // Case 2: Supplier NO, Buyer YES (RCM)
        isRcm = true;
        isGstApplicable = true;
    } else if (!userGst && supplierGst) {
        // Case 3: Buyer NO, Supplier YES (Normal GST)
        isRcm = false;
        isGstApplicable = true;
        isInterState = companyState !== supplierState;
    } else {
        // Case 4: Both NO
        isGstApplicable = false;
    }

    let totalQuantity = 0;
    let taxableAmount = 0;
    let totalTaxAmount = 0;

    const itemsToCreate = [];
    for (const item of dto.items) {
      if (item.quantity <= 0 || item.rate <= 0) {
        throw new BadRequestException(`Quantity and Rate must be positive for product ${item.productName}`);
      }

      const previousTotalReceived = await this.prisma.grnItem.aggregate({
        where: {
          grn: {
            userId,
            supplierName: dto.supplierName,
            poNumber: dto.poNumber || undefined,
            status: { not: 'DELETED' },
            id: existingId ? { not: existingId } : undefined
          },
          productCode: item.productCode
        },
        _sum: { receivedQty: true }
      });

      const receivedPoQty = previousTotalReceived._sum.receivedQty || 0;
      const totalPoQty = Number(item.totalPoQty || 0);
      const currentReceived = Number(item.quantity);
      const remainingQty = totalPoQty > 0 ? totalPoQty - (receivedPoQty + currentReceived) : 0;

      const discountAmount = Number(item.discountAmt || 0);
      const beforeTaxAmount = (currentReceived * Number(item.rate)) - discountAmount;
      const taxPercent = Number(item.taxPercent || 0);
      const itemTaxAmount = (beforeTaxAmount * taxPercent) / 100;
      const totalAmount = beforeTaxAmount + itemTaxAmount;

      totalQuantity += currentReceived;
      taxableAmount += beforeTaxAmount;
      totalTaxAmount += itemTaxAmount;

      itemsToCreate.push({
        productId: item.productId ? parseInt(item.productId, 10) : null,
        productCode: item.productCode,
        productName: item.productName,
        hsnCode: item.hsnCode,
        totalPoQty,
        receivedPoQty,
        receivedQty: currentReceived,
        remainingQty: remainingQty < 0 ? 0 : remainingQty,
        rate: Number(item.rate),
        uom: item.uom,
        discountPercent: Number(item.discountPercent || 0),
        discountAmount: discountAmount,
        taxPercent,
        taxAmount: itemTaxAmount,
        beforeTaxAmount,
        totalAmount,
        amount: totalAmount,
        printDescription: item.printDescription,
      });
    }

    let expenseTotal = 0;
    let expenseTaxTotal = 0;
    let postGstChargeTotal = 0;
    const expensesToCreate = [];

    if (dto.expenses) {
      for (const exp of dto.expenses) {
        const amt = Number(exp.amount || 0);
        const isPostGst = !!exp.isPostGst;
        const taxRate = Number(exp.taxRate || 0);
        let taxAmt = 0;

        if (!isPostGst) {
          if (exp.isGstApplicable) {
            taxAmt = (amt * taxRate) / 100;
          }
          expenseTotal += amt;
          expenseTaxTotal += taxAmt;
        } else {
          postGstChargeTotal += amt;
        }

        expensesToCreate.push({
          groupName: exp.groupName,
          amount: amt,
          taxRate,
          taxAmount: taxAmt,
          isGstApplicable: !!exp.isGstApplicable,
          isPostGst: isPostGst
        });
      }
    }

    const finalTaxTotal = isGstApplicable ? (totalTaxAmount + expenseTaxTotal) : 0;
    let cgstAmount = 0, sgstAmount = 0, igstAmount = 0;

    if (isGstApplicable) {
        if (isInterState) {
            igstAmount = finalTaxTotal;
        } else {
            cgstAmount = finalTaxTotal / 2;
            sgstAmount = finalTaxTotal / 2;
        }
    }

    // In RCM (Case 2), Buyer calculates and pays tax. Tax should NOT be added to supplier's grand total.
    const taxToAddToTotal = isRcm ? 0 : finalTaxTotal;
    const grandTotal = taxableAmount + expenseTotal + taxToAddToTotal + postGstChargeTotal;

    const lastGrn = await this.prisma.grn.findFirst({
      where: { 
        userId, 
        supplierName: dto.supplierName, 
        id: existingId ? { not: existingId } : undefined,
        status: { not: 'DELETED' }
      },
      orderBy: { createdAt: 'desc' },
      select: { cumulativeBalance: true },
    });

    const cumulativeBalance = (lastGrn ? lastGrn.cumulativeBalance : 0) + grandTotal;

    return {
      bookingDate,
      supplierGst: supplier.gstNo,
      totalQuantity,
      taxableAmount,
      cgstAmount,
      sgstAmount,
      igstAmount,
      grandTotal,
      cumulativeBalance,
      isInterState,
      isRcm,
      isGstApplicable,
      itemsToCreate,
      expensesToCreate
    };
  }

  async create(createDto: CreateGrnDto, userId: number, uploadedFilePath?: string) {
    const totals = await this.calculateGrnTotals(createDto, userId);

    return this.prisma.$transaction(async (tx) => {
      const grn = await tx.grn.create({
        data: {
          grnDate: createDto.grnDate ? new Date(createDto.grnDate) : new Date(),
          bookingDate: totals.bookingDate,
          supplierName: createDto.supplierName,
          address: createDto.address,
          gstNumber: createDto.gstNumber || totals.supplierGst || null,
          poNumber: createDto.poNumber,
          challanNumber: createDto.challanNumber,
          creditDays: createDto.creditDays || 0,
          totalQuantity: totals.totalQuantity,
          taxableAmount: totals.taxableAmount,
          cgstAmount: totals.cgstAmount,
          sgstAmount: totals.sgstAmount,
          igstAmount: totals.igstAmount,
          grandTotal: totals.grandTotal,
          cumulativeBalance: totals.cumulativeBalance,
          isInterState: totals.isInterState,
          isRcm: totals.isRcm,
          userId,
          poId: createDto.poId,
          items: { create: totals.itemsToCreate },
          expenses: { create: totals.expensesToCreate }
        },
        include: { items: true, expenses: true },
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
        grandTotal: true,
        poId: true,
        poNumber: true
      },
      orderBy: { createdAt: 'desc' }
    });
  }

  async getReceivedQty(supplierName: string, productCode: string, userId: number, poNumber?: string) {
    const prev = await this.prisma.grnItem.aggregate({
      where: {
        grn: {
          userId,
          supplierName: { equals: supplierName, mode: 'insensitive' },
          poNumber: poNumber || undefined,
          status: { not: 'DELETED' }
        },
        productCode
      },
      _sum: { receivedQty: true }
    });
    return { receivedPoQty: prev._sum.receivedQty || 0 };
  }

  async findAll(query: { search?: string, status?: string, page?: number, limit?: number, supplierId?: string, userId: number }) {
    let supplierName: string | undefined;
    if (query.supplierId) {
      const account = await this.prisma.accountMaster.findUnique({
        where: { id: parseInt(query.supplierId, 10) }
      });
      supplierName = account?.accountName;
    }

    const where: any = {
      userId: query.userId,
      ...(supplierName ? { supplierName } : {}),
    };

    if (query.status && query.status !== 'all') {
      where.status = query.status.toUpperCase();
    }

    if (query.search) {
      where.OR = [
        { supplierName: { contains: query.search, mode: 'insensitive' } },
        { challanNumber: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.max(1, Number(query.limit) || 10);
    const skip = (page - 1) * limit;

    const [data, total] = await Promise.all([
      this.prisma.grn.findMany({
        where,
        include: { items: true, expenses: true },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.grn.count({ where })
    ]);

    return {
      data,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit)
      }
    };
  }

  async findOne(id: number, userId: number) {
    const grn = await this.prisma.grn.findFirst({
      where: { id, userId },
      include: { items: true, expenses: true },
    });
    if (!grn) throw new NotFoundException(`GRN ID ${id} not found or access denied`);
    return grn;
  }
 
  async update(id: number, updateDto: any, userId: number, uploadedFilePath?: string) {
    const existing = await this.findOne(id, userId);
    if (!existing) throw new NotFoundException(`GRN ID ${id} not found`);

    const mergedDto: CreateGrnDto = {
      ...existing,
      ...updateDto,
      bookingDate: updateDto.bookingDate || existing.bookingDate.toISOString(),
      items: updateDto.items || existing.items.map(i => ({
        ...i,
        quantity: i.receivedQty,
        discountAmt: i.discountAmount
      })),
      expenses: updateDto.expenses || existing.expenses
    };

    const totals = await this.calculateGrnTotals(mergedDto, existing.userId, id);

    return this.prisma.$transaction(async (tx) => {
      await tx.grnItem.deleteMany({ where: { grnId: id } });
      await tx.grnExpense.deleteMany({ where: { grnId: id } });

      return tx.grn.update({
        where: { id },
        data: {
          supplierName: updateDto.supplierName ?? existing.supplierName,
          address: updateDto.address ?? existing.address,
          challanNumber: updateDto.challanNumber ?? existing.challanNumber,
          grnDate: updateDto.grnDate ? new Date(updateDto.grnDate) : existing.grnDate,
          creditDays: updateDto.creditDays ?? existing.creditDays,
          gstNumber: updateDto.gstNumber ?? totals.supplierGst ?? existing.gstNumber,
          poId: updateDto.poId ?? existing.poId,
          poNumber: updateDto.poNumber ?? existing.poNumber,
          bookingDate: totals.bookingDate,
          totalQuantity: totals.totalQuantity,
          taxableAmount: totals.taxableAmount,
          cgstAmount: totals.cgstAmount,
          sgstAmount: totals.sgstAmount,
          igstAmount: totals.igstAmount,
          grandTotal: totals.grandTotal,
          cumulativeBalance: totals.cumulativeBalance,
          isInterState: totals.isInterState,
          isRcm: totals.isRcm,
          items: { create: totals.itemsToCreate },
          expenses: { create: totals.expensesToCreate }
        },
        include: { items: true, expenses: true },
      });
    });
  }

  async remove(id: number, userId: number) {
    const existing = await this.prisma.grn.findUnique({ where: { id } });
    if (!existing || existing.userId !== userId) throw new NotFoundException('GRN not found');
    return this.prisma.grn.update({ 
      where: { id },
      data: { status: 'DELETED' }
    });
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

      grns.data.forEach(g => {
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

        grns.data.forEach((g, index) => {
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
