import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../../../infrastructure/prisma/prisma.service';
import { CreateSalesInvoiceDto, UpdateSalesInvoiceDto, SalesInvoiceStatus } from './dto/invoice.dto';
import { SalesOrderService } from '../../sales-order/sales-order.service';
import * as ExcelJS from 'exceljs';
import * as PDFDocument from 'pdfkit';
import { isValidGst, determineSalesGst } from '../../../../common/utils/gst.helper';

@Injectable()
export class SalesInvoiceService {
  constructor(
    private prisma: PrismaService,
    private soService: SalesOrderService
  ) { }

  async getCustomers(userId: number) {
    return this.prisma.accountMaster.findMany({
      where: {
        userId,
        groupName: { has: 'SUNDRY_DEBTORS' },
        status: 'ACTIVE',
      },
      select: {
        id: true,
        accountName: true,
        customerCreditDays: true,
        addressLine1: true,
        addressLine2: true,
        gstNo: true,
        panNo: true,
        state: true,
        customerType: true,
      },
      orderBy: { accountName: 'asc' },
    });
  }

  async getCustomerSOs(customerIdOrName: string, userId: number, excludeInvoiceId?: number) {
    if (!customerIdOrName) return [];
    
    let accountName = String(customerIdOrName).trim();
    if (/^\d+$/.test(accountName)) {
      const account = await this.prisma.accountMaster.findUnique({
        where: { id: parseInt(accountName, 10) },
      });
      if (account) accountName = account.accountName;
    }

    const sos = await this.prisma.salesOrder.findMany({
      where: {
        userId,
        customerName: { equals: accountName, mode: 'insensitive' },
        status: { notIn: ['DELETED', 'INVOICE_COMPLETED'] as any },
      },
      include: {
        items: true,
        salesInvoices: {
          where: { 
            status: { not: 'DELETED' },
            ...(excludeInvoiceId ? { id: { not: excludeInvoiceId } } : {})
          },
          include: { items: true }
        }
      },
      orderBy: { soNumber: 'desc' },
    });

    // Filter SOs where total invoiced quantity < total SO quantity
    return sos.filter(so => {
      const totalSoQty = so.items.reduce((sum, item) => sum + item.quantity, 0);
      const totalInvoicedQty = so.salesInvoices.reduce((sum, inv) => {
        return sum + inv.items.reduce((iSum, i) => iSum + i.quantity, 0);
      }, 0);
      
      return totalInvoicedQty < totalSoQty;
    });
  }

  async generateInvoiceNumber(userId: number): Promise<string> {
    const lastInvoice = await this.prisma.salesInvoice.findFirst({
      where: { 
        userId,
        invoiceNumber: { startsWith: 'SINV-' } 
      },
      orderBy: { invoiceNumber: 'desc' },
      select: { invoiceNumber: true },
    });

    if (!lastInvoice) return 'SINV-0001';
    const lastNumber = parseInt(lastInvoice.invoiceNumber.replace('SINV-', ''), 10);
    return `SINV-${(lastNumber + 1).toString().padStart(4, '0')}`;
  }

  async generateCustomerInvoiceNumber(userId: number): Promise<string> {
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1; // 1-12
    let startYear, endYear;

    if (currentMonth >= 4) { // April onwards
      startYear = currentYear;
      endYear = currentYear + 1;
    } else {
      startYear = currentYear - 1;
      endYear = currentYear;
    }
    const fyString = `${startYear}-${endYear.toString().slice(-2)}`;

    const lastInvoice = await this.prisma.salesInvoice.findFirst({
      where: {
        userId,
        customerInvoiceNumber: { startsWith: `${fyString}/` }
      },
      orderBy: { customerInvoiceNumber: 'desc' },
      select: { customerInvoiceNumber: true }
    });

    if (!lastInvoice) return `${fyString}/0001`;

    // Extract the number part after '/'
    const parts = lastInvoice.customerInvoiceNumber.split('/');
    const lastNumStr = parts[parts.length - 1];
    const lastNumber = parseInt(lastNumStr, 10);
    
    if (isNaN(lastNumber)) return `${fyString}/0001`;
    
    return `${fyString}/${(lastNumber + 1).toString().padStart(4, '0')}`;
  }

