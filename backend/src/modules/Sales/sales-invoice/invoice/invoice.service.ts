import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../../../infrastructure/prisma/prisma.service';
import { CreateSalesInvoiceDto, UpdateSalesInvoiceDto, SalesInvoiceStatus } from './dto/invoice.dto';
import { TransactionType, BalanceType } from '@prisma/client';
import { SalesOrderService } from '../../sales-order/sales-order.service';
import { TransactionService } from '../../../Finance/transaction.service';
import * as ExcelJS from 'exceljs';
import * as PDFDocument from 'pdfkit';
import { formatDate, parseDDMMYYYY } from '../../../../utils/dateFormatter';
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

  private async batchIsCustomerMsme(accounts: Array<{ mobileNo?: string | null; emailId?: string | null; gstNo?: string | null }>): Promise<Map<string, boolean>> {
    const result = new Map<string, boolean>();
    if (!accounts || accounts.length === 0) return result;

    const gstNos = Array.from(new Set(
      accounts
        .map(a => a.gstNo?.trim())
        .filter((g): g is string => !!g && g !== '')
    ));

    let gstDocs: Array<{ name: string | null; uploadedByUserId: number | null }> = [];
    if (gstNos.length > 0) {
      gstDocs = await this.prisma.sellerDocument.findMany({
        where: {
          type: 'GST',
          name: { in: gstNos }
        },
        select: {
          name: true,
          uploadedByUserId: true
        }
      });
    }

    const gstToUploaderId = new Map<string, number>();
    for (const doc of gstDocs) {
      if (doc.name && doc.uploadedByUserId) {
        gstToUploaderId.set(doc.name.trim(), doc.uploadedByUserId);
      }
    }

    const phones = Array.from(new Set(
      accounts
        .map(a => a.mobileNo?.trim())
        .filter((p): p is string => !!p && p !== '')
    ));

    const emails = Array.from(new Set(
      accounts
        .map(a => a.emailId?.trim())
        .filter((e): e is string => !!e && e !== '')
    ));

    const uploaderIds = Array.from(new Set(
      Array.from(gstToUploaderId.values())
    ));

    const userConditions: any[] = [];
    if (phones.length > 0) {
      userConditions.push({ phone: { in: phones } });
    }
    if (emails.length > 0) {
      userConditions.push({ email: { in: emails } });
    }
    if (uploaderIds.length > 0) {
      userConditions.push({ id: { in: uploaderIds } });
    }

    let users: any[] = [];
    if (userConditions.length > 0) {
      users = await this.prisma.user.findMany({
        where: {
          OR: userConditions
        },
        include: {
          sellerDocuments: true
        }
      });
    }

    const checkUserMsme = (user: any): boolean => {
      if (!user) return false;
      const isMsmeActive = user.sellerDocuments.some(
        (d: any) => d.category === 'UDYOG_AADHAR' && d.name && d.name.trim() !== '' && d.name.trim().toUpperCase() !== 'N/A'
      );
      const isMsmeType = user.regType === 'Manufacturing' || user.regType === 'Service';
      return Boolean(isMsmeActive && isMsmeType);
    };

    const userByPhone = new Map<string, any>();
    const userByEmail = new Map<string, any>();
    const userById = new Map<number, any>();

    for (const u of users) {
      if (u.phone) userByPhone.set(u.phone.trim(), u);
      if (u.email) userByEmail.set(u.email.trim(), u);
      userById.set(u.id, u);
    }

    for (const a of accounts) {
      const mob = a.mobileNo?.trim() || '';
      const em = a.emailId?.trim() || '';
      const gst = a.gstNo?.trim() || '';
      const key = `${mob}|${em}|${gst}`;

      if (result.has(key)) continue;

      let matchedUser: any = null;
      if (mob !== '' && userByPhone.has(mob)) {
        matchedUser = userByPhone.get(mob);
      } else if (em !== '' && userByEmail.has(em)) {
        matchedUser = userByEmail.get(em);
      } else if (gst !== '') {
        const uploaderId = gstToUploaderId.get(gst);
        if (uploaderId && userById.has(uploaderId)) {
          matchedUser = userById.get(uploaderId);
        }
      }

      const isMsme = checkUserMsme(matchedUser);
      result.set(key, isMsme);
    }

    return result;
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

    const msmeMap = await this.batchIsCustomerMsme(customers);
    return customers.map((customer) => {
      const key = `${customer.mobileNo?.trim() || ''}|${customer.emailId?.trim() || ''}|${customer.gstNo?.trim() || ''}`;
      const isMsmeUser = msmeMap.get(key) || false;
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

    const trimmedAccountName = accountName.trim();
    const accounts = await this.prisma.accountMaster.findMany({
      where: {
        userId,
        accountName: { startsWith: trimmedAccountName, mode: 'insensitive' }
      },
      select: { accountName: true }
    });
    const matchedNames = Array.from(new Set([
      trimmedAccountName,
      accountName,
      ...accounts
        .map(a => a.accountName)
        .filter(name => name.trim().toLowerCase() === trimmedAccountName.toLowerCase())
    ]));

    const sos = await this.prisma.salesOrder.findMany({
      where: {
        userId,
        customerName: { in: matchedNames },
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
        await this.syncLedgerTransactions(inv, userId, tx);

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

    const customerIds = Array.from(new Set(
      data
        .map(inv => inv.customerId)
        .filter((id): id is number => id !== null && id !== undefined)
    ));

    let customerMap = new Map<number, any>();
    if (customerIds.length > 0) {
      const customers = await this.prisma.accountMaster.findMany({
        where: { id: { in: customerIds } }
      });
      for (const c of customers) {
        customerMap.set(c.id, c);
      }
    }

    const mappedData = data.map((invoice) => {
      let updatedAddress = invoice.address;
      if (invoice.customerId) {
        const customer = customerMap.get(invoice.customerId);
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
    });

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
      await this.syncLedgerTransactions(inv, userId, tx);

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
      const existing = await tx.salesInvoice.findUnique({
        where: { id, userId },
        select: { invoiceNumber: true }
      });
      if (!existing) {
        throw new BadRequestException("Sales Invoice not found");
      }

      const invoice = await tx.salesInvoice.update({
        where: { id, userId },
        data: { 
          status: 'DELETED',
          invoiceNumber: `${existing.invoiceNumber}_DELETED_${Date.now()}`
        }
      });

      // Synchronize with Ledger: Remove transaction on deletion
      await tx.transaction.deleteMany({
        where: {
          userId,
          invoiceNumber: invoice.customerInvoiceNumber || invoice.invoiceNumber,
          transactionType: TransactionType.Sales,
        }
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

  async downloadSample() {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Invoice Template');
    worksheet.views = [{ state: 'frozen', ySplit: 1 }];

    const headers = [
      'Invoice Number*', 'Invoice Date*', 'Customer Name*',
      'Product Name*', 'Quantity*', 'Rate*', 'Discount (₹)', 'Discount (%)',
      'SO Number', 'Challan Number'
    ];
    worksheet.addRow(headers);

    const headerRow = worksheet.getRow(1);
    headerRow.font = { bold: true };
    headerRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFD3D3D3' }
    };



    worksheet.columns = headers.map((h, i) => {
      let width = Math.max(20, h.length + 5);
      if (i === 2) width = 30; // Customer Name
      if (i === 3) width = 30; // Product Name
      return { width };
    });

    const buffer = await workbook.xlsx.writeBuffer();
    return {
      buffer: Buffer.from(buffer),
      filename: 'Invoice_Import_Sample.xlsx',
      mimetype: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    };
  }

  async importSalesInvoices(buffer: Buffer, userId: number) {
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
        if (val.includes('invoice number')) { colMap['invoiceNumber'] = colNumber; found = true; }
        if (val.includes('invoice date')) colMap['invoiceDate'] = colNumber;
        if (val.includes('customer name')) colMap['customerName'] = colNumber;
        if (val.includes('product name')) colMap['productName'] = colNumber;
        if (val.includes('quantity')) colMap['quantity'] = colNumber;
        if (val.includes('rate')) colMap['rate'] = colNumber;
        if (val.includes('discount (₹)') || val.includes('discount amount') || val.includes('discount rs')) colMap['discountAmount'] = colNumber;
        if (val.includes('discount (%)') || val.includes('discount percent')) colMap['discountPercent'] = colNumber;
        if (val.includes('so number')) colMap['soNumber'] = colNumber;
        if (val.includes('challan number')) colMap['challanNumber'] = colNumber;
      });
      if (found) {
        headerRowIndex = r;
        break;
      }
    }

    const mandatoryCols = ['invoiceNumber', 'invoiceDate', 'customerName', 'productName', 'quantity', 'rate'];
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
      const invoiceNumber = getVal(row, 'invoiceNumber');
      if (!invoiceNumber || invoiceNumber === '-') continue;

      const item = {
        rowNum: r,
        originalRowValues: row.values,
        invoiceNumber,
        invoiceDateStr: getVal(row, 'invoiceDate'),
        customerName: getVal(row, 'customerName'),
        productName: getVal(row, 'productName'),
        quantityStr: getVal(row, 'quantity'),
        rateStr: getVal(row, 'rate'),
        discountAmountStr: getVal(row, 'discountAmount'),
        discountPercentStr: getVal(row, 'discountPercent'),
        soNumber: getVal(row, 'soNumber'),
        challanNumber: getVal(row, 'challanNumber'),
      };

      parsedRows.push(item);
      if (!groupMap.has(invoiceNumber)) {
        groupMap.set(invoiceNumber, []);
      }
      groupMap.get(invoiceNumber).push(item);
    }

    const distinctSoNumbers = Array.from(new Set(parsedRows.map(r => r.soNumber).filter(Boolean)));
    const distinctChallanNumbers = Array.from(new Set(parsedRows.map(r => r.challanNumber).filter(Boolean)));

    const [dbCustomers, dbProducts, userShop, userGstDoc, dbSalesOrders, dbChallans, dbInvoices, soInvoiceItems, challanInvoiceItems] = await Promise.all([
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
        where: { userId, challanNumber: { in: distinctChallanNumbers }, status: { not: 'DELETED' } },
        include: { items: true }
      }),
      this.prisma.salesInvoice.findMany({
        where: { userId, status: { not: 'DELETED' } },
        select: { invoiceNumber: true }
      }),
      this.prisma.salesInvoiceItem.findMany({
        where: {
          salesInvoice: {
            userId,
            status: { not: 'DELETED' },
            soNumber: { in: distinctSoNumbers }
          }
        },
        select: {
          productCode: true,
          quantity: true,
          salesInvoice: { select: { soNumber: true } }
        }
      }),
      this.prisma.salesInvoiceItem.findMany({
        where: {
          salesInvoice: {
            userId,
            status: { not: 'DELETED' },
            challanNumber: { in: distinctChallanNumbers }
          }
        },
        select: {
          productCode: true,
          quantity: true,
          salesInvoice: { select: { challanNumber: true } }
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

    const challanMap = new Map<string, any>();
    for (const ch of dbChallans) {
      challanMap.set(ch.challanNumber.toLowerCase().trim(), ch);
    }

    const dbInvoiceNumbers = new Set(dbInvoices.map(inv => inv.invoiceNumber.toLowerCase().trim()));
    const importedInvoiceNumbersInFile = new Set<string>();

    // Maps to track remaining invoiced quantities
    const soInvoicedQtyMap = new Map<string, number>();
    for (const item of soInvoiceItems) {
      const soNo = item.salesInvoice.soNumber?.toLowerCase().trim() || '';
      const pCode = item.productCode.toLowerCase().trim();
      const key = `${soNo}_${pCode}`;
      soInvoicedQtyMap.set(key, (soInvoicedQtyMap.get(key) || 0) + item.quantity);
    }

    const challanInvoicedQtyMap = new Map<string, number>();
    for (const item of challanInvoiceItems) {
      const chNo = item.salesInvoice.challanNumber?.toLowerCase().trim() || '';
      const pCode = item.productCode.toLowerCase().trim();
      const key = `${chNo}_${pCode}`;
      challanInvoicedQtyMap.set(key, (challanInvoicedQtyMap.get(key) || 0) + item.quantity);
    }

    const successRows: any[] = [];
    const failedRows: { rowNum: number; values: any[]; error: string }[] = [];
    const rowErrors: { row: number; error: string }[] = [];

    const userGst = userGstDoc?.name;
    const companyState = (userShop?.state || "").trim().toLowerCase();
    const isGstApplicable = isValidGst(userGst);

    for (const [invoiceNumber, rows] of groupMap.entries()) {
      const groupErrors: string[] = [];
      const firstRow = rows[0];

      // Check duplicates
      if (dbInvoiceNumbers.has(invoiceNumber.toLowerCase())) {
        groupErrors.push(`Record already exists.`);
      }
      if (importedInvoiceNumbersInFile.has(invoiceNumber.toLowerCase())) {
        groupErrors.push(`Duplicate Invoice Number in file.`);
      }

      // Customer check
      const custName = firstRow.customerName;
      const customer = customerMap.get(custName.toLowerCase());
      if (!customer) {
        groupErrors.push(`Customer "${custName}" not found. Please create the customer first.`);
      }

      const parsedInvoiceDate = parseDDMMYYYY(firstRow.invoiceDateStr);
      if (!parsedInvoiceDate) {
        groupErrors.push(`Invalid Invoice Date format. Please use DD/MM/YYYY.`);
      }

      const soNoInput = firstRow.soNumber;
      const chNoInput = firstRow.challanNumber;

      const salesOrder = soNoInput ? soMap.get(soNoInput.toLowerCase().trim()) : null;
      const challan = chNoInput ? challanMap.get(chNoInput.toLowerCase().trim()) : null;

      if (soNoInput && !salesOrder) {
        groupErrors.push(`Sales Order not found.`);
      }
      if (chNoInput && !challan) {
        groupErrors.push(`Challan not found.`);
      }

      // Cross-document relation validations
      if (salesOrder && parsedInvoiceDate && salesOrder.soCreationDate) {
        const soDate = new Date(salesOrder.soCreationDate);
        if (parsedInvoiceDate < soDate) {
          groupErrors.push(`Invoice Date must be greater than or equal to SO Date.`);
        }
      }

      if (challan && parsedInvoiceDate && challan.challanDate) {
        const chDate = new Date(challan.challanDate);
        if (parsedInvoiceDate < chDate) {
          groupErrors.push(`Invoice Date must be greater than or equal to Challan Date.`);
        }
      }

      if (salesOrder && challan) {
        // Scenario 2: Validate that Challan belongs to SO
        if (challan.soNumber?.toLowerCase().trim() !== soNoInput.toLowerCase().trim()) {
          groupErrors.push(`Challan ${chNoInput} does not belong to Sales Order ${soNoInput}.`);
        }
      }

      const processedItems: any[] = [];
      let totalQuantity = 0;
      let totalTaxable = 0;
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

        // Scenarios validations
        if (soNoInput && salesOrder && !chNoInput) {
          // Scenario 1: Only SO
          const soItem = salesOrder.items.find(
            (it: any) => it.productCode.toLowerCase().trim() === prod.product_code.toLowerCase().trim()
          );
          if (!soItem) {
            groupErrors.push(`Row ${row.rowNum}: Product "${row.productName}" does not belong to Sales Order ${soNoInput}.`);
            continue;
          }
          if (Math.abs(rate - soItem.rate) >= 0.01) {
            groupErrors.push(`Row ${row.rowNum}: Rate mismatch with Sales Order.`);
          }
          if (Math.abs(discountAmt - soItem.discountAmount) >= 0.01) {
            groupErrors.push(`Row ${row.rowNum}: Discount mismatch with Sales Order.`);
          }
          if (Math.abs(discountPct - soItem.discountPercent) >= 0.01) {
            groupErrors.push(`Row ${row.rowNum}: Discount mismatch with Sales Order.`);
          }

          const key = `${soNoInput.toLowerCase().trim()}_${prod.product_code.toLowerCase().trim()}`;
          const alreadyInvoiced = soInvoicedQtyMap.get(key) || 0;
          const remaining = soItem.quantity - alreadyInvoiced;

          if (qty > remaining) {
            groupErrors.push(`Row ${row.rowNum}: Quantity exceeds Sales Order quantity.`);
          } else {
            soInvoicedQtyMap.set(key, alreadyInvoiced + qty);
          }

        } else if (challan) {
          // Scenario 2 (SO + Challan) or Scenario 3 (Only Challan)
          const chItem = challan.items.find(
            (it: any) => it.productCode.toLowerCase().trim() === prod.product_code.toLowerCase().trim()
          );
          if (!chItem) {
            groupErrors.push(`Row ${row.rowNum}: Product "${row.productName}" does not belong to Challan ${chNoInput}.`);
            continue;
          }
          if (Math.abs(rate - chItem.rate) >= 0.01) {
            groupErrors.push(`Row ${row.rowNum}: Rate mismatch with Challan.`);
          }
          if (Math.abs(discountAmt - chItem.discountAmount) >= 0.01) {
            groupErrors.push(`Row ${row.rowNum}: Discount mismatch with Challan.`);
          }
          if (Math.abs(discountPct - chItem.discountPercent) >= 0.01) {
            groupErrors.push(`Row ${row.rowNum}: Discount mismatch with Challan.`);
          }

          const key = `${chNoInput.toLowerCase().trim()}_${prod.product_code.toLowerCase().trim()}`;
          const alreadyInvoiced = challanInvoicedQtyMap.get(key) || 0;
          const remaining = chItem.challanQty - alreadyInvoiced;

          if (qty > remaining) {
            groupErrors.push(`Row ${row.rowNum}: Quantity exceeds Challan quantity.`);
          } else {
            challanInvoicedQtyMap.set(key, alreadyInvoiced + qty);
          }
        }

        if (groupErrors.length > 0) continue;

        const beforeTaxAmount = (qty * rate) - discountAmt;
        const taxRate = Number(prod.tax_rate || 0);
        const taxAmount = isGstApplicable ? ((beforeTaxAmount * taxRate) / 100) : 0;
        const totalItemAmount = beforeTaxAmount + taxAmount;

        totalQuantity += qty;
        totalTaxable += beforeTaxAmount;
        totalTaxAmount += taxAmount;

        processedItems.push({
          productId: prod.id,
          productCode: prod.product_code,
          productName: prod.product_name,
          hsnCode: prod.hsn_code || null,
          quantity: qty,
          rate,
          uom: prod.uom?.unit_name || 'Nos',
          discountPercent: discountPct,
          discountAmount: discountAmt,
          taxPercent: taxRate,
          taxAmount,
          beforeTaxAmount,
          totalAmount: totalItemAmount,
          totalSoQty: salesOrder ? salesOrder.items.find((it: any) => it.productCode === prod.product_code)?.quantity || 0 : 0,
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

          const grandTotal = totalTaxable + totalTaxAmount;

          const lastInvoice = await this.prisma.salesInvoice.findFirst({
            where: { userId, customerName: customer.accountName, status: { not: 'DELETED' } },
            orderBy: { createdAt: 'desc' },
            select: { cumulativeBalance: true }
          });
          const cumulativeBalance = (lastInvoice?.cumulativeBalance || 0) + grandTotal;

          await this.prisma.$transaction(async (tx) => {
            const inv = await tx.salesInvoice.create({
              data: {
                invoiceNumber,
                customerInvoiceNumber: invoiceNumber,
                customerInvoiceDate: parsedInvoiceDate,
                invoiceDate: parsedInvoiceDate,
                bookingDate: new Date(),
                customerId: customer.id,
                soId: salesOrder ? salesOrder.id : null,
                customerName: customer.accountName,
                address: customer.addressLine1 + (customer.addressLine2 ? ', ' + customer.addressLine2 : ''),
                creditDays: customer.customerCreditDays || 0,
                gstNumber: customer.gstNo || '',
                soNumber: soNoInput || null,
                challanNumber: chNoInput || null,
                cgstAmount,
                sgstAmount,
                igstAmount,
                isRcm: false,
                isInterState,
                gstType: isInterState ? 'IGST' : 'CGST_SGST',
                taxableAmount: totalTaxable,
                grandTotal,
                cumulativeBalance,
                userId,
                items: {
                  create: processedItems.map(item => ({
                    productId: item.productId,
                    productCode: item.productCode,
                    productName: item.productName,
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
                    totalSoQty: item.totalSoQty,
                    printDescription: item.printDescription
                  }))
                }
              }
            });

            // Post Ledger Transaction
            await this.syncLedgerTransactions(inv, userId, tx);

            await this.updateCompletionStatusesAfterInvoice(inv.id, tx);
          });

          importedInvoiceNumbersInFile.add(invoiceNumber.toLowerCase());
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
      'Invoice Number*', 'Invoice Date*', 'Customer Name*',
      'Product Name*', 'Quantity*', 'Rate*', 'Discount (₹)', 'Discount (%)',
      'SO Number', 'Challan Number'
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

  private async getOrCreateAccount(accountName: string, groupName: string[], userId: number, tx: any) {
    let account = await tx.accountMaster.findFirst({
      where: {
        accountName,
        userId,
      },
    });

    if (!account) {
      account = await tx.accountMaster.create({
        data: {
          accountName,
          groupName,
          userId,
          status: 'ACTIVE',
          panNo: 'N/A',
          addressLine1: 'Default Address',
          pincode: '000000',
          state: 'Unknown',
          prefix: 'Mr',
          contactPersonName: 'Admin',
          mobileNo: '0000000000',
        },
      });
    }
    return account;
  }

  private async syncLedgerTransactions(invoice: any, userId: number, tx: any) {
    // 1. Delete all existing transactions for this sales invoice
    await tx.transaction.deleteMany({
      where: {
        userId,
        invoiceNumber: invoice.customerInvoiceNumber || invoice.invoiceNumber,
        transactionType: TransactionType.Sales,
      }
    });

    // 2. Debit Customer
    await tx.transaction.create({
      data: {
        accountId: invoice.customerId,
        userId,
        bookingDate: new Date(invoice.bookingDate),
        invoiceNumber: invoice.customerInvoiceNumber || invoice.invoiceNumber,
        transactionType: TransactionType.Sales,
        amount: invoice.grandTotal,
        entryType: BalanceType.Dr,
      }
    });

    // 3. Credit Sales Income (Sales excl GST)
    const salesAccount = await this.getOrCreateAccount(
      'SALES INCOME (EXCL. GST)',
      ['Sales Accounts'],
      userId,
      tx
    );
    await tx.transaction.create({
      data: {
        accountId: salesAccount.id,
        userId,
        bookingDate: new Date(invoice.bookingDate),
        invoiceNumber: invoice.customerInvoiceNumber || invoice.invoiceNumber,
        transactionType: TransactionType.Sales,
        amount: invoice.taxableAmount,
        entryType: BalanceType.Cr,
      }
    });

    // 4. Credit Expenses/Charges
    if (invoice.expenses) {
      for (const exp of invoice.expenses) {
        if (exp.amount > 0) {
          const expAccount = await this.getOrCreateAccount(
            exp.groupName,
            ['Direct Income'],
            userId,
            tx
          );
          await tx.transaction.create({
            data: {
              accountId: expAccount.id,
              userId,
              bookingDate: new Date(invoice.bookingDate),
              invoiceNumber: invoice.customerInvoiceNumber || invoice.invoiceNumber,
              transactionType: TransactionType.Sales,
              amount: exp.amount,
              entryType: BalanceType.Cr,
            }
          });
        }
      }
    }
  }
}

