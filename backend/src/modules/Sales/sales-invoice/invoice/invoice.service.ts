import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../../../infrastructure/prisma/prisma.service';
import { CreateSalesInvoiceDto, UpdateSalesInvoiceDto, SalesInvoiceStatus } from './dto/invoice.dto';
import { TransactionType, BalanceType } from '@prisma/client';
import { SalesOrderService } from '../../sales-order/sales-order.service';
import { TransactionService } from '../../../Finance/transaction.service';
import * as ExcelJS from 'exceljs';
import * as PDFDocument from 'pdfkit';
import { formatDate } from '../../../../utils/dateFormatter';
import { isValidGst, determineSalesGst } from '../../../../common/utils/gst.helper';

@Injectable()
export class SalesInvoiceService {
  constructor(
    private prisma: PrismaService,
    private soService: SalesOrderService,
    private transactionService: TransactionService
  ) { }

  private async isSellerMsme(userId: number): Promise<boolean> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { sellerDocuments: true }
    });
    if (!user) return false;
    const isSellerMsmeActive = user.sellerDocuments.some(
      d => d.category === 'UDYOG_AADHAR' && d.name && d.name.trim() !== '' && d.name.trim().toUpperCase() !== 'N/A'
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

  async getCustomers(userId: number) {
    const customers = await this.prisma.accountMaster.findMany({
      where: {
        userId,
        groupName: { has: 'SUNDRY_DEBTORS' },
        customerStatus: 'ACTIVE',
      },
      select: {
        id: true,
        customerCode: true,
        accountName: true,
        customerCreditDays: true,
        addressLine1: true,
        addressLine2: true,
        pincode: true,
        area: true,
        subDistrict: true,
        district: true,
        state: true,
        country: true,
        gstNo: true,
        panNo: true,
        customerType: true,
        msmeEnabled: true,
        regType: true,
        msmeId: true,
        mobileNo: true,
        emailId: true,
      },
      orderBy: { accountName: 'asc' },
    });

    return Promise.all(
      customers.map(async (customer) => {
        const isMsmeUser = await this.isCustomerMsme(
          customer.mobileNo,
          customer.emailId,
          customer.gstNo
        );
        return {
          id: customer.id,
          customerCode: customer.customerCode,
          customerName: customer.accountName,
          customerCreditDays: customer.customerCreditDays,
          addressLine1: customer.addressLine1,
          addressLine2: customer.addressLine2,
          pincode: customer.pincode,
          area: customer.area,
          subDistrict: customer.subDistrict,
          district: customer.district,
          state: customer.state,
          country: customer.country,
          gstNo: customer.gstNo,
          panNo: customer.panNo,
          customerType: customer.customerType,
          msmeEnabled: customer.msmeEnabled,
          regType: customer.regType,
          msmeId: customer.msmeId,
          isMsmeUser,
        };
      })
    );
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
        status: { not: 'DELETED' },
      },
      include: {
        items: true,
        salesInvoices: {
          where: { 
            status: { not: 'DELETED' },
            ...(excludeInvoiceId ? { id: { not: excludeInvoiceId } } : {})
          },
          include: { items: true }
        },
        salesChallans: {
          where: { status: { not: 'DELETED' } },
          include: { items: true }
        }
      },
      orderBy: { soNumber: 'desc' },
    });

    // Filter SOs based strictly on invoiced quantity, not delivered quantity
    return sos.filter(so => {
      if (!excludeInvoiceId && so.status === 'INVOICE_COMPLETED') {
        return false;
      }
      const totalSoQty = so.items.reduce((sum, item) => sum + item.quantity, 0);
      
      const totalInvoicedQty = so.salesInvoices.reduce((sum, inv) => {
        return sum + inv.items.reduce((iSum, i) => iSum + i.quantity, 0);
      }, 0);

      return (totalSoQty - totalInvoicedQty) > 0.01;
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

  private async validateInvoiceDate(
    invoiceDateStr: string | Date | undefined,
    soId: number | null | undefined,
    challanNumbers: string[] | undefined,
    soNumbers?: string[]
  ) {
    const invoiceDate = new Date(invoiceDateStr || new Date());
    const today = new Date();
    today.setHours(23, 59, 59, 999);

    let resolvedSoNumbers: string[] = [];
    if (soNumbers) {
      if (typeof soNumbers === 'string') {
        try {
          resolvedSoNumbers = JSON.parse(soNumbers);
        } catch {
          resolvedSoNumbers = [soNumbers];
        }
      } else if (Array.isArray(soNumbers)) {
        resolvedSoNumbers = soNumbers;
      }
    }
    resolvedSoNumbers = resolvedSoNumbers.map(n => String(n).trim()).filter(Boolean);

    let resolvedChallanNumbers: string[] = [];
    if (challanNumbers) {
      if (typeof challanNumbers === 'string') {
        try {
          resolvedChallanNumbers = JSON.parse(challanNumbers);
        } catch {
          resolvedChallanNumbers = [challanNumbers];
        }
      } else if (Array.isArray(challanNumbers)) {
        resolvedChallanNumbers = challanNumbers;
      }
    }
    resolvedChallanNumbers = resolvedChallanNumbers.map(n => String(n).trim()).filter(Boolean);

    let resolvedSoId = soId;
    if (!resolvedSoId && resolvedSoNumbers.length > 0) {
      const soRecord = await this.prisma.salesOrder.findFirst({
        where: { soNumber: { in: resolvedSoNumbers } }
      });
      if (soRecord) {
        resolvedSoId = soRecord.id;
      }
    }

    const hasChallan = resolvedChallanNumbers.length > 0;
    const hasSo = !!resolvedSoId;

    if (hasSo && hasChallan) {
      let latestChallanDate: Date | null = null;
      const challanIds = resolvedChallanNumbers.map(n => Number(n)).filter(n => !isNaN(n));
      const challanRecords = await this.prisma.salesChallan.findMany({
        where: {
          OR: [
            { id: { in: challanIds } },
            { challanNumber: { in: resolvedChallanNumbers } }
          ]
        }
      });
      for (const challan of challanRecords) {
        const cDate = challan.challanDate || challan.bookingDate;
        if (cDate && (!latestChallanDate || cDate > latestChallanDate)) {
          latestChallanDate = cDate;
        }
      }

      if (latestChallanDate) {
        const minDate = new Date(latestChallanDate);
        minDate.setHours(0, 0, 0, 0);
        const invOnlyDate = new Date(invoiceDate);
        invOnlyDate.setHours(0, 0, 0, 0);

        if (invOnlyDate < minDate || invoiceDate > today) {
          throw new BadRequestException('Customer Invoice Date must be between Latest Challan Date and Current Date.');
        }
      } else {
        if (invoiceDate > today) {
          throw new BadRequestException('Customer Invoice Date must be between Latest Challan Date and Current Date.');
        }
      }
    } else if (hasSo && !hasChallan) {
      const so = await this.prisma.salesOrder.findUnique({
        where: { id: Number(resolvedSoId) }
      });
      if (so) {
        const soDate = new Date(so.soCreationDate);
        soDate.setHours(0, 0, 0, 0);
        const invOnlyDate = new Date(invoiceDate);
        invOnlyDate.setHours(0, 0, 0, 0);

        if (invOnlyDate < soDate || invoiceDate > today) {
          throw new BadRequestException('Customer Invoice Date must be between SO Date and Current Date.');
        }
      } else {
        if (invoiceDate > today) {
          throw new BadRequestException('Customer Invoice Date must be between SO Date and Current Date.');
        }
      }
    } else if (!hasSo && hasChallan) {
      let latestChallanDate: Date | null = null;
      const challanIds = resolvedChallanNumbers.map(n => Number(n)).filter(n => !isNaN(n));
      const challanRecords = await this.prisma.salesChallan.findMany({
        where: {
          OR: [
            { id: { in: challanIds } },
            { challanNumber: { in: resolvedChallanNumbers } }
          ]
        }
      });
      for (const challan of challanRecords) {
        const cDate = challan.challanDate || challan.bookingDate;
        if (cDate && (!latestChallanDate || cDate > latestChallanDate)) {
          latestChallanDate = cDate;
        }
      }

      if (latestChallanDate) {
        const minDate = new Date(latestChallanDate);
        minDate.setHours(0, 0, 0, 0);
        const invOnlyDate = new Date(invoiceDate);
        invOnlyDate.setHours(0, 0, 0, 0);

        if (invOnlyDate < minDate || invoiceDate > today) {
          throw new BadRequestException('Customer Invoice Date must be between Challan Date and Current Date.');
        }
      } else {
        if (invoiceDate > today) {
          throw new BadRequestException('Customer Invoice Date must be between Challan Date and Current Date.');
        }
      }
    } else {
      const now = new Date();
      const fyStart = new Date(now.getMonth() < 3 ? now.getFullYear() - 1 : now.getFullYear(), 3, 1);
      fyStart.setHours(0, 0, 0, 0);
      const invOnlyDate = new Date(invoiceDate);
      invOnlyDate.setHours(0, 0, 0, 0);

      if (invOnlyDate < fyStart || invoiceDate > today) {
        throw new BadRequestException('Customer Invoice Date must be within current financial year.');
      }
    }
  }

  async create(createDto: CreateSalesInvoiceDto, userId: number, uploadedFilePath?: string) {
    const invoiceNumber = await this.generateInvoiceNumber(userId);
    const customerInvoiceNumber = await this.generateCustomerInvoiceNumber(userId);

    const invDateToValidate = createDto.customerInvoiceDate || createDto.invoiceDate || new Date();
    await this.validateInvoiceDate(
      invDateToValidate,
      createDto.soId,
      createDto.challanNumbers,
      createDto.soNumbers
    );

    const customer = await this.prisma.accountMaster.findUnique({
      where: { id: createDto.customerId },
    });

    if (!customer) throw new BadRequestException('Customer not found');

    if (customer.status !== 'ACTIVE' || customer.customerStatus !== 'ACTIVE') {
      throw new BadRequestException('Customer is inactive. New sales transactions are not allowed.');
    }

     const sellerMsme = await this.isSellerMsme(userId);
 
     let creditDays = createDto.creditDays !== undefined && createDto.creditDays !== null ? createDto.creditDays : (customer.customerCreditDays || 0);
 
     if (sellerMsme && creditDays > 45) {
       const entered = creditDays;
       creditDays = 45;
       createDto.creditDays = 45;
       await this.prisma.auditLog.create({
         data: {
           userId,
           action: 'MSME_AUTO_CORRECT',
           resource: 'SalesInvoice',
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

    const address = createDto.address || customer.addressLine1;
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
      where: { uploadedByUserId: userId, type: 'GST', url: 'N/A' },
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
      totalTaxable,   // the total taxable amount
      0,              // percent not needed as we pass preCalculated
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
            invoiceDate: (createDto.invoiceDate && createDto.invoiceDate.trim() !== "") ? new Date(createDto.invoiceDate) : ((createDto.customerInvoiceDate && createDto.customerInvoiceDate.trim() !== "") ? new Date(createDto.customerInvoiceDate) : new Date()),
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
            isInterState: gstResult.gstType === 'IGST',
            gstType: gstResult.gstType as any,
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

        // INTEGRATION: Record the transaction in the ledger
        await this.transactionService.recordTransaction({
          accountId: customer.id,
          userId,
          bookingDate: inv.bookingDate,
          invoiceNumber: inv.customerInvoiceNumber || inv.invoiceNumber,
          transactionType: TransactionType.Sales,
          amount: inv.grandTotal,
          entryType: BalanceType.Dr, // Sales increases Debtor balance (Debit)
        }, tx);

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

    const mappedData = await Promise.all(
      data.map(async (invoice) => {
        let updatedAddress = invoice.address;
        if (invoice.customerId) {
          const customer = await this.prisma.accountMaster.findUnique({
            where: { id: invoice.customerId }
          });
          if (customer) {
            const parts = [
              customer.addressLine1,
              customer.addressLine2,
              customer.area,
              customer.subDistrict,
              customer.district,
              customer.state
            ].filter(p => p && String(p).trim() !== '');
            let formatted = parts.join(', ');
            if (customer.pincode && String(customer.pincode).trim() !== '') {
              formatted += ` - ${customer.pincode}`;
            }
            updatedAddress = formatted || invoice.address;
          }
        }
        return {
          ...invoice,
          address: updatedAddress
        };
      })
    );

    return { data: mappedData, meta: { total, page, limit, totalPages: Math.ceil(total / limit) } };
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

    let updatedAddress = invoice.address;
    if (invoice.customerId) {
      const customer = await this.prisma.accountMaster.findUnique({
        where: { id: invoice.customerId }
      });
      if (customer) {
        const parts = [
          customer.addressLine1,
          customer.addressLine2,
          customer.area,
          customer.subDistrict,
          customer.district,
          customer.state
        ].filter(p => p && String(p).trim() !== '');
        let formatted = parts.join(', ');
        if (customer.pincode && String(customer.pincode).trim() !== '') {
          formatted += ` - ${customer.pincode}`;
        }
        updatedAddress = formatted || invoice.address;
      }
    }

    return {
      ...invoice,
      address: updatedAddress,
      customerChallanIds
    };
  }

  async update(id: number, updateDto: UpdateSalesInvoiceDto, userId: number, uploadedFilePath?: string) {
    try {
      const existing = await this.prisma.salesInvoice.findUnique({
      where: { id, userId },
      include: { items: true, expenses: true },
    });
    if (!existing) throw new NotFoundException(`Invoice ID ${id} not found or access denied`);

    const resolvedInvoiceDate = updateDto.customerInvoiceDate || updateDto.invoiceDate || existing.customerInvoiceDate || existing.invoiceDate;
    const resolvedSoId = updateDto.soId !== undefined ? updateDto.soId : existing.soId;
    
    let resolvedChallanNumbers: string[] = [];
    if (updateDto.challanNumbers !== undefined) {
      if (typeof updateDto.challanNumbers === 'string') {
        try {
          resolvedChallanNumbers = JSON.parse(updateDto.challanNumbers);
        } catch {
          resolvedChallanNumbers = [updateDto.challanNumbers];
        }
      } else if (Array.isArray(updateDto.challanNumbers)) {
        resolvedChallanNumbers = updateDto.challanNumbers;
      }
    } else if (existing.challanNumber) {
      resolvedChallanNumbers = existing.challanNumber.split(',').map(n => n.trim()).filter(Boolean);
    }
    resolvedChallanNumbers = resolvedChallanNumbers.map(n => String(n).trim()).filter(Boolean);

    let resolvedSoNumbers: string[] = [];
    if (updateDto.soNumbers !== undefined) {
      if (typeof updateDto.soNumbers === 'string') {
        try {
          resolvedSoNumbers = JSON.parse(updateDto.soNumbers);
        } catch {
          resolvedSoNumbers = [updateDto.soNumbers];
        }
      } else if (Array.isArray(updateDto.soNumbers)) {
        resolvedSoNumbers = updateDto.soNumbers;
      }
    } else if (existing.soNumber) {
      resolvedSoNumbers = existing.soNumber.split(',').map(n => n.trim()).filter(Boolean);
    }
    resolvedSoNumbers = resolvedSoNumbers.map(n => String(n).trim()).filter(Boolean);

    await this.validateInvoiceDate(
      resolvedInvoiceDate,
      resolvedSoId,
      resolvedChallanNumbers,
      resolvedSoNumbers
    );

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
    
      const sellerMsme = await this.isSellerMsme(existing.userId);
      if (sellerMsme) {
         const creditDays = updateDto.creditDays !== undefined ? updateDto.creditDays : existing.creditDays;
         if (creditDays > 45) {
           const entered = creditDays;
           updateDto.creditDays = 45;
           await this.prisma.auditLog.create({
             data: {
               userId: existing.userId,
               action: 'MSME_AUTO_CORRECT',
               resource: 'SalesInvoice',
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
      }
    
    // Fetch Company GST
    const companyGstDoc = await this.prisma.sellerDocument.findFirst({
      where: { uploadedByUserId: existing.userId, type: 'GST', url: 'N/A' },
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
          soNumber: updateDto.soNumbers !== undefined ? (resolvedSoNumbers.length > 0 ? resolvedSoNumbers.join(',') : null) : undefined,
          challanNumber: updateDto.challanNumbers !== undefined ? (resolvedChallanNumbers.length > 0 ? resolvedChallanNumbers.join(',') : null) : undefined,
          soId: updateDto.soId ?? (updateDto.soNumbers !== undefined ? (resolvedSoNumbers.length === 1 && !isNaN(Number(resolvedSoNumbers[0])) ? Number(resolvedSoNumbers[0]) : null) : existing.soId),
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

      // Synchronize with Ledger
      await this.transactionService.updateTransaction({
        userId,
        accountId: inv.customerId,
        invoiceNumber: existing.customerInvoiceNumber || existing.invoiceNumber,
        transactionType: TransactionType.Sales,
      }, {
        amount: inv.grandTotal,
        bookingDate: inv.bookingDate,
        invoiceNumber: inv.customerInvoiceNumber || inv.invoiceNumber,
      }, tx);

      await this.updateCompletionStatusesAfterInvoice(inv.id, tx);
      return inv;
    });
    } catch (e: any) {
      const fs = require('fs');
      fs.appendFileSync('./service_error.log', `[${new Date().toISOString()}] UPDATE ERROR: ${e.message}\n${e.stack}\n\n`);
      console.error("Error in updateSalesInvoice:", e);
      throw new BadRequestException("Failed to update Sales Invoice: " + e.message);
    }
  }

  async remove(id: number, userId: number) {
    return this.prisma.$transaction(async (tx) => {
      const invoice = await tx.salesInvoice.update({
        where: { id, userId },
        data: { status: 'DELETED' }
      });

      // Synchronize with Ledger: Remove transaction on deletion
      await this.transactionService.deleteTransaction({
        userId,
        accountId: invoice.customerId,
        invoiceNumber: invoice.customerInvoiceNumber || invoice.invoiceNumber,
        transactionType: TransactionType.Sales,
      }, tx);

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
            const totalInvoicedQty = (so.salesInvoices || []).reduce((sum, inv) => {
                return sum + (inv.items || []).reduce((iSum, i) => iSum + (Number(i.quantity) || 0), 0);
            }, 0);

            const challans = await tx.salesChallan.findMany({
                where: { soId: so.id, status: { not: 'DELETED' } },
                include: { items: true }
            });
            const totalDeliveredQty = (challans || []).reduce((sum, ch) => sum + (ch.items || []).reduce((iSum, i) => iSum + (Number(i.challanQty) || 0), 0), 0);

            const consumedQty = Math.max(totalInvoicedQty, totalDeliveredQty);

            let newStatus = 'PENDING';
            if (consumedQty >= totalSoQty) {
                if (totalInvoicedQty >= totalSoQty) {
                    newStatus = 'INVOICE_COMPLETED';
                } else {
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
    worksheet.views = [{ state: 'frozen', ySplit: 1 }];
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
      worksheet.views = [{ state: 'frozen', ySplit: 5 }];
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
          customerInvoiceDate: formatDate(inv.customerInvoiceDate),
          bookingDate: formatDate(inv.bookingDate),
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
          doc.text(formatDate(inv.customerInvoiceDate), colX[3], y);
          doc.text(formatDate(inv.bookingDate), colX[4], y);
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
