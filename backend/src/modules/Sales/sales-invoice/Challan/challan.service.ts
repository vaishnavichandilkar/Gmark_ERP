import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../../../infrastructure/prisma/prisma.service';
import { CreateChallanDto, UpdateChallanDto } from './dto/challan.dto';
import { SalesOrderService } from '../../sales-order/sales-order.service';
import * as ExcelJS from 'exceljs';
import * as PDFDocument from 'pdfkit';

@Injectable()
export class ChallanService {
  constructor(
    private prisma: PrismaService,
    private soService: SalesOrderService
  ) { }

  private async calculateChallanTotals(dto: CreateChallanDto, userId: number, existingId?: number) {
    const bookingDate = new Date(); // Enforced (Condition 1 & 2)
    const challanDate = new Date(dto.challanDate || new Date());
    const today = new Date();
    today.setHours(23, 59, 59, 999);

    if (challanDate > today) {
      throw new BadRequestException('Challan Date cannot be in the future');
    }

    if (dto.soId) {
      const so = await this.prisma.salesOrder.findUnique({ where: { id: Number(dto.soId) } });
      if (so) {
        const soDate = new Date(so.soCreationDate);
        soDate.setHours(0, 0, 0, 0);
        const challanOnlyDate = new Date(challanDate);
        challanOnlyDate.setHours(0, 0, 0, 0);
        
        if (challanOnlyDate < soDate) {
          throw new BadRequestException(`Challan Date cannot be before SO Creation Date (${soDate.toLocaleDateString()})`);
        }
      }
    }

    const company = await this.prisma.shopDetail.findUnique({ where: { userId } });
    const customer = await this.prisma.accountMaster.findFirst({
      where: { userId, accountName: { equals: dto.customerName, mode: 'insensitive' } }
    });

    if (!company) throw new BadRequestException('Company detail not found');
    if (!customer) throw new BadRequestException(`Customer '${dto.customerName}' not found`);

    const userGstDoc = await this.prisma.sellerDocument.findFirst({
      where: { uploadedByUserId: userId, type: 'GST' },
      select: { name: true }
    });
    const userGst = userGstDoc?.name;
    const customerGst = dto.gstNumber || customer.gstNo;

    const companyState = (company.state || "").trim().toLowerCase();
    const customerState = (customer.state || "").trim().toLowerCase();

    const isValidGst = (name?: string | null) => Boolean(name && name.trim().toUpperCase() !== 'N/A' && name.trim().length >= 10);
    let isGstApplicable = isValidGst(userGst);
    let isRcm = false;
    let isInterState = false;

    if (isGstApplicable) {
      const userCode = userGst.substring(0, 2);
      const customerCode = customerGst ? customerGst.substring(0, 2) : null;

      if (customerGst && /^\d{2}$/.test(userCode) && /^\d{2}$/.test(customerCode)) {
        isInterState = userCode !== customerCode;
      } else {
        isInterState = companyState !== customerState;
      }
    }

    let totalQuantity = 0;
    let taxableAmount = 0;
    let totalTaxAmount = 0;
    const itemsToCreate = [];

    for (const item of dto.items) {
      const prev = await this.prisma.salesChallanItem.aggregate({
        where: {
          salesChallan: {
            userId,
            customerName: dto.customerName,
            status: { not: 'DELETED' },
            id: existingId ? { not: existingId } : undefined
          },
          productCode: item.productCode
        },
        _sum: { challanQty: true }
      });

      const givenSoQty = prev._sum.challanQty || 0;
      const totalSoQty = Number(item.totalSoQty || 0);
      const currentQty = Number(item.quantity);
      const remainingQty = totalSoQty > 0 ? totalSoQty - (givenSoQty + currentQty) : 0;

      const discountAmount = Number(item.discountAmt || 0);
      const beforeTaxAmount = (currentQty * Number(item.rate)) - discountAmount;
      const taxPercent = Number(item.taxPercent || 0);
      const itemTaxAmount = isGstApplicable ? (beforeTaxAmount * taxPercent) / 100 : 0;
      const totalAmount = beforeTaxAmount + itemTaxAmount;

      totalQuantity += currentQty;
      taxableAmount += beforeTaxAmount;
      totalTaxAmount += itemTaxAmount;

      itemsToCreate.push({
        productId: item.productId || null,
        productCode: item.productCode,
        productName: item.productName,
        hsnCode: item.hsnCode || null,
        totalSoQty,
        givenSoQty,
        challanQty: currentQty,
        remainingQty: remainingQty < 0 ? 0 : remainingQty,
        rate: Number(item.rate),
        uom: item.uom,
        discountPercent: Number(item.discountPercent || 0),
        discountAmount,
        taxPercent,
        taxAmount: itemTaxAmount,
        beforeTaxAmount,
        totalAmount
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
          if (exp.isGstApplicable) taxAmt = (amt * taxRate) / 100;
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
      if (isInterState) igstAmount = finalTaxTotal;
      else {
        cgstAmount = finalTaxTotal / 2;
        sgstAmount = finalTaxTotal / 2;
      }
    }

    const grandTotal = taxableAmount + expenseTotal + (isRcm ? 0 : finalTaxTotal) + postGstChargeTotal;

    const last = await this.prisma.salesChallan.findFirst({
      where: { userId, customerName: dto.customerName, status: { not: 'DELETED' } },
      orderBy: { createdAt: 'desc' },
      select: { cumulativeBalance: true }
    });
    const cumulativeBalance = (last ? last.cumulativeBalance : 0) + grandTotal;

    return {
      bookingDate,
      customerGst: customer.gstNo,
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

  async getCustomerSOsForChallan(customerName: string, userId: number) {
    if (!customerName) return [];

    const sos = await this.prisma.salesOrder.findMany({
      where: {
        userId,
        customerName: { equals: customerName, mode: 'insensitive' },
        status: { notIn: ['DELETED', 'CHALLAN_COMPLETED', 'INVOICE_COMPLETED'] as any },
      },
      include: {
        items: true,
        salesChallans: {
          where: { status: { not: 'DELETED' } },
          include: { items: true }
        }
      },
      orderBy: { soNumber: 'desc' },
    });

    const filteredSos = sos.filter(so => {
      const totalSoQty = so.items.reduce((sum, item) => sum + item.quantity, 0);
      const totalDeliveredQty = so.salesChallans.reduce((sum, ch) => {
        return sum + ch.items.reduce((iSum, i) => iSum + i.challanQty, 0);
      }, 0);
      
      return totalDeliveredQty < totalSoQty;
    });

    return filteredSos.map(so => ({
      id: so.id,
      soNumber: so.soNumber,
      soCreationDate: so.soCreationDate,
      items: so.items
    }));
  }
  
  async generateChallanNumber(userId: number): Promise<string> {
    const lastChallan = await this.prisma.salesChallan.findFirst({
      where: { 
        userId,
        challanNumber: { startsWith: 'CH' } 
      },
      orderBy: { challanNumber: 'desc' },
      select: { challanNumber: true },
    });

    if (!lastChallan) return 'CH0001';
    
    const lastNumStr = lastChallan.challanNumber.replace('CH', '');
    const lastNumber = parseInt(lastNumStr, 10);
    
    if (isNaN(lastNumber)) return 'CH0001';
    
    return `CH${(lastNumber + 1).toString().padStart(4, '0')}`;
  }

  async updateSOStatusAfterChallan(soId: number, tx: any) {
    if (!soId) return;

    const so = await tx.salesOrder.findUnique({
      where: { id: soId },
      include: {
        items: true,
        salesChallans: {
          where: { status: { not: 'DELETED' } },
          include: { items: true }
        }
      }
    });

    if (!so) return;

    const totalSoQty = so.items.reduce((sum, item) => sum + item.quantity, 0);
    const totalDeliveredQty = so.salesChallans.reduce((sum, ch) => {
      return sum + ch.items.reduce((iSum, i) => iSum + i.challanQty, 0);
    }, 0);

    let newStatus = so.status;
    if (totalDeliveredQty >= totalSoQty) {
      if (so.status !== 'INVOICE_COMPLETED') {
        newStatus = 'CHALLAN_COMPLETED';
      }
    } else {
      newStatus = 'PENDING';
    }

    if (so.status !== newStatus) {
      await tx.salesOrder.update({
        where: { id: soId },
        data: { status: newStatus }
      });
    }
  }

  async create(createDto: CreateChallanDto, userId: number, uploadedFilePath?: string) {
    const totals = await this.calculateChallanTotals(createDto, userId);
    return this.prisma.$transaction(async (tx) => {
      const challan = await tx.salesChallan.create({
        data: {
          challanDate: createDto.challanDate ? new Date(createDto.challanDate) : new Date(),
          bookingDate: totals.bookingDate,
          customerName: createDto.customerName,
          address: createDto.address,
          gstNumber: createDto.gstNumber || totals.customerGst || null,
          soNumber: createDto.soNumber,
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
          soId: createDto.soId,
          items: { create: totals.itemsToCreate },
          expenses: { create: totals.expensesToCreate }
        },
        include: { items: true, expenses: true }
      });

      if (createDto.soId) {
        await this.updateSOStatusAfterChallan(createDto.soId, tx);
      }
      return challan;
    });
  }

  async getCustomerChallans(customerName: string, userId: number, soNumber?: string, excludeInvoiceId?: number) {
    // 1. Fetch all Challans for the customer
    const challans = await this.prisma.salesChallan.findMany({
      where: {
        userId,
        customerName: { equals: customerName, mode: 'insensitive' },
        status: { not: 'DELETED' },
        ...(soNumber && soNumber.trim() !== '' ? { soNumber: { equals: soNumber.trim(), mode: 'insensitive' } } : {})
      },
      include: {
        items: true,
      },
      orderBy: { createdAt: 'desc' }
    });

    // 2. Fetch all invoices that might refer to these Challans
    const invoices = await this.prisma.salesInvoice.findMany({
      where: { 
        userId, 
        status: { not: 'DELETED' },
        ...(excludeInvoiceId ? { id: { not: excludeInvoiceId } } : {})
      },
      include: { items: true }
    });

    // 3. Filter Challans based on invoiced quantity
    return challans.filter(ch => {
      const totalChallanQty = ch.items.reduce((sum, item) => sum + item.challanQty, 0);
      
      // Calculate how much of this Challan has been invoiced
      const totalInvoicedQty = invoices.reduce((sum, inv) => {
        if (inv.challanNumber && typeof inv.challanNumber === 'string') {
          const challanIds = inv.challanNumber.split(',').map(id => id.trim());
          if (challanIds.includes(ch.id.toString()) || challanIds.includes(ch.challanNumber)) {
            return sum + inv.items.reduce((iSum, i) => iSum + i.quantity, 0);
          }
        }
        return sum;
      }, 0);

      return totalInvoicedQty < totalChallanQty;
    });
  }

  async getReceivedQty(customerName: string, productCode: string, userId: number, soNumber?: string) {
    const prev = await this.prisma.salesChallanItem.aggregate({
      where: {
        salesChallan: {
          userId,
          customerName: { equals: customerName, mode: 'insensitive' },
          soNumber: soNumber || undefined,
          status: { not: 'DELETED' }
        },
        productCode
      },
      _sum: { challanQty: true }
    });
    return { givenSoQty: prev._sum.challanQty || 0 };
  }

  async findAll(query: { search?: string, status?: string, page?: number, limit?: number, customerId?: string, userId: number }) {
    const where: any = { userId: query.userId };
    if (query.status && query.status !== 'all') where.status = query.status.toUpperCase();
    if (query.search) {
      where.OR = [
        { customerName: { contains: query.search, mode: 'insensitive' } },
        { challanNumber: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.max(1, Number(query.limit) || 10);
    const skip = (page - 1) * limit;

    const [data, total] = await Promise.all([
      this.prisma.salesChallan.findMany({
        where, 
        include: { items: true, expenses: true },
        orderBy: { createdAt: 'desc' },
        skip, take: limit
      }),
      this.prisma.salesChallan.count({ where })
    ]);

    return { data, meta: { total, page, limit, totalPages: Math.ceil(total / limit) } };
  }

  async findOne(id: number, userId: number) {
    const challan = await this.prisma.salesChallan.findUnique({
      where: { id, userId },
      include: { items: true, expenses: true }
    });
    if (!challan) throw new NotFoundException(`Challan ID ${id} not found or access denied`);
    return challan;
  }

  async update(id: number, updateDto: any, userId: number) {
    const existing = await this.prisma.salesChallan.findUnique({ 
      where: { id, userId },
      include: { items: true, expenses: true } 
    });
    if (!existing) throw new NotFoundException('Challan not found');

    return this.prisma.$transaction(async (tx) => {
      await tx.salesChallanItem.deleteMany({ where: { salesChallanId: id } });
      await tx.salesChallanExpense.deleteMany({ where: { salesChallanId: id } });

      const totalsDto = {
        ...existing,
        ...updateDto,
        items: updateDto.items || existing.items,
        expenses: updateDto.expenses || existing.expenses
      };

      const totals = await this.calculateChallanTotals(totalsDto, userId, id);
      const challan = await tx.salesChallan.update({
        where: { id },
        data: {
          customerName: updateDto.customerName,
          address: updateDto.address,
          gstNumber: updateDto.gstNumber,
          creditDays: updateDto.creditDays,
          soId: updateDto.soId ?? existing.soId,
          soNumber: updateDto.soNumber,
          challanNumber: updateDto.challanNumber,
          challanDate: updateDto.challanDate ? new Date(updateDto.challanDate) : undefined,
          status: updateDto.status,
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
        include: { items: true, expenses: true }
      });

      if (updateDto.soId) {
        await this.updateSOStatusAfterChallan(updateDto.soId, tx);
      } else if (existing.soId) {
        await this.updateSOStatusAfterChallan(existing.soId, tx);
      }

      return challan;
    });
  }

  async remove(id: number, userId: number) {
    return this.prisma.$transaction(async (tx) => {
      const challan = await tx.salesChallan.update({ 
        where: { id, userId }, 
        data: { status: 'DELETED' } 
      });
      if (challan.soId) {
        await this.updateSOStatusAfterChallan(challan.soId, tx);
      }
      return challan;
    });
  }

  async downloadSample() {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Sales Challan Sample');
    const headers = [
      'Customer Name*', 'Challan No*', 'Challan Date (YYYY-MM-DD)*', 'Booking Date (YYYY-MM-DD)',
      'Address*', 'Credit Days*', 'SO No', 'Product Code*', 'Quantity*', 'Rate*', 'UOM*'
    ];
    worksheet.addRow(headers);

    const headerRow = worksheet.getRow(1);
    headerRow.font = { bold: true };
    headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD3D3D3' } };
    worksheet.columns = headers.map(() => ({ width: 22 }));

    const buffer = await workbook.xlsx.writeBuffer();
    return {
      buffer: Buffer.from(buffer),
      filename: 'sales_challan_sample.xlsx',
      mimetype: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    };
  }

  async exportChallans(format: string, query: { search?: string, userId: number }) {
    const challansData = await this.findAll(query);
    const challans = challansData.data;

    const now = new Date();
    const pad = (n: number) => n.toString().padStart(2, '0');
    const hours = now.getHours();
    const ampm = hours >= 12 ? 'pm' : 'am';
    const formattedHours = hours % 12 || 12;
    const timestamp = `${pad(now.getDate())}/${pad(now.getMonth() + 1)}/${now.getFullYear()}, ${pad(formattedHours)}:${pad(now.getMinutes())}:${pad(now.getSeconds())} ${ampm}`;

    if (format === 'xlsx') {
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet('Sales Challans');
      worksheet.columns = [
        { header: 'Challan No', key: 'challanNumber', width: 15 },
        { header: 'Customer Name', key: 'customerName', width: 30 },
        { header: 'Date', key: 'challanDate', width: 15 },
        { header: 'Booking Date', key: 'bookingDate', width: 15 },
        { header: 'SO No', key: 'soNumber', width: 15 },
        { header: 'Taxable Amt', key: 'taxableAmount', width: 15 },
        { header: 'Grand Total', key: 'grandTotal', width: 15 },
        { header: 'Status', key: 'status', width: 12 },
      ];

      challans.forEach(ch => {
        worksheet.addRow({
          challanNumber: ch.challanNumber,
          customerName: ch.customerName,
          challanDate: ch.challanDate.toLocaleDateString(),
          bookingDate: ch.bookingDate.toLocaleDateString(),
          soNumber: ch.soNumber || '-',
          taxableAmount: ch.taxableAmount,
          grandTotal: ch.grandTotal,
          status: ch.status,
        });
      });

      worksheet.spliceRows(1, 0, [], [], [], []);
      worksheet.mergeCells('A1:H1');
      worksheet.getCell('A1').value = 'ERP';
      worksheet.getCell('A1').font = { size: 18, bold: true };
      worksheet.getCell('A1').alignment = { horizontal: 'center' };

      worksheet.mergeCells('A2:H2');
      worksheet.getCell('A2').value = 'Sales Challan Report';
      worksheet.getCell('A2').font = { size: 14 };
      worksheet.getCell('A2').alignment = { horizontal: 'center' };

      worksheet.mergeCells('A3:H3');
      worksheet.getCell('A3').value = `Exported on: ${timestamp}`;
      worksheet.getCell('A3').alignment = { horizontal: 'right' };

      const headerRow = worksheet.getRow(5);
      headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4472C4' } };

      const buffer = await workbook.xlsx.writeBuffer();
      return {
        buffer: Buffer.from(buffer),
        filename: `sales_challans_${Date.now()}.xlsx`,
        mimetype: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      };
    } else {
      return new Promise<any>((resolve) => {
        const doc = new PDFDocument({ margin: 20, size: 'A4', layout: 'landscape' });
        const buffers: Buffer[] = [];
        doc.on('data', buffers.push.bind(buffers));
        doc.on('end', () => resolve({ buffer: Buffer.concat(buffers), filename: `sales_challans_${Date.now()}.pdf`, mimetype: 'application/pdf' }));

        doc.fontSize(18).font('Helvetica-Bold').text('ERP', { align: 'center' });
        doc.fontSize(14).font('Helvetica').text('Sales Challan Report', { align: 'center' });
        doc.moveDown(0.5);
        doc.fontSize(10).text(`Exported on: ${timestamp}`, { align: 'right' });
        doc.moveDown();

        const tableTop = 100;
        const colX = [20, 100, 250, 340, 420, 500, 580, 660];
        const headers = ['Challan No', 'Customer Name', 'Challan Date', 'Book Date', 'SO No', 'Taxable', 'Total', 'Status'];

        doc.rect(15, tableTop - 5, 780, 20).fill('#4472C4');
        doc.fontSize(8).font('Helvetica-Bold').fillColor('#FFFFFF');
        headers.forEach((h, i) => doc.text(h, colX[i], tableTop));

        let y = tableTop + 20;
        doc.fillColor('#000000').font('Helvetica');

        challans.forEach((ch, index) => {
          if (y > 500) {
            doc.addPage({ margin: 20, size: 'A4', layout: 'landscape' });
            y = 40;
            doc.rect(15, y - 5, 780, 20).fill('#4472C4');
            doc.fontSize(8).font('Helvetica-Bold').fillColor('#FFFFFF');
            headers.forEach((h, i) => doc.text(h, colX[i], y));
            y += 20;
            doc.fillColor('#000000').font('Helvetica');
          }

          if (index % 2 === 1) doc.rect(15, y - 3, 780, 15).fill('#F2F2F2').fillColor('#000000');

          doc.fontSize(7);
          doc.text(ch.challanNumber, colX[0], y);
          doc.text(ch.customerName.substring(0, 30), colX[1], y);
          doc.text(ch.challanDate.toLocaleDateString(), colX[2], y);
          doc.text(ch.bookingDate.toLocaleDateString(), colX[3], y);
          doc.text(ch.soNumber || '-', colX[4], y);
          doc.text(ch.taxableAmount.toFixed(2), colX[5], y);
          doc.text(ch.grandTotal.toFixed(2), colX[6], y);
          doc.text(ch.status, colX[7], y);
          y += 20;
        });

        doc.end();
      });
    }
  }

  async importChallans(buffer: Buffer, userId: number) {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer as any);
    const worksheet = workbook.getWorksheet(1);
    const rowCount = worksheet.rowCount;
    if (rowCount < 2) throw new BadRequestException('No data to import');

    let imported = 0;
    const errors: string[] = [];

    const parseDate = (val: any): Date | undefined => {
      if (!val) return undefined;
      const date = new Date(val);
      return isNaN(date.getTime()) ? undefined : date;
    };

    const challansMap = new Map<string, any>();

    for (let i = 2; i <= rowCount; i++) {
      const row = worksheet.getRow(i);
      try {
        const customerName = String(row.getCell(1).value || '').trim();
        const challanNumber = String(row.getCell(2).value || '').trim();
        if (!challanNumber || !customerName) continue;

        if (!challansMap.has(challanNumber)) {
          const customer = await this.prisma.accountMaster.findFirst({
            where: { accountName: customerName, userId }
          });
          if (!customer) throw new Error(`Customer '${customerName}' not found`);

          challansMap.set(challanNumber, {
            customerName: customer.accountName,
            challanNumber,
            challanDate: parseDate(row.getCell(3).value) || new Date(),
            bookingDate: parseDate(row.getCell(4).value) || new Date(),
            address: String(row.getCell(5).value || '').trim() || customer.addressLine1,
            creditDays: parseInt(String(row.getCell(6).value), 10) || 0,
            soNumber: String(row.getCell(7).value || '').trim(),
            items: []
          });
        }

        const ch = challansMap.get(challanNumber);
        const productCode = String(row.getCell(8).value || '').trim();
        const product = await this.prisma.product.findFirst({ 
          where: { product_code: productCode, created_by: userId },
          include: { uom: true }
        });
        if (!product) throw new Error(`Product '${productCode}' not found`);

        ch.items.push({
          productId: product.id,
          productCode: product.product_code,
          productName: product.product_name,
          quantity: parseFloat(String(row.getCell(9).value)) || 0,
          rate: parseFloat(String(row.getCell(10).value)) || 0,
          uom: String(row.getCell(11).value || '').trim() || product.uom?.gst_uom || 'Nos',
          taxPercent: Number(product.tax_rate) || 0,
          totalSoQty: 0, // Manual import might not have SO details, defaulting to 0
        });
      } catch (err) {
        errors.push(`Row ${i}: ${err.message}`);
      }
    }

    for (const challan of challansMap.values()) {
      try {
        await this.create(challan, userId);
        imported++;
      } catch (err) {
        errors.push(`Challan ${challan.challanNumber}: ${err.message}`);
      }
    }

    return { imported, total: challansMap.size, errors };
  }

  async printChallan(id: number, userId: number) {
    const challan = await this.findOne(id, userId);
    return { buffer: Buffer.from(''), filename: 'challan.pdf', mimetype: 'application/pdf' };
  }
}