  async create(createDto: CreateSalesInvoiceDto, userId: number, uploadedFilePath?: string) {
    const invoiceNumber = await this.generateInvoiceNumber(userId);
    const customerInvoiceNumber = await this.generateCustomerInvoiceNumber(userId);

    const bookingDate = new Date(); // Enforced (Condition 1, 2, 3)
    const invoiceDate = new Date(createDto.invoiceDate || new Date());
    const today = new Date();
    today.setHours(23, 59, 59, 999);

    if (invoiceDate > today) {
        throw new BadRequestException('Customer Invoice Date cannot be in the future');
    }

    const hasLink = (createDto.soId) || (createDto.challanNumbers && createDto.challanNumbers.length > 0);
    
    if (hasLink) {
        let minDate: Date | null = null;
        
        // Multiple Challan Rule: Use the latest challan date
        if (createDto.challanNumbers && createDto.challanNumbers.length > 0) {
            const challanIds = createDto.challanNumbers.map(n => Number(n)).filter(n => !isNaN(n));
            const challans = await this.prisma.salesChallan.findMany({
                where: { id: { in: challanIds } }
            });
            challans.forEach(c => {
                const cDate = c.challanDate || c.bookingDate;
                if (!minDate || cDate > minDate) minDate = cDate;
            });
        }
        
        // Fallback to SO if no Challans or SO is newer (though usually Challan is after SO)
        if (!minDate && createDto.soId) {
             const so = await this.prisma.salesOrder.findUnique({
                 where: { id: Number(createDto.soId) }
             });
             if (so) minDate = so.soCreationDate;
        }

        if (minDate) {
            const minOnlyDate = new Date(minDate);
            minOnlyDate.setHours(0, 0, 0, 0);
            const invOnlyDate = new Date(invoiceDate);
            invOnlyDate.setHours(0, 0, 0, 0);

            if (invOnlyDate < minOnlyDate) {
                throw new BadRequestException(`Customer Invoice Date cannot be before latest Challan/SO date (${minOnlyDate.toLocaleDateString()})`);
            }
        }
    } else {
        // Condition 3: Without SO and Challan -> Must be Today
        const startOfToday = new Date();
        startOfToday.setHours(0, 0, 0, 0);
        const invOnlyDate = new Date(invoiceDate);
        invOnlyDate.setHours(0, 0, 0, 0);

        if (invOnlyDate.getTime() !== startOfToday.getTime()) {
            throw new BadRequestException('Standalone invoices must be dated today');
        }
    }

    const customer = await this.prisma.accountMaster.findUnique({
      where: { id: createDto.customerId },
    });

    if (!customer) throw new BadRequestException('Customer not found');

    const address = createDto.address || customer.addressLine1;
    const creditDays = createDto.creditDays || customer.customerCreditDays || 0;
    const gstNo = createDto.gstNumber || customer.gstNo;

    const company = await this.prisma.shopDetail.findUnique({ where: { userId } });
    if (!company) throw new BadRequestException('Company detail not found');

    const itemsToCreate = [];
    let totalTaxable = 0;
    let materialTax = 0;

    for (const i of createDto.items) {
      const qty = Number(i.quantity || 0);
      const rate = Number(i.rate || 0);
      const discAmt = Number(i.discountAmount || 0);
      const befTax = (qty * rate) - discAmt;
      const taxPct = Number(i.taxPercent || 0);
      const taxAmt = (befTax * taxPct) / 100;

      totalTaxable += befTax;
      materialTax += taxAmt;

      itemsToCreate.push({
        productId: Number(i.productId) || 0,
        productCode: i.productCode,
        productName: i.productName,
        hsnCode: i.hsnCode || null,
        quantity: qty,
        rate: rate,
        uom: i.uom || 'Nos',
        discountPercent: Number(i.discountPercent || 0),
        discountAmount: Number(i.discountAmount || 0),
        taxPercent: taxPct,
        taxAmount: taxAmt,
        beforeTaxAmount: befTax,
        totalAmount: befTax + taxAmt,
        totalSoQty: Number(i.totalSoQty || 0),
        printDescription: i.printDescription || i.description || i.productName || ""
      });
    }

    let expenseTotal = 0;
    let expenseTax = 0;
    let postGstChargeTotal = 0;
    const expensesToCreate = [];

    if (createDto.expenses) {
      for (const exp of createDto.expenses) {
        const amt = Number(exp.amount || 0);
        const isPostGst = !!exp.isPostGst;
        const tRate = Number(exp.taxRate || 0);
        let tAmt = 0;
        if (!isPostGst) {
          if (exp.isGstApplicable) tAmt = (amt * tRate) / 100;
          expenseTotal += amt;
          expenseTax += tAmt;
        } else {
          postGstChargeTotal += amt;
        }
        expensesToCreate.push({
          groupName: exp.groupName,
          amount: amt,
          taxRate: tRate,
          taxAmount: tAmt,
          isGstApplicable: !!exp.isGstApplicable,
          isPostGst: isPostGst
        });
      }
    }

    const finalTax = materialTax + expenseTax;
    const userGstDoc = await this.prisma.sellerDocument.findFirst({
      where: { uploadedByUserId: userId, type: 'GST' },
      select: { name: true }
    });
    const userGst = userGstDoc?.name;

    const companyState = (company.state || "").trim();
    const customerState = (customer.state || "").trim();

    // MODULE 3: GST DETERMINATION LOGIC (centralized)
    // Sales rule: GST only if User/Company has valid GST
    const gstResult = determineSalesGst(
      userGst,
      gstNo,          // customer GST (used for state code comparison only)
      companyState,
      customerState,
      finalTax,       // the total tax amount to be split into CGST/SGST or IGST
    );

    const cgst = gstResult.cgstAmount;
    const sgst = gstResult.sgstAmount;
    const igst = gstResult.igstAmount;
    const effectiveTax = gstResult.totalGstAmount;
    const isRcm = false;

    const taxInTotal = effectiveTax;
    const grandTotal = totalTaxable + expenseTotal + taxInTotal + postGstChargeTotal;

    const lastInvoice = await this.prisma.salesInvoice.findFirst({
      where: { userId, customerName: customer.accountName, status: { not: 'DELETED' } },
      orderBy: { createdAt: 'desc' },
      select: { cumulativeBalance: true }
    });
    const cumulativeBalance = (lastInvoice?.cumulativeBalance || 0) + grandTotal;

    try {
      const soNumbersArr = Array.isArray(createDto.soNumbers) ? createDto.soNumbers : [];
      const soId = createDto.soId || (soNumbersArr.length === 1 && !isNaN(Number(soNumbersArr[0])) ? Number(soNumbersArr[0]) : null);

      return await this.prisma.$transaction(async (tx) => {
        const inv = await tx.salesInvoice.create({
          data: {
            invoiceNumber: createDto.invoiceNumber || invoiceNumber,
            customerInvoiceNumber: createDto.customerInvoiceNumber || customerInvoiceNumber,
            customerInvoiceDate: (createDto.customerInvoiceDate && createDto.customerInvoiceDate.trim() !== "") ? new Date(createDto.customerInvoiceDate) : (createDto.invoiceDate && createDto.invoiceDate.trim() !== "" ? new Date(createDto.invoiceDate) : new Date()),
            bookingDate: (createDto.bookingDate && createDto.bookingDate.trim() !== "") ? new Date(createDto.bookingDate) : new Date(),
            customerId: customer.id,
            soId: soId,
            customerName: customer.accountName,
            address,
            creditDays,
            gstNumber: gstNo,
            soNumber: soNumbersArr.length > 0 ? soNumbersArr.join(',') : (createDto['soNumber'] || null),
            challanNumber: Array.isArray(createDto.challanNumbers) ? createDto.challanNumbers.join(',') : (createDto['challanNumber'] || null),
            cgstAmount: cgst,
            sgstAmount: sgst,
            igstAmount: igst,
            isRcm,
            taxableAmount: totalTaxable,
            grandTotal,
            cumulativeBalance,
            userId,
            uploadedFilePath: uploadedFilePath || null,
            items: { create: itemsToCreate },
            expenses: { create: expensesToCreate }
          },
          include: { items: true, expenses: true }
        });

        await this.updateCompletionStatusesAfterInvoice(inv.id, tx);
        return inv;
      });
    } catch (e) {
      const fs = require('fs');
      fs.appendFileSync('D:\\USERS\\vaishnavi\\Desktop\\weighting_scale\\backend\\service_error.log', `[${new Date().toISOString()}] CREATE ERROR: ${e.message}\n${e.stack}\n\n`);
      if (e.code === 'P2002' && e.meta && e.meta.target.includes('invoiceNumber')) {
        const { BadRequestException } = require('@nestjs/common');
        throw new BadRequestException('Invoice number already exists. Please generate a new invoice number.');
      }
      throw e;
    }
  }

