import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../../../infrastructure/prisma/prisma.service';
import { CreateChallanDto, UpdateChallanDto } from './dto/challan.dto';
import { SalesOrderService } from '../../sales-order/sales-order.service';
import * as ExcelJS from 'exceljs';
import * as PDFDocument from 'pdfkit';
import { formatDate, parseDDMMYYYY } from '../../../../utils/dateFormatter';
import { determineSalesGst } from '../../../../common/utils/gst.helper';

@Injectable()
export class ChallanService {
  constructor(
    private prisma: PrismaService,
    private soService: SalesOrderService
  ) { }

  private async _getMatchedCustomerNames(customerName: string, userId: number): Promise<string[]> {
    const trimmed = customerName.trim();
    const accounts = await this.prisma.accountMaster.findMany({
      where: {
        userId,
        accountName: { startsWith: trimmed, mode: 'insensitive' }
      },
      select: { accountName: true }
    });
    return Array.from(new Set([
      trimmed,
      customerName,
      ...accounts
        .map(a => a.accountName)
        .filter(name => name.trim().toLowerCase() === trimmed.toLowerCase())
    ]));
  }

  private async calculateChallanTotals(dto: CreateChallanDto, userId: number, existingId?: number) {
    const bookingDate = new Date(); // Enforced (Condition 1 & 2)
    const challanDate = new Date(dto.challanDate || new Date());
    const today = new Date();
    today.setHours(23, 59, 59, 999);

    if (dto.soId) {
      const so = await this.prisma.salesOrder.findUnique({ where: { id: Number(dto.soId) } });
      const soDate = so ? new Date(so.soCreationDate) : null;
      if (soDate) {
        soDate.setHours(0, 0, 0, 0);
        const challanOnlyDate = new Date(challanDate);
        challanOnlyDate.setHours(0, 0, 0, 0);
        
        if (challanOnlyDate < soDate || challanDate > today) {
          throw new BadRequestException('Challan Date must be between SO Date and Current Date.');
        }
      } else if (challanDate > today) {
        throw new BadRequestException('Challan Date must be between SO Date and Current Date.');
      }
    } else {
      const now = new Date();
      const fyStart = new Date(now.getMonth() < 3 ? now.getFullYear() - 1 : now.getFullYear(), 3, 1);
      fyStart.setHours(0, 0, 0, 0);
      const challanOnlyDate = new Date(challanDate);
      challanOnlyDate.setHours(0, 0, 0, 0);

      if (challanOnlyDate < fyStart || challanDate > today) {
        throw new BadRequestException('Challan Date must be within current financial year.');
      }
    }

    const company = await this.prisma.shopDetail.findUnique({ where: { userId } });
    const customer = await this.prisma.accountMaster.findFirst({
      where: { userId, accountName: { equals: dto.customerName, mode: 'insensitive' } }
    });

    if (!company) throw new BadRequestException('Company detail not found');
    if (!customer) throw new BadRequestException(`Customer '${dto.customerName}' not found`);

    if (customer.status !== 'ACTIVE' || customer.customerStatus !== 'ACTIVE') {
      throw new BadRequestException('Customer is inactive. New sales transactions are not allowed.');
    }

    const sellerMsme = await this.isSellerMsme(userId);

    let creditDays = dto.creditDays !== undefined && dto.creditDays !== null ? dto.creditDays : (customer.customerCreditDays || 0);

    if (sellerMsme && creditDays > 45) {
      const entered = creditDays;
      creditDays = 45;
      dto.creditDays = 45;
      await this.prisma.auditLog.create({
        data: {
          userId,
          action: 'MSME_AUTO_CORRECT',
          resource: 'SalesChallan',
          details: {
            entered,
            final: 45,
            reason: 'MSME Compliance Rule',
            comment: 'MSME Manufacturing/Service Credit Limit',
            type: 'Customer'
          }
        }
      });
    }

    const userGstDoc = await this.prisma.sellerDocument.findFirst({
      where: { uploadedByUserId: userId, type: 'GST', url: 'N/A' },
      select: { name: true }
    });
    const userGst = userGstDoc?.name;
    const customerGst = dto.gstNumber || customer.gstNo;

    const companyState = (company.state || "").trim().toLowerCase();
    const customerState = (customer.state || "").trim().toLowerCase();

    const isValidGst = (name?: string | null) => Boolean(
      name && 
      name.trim().toUpperCase() !== 'N/A' && 
      name.trim().toUpperCase() !== 'NOT AVAILABLE' && 
      name.trim().toUpperCase() !== '-' && 
      name.trim().length >= 10
    );
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
        totalAmount,
        printDescription: item.printDescription || item.productName || ''
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

    const gstResult = determineSalesGst(
      userGst,
      customerGst,
      company.state,
      customer.state,
      taxableAmount + expenseTotal, // base
      0,                            // percent
      totalTaxAmount + expenseTaxTotal // preCalculated
    );

    const cgstAmount = gstResult.cgstAmount;
    const sgstAmount = gstResult.sgstAmount;
    const igstAmount = gstResult.igstAmount;
    const finalTaxTotal = gstResult.totalGstAmount;
    isInterState = gstResult.gstType === 'IGST';
    isGstApplicable = gstResult.gstType !== 'NONE';

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
      expensesToCreate,
      creditDays
    };
  }

  async getCustomerSOsForChallan(customerName: string, userId: number) {
    if (!customerName) return [];

    const matchedNames = await this._getMatchedCustomerNames(customerName, userId);

    const sos = await this.prisma.salesOrder.findMany({
      where: {
        userId,
        customerName: { in: matchedNames },
        status: { not: 'DELETED' },
      },
      include: {
        items: true,
        salesChallans: {
          where: { status: { not: 'DELETED' } },
          include: { items: true }
        },
        salesInvoices: {
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

      return (totalSoQty - totalDeliveredQty) > 0.01;
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
        },
        salesInvoices: {
          where: { status: { not: 'DELETED' } },
          include: { items: true }
        }
      }
    });

    if (!so) return;

    const totalSoQty = so.items.reduce((sum, item) => sum + item.quantity, 0);
    
    const totalDeliveredQty = (so.salesChallans || []).reduce((sum, ch) => {
      return sum + (ch.items || []).reduce((iSum, i) => iSum + (Number(i.challanQty) || 0), 0);
    }, 0);

    const totalInvoicedQty = (so.salesInvoices || []).reduce((sum, inv) => {
      return sum + (inv.items || []).reduce((iSum, i) => iSum + (Number(i.quantity) || 0), 0);
    }, 0);

    const consumedQty = Math.max(totalDeliveredQty, totalInvoicedQty);

    let newStatus = so.status;
    if (consumedQty >= totalSoQty) {
      if (totalInvoicedQty >= totalSoQty) {
        newStatus = 'INVOICE_COMPLETED';
      } else {
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
          creditDays: totals.creditDays || 0,
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
    const matchedNames = await this._getMatchedCustomerNames(customerName, userId);
    const challans = await this.prisma.salesChallan.findMany({
      where: {
        userId,
        customerName: { in: matchedNames },
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
    const matchedNames = await this._getMatchedCustomerNames(customerName, userId);
    const [chSum, invSum] = await Promise.all([
        this.prisma.salesChallanItem.aggregate({
          where: {
            salesChallan: {
              userId,
              customerName: { in: matchedNames },
              soNumber: soNumber || undefined,
              status: { not: 'DELETED' }
            },
            productCode
          },
          _sum: { challanQty: true }
        }),
        this.prisma.salesInvoiceItem.aggregate({
          where: {
            salesInvoice: {
              userId,
              customerName: { in: matchedNames },
              soNumber: soNumber ? { contains: soNumber } : undefined,
              status: { not: 'DELETED' }
            },
            productCode
          },
          _sum: { quantity: true }
        })
    ]);

    const totalChallan = chSum._sum.challanQty || 0;
    const totalInvoiced = invSum._sum.quantity || 0;

    return { givenSoQty: Math.max(totalChallan, totalInvoiced) };
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

    const invoices = await this.prisma.salesInvoice.findMany({
      where: { userId: query.userId, status: { not: 'DELETED' } },
      select: { challanNumber: true }
    });

    const mappedData = data.map(challan => {
      const isLinked = invoices.some(inv => {
        if (!inv.challanNumber) return false;
        const challanIds = inv.challanNumber.split(',').map(idx => idx.trim());
        return challanIds.includes(challan.id.toString()) || challanIds.includes(challan.challanNumber);
      });
      return { ...challan, isInvoiced: isLinked };
    });

    return { data: mappedData, meta: { total, page, limit, totalPages: Math.ceil(total / limit) } };
  }

  async findOne(id: number, userId: number) {
    const challan = await this.prisma.salesChallan.findUnique({
      where: { id, userId },
      include: { items: true, expenses: true }
    });
    if (!challan) throw new NotFoundException(`Challan ID ${id} not found or access denied`);

    const invoices = await this.prisma.salesInvoice.findMany({
      where: { userId, status: { not: 'DELETED' } },
      select: { challanNumber: true }
    });
    const isLinked = invoices.some(inv => {
      if (!inv.challanNumber) return false;
      const challanIds = inv.challanNumber.split(',').map(idx => idx.trim());
      return challanIds.includes(id.toString()) || challanIds.includes(challan.challanNumber);
    });

    return { ...challan, isInvoiced: isLinked };
  }

  async update(id: number, updateDto: any, userId: number) {
    const existing = await this.prisma.salesChallan.findUnique({ 
      where: { id, userId },
      include: { items: true, expenses: true } 
    });
    if (!existing) throw new NotFoundException('Challan not found');

    // Check if Challan is linked to any Sales Invoice
    const invoices = await this.prisma.salesInvoice.findMany({
      where: { userId, status: { not: 'DELETED' } },
      select: { challanNumber: true }
    });
    const isLinked = invoices.some(inv => {
      if (!inv.challanNumber) return false;
      const challanIds = inv.challanNumber.split(',').map(idx => idx.trim());
      return challanIds.includes(id.toString()) || challanIds.includes(existing.challanNumber);
    });
    if (isLinked) {
      throw new ForbiddenException(`Challan cannot be edited because it is linked to a Sales Invoice.`);
    }

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
          creditDays: totals.creditDays,
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
    const existing = await this.prisma.salesChallan.findUnique({ where: { id, userId } });
    if (!existing) throw new NotFoundException('Challan not found');

    // Check if Challan is linked to any Sales Invoice
    const invoices = await this.prisma.salesInvoice.findMany({
      where: { userId, status: { not: 'DELETED' } },
      select: { challanNumber: true }
    });
    const isLinked = invoices.some(inv => {
      if (!inv.challanNumber) return false;
      const challanIds = inv.challanNumber.split(',').map(idx => idx.trim());
      return challanIds.includes(id.toString()) || challanIds.includes(existing.challanNumber);
    });
    if (isLinked) {
      throw new ForbiddenException(`Challan cannot be deleted because it is linked to a Sales Invoice.`);
    }

    return this.prisma.$transaction(async (tx) => {
      const challan = await tx.salesChallan.update({ 
        where: { id, userId }, 
        data: { 
          status: 'DELETED',
          challanNumber: `${existing.challanNumber}_DELETED_${Date.now()}`
        } 
      });
      if (challan.soId) {
        await this.updateSOStatusAfterChallan(challan.soId, tx);
      }
      return challan;
    });
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
      worksheet.views = [{ state: 'frozen', ySplit: 5 }];
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
          challanDate: formatDate(ch.challanDate),
          bookingDate: formatDate(ch.bookingDate),
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
          doc.text(formatDate(ch.challanDate), colX[2], y);
          doc.text(formatDate(ch.bookingDate), colX[3], y);
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

  async downloadSample() {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Challan Template');
    worksheet.views = [{ state: 'frozen', ySplit: 1 }];

    const headers = [
      'Challan Number*', 'Challan Date*', 'SO Number*', 'Customer Name*',
      'Product Name*', 'Quantity*', 'Rate*', 'Discount (₹)', 'Discount (%)'
    ];
    const headerRow = worksheet.getRow(1);
    headerRow.height = 28;
    headers.forEach((h, idx) => {
      const cell = headerRow.getCell(idx + 1);
      const isRequired = h.includes('*');
      cell.value = h;
      cell.font = { bold: true, color: { argb: isRequired ? 'FF881337' : 'FF1E293B' }, size: 11 };
      cell.alignment = { vertical: 'middle', horizontal: 'center' };
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: isRequired ? 'FFFECDD3' : 'FFF1F5F9' }
      };
      cell.border = {
        top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        bottom: { style: 'medium', color: { argb: isRequired ? 'FFFDA4AF' : 'FFCBD5E1' } },
        right: { style: 'thin', color: { argb: 'FFE2E8F0' } },
      };
    });



    worksheet.columns = headers.map((h, i) => {
      let width = Math.max(20, h.length + 5);
      if (i === 3) width = 30; // Customer Name
      if (i === 4) width = 30; // Product Name
      return { width };
    });

    const buffer = await workbook.xlsx.writeBuffer();
    return {
      buffer: Buffer.from(buffer),
      filename: 'Challan_Import_Sample.xlsx',
      mimetype: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    };
  }

  async importChallans(buffer: Buffer, userId: number) {
    if (!buffer || buffer.length === 0) {
      throw new BadRequestException('Empty or invalid file uploaded');
    }

    const workbook = new ExcelJS.Workbook();
    try {
      await workbook.xlsx.load(buffer as any);
    } catch (error) {
      throw new BadRequestException('Invalid Excel file format. Please upload a valid .xlsx file.');
    }
    const worksheet = workbook.getWorksheet(1);
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
        if (val.includes('challan number')) { colMap['challanNumber'] = colNumber; found = true; }
        if (val.includes('challan date')) colMap['challanDate'] = colNumber;
        if (val.includes('so number')) colMap['soNumber'] = colNumber;
        if (val.includes('customer name')) colMap['customerName'] = colNumber;
        if (val.includes('product name')) colMap['productName'] = colNumber;
        if (val.includes('quantity')) colMap['quantity'] = colNumber;
        if (val.includes('rate')) colMap['rate'] = colNumber;
        if (val.includes('discount (₹)') || val.includes('discount amount') || val.includes('discount rs')) colMap['discountAmount'] = colNumber;
        if (val.includes('discount (%)') || val.includes('discount percent')) colMap['discountPercent'] = colNumber;
      });
      if (found) {
        headerRowIndex = r;
        break;
      }
    }

    const mandatoryCols = ['challanNumber', 'challanDate', 'soNumber', 'customerName', 'productName', 'quantity', 'rate'];
    const missing = mandatoryCols.filter(col => !colMap[col]);
    if (headerRowIndex === -1 || missing.length > 0) {
      throw new BadRequestException(`Invalid template. Missing mandatory columns: ${missing.join(', ')}`);
    }

    const getVal = (row: ExcelJS.Row, key: string, defaultVal: any = '') => {
      const colIdx = colMap[key];
      if (!colIdx) return defaultVal;
      const cell = row.getCell(colIdx);
      let val = cell.value;
      if (val && typeof val === 'object' && 'result' in val) {
        val = val.result;
      }
      if (val && (val instanceof Date || Object.prototype.toString.call(val) === '[object Date]' || typeof (val as any).getTime === 'function')) {
        return val;
      }
      return String(val !== undefined && val !== null ? val : '').trim();
    };

    // Preload Lookups
    const parsedRows: any[] = [];
    const groupMap = new Map<string, any[]>();

    for (let r = headerRowIndex + 1; r <= rowCount; r++) {
      const row = worksheet.getRow(r);
      const challanNumber = getVal(row, 'challanNumber');
      if (!challanNumber || challanNumber === '-') continue;

      const item = {
        rowNum: r,
        originalRowValues: row.values,
        challanNumber,
        challanDateStr: getVal(row, 'challanDate'),
        soNumber: getVal(row, 'soNumber'),
        customerName: getVal(row, 'customerName'),
        productName: getVal(row, 'productName'),
        quantityStr: getVal(row, 'quantity'),
        rateStr: getVal(row, 'rate'),
        discountAmountStr: getVal(row, 'discountAmount'),
        discountPercentStr: getVal(row, 'discountPercent'),
      };

      parsedRows.push(item);
      if (!groupMap.has(challanNumber)) {
        groupMap.set(challanNumber, []);
      }
      groupMap.get(challanNumber).push(item);
    }

    const distinctSoNumbers = Array.from(new Set(parsedRows.map(r => r.soNumber).filter(Boolean)));

    const [dbCustomers, dbProducts, userShop, userGstDoc, dbSalesOrders, dbChallans, challanItems] = await Promise.all([
      this.prisma.accountMaster.findMany({
        where: { userId, customerStatus: 'ACTIVE' }
      }),
      this.prisma.product.findMany({
        where: { created_by: userId, status: 'ACTIVE' },
        include: { uom: true }
      }),
      this.prisma.shopDetail.findUnique({
        where: { userId }
      }),
      this.prisma.sellerDocument.findFirst({
        where: { uploadedByUserId: userId, type: 'GST', url: 'N/A' },
        select: { name: true }
      }),
      this.prisma.salesOrder.findMany({
        where: { userId, soNumber: { in: distinctSoNumbers }, status: { not: 'DELETED' } },
        include: { items: true }
      }),
      this.prisma.salesChallan.findMany({
        where: { userId, status: { not: 'DELETED' } },
        select: { challanNumber: true }
      }),
      this.prisma.salesChallanItem.findMany({
        where: {
          salesChallan: {
            userId,
            status: { not: 'DELETED' },
            soNumber: { in: distinctSoNumbers }
          }
        },
        select: {
          productCode: true,
          challanQty: true,
          salesChallan: {
            select: { soNumber: true }
          }
        }
      })
    ]);

    const customerMap = new Map<string, any>();
    for (const cust of dbCustomers) {
      customerMap.set(cust.accountName.toLowerCase().trim(), cust);
    }

    const productMap = new Map<string, any>();
    for (const prod of dbProducts) {
      productMap.set(prod.product_name.toLowerCase().trim(), prod);
    }

    const soMap = new Map<string, any>();
    for (const so of dbSalesOrders) {
      soMap.set(so.soNumber.toLowerCase().trim(), so);
    }

    const dbChallanNumbers = new Set(dbChallans.map(ch => ch.challanNumber.toLowerCase().trim()));
    const importedChallanNumbersInFile = new Set<string>();

    const deliveredQtyMap = new Map<string, number>();
    for (const item of challanItems) {
      const soNo = item.salesChallan.soNumber?.toLowerCase().trim() || '';
      const pCode = item.productCode.toLowerCase().trim();
      const key = `${soNo}_${pCode}`;
      deliveredQtyMap.set(key, (deliveredQtyMap.get(key) || 0) + item.challanQty);
    }

    const successRows: any[] = [];
    const failedRows: { rowNum: number; values: any[]; error: string }[] = [];
    const rowErrors: { row: number; error: string }[] = [];

    const isValidGst = (name?: string | null) => Boolean(
      name && 
      name.trim().toUpperCase() !== 'N/A' && 
      name.trim().toUpperCase() !== 'NOT AVAILABLE' && 
      name.trim().toUpperCase() !== '-' && 
      name.trim().length >= 10
    );

    const userGst = userGstDoc?.name;
    const companyState = (userShop?.state || "").trim().toLowerCase();
    const isGstApplicable = isValidGst(userGst);

    for (const [challanNumber, rows] of groupMap.entries()) {
      const groupErrors: string[] = [];
      const firstRow = rows[0];

      // Check duplicates
      if (dbChallanNumbers.has(challanNumber.toLowerCase())) {
        groupErrors.push(`Record already exists.`);
      }
      if (importedChallanNumbersInFile.has(challanNumber.toLowerCase())) {
        groupErrors.push(`Duplicate Challan Number in file.`);
      }

      // Customer check
      const custName = firstRow.customerName;
      const customer = customerMap.get(custName.toLowerCase());
      if (!customer) {
        groupErrors.push(`Customer "${custName}" not found. Please create the customer first.`);
      }

      const parsedChallanDate = parseDDMMYYYY(firstRow.challanDateStr);
      if (!parsedChallanDate) {
        groupErrors.push(`Invalid Challan Date format. Please use DD/MM/YYYY.`);
      }

      // Sales Order check
      const soNumber = firstRow.soNumber;
      const salesOrder = soMap.get(soNumber.toLowerCase().trim());
      if (!salesOrder) {
        groupErrors.push(`Sales Order not found.`);
      } else {
        if (parsedChallanDate && salesOrder.soCreationDate) {
          const soDate = new Date(salesOrder.soCreationDate);
          if (parsedChallanDate < soDate) {
            groupErrors.push(`Challan Date must be greater than or equal to SO Date.`);
          }
        }
      }

      const processedItems: any[] = [];
      let totalQuantity = 0;
      let taxableAmount = 0;
      let totalTaxAmount = 0;

      for (const row of rows) {
        const prod = productMap.get(row.productName.toLowerCase());
        if (!prod) {
          groupErrors.push(`Product "${row.productName}" not found. Please create the product first.`);
          continue;
        }

        const qty = parseFloat(row.quantityStr);
        const rate = parseFloat(row.rateStr);
        if (isNaN(qty) || qty <= 0) groupErrors.push(`Row ${row.rowNum}: Quantity must be greater than 0.`);
        if (isNaN(rate) || rate < 0) groupErrors.push(`Row ${row.rowNum}: Rate must be 0 or positive.`);

        const discountAmt = parseFloat(row.discountAmountStr || '0');
        const discountPct = parseFloat(row.discountPercentStr || '0');
        if (isNaN(discountAmt) || discountAmt < 0) groupErrors.push(`Row ${row.rowNum}: Discount amount must be positive.`);
        if (isNaN(discountPct) || discountPct < 0 || discountPct > 100) groupErrors.push(`Row ${row.rowNum}: Discount percent must be between 0 and 100.`);

        if (groupErrors.length > 0) continue;

        // SO validation details
        if (salesOrder) {
          const soItem = salesOrder.items.find(
            (it: any) => it.productCode.toLowerCase().trim() === prod.product_code.toLowerCase().trim()
          );

          if (!soItem) {
            groupErrors.push(`Row ${row.rowNum}: Product "${row.productName}" does not belong to Sales Order ${soNumber}.`);
            continue;
          }

          // Rate check
          if (Math.abs(rate - soItem.rate) >= 0.01) {
            groupErrors.push(`Row ${row.rowNum}: Rate mismatch with Sales Order.`);
          }

          // Discount checks
          if (Math.abs(discountAmt - soItem.discountAmount) >= 0.01) {
            groupErrors.push(`Row ${row.rowNum}: Discount mismatch with Sales Order.`);
          }
          if (Math.abs(discountPct - soItem.discountPercent) >= 0.01) {
            groupErrors.push(`Row ${row.rowNum}: Discount mismatch with Sales Order.`);
          }

          // Remaining quantity check
          const key = `${soNumber.toLowerCase().trim()}_${prod.product_code.toLowerCase().trim()}`;
          const alreadyDelivered = deliveredQtyMap.get(key) || 0;
          const remaining = soItem.quantity - alreadyDelivered;

          if (qty > remaining) {
            groupErrors.push(`Row ${row.rowNum}: Quantity exceeds Sales Order quantity.`);
          } else {
            // Update in-memory map to reflect current row's allocation for subsequent rows in same Challan/file
            deliveredQtyMap.set(key, alreadyDelivered + qty);
          }
        }

        if (groupErrors.length > 0) continue;

        const beforeTaxAmount = (qty * rate) - discountAmt;
        const taxRate = Number(prod.tax_rate || 0);
        const taxAmount = isGstApplicable ? ((beforeTaxAmount * taxRate) / 100) : 0;
        const totalItemAmount = beforeTaxAmount + taxAmount;

        totalQuantity += qty;
        taxableAmount += beforeTaxAmount;
        totalTaxAmount += taxAmount;

        processedItems.push({
          productId: prod.id,
          productCode: prod.product_code,
          productName: prod.product_name,
          hsnCode: prod.hsn_code || null,
          totalSoQty: salesOrder ? salesOrder.items.find((it: any) => it.productCode === prod.product_code)?.quantity || 0 : 0,
          givenSoQty: salesOrder ? (deliveredQtyMap.get(`${soNumber.toLowerCase()}_${prod.product_code.toLowerCase()}`) || 0) - qty : 0,
          challanQty: qty,
          remainingQty: salesOrder ? Math.max(0, (salesOrder.items.find((it: any) => it.productCode === prod.product_code)?.quantity || 0) - (deliveredQtyMap.get(`${soNumber.toLowerCase()}_${prod.product_code.toLowerCase()}`) || 0)) : 0,
          rate,
          uom: prod.uom?.unit_name || 'Nos',
          discountPercent: discountPct,
          discountAmount: discountAmt,
          taxPercent: taxRate,
          taxAmount,
          beforeTaxAmount,
          totalAmount: totalItemAmount,
          printDescription: prod.product_name
        });
      }

      if (groupErrors.length > 0) {
        const combinedErrorMsg = groupErrors.join(' | ');
        for (const row of rows) {
          rowErrors.push({ row: row.rowNum, error: combinedErrorMsg });
          failedRows.push({
            rowNum: row.rowNum,
            values: row.originalRowValues,
            error: combinedErrorMsg
          });
        }
      } else {
        try {
          const customerGst = customer?.gstNo;
          const customerState = (customer?.state || "").trim().toLowerCase();

          let isInterState = false;
          if (isGstApplicable) {
            const userCode = userGst?.substring(0, 2);
            const customerCode = customerGst ? customerGst.substring(0, 2) : null;
            if (customerGst && /^\d{2}$/.test(userCode) && /^\d{2}$/.test(customerCode)) {
              isInterState = userCode !== customerCode;
            } else {
              isInterState = companyState !== customerState;
            }
          }

          let cgstAmount = 0;
          let sgstAmount = 0;
          let igstAmount = 0;
          if (isInterState) {
            igstAmount = totalTaxAmount;
          } else {
            cgstAmount = totalTaxAmount / 2;
            sgstAmount = totalTaxAmount / 2;
          }

          await this.prisma.$transaction(async (tx) => {
            await tx.salesChallan.create({
              data: {
                challanNumber,
                customerName: customer.accountName,
                address: customer.addressLine1 + (customer.addressLine2 ? ', ' + customer.addressLine2 : ''),
                gstNumber: customer.gstNo || '',
                soNumber: soNumber || null,
                challanDate: parsedChallanDate,
                bookingDate: new Date(),
                creditDays: customer.customerCreditDays || 0,
                soId: salesOrder ? salesOrder.id : null,
                grandTotal: taxableAmount + totalTaxAmount,
                cgstAmount,
                sgstAmount,
                igstAmount,
                taxableAmount,
                totalQuantity,
                isInterState,
                userId,
                status: 'GENERATED',
                items: {
                  create: processedItems.map(item => ({
                    productId: item.productId,
                    productCode: item.productCode,
                    productName: item.productName,
                    hsnCode: item.hsnCode,
                    totalSoQty: item.totalSoQty,
                    givenSoQty: item.givenSoQty,
                    challanQty: item.challanQty,
                    remainingQty: item.remainingQty,
                    rate: item.rate,
                    uom: item.uom,
                    discountAmount: item.discountAmount,
                    discountPercent: item.discountPercent,
                    taxPercent: item.taxPercent,
                    beforeTaxAmount: item.beforeTaxAmount,
                    taxAmount: item.taxAmount,
                    totalAmount: item.totalAmount,
                    printDescription: item.printDescription
                  }))
                }
              }
            });

            // Update SO Status to COMPLETED if all items are fully delivered
            if (salesOrder) {
              const allSoItems = salesOrder.items;
              let isFullyDelivered = true;
              for (const it of allSoItems) {
                const key = `${soNumber.toLowerCase().trim()}_${it.productCode.toLowerCase().trim()}`;
                const totalDelivered = deliveredQtyMap.get(key) || 0;
                if (totalDelivered < it.quantity) {
                  isFullyDelivered = false;
                  break;
                }
              }
              if (isFullyDelivered) {
                await tx.salesOrder.update({
                  where: { id: salesOrder.id },
                  data: { status: 'CHALLAN_COMPLETED' }
                });
              }
            }
          });

          importedChallanNumbersInFile.add(challanNumber.toLowerCase());
          for (const row of rows) {
            successRows.push(row);
          }
        } catch (dbError: any) {
          const dbErrMsg = `Database Save Failed: ${dbError.message || dbError}`;
          for (const row of rows) {
            rowErrors.push({ row: row.rowNum, error: dbErrMsg });
            failedRows.push({
              rowNum: row.rowNum,
              values: row.originalRowValues,
              error: dbErrMsg
            });
          }
        }
      }
    }

    // Build Excel response files
    const headers = [
      'Challan Number*', 'Challan Date*', 'SO Number*', 'Customer Name*',
      'Product Name*', 'Quantity*', 'Rate*', 'Discount (₹)', 'Discount (%)'
    ];

    const successWb = new ExcelJS.Workbook();
    const successWs = successWb.addWorksheet('Success Reports');
    successWs.addRow(headers);
    successWs.getRow(1).font = { bold: true };
    successWs.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD3D3D3' } };
    successRows.forEach(r => {
      const rowVals = r.originalRowValues.slice(1);
      successWs.addRow(rowVals);
    });
    const successBuffer = await successWb.xlsx.writeBuffer();

    const failedWb = new ExcelJS.Workbook();
    const failedWs = failedWb.addWorksheet('Error Reports');
    failedWs.addRow([...headers, 'Error Description']);
    failedWs.getRow(1).font = { bold: true };
    failedWs.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD3D3D3' } };
    failedRows.forEach(r => {
      const rowVals = r.values.slice(1);
      while (rowVals.length < headers.length) rowVals.push('');
      rowVals[headers.length] = r.error;
      failedWs.addRow(rowVals);
    });
    const failedBuffer = await failedWb.xlsx.writeBuffer();

    return {
      success: true,
      summary: {
        totalRows: parsedRows.length,
        successful: successRows.length,
        failed: failedRows.length
      },
      errors: rowErrors,
      successFile: Buffer.from(successBuffer).toString('base64'),
      errorFile: Buffer.from(failedBuffer).toString('base64')
    };
  }

  async printChallan(id: number, userId: number) {
    const challan = await this.findOne(id, userId);
    return { buffer: Buffer.from(''), filename: 'challan.pdf', mimetype: 'application/pdf' };
  }

  private async isSellerMsme(userId: number): Promise<boolean> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { sellerDocuments: true }
    });
    if (!user) return false;
    const isSellerMsmeActive = user.sellerDocuments.some(
      doc => doc.category === 'UDYOG_AADHAR' && doc.name && doc.name.trim() !== '' && doc.name.trim().toUpperCase() !== 'N/A'
    );
    const isSellerMsmeType = user.regType === 'Manufacturing' || user.regType === 'Service';
    return Boolean(isSellerMsmeActive && isSellerMsmeType);
  }

  private async isCustomerMsme(mobileNo?: string, emailId?: string, gstNo?: string): Promise<boolean> {
    const conditions = [];
    if (mobileNo && mobileNo.trim() !== '') {
      conditions.push({ phone: mobileNo.trim() });
    }
    if (emailId && emailId.trim() !== '') {
      conditions.push({ email: emailId.trim() });
    }
    if (gstNo && gstNo.trim() !== '') {
      const gstDoc = await this.prisma.sellerDocument.findFirst({
        where: { type: 'GST', name: gstNo.trim() }
      });
      if (gstDoc && gstDoc.uploadedByUserId) {
        conditions.push({ id: gstDoc.uploadedByUserId });
      }
    }
    if (conditions.length === 0) return false;
    const user = await this.prisma.user.findFirst({
      where: { OR: conditions },
      include: { sellerDocuments: true }
    });
    if (!user) return false;
    const isMsmeActive = user.sellerDocuments.some(
      d => d.category === 'UDYOG_AADHAR' && d.name && d.name.trim() !== '' && d.name.trim().toUpperCase() !== 'N/A'
    );
    const isMsmeType = user.regType === 'Manufacturing' || user.regType === 'Service';
    return Boolean(isMsmeActive && isMsmeType);
  }
}