  async findAll(query: { search?: string, status?: string, page?: number, limit?: number, userId: number }) {
    const where: any = { userId: query.userId };
    if (query.status && query.status !== 'all') where.status = query.status.toUpperCase();
    if (query.search) {
      where.OR = [
        { customerName: { contains: query.search, mode: 'insensitive' } },
        { invoiceNumber: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.max(1, Number(query.limit) || 10);
    const skip = (page - 1) * limit;

    const [data, total] = await Promise.all([
      this.prisma.salesInvoice.findMany({
        where,
        include: { items: true, expenses: true },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.salesInvoice.count({ where })
    ]);

    return { data, meta: { total, page, limit, totalPages: Math.ceil(total / limit) } };
  }

  async findOne(id: number, userId: number) {
    const invoice = await this.prisma.salesInvoice.findUnique({
      where: { id, userId },
      include: { items: true, expenses: true },
    });
    if (!invoice) throw new NotFoundException(`Invoice ID ${id} not found or access denied`);

    // Resolution: Map comma-separated challanNumber string to an array of actual IDs from the database
    const challanNums = invoice.challanNumber ? invoice.challanNumber.split(',').map(n => n.trim()).filter(Boolean) : [];
    let customerChallanIds = [];
    
    if (challanNums.length > 0) {
      const challanRecords = await this.prisma.salesChallan.findMany({
        where: {
          challanNumber: { in: challanNums },
          userId
        },
        select: { id: true }
      });
      customerChallanIds = challanRecords.map(c => c.id);
    }

    return {
      ...invoice,
      customerChallanIds
    };
  }

  async update(id: number, updateDto: UpdateSalesInvoiceDto, userId: number, uploadedFilePath?: string) {
    const existing = await this.prisma.salesInvoice.findUnique({
      where: { id, userId },
      include: { items: true, expenses: true },
    });
    if (!existing) throw new NotFoundException(`Invoice ID ${id} not found or access denied`);

    // Robust implementation that recalculates everything for data integrity
    const itemsToCreate = [];
    let totalTaxable = 0;
    let materialTax = 0;

    if (updateDto.items) {
      for (const i of updateDto.items) {
        const qty = Number(i.quantity || 0);
        const rate = Number(i.rate || 0);
        const discAmt = Number(i.discountAmount || 0);
        const befTax = (qty * rate) - discAmt;
        const taxPct = Number(i.taxPercent || 0);
        const taxAmt = (befTax * taxPct) / 100;

        totalTaxable += befTax;
        materialTax += taxAmt;

        itemsToCreate.push({
          productId: Number(i.productId) || 0,
          productCode: i.productCode,
          productName: i.productName,
          hsnCode: i.hsnCode || null,
          quantity: qty,
          rate: rate,
          uom: i.uom || 'Nos',
          discountPercent: Number(i.discountPercent || 0),
          discountAmount: Number(i.discountAmount || 0),
          taxPercent: taxPct,
          taxAmount: taxAmt,
          beforeTaxAmount: befTax,
          totalAmount: befTax + taxAmt,
          totalSoQty: Number(i.totalSoQty || 0),
          printDescription: i.printDescription || i.description || i.productName || ""
        });
      }
    }

    let expenseTotal = 0;
    let expenseTax = 0;
    const expensesToCreate = [];

    if (updateDto.expenses) {
      for (const exp of updateDto.expenses) {
        const amt = Number(exp.amount || 0);
        const isPostGst = !!exp.isPostGst;
        const tRate = Number(exp.taxRate || 0);
        let tAmt = 0;
        
        if (!isPostGst) {
          if (exp.isGstApplicable) tAmt = (amt * tRate) / 100;
          expenseTotal += amt;
          expenseTax += tAmt;
        }

        expensesToCreate.push({
          groupName: exp.groupName,
          amount: amt,
          taxRate: tRate,
          taxAmount: tAmt,
          isGstApplicable: !!exp.isGstApplicable,
          isPostGst: isPostGst
        });
      }
    }

    const finalTax = materialTax + expenseTax;
    
    // Check state for tax splitting
    const company = await this.prisma.shopDetail.findUnique({ where: { userId: existing.userId } });
    const customer = await this.prisma.accountMaster.findUnique({ where: { id: updateDto.customerId || existing.customerId } });
    
    // Fetch Company GST
    const companyGstDoc = await this.prisma.sellerDocument.findFirst({
      where: { uploadedByUserId: existing.userId, type: 'GST' },
      select: { name: true }
    });
    const companyGST = isValidGst(companyGstDoc?.name) ? companyGstDoc!.name : null;

    const companyState = (company?.state || "").trim();
    const customerState = (customer?.state || "").trim();
    const customerGST = updateDto.gstNumber || customer?.gstNo || null;

    // MODULE 3: GST DETERMINATION LOGIC (centralized) — Sales rule: user GST required
    const gstResult = determineSalesGst(
      companyGST,
      customerGST,
      companyState,
      customerState,
      finalTax,
    );

    const cgst = gstResult.cgstAmount;
    const sgst = gstResult.sgstAmount;
    const igst = gstResult.igstAmount;
    const grandTotal = totalTaxable + expenseTotal + gstResult.totalGstAmount;

    return this.prisma.$transaction(async (tx) => {
      if (updateDto.items) await tx.salesInvoiceItem.deleteMany({ where: { salesInvoiceId: id } });
      if (updateDto.expenses) await tx.salesInvoiceExpense.deleteMany({ where: { salesInvoiceId: id } });

      const inv = await tx.salesInvoice.update({
        where: { id },
        data: {
          invoiceNumber: updateDto.invoiceNumber,
          customerInvoiceNumber: updateDto.customerInvoiceNumber,
          customerInvoiceDate: updateDto.customerInvoiceDate ? new Date(updateDto.customerInvoiceDate) : undefined,
          invoiceDate: updateDto.invoiceDate ? new Date(updateDto.invoiceDate) : undefined,
          bookingDate: updateDto.bookingDate ? new Date(updateDto.bookingDate) : undefined,
          customerId: updateDto.customerId,
          customerName: updateDto.customerName,
          address: updateDto.address,
          creditDays: updateDto.creditDays,
          gstNumber: updateDto.gstNumber,
          soNumber: updateDto.soNumbers ? updateDto.soNumbers.join(',') : undefined,
          challanNumber: updateDto.challanNumbers ? updateDto.challanNumbers.join(',') : undefined,
          soId: updateDto.soId ?? (updateDto.soNumbers && updateDto.soNumbers.length === 1 && !isNaN(Number(updateDto.soNumbers[0])) ? Number(updateDto.soNumbers[0]) : existing.soId),
          status: updateDto.status as any,
          taxableAmount: totalTaxable,
          cgstAmount: cgst,
          sgstAmount: sgst,
          igstAmount: igst,
          grandTotal: grandTotal,
          items: updateDto.items ? { create: itemsToCreate } : undefined,
          expenses: updateDto.expenses ? { create: expensesToCreate } : undefined,
        },
        include: { items: true, expenses: true }
      });

      await this.updateCompletionStatusesAfterInvoice(inv.id, tx);
      return inv;
    });
  }

  async remove(id: number, userId: number) {
    return this.prisma.$transaction(async (tx) => {
      const invoice = await tx.salesInvoice.update({
        where: { id, userId },
        data: { status: 'DELETED' }
      });
      await this.updateCompletionStatusesAfterInvoice(id, tx);
      return invoice;
    });
  }

  private async updateCompletionStatusesAfterInvoice(invoiceId: number, tx: any) {
    const invoice = await tx.salesInvoice.findUnique({
      where: { id: invoiceId },
      include: { items: true }
    });

    if (!invoice) return;

    // 1. Update SO Status
    const soIds = invoice.soNumber ? invoice.soNumber.split(',').map(n => n.trim()).filter(n => !isNaN(Number(n))).map(Number) : [];
    if (invoice.soId) soIds.push(invoice.soId);
    const uniqueSoIds = [...new Set(soIds)];

    for (const soId of uniqueSoIds) {
        const so = await tx.salesOrder.findUnique({
            where: { id: soId },
            include: { 
                items: true,
                salesInvoices: { where: { status: { not: 'DELETED' } }, include: { items: true } }
            }
        });
        if (so) {
            const totalSoQty = so.items.reduce((sum, item) => sum + item.quantity, 0);
            const totalInvoicedQty = so.salesInvoices.reduce((sum, inv) => {
                return sum + inv.items.reduce((iSum, i) => iSum + i.quantity, 0);
            }, 0);

            let newStatus = 'PENDING';
            if (totalInvoicedQty >= totalSoQty) {
                newStatus = 'INVOICE_COMPLETED';
            } else {
                // Check challan completion
                const challans = await tx.salesChallan.findMany({
                    where: { soId: so.id, status: { not: 'DELETED' } },
                    include: { items: true }
                });
                const totalDeliveredQty = challans.reduce((sum, ch) => sum + ch.items.reduce((iSum, i) => iSum + i.challanQty, 0), 0);
                if (totalDeliveredQty >= totalSoQty) {
                    newStatus = 'CHALLAN_COMPLETED';
                }
            }

            if (so.status !== newStatus) {
                await tx.salesOrder.update({ where: { id: so.id }, data: { status: newStatus } });
            }
        }
    }

    // 2. Update Challan Status
    const challanNums = invoice.challanNumber ? invoice.challanNumber.split(',').map(n => n.trim()).filter(Boolean) : [];
    if (challanNums.length > 0) {
        const challans = await tx.salesChallan.findMany({
            where: {
                OR: [
                    { challanNumber: { in: challanNums } },
                    { id: { in: challanNums.filter(n => !isNaN(Number(n))).map(Number) } }
                ],
                userId: invoice.userId,
                status: { not: 'DELETED' }
            },
            include: { items: true }
        });

        for (const challan of challans) {
            const totalChallanQty = challan.items.reduce((sum, item) => sum + item.challanQty, 0);
            
            // Find all invoices for this challan
            const invoices = await tx.salesInvoice.findMany({
                where: { 
                    userId: invoice.userId, 
                    status: { not: 'DELETED' }
                },
                include: { items: true }
            });

            const totalInvoicedQty = invoices.reduce((sum, inv) => {
                if (inv.challanNumber && typeof inv.challanNumber === 'string') {
                    const ids = inv.challanNumber.split(',').map(id => id.trim());
                    if (ids.includes(challan.id.toString()) || ids.includes(challan.challanNumber)) {
                        return sum + inv.items.reduce((iSum, i) => iSum + i.quantity, 0);
                    }
                }
                return sum;
            }, 0);

            const newStatus = totalInvoicedQty >= totalChallanQty ? 'COMPLETED' : 'GENERATED';
            if (challan.status !== newStatus) {
                await tx.salesChallan.update({ where: { id: challan.id }, data: { status: newStatus } });
            }
        }
    }
  }

  async generateNextNumber(userId: number) {
    return { 
      nextNumber: await this.generateInvoiceNumber(userId),
      nextCustomerInvoiceNumber: await this.generateCustomerInvoiceNumber(userId)
    };
  }

  async downloadSample() {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Sales Invoice Sample');
    const headers = [
      'Customer Name*', 'Customer Invoice No*', 'Customer Invoice Date (YYYY-MM-DD)*', 'Booking Date (YYYY-MM-DD)',
      'Address*', 'Credit Days*', 'Challan Nos', 'SO Nos', 'Product Code*', 'Quantity*', 'Rate*', 'UOM*'
    ];
    worksheet.addRow(headers);

    const headerRow = worksheet.getRow(1);
    headerRow.font = { bold: true };
    headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD3D3D3' } };
    worksheet.columns = headers.map(() => ({ width: 22 }));

    const buffer = await workbook.xlsx.writeBuffer();
    return {
      buffer: Buffer.from(buffer),
      filename: 'sales_invoice_sample.xlsx',
      mimetype: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    };
  }

  async exportSalesInvoices(format: string, query: { search?: string, userId: number }) {
    const invoicesData = await this.findAll(query);
    const invoices = invoicesData.data;

    const now = new Date();
    const pad = (n: number) => n.toString().padStart(2, '0');
    const hours = now.getHours();
    const ampm = hours >= 12 ? 'pm' : 'am';
    const formattedHours = hours % 12 || 12;
    const timestamp = `${pad(now.getDate())}/${pad(now.getMonth() + 1)}/${now.getFullYear()}, ${pad(formattedHours)}:${pad(now.getMinutes())}:${pad(now.getSeconds())} ${ampm}`;

    if (format === 'xlsx') {
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet('Sales Invoices');
      worksheet.columns = [
        { header: 'Inv No', key: 'invoiceNumber', width: 15 },
        { header: 'Customer Name', key: 'customerName', width: 30 },
        { header: 'Cust. Inv No', key: 'customerInvoiceNumber', width: 20 },
        { header: 'Cust. Inv Date', key: 'customerInvoiceDate', width: 15 },
        { header: 'Booking Date', key: 'bookingDate', width: 15 },
        { header: 'SO No', key: 'soNumber', width: 15 },
        { header: 'Taxable Amt', key: 'taxableAmount', width: 15 },
        { header: 'Grand Total', key: 'grandTotal', width: 15 },
        { header: 'Status', key: 'status', width: 12 },
      ];

      invoices.forEach(inv => {
        worksheet.addRow({
          invoiceNumber: inv.invoiceNumber,
          customerName: inv.customerName,
          customerInvoiceNumber: inv.customerInvoiceNumber,
          customerInvoiceDate: inv.customerInvoiceDate.toLocaleDateString(),
          bookingDate: inv.bookingDate.toLocaleDateString(),
          soNumber: inv.soNumber || '-',
          taxableAmount: inv.taxableAmount,
          grandTotal: inv.grandTotal,
          status: inv.status,
        });
      });

      // Styling and Headers
      worksheet.spliceRows(1, 0, [], [], [], []);
      worksheet.mergeCells('A1:I1');
      worksheet.getCell('A1').value = 'ERP';
      worksheet.getCell('A1').font = { size: 18, bold: true };
      worksheet.getCell('A1').alignment = { horizontal: 'center' };

      worksheet.mergeCells('A2:I2');
      worksheet.getCell('A2').value = 'Sales Invoice Report';
      worksheet.getCell('A2').font = { size: 14 };
      worksheet.getCell('A2').alignment = { horizontal: 'center' };

      worksheet.mergeCells('A3:I3');
      worksheet.getCell('A3').value = `Exported on: ${timestamp}`;
      worksheet.getCell('A3').alignment = { horizontal: 'right' };

      const headerRow = worksheet.getRow(5);
      headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4472C4' } };

      const buffer = await workbook.xlsx.writeBuffer();
      return {
        buffer: Buffer.from(buffer),
        filename: `sales_invoices_${Date.now()}.xlsx`,
        mimetype: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      };
    } else {
      return new Promise<any>((resolve) => {
        const doc = new PDFDocument({ margin: 20, size: 'A4', layout: 'landscape' });
        const buffers: Buffer[] = [];
        doc.on('data', buffers.push.bind(buffers));
        doc.on('end', () => resolve({ buffer: Buffer.concat(buffers), filename: `sales_invoices_${Date.now()}.pdf`, mimetype: 'application/pdf' }));

        doc.fontSize(18).font('Helvetica-Bold').text('ERP', { align: 'center' });
        doc.fontSize(14).font('Helvetica').text('Sales Invoice Report', { align: 'center' });
        doc.moveDown(0.5);
        doc.fontSize(10).text(`Exported on: ${timestamp}`, { align: 'right' });
        doc.moveDown();

        const tableTop = 100;
        const colX = [20, 100, 250, 340, 420, 500, 570, 640, 710];
        const headers = ['Inv No', 'Customer Name', 'Cust. Inv No', 'Cust. Date', 'Book Date', 'SO No', 'Taxable', 'Total', 'Status'];

        doc.rect(15, tableTop - 5, 780, 20).fill('#4472C4');
        doc.fontSize(8).font('Helvetica-Bold').fillColor('#FFFFFF');
        headers.forEach((h, i) => doc.text(h, colX[i], tableTop));

        let y = tableTop + 20;
        doc.fillColor('#000000').font('Helvetica');

        invoices.forEach((inv, index) => {
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
          doc.text(inv.invoiceNumber, colX[0], y);
          doc.text(inv.customerName.substring(0, 30), colX[1], y);
          doc.text(inv.customerInvoiceNumber, colX[2], y);
          doc.text(inv.customerInvoiceDate.toLocaleDateString(), colX[3], y);
          doc.text(inv.bookingDate.toLocaleDateString(), colX[4], y);
          doc.text(inv.soNumber || '-', colX[5], y);
          doc.text(inv.taxableAmount.toFixed(2), colX[6], y);
          doc.text(inv.grandTotal.toFixed(2), colX[7], y);
          doc.text(inv.status, colX[8], y);
          y += 20;
        });

        doc.end();
      });
    }
  }

  async importSalesInvoices(buffer: Buffer, userId: number) {
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

    // Group items by invoice number to handle multiple products per invoice
    const invoicesMap = new Map<string, any>();

    for (let i = 2; i <= rowCount; i++) {
      const row = worksheet.getRow(i);
      try {
        const customerName = String(row.getCell(1).value || '').trim();
        const customerInvoiceNumber = String(row.getCell(2).value || '').trim();
        if (!customerInvoiceNumber || !customerName) continue;

        if (!invoicesMap.has(customerInvoiceNumber)) {
          const customer = await this.prisma.accountMaster.findFirst({
            where: { accountName: customerName, userId }
          });
          if (!customer) throw new Error(`Customer '${customerName}' not found`);

          invoicesMap.set(customerInvoiceNumber, {
            customerId: customer.id,
            customerName: customer.accountName,
            customerInvoiceNumber,
            invoiceDate: parseDate(row.getCell(3).value) || new Date(),
            bookingDate: parseDate(row.getCell(4).value) || new Date(),
            address: String(row.getCell(5).value || '').trim() || customer.addressLine1,
            creditDays: parseInt(String(row.getCell(6).value), 10) || 0,
            challanNumbers: String(row.getCell(7).value || '').split(',').filter(Boolean),
            soNumbers: String(row.getCell(8).value || '').split(',').filter(Boolean),
            items: []
          });
        }

        const inv = invoicesMap.get(customerInvoiceNumber);
        const productCode = String(row.getCell(9).value || '').trim();
        const product = await this.prisma.product.findFirst({ 
          where: { product_code: productCode, created_by: userId },
          include: { uom: true }
        });
        if (!product) throw new Error(`Product '${productCode}' not found`);

        inv.items.push({
          productId: product.id,
          productCode: product.product_code,
          productName: product.product_name,
          quantity: parseFloat(String(row.getCell(10).value)) || 0,
          rate: parseFloat(String(row.getCell(11).value)) || 0,
          uom: String(row.getCell(12).value || '').trim() || product.uom?.gst_uom || 'Nos',
          taxPercent: Number(product.tax_rate) || 0,
        });
      } catch (err) {
        errors.push(`Row ${i}: ${err.message}`);
      }
    }

    for (const inv of invoicesMap.values()) {
      try {
        await this.create(inv, userId);
        imported++;
      } catch (err) {
        errors.push(`Invoice ${inv.customerInvoiceNumber}: ${err.message}`);
      }
    }

    return { imported, total: invoicesMap.size, errors };
  }
}
