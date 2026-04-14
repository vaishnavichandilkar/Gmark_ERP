import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/prisma/prisma.service';
import { CreatePurchaseInvoiceDto, UpdatePurchaseInvoiceDto, ItemDto } from './invoice/dto/invoice.dto';
import { Prisma, PIStatus } from '@prisma/client';
import { PurchaseOrderService } from '../purchase-order/purchase-order.service';
import * as ExcelJS from 'exceljs';
import * as PDFDocument from 'pdfkit';

@Injectable()
export class PurchaseInvoiceService {
  constructor(
    private prisma: PrismaService,
    private poService: PurchaseOrderService
  ) { }

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

  async getSupplierPOs(supplierIdOrName: string, userId: number) {
    let accountName = supplierIdOrName;
    
    // If it's a numeric ID, find the actual account name first
    if (/^\d+$/.test(supplierIdOrName)) {
      const account = await this.prisma.accountMaster.findUnique({
        where: { id: parseInt(supplierIdOrName, 10) },
      });
      if (account) {
        accountName = account.accountName;
      }
    }

    return this.prisma.purchaseOrder.findMany({
      where: {
        userId,
        supplierName: accountName,
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
    const invoiceNumber = await this.generateInvoiceNumber();

    // Supplier Logic
    const supplier = await this.prisma.accountMaster.findFirst({
      where: { id: parseInt(createDto.supplierId, 10) },
    });

    if (!supplier) throw new BadRequestException('Supplier not found');

    // As per requirement: Check if supplier is valid for purchase
    // Defaulting to groupName including 'SUNDRY_CREDITORS' if type isn't natively available
    if (!supplier.groupName.includes('SUNDRY_CREDITORS') && !supplier.supplierCode) {
      throw new BadRequestException('Invalid supplier');
    }

    // Auto-fill from supplier
    const address = supplier.addressLine1 || createDto.address;
    const creditDays = supplier.supplierCreditDays || createDto.creditDays || 0;
    const gstNo = supplier.gstNo || createDto.gstNumber;

    const company = await this.prisma.shopDetail.findUnique({
      where: { userId },
    });

    if (!company) throw new BadRequestException('Company detail not found for this user');

    // As per spec: items and accountSummary are prioritized
    const pItems = createDto.items || createDto.products || [];
    let summary = createDto.accountSummary;
    
    let totalTaxable = 0;
    let materialTax = 0;
    const itemsToCreate = [];

    for (const i of pItems) {
        const qty = Number(i.quantity || 0);
        const rate = Number(i.rate || 0);
        const discAmt = Number(i.discount || 0);
        const befTax = (qty * rate) - discAmt;
        const taxPct = Number(i.taxPercent || 0);
        const taxAmt = (befTax * taxPct) / 100;
        
        totalTaxable += befTax;
        materialTax += taxAmt;

        itemsToCreate.push({
            productId: i.productId ? parseInt(i.productId, 10) : null,
            productCode: i.productCode,
            productName: i.productName,
            quantity: qty,
            rate: rate,
            uom: i.uom,
            taxPercent: taxPct,
            taxAmount: taxAmt,
            amount: befTax + taxAmt,
            beforeTaxAmount: befTax,
            totalPoQty: i.totalPoQty || 0,
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
                if (exp.isGstApplicable) {
                    tAmt = (amt * tRate) / 100;
                }
                expenseTotal += amt;
                expenseTax += tAmt;
            } else {
                // Post GST charges don't add to base or tax
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

    // Fetch user's registered GST
    const userGstDoc = await this.prisma.sellerDocument.findFirst({
        where: { uploadedByUserId: userId, type: 'GST' },
        select: { name: true }
    });
    const userGst = userGstDoc?.name;

    const companyState = (company.state || "").trim().toLowerCase();
    const supplierState = (supplier.state || "").trim().toLowerCase();
    const supplierGst = gstNo;

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
    } else if (!userGst && supplierGst) {
        // Case 3: Buyer NO, Supplier YES (Normal GST)
        isInterState = companyState !== supplierState;
    } else {
        // Case 4: Both NO
        isGstApplicable = false;
    }

    let cgst = 0, sgst = 0, igst = 0;
    const effectiveTax = isGstApplicable ? finalTax : 0;

    if (isGstApplicable) {
        if (isInterState) {
            igst = effectiveTax;
        } else {
            cgst = effectiveTax / 2;
            sgst = effectiveTax / 2;
        }
    }

    // RCM: Buyer pays tax separately. Supplier invoice doesn't include it in payable total.
    const taxInTotal = isRcm ? 0 : effectiveTax;
    const grandTotal = totalTaxable + expenseTotal + taxInTotal + postGstChargeTotal;

    const lastPi = await this.prisma.purchaseInvoice.findFirst({
        where: { 
          userId, 
          supplierName: supplier.accountName,
          status: { not: 'DELETED' }
        },
        orderBy: { createdAt: 'desc' },
        select: { cumulativeBalance: true }
    });

    const cumulativeBalance = (lastPi?.cumulativeBalance || 0) + grandTotal;

    const poIds = createDto.poIds || [];
    const challanNumbers = createDto.challanNumbers || [];

    const poNumberStr = poIds.length > 0 ? poIds.join(',') : null;
    const grnNumberStr = challanNumbers.length > 0 ? challanNumbers.join(',') : null;

    const invoice = await this.prisma.purchaseInvoice.create({
      data: {
        invoiceNumber: createDto.invoiceNumber || invoiceNumber,
        bookingDate: createDto.bookingDate ? new Date(createDto.bookingDate) : new Date(),
        supplierInvoiceNumber: createDto.supplierInvoiceNumber,
        supplierInvoiceDate: createDto.invoiceDate ? new Date(createDto.invoiceDate) : new Date(),
        supplierId: supplier.id,
        supplierName: supplier.accountName,
        address: createDto.address,
        creditDays: createDto.creditDays,
        gstNumber: createDto.gstNumber,
        poNumber: poNumberStr,
        challanNumber: grnNumberStr,
        cgstAmount: cgst,
        sgstAmount: sgst,
        igstAmount: igst,
        isRcm: isRcm,
        taxableAmount: totalTaxable,
        grandTotal: grandTotal,
        cumulativeBalance: cumulativeBalance,
        userId,
        uploadedFilePath: uploadedFilePath || null,
        items: {
          create: itemsToCreate
        },
        expenses: {
          create: expensesToCreate
        }
      },
      include: { items: true, expenses: true }
    });

    return invoice;
  }


  async findAll(query?: { search?: string, status?: string, page?: number, limit?: number, userId?: number }) {
    const where: any = {
      userId: query?.userId
    };

    if (query?.status && query.status !== 'all') {
      where.status = query.status.toUpperCase();
    }

    if (query?.search) {
      where.OR = [
        { supplierName: { contains: query.search, mode: 'insensitive' } },
        { invoiceNumber: { contains: query.search, mode: 'insensitive' } },
        { supplierInvoiceNumber: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    const { page = 1, limit = 10 } = query || {};
    const skip = (page - 1) * limit;

    const [data, total] = await Promise.all([
      this.prisma.purchaseInvoice.findMany({
        where,
        include: { items: true, expenses: true },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.purchaseInvoice.count({ where })
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

  async findOne(id: number) {
    const invoice = await this.prisma.purchaseInvoice.findUnique({
      where: { id },
      include: { items: true, expenses: true },
    });

    if (!invoice) throw new NotFoundException(`Invoice ID ${id} not found`);
    return invoice;
  }

  async update(id: number, updateDto: UpdatePurchaseInvoiceDto, uploadedFilePath?: string) {
    const existing = await this.prisma.purchaseInvoice.findUnique({
      where: { id },
      include: { items: true, expenses: true },
    });

    if (!existing) throw new NotFoundException(`Invoice ID ${id} not found`);

    const company = await this.prisma.shopDetail.findUnique({
      where: { userId: existing.userId },
    });

    if (!company) throw new BadRequestException('Company detail not found');

    let pItems = updateDto.items || updateDto.products;
    
    let totalTaxable = 0;
    let materialTax = 0;
    const itemsToCreate = [];

    if (pItems) {
        for (const i of pItems) {
            const qty = Number(i.quantity || 0);
            const rate = Number(i.rate || 0);
            const discAmt = Number(i.discount || 0);
            const befTax = (qty * rate) - discAmt;
            const taxPct = Number(i.taxPercent || 0);
            const taxAmt = (befTax * taxPct) / 100;
            
            totalTaxable += befTax;
            materialTax += taxAmt;

            itemsToCreate.push({
                productId: i.productId ? parseInt(i.productId, 10) : null,
                productCode: i.productCode,
                productName: i.productName,
                quantity: qty,
                rate: rate,
                uom: i.uom,
                taxPercent: taxPct,
                taxAmount: taxAmt,
                amount: befTax + taxAmt,
                beforeTaxAmount: befTax,
                totalPoQty: i.totalPoQty || 0,
            });
        }
    } else {
        totalTaxable = existing.taxableAmount;
        // Approximation for materialTax if items not provided
        materialTax = existing.cgstAmount + existing.sgstAmount + existing.igstAmount; 
    }

    let expenseTotal = 0;
    let expenseTax = 0;
    let postGstChargeTotal = 0;
    const expensesToCreate = [];

    if (updateDto.expenses) {
        for (const exp of updateDto.expenses) {
            const amt = Number(exp.amount || 0);
            const tRate = Number(exp.taxRate || 0);
            const isPostGst = !!exp.isPostGst;
            let tAmt = 0;
            
            if (!isPostGst) {
                if (exp.isGstApplicable) {
                    tAmt = (amt * tRate) / 100;
                }
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
    const gstNo = updateDto.gstNumber || existing.gstNumber;

    // Fetch user's registered GST
    const userGstDoc = await this.prisma.sellerDocument.findFirst({
        where: { uploadedByUserId: existing.userId, type: 'GST' },
        select: { name: true }
    });
    const userGst = userGstDoc?.name;

    const companyState = (company.state || "").trim().toLowerCase();
    
    let isGstApplicable = true;
    let isRcm = false;
    let isInterState = false;

    const userCode = userGst ? userGst.substring(0, 2) : null;
    const supplierCode = gstNo ? gstNo.substring(0, 2) : null;

    if (userGst && gstNo) {
        if (/^\d{2}$/.test(userCode) && /^\d{2}$/.test(supplierCode)) {
            isInterState = userCode !== supplierCode;
        } else {
            isInterState = gstNo.substring(0, 2) !== company.state.substring(0, 2);
        }
    } else if (userGst && !gstNo) {
        isRcm = true;
    } else if (!userGst && gstNo) {
        isInterState = gstNo.substring(0, 2) !== company.state.substring(0, 2);
    } else {
        isGstApplicable = false;
    }

    let cgst = 0, sgst = 0, igst = 0;
    const effectiveTax = isGstApplicable ? finalTax : 0;

    if (isGstApplicable) {
        if (isInterState) {
            igst = effectiveTax;
        } else {
            cgst = effectiveTax / 2;
            sgst = effectiveTax / 2;
        }
    }

    const taxInTotal = isRcm ? 0 : effectiveTax;
    const grandTotal = totalTaxable + expenseTotal + taxInTotal + postGstChargeTotal;

    try {
      return await this.prisma.$transaction(async (tx) => {
        if (pItems) {
          await tx.purchaseInvoiceItem.deleteMany({
            where: { purchaseInvoiceId: id },
          });
        }

      if (updateDto.expenses) {
        await tx.purchaseInvoiceExpense.deleteMany({
          where: { purchaseInvoiceId: id },
        });
      }

      const updated = await tx.purchaseInvoice.update({
        where: { id },
        data: {
          invoiceNumber: updateDto.invoiceNumber ?? existing.invoiceNumber,
          supplierInvoiceNumber: updateDto.supplierInvoiceNumber ?? existing.supplierInvoiceNumber,
          supplierInvoiceDate: updateDto.invoiceDate ? new Date(updateDto.invoiceDate) : existing.supplierInvoiceDate,
          bookingDate: updateDto.bookingDate ? new Date(updateDto.bookingDate) : existing.bookingDate,
          supplierName: updateDto.supplierName ?? existing.supplierName,
          address: updateDto.address ?? existing.address,
          poNumber: updateDto.poIds ? updateDto.poIds.join(',') : existing.poNumber,
          challanNumber: updateDto.challanNumbers ? updateDto.challanNumbers.join(',') : existing.challanNumber,
          creditDays: updateDto.creditDays ?? existing.creditDays,
          status: (updateDto.status as any) ?? existing.status,
          uploadedFilePath: uploadedFilePath || existing.uploadedFilePath,
          taxableAmount: totalTaxable,
          cgstAmount: cgst,
          sgstAmount: sgst,
          igstAmount: igst,
          isRcm: isRcm,
          grandTotal: grandTotal,
          items: pItems ? {
            create: itemsToCreate
          } : undefined,
          expenses: updateDto.expenses ? {
            create: expensesToCreate
          } : undefined,
        },
        include: { items: true, expenses: true },
      });

        return updated;
      });
    } catch (error) {
        console.error("Error in updatePurchaseInvoice:", error);
        throw new BadRequestException("Failed to update Purchase Invoice: " + error.message);
    }
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

    const now = new Date();
    const pad = (n: number) => n.toString().padStart(2, '0');
    const hours = now.getHours();
    const ampm = hours >= 12 ? 'pm' : 'am';
    const formattedHours = hours % 12 || 12;
    const d = pad(now.getDate());
    const m = pad(now.getMonth() + 1);
    const yyyy = now.getFullYear();
    const hr = pad(formattedHours);
    const min = pad(now.getMinutes());
    const sec = pad(now.getSeconds());
    const timestamp = `${d}/${m}/${yyyy}, ${hr}:${min}:${sec} ${ampm}`;

    if (format === 'xlsx') {
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet('Purchase Invoices');
      worksheet.columns = [
        { header: 'Inv No', key: 'invoiceNumber', width: 15 },
        { header: 'Supplier Name', key: 'supplierName', width: 30 },
        { header: 'Supp. Inv No', key: 'supplierInvoiceNumber', width: 20 },
        { header: 'Supp. Inv Date', key: 'supplierInvoiceDate', width: 15 },
        { header: 'Booking Date', key: 'bookingDate', width: 15 },
        { header: 'PO No', key: 'poNumber', width: 15 },
        { header: 'Taxable Amt', key: 'taxableAmount', width: 15 },
        { header: 'Tax Amt', key: 'taxAmt', width: 15 },
        { header: 'Grand Total', key: 'grandTotal', width: 15 },
        { header: 'Status', key: 'status', width: 12 },
      ];

      invoices.forEach(inv => {
        worksheet.addRow({
          invoiceNumber: inv.invoiceNumber,
          supplierName: inv.supplierName,
          supplierInvoiceNumber: inv.supplierInvoiceNumber,
          supplierInvoiceDate: inv.supplierInvoiceDate.toLocaleDateString(),
          bookingDate: inv.bookingDate.toLocaleDateString(),
          poNumber: inv.poNumber || '-',
          taxableAmount: inv.taxableAmount,
          taxAmt: inv.cgstAmount + inv.sgstAmount,
          grandTotal: inv.grandTotal,
          status: inv.status,
        });
      });

      worksheet.spliceRows(1, 0, [], [], [], []);
      worksheet.mergeCells('A1:J1');
      const titleCell = worksheet.getCell('A1');
      titleCell.value = 'ERP';
      titleCell.font = { size: 18, bold: true };
      titleCell.alignment = { horizontal: 'center', vertical: 'middle' };

      worksheet.mergeCells('A2:J2');
      const subtitleCell = worksheet.getCell('A2');
      subtitleCell.value = 'Purchase Invoice Report';
      subtitleCell.font = { size: 14 };
      subtitleCell.alignment = { horizontal: 'center', vertical: 'middle' };

      worksheet.mergeCells('A3:J3');
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
        filename: `purchase_invoices_${Date.now()}.xlsx`,
        mimetype: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      };
    } else {
      return new Promise<any>((resolve) => {
        const doc = new PDFDocument({ margin: 20, size: 'A4', layout: 'landscape' });
        const buffers: Buffer[] = [];
        doc.on('data', buffers.push.bind(buffers));
        doc.on('end', () => resolve({ buffer: Buffer.concat(buffers), filename: `purchase_invoices_${Date.now()}.pdf`, mimetype: 'application/pdf' }));

        doc.fontSize(18).font('Helvetica-Bold').text('ERP', { align: 'center' });
        doc.fontSize(14).font('Helvetica').text('Purchase Invoice Report', { align: 'center' });
        doc.moveDown(0.5);
        doc.fontSize(10).text(`Exported on: ${timestamp}`, { align: 'right' });
        doc.moveDown();

        const tableTop = 100;
        const colX = [20, 100, 250, 340, 420, 500, 570, 640, 710, 770];
        const headers = ['Inv No', 'Supplier Name', 'Supp. Inv No', 'Supp. Date', 'Book Date', 'PO No', 'Taxable', 'Tax', 'Total', 'Status'];

        doc.rect(15, tableTop - 5, 805, 20).fill('#4472C4');
        doc.fontSize(8).font('Helvetica-Bold').fillColor('#FFFFFF');
        headers.forEach((h, i) => doc.text(h, colX[i], tableTop));

        let y = tableTop + 20;
        doc.fillColor('#000000').font('Helvetica');

        invoices.forEach((inv, index) => {
          if (y > 550) {
            doc.addPage({ margin: 20, size: 'A4', layout: 'landscape' });
            y = 40;
            doc.rect(15, y - 5, 805, 20).fill('#4472C4');
            doc.fontSize(8).font('Helvetica-Bold').fillColor('#FFFFFF');
            headers.forEach((h, i) => doc.text(h, colX[i], y));
            y += 20;
            doc.fillColor('#000000').font('Helvetica');
          }

          if (index % 2 === 1) {
            doc.rect(15, y - 3, 805, 15).fill('#F2F2F2').fillColor('#000000');
          }

          doc.fontSize(7);
          doc.text(inv.invoiceNumber, colX[0], y);
          doc.text(inv.supplierName.substring(0, 30), colX[1], y, { width: 140 });
          doc.text(inv.supplierInvoiceNumber, colX[2], y);
          doc.text(inv.supplierInvoiceDate.toLocaleDateString(), colX[3], y);
          doc.text(inv.bookingDate.toLocaleDateString(), colX[4], y);
          doc.text(inv.poNumber || '-', colX[5], y);
          doc.text(inv.taxableAmount.toFixed(2), colX[6], y);
          doc.text((inv.cgstAmount + inv.sgstAmount).toFixed(2), colX[7], y);
          doc.text(inv.grandTotal.toFixed(2), colX[8], y);
          doc.text(inv.status, colX[9], y);
          y += 20;
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

    const parseDate = (val: any): Date | undefined => {
      if (!val) return undefined;
      const date = new Date(val);
      if (isNaN(date.getTime())) return undefined;
      return date;
    };

    for (let i = 2; i <= rowCount; i++) {
      const row = worksheet.getRow(i);
      try {
        const supplierName = String(row.getCell(1).value || '').trim();
        const supplierInvoiceNumber = String(row.getCell(2).value || '').trim();
        const supplierInvoiceDateRaw = row.getCell(3).value;

        if (!supplierInvoiceNumber || !supplierName || supplierInvoiceNumber === 'Supplier Invoice No*') continue;

        const supplierInvoiceDate = parseDate(supplierInvoiceDateRaw);
        if (!supplierInvoiceDate) {
          throw new Error(`Invalid Supplier Invoice Date at row ${i}`);
        }

        const supplier = await this.prisma.accountMaster.findFirst({
            where: { accountName: supplierName }
        });

        if (!supplier) {
            throw new Error(`Supplier ${supplierName} not found`);
        }

        const items: ItemDto[] = [{
          productId: '0',
          productCode: String(row.getCell(9).value || '').trim(),
          productName: 'Imported Item',
          quantity: parseFloat(String(row.getCell(10).value || 0)),
          rate: parseFloat(String(row.getCell(11).value || 0)),
          uom: String(row.getCell(12).value || 'NOS').trim(),
          hsnCode: '',
          discount: 0,
          taxPercent: 0,
          beforeTaxAmount: 0,
          taxAmount: 0,
          totalAmount: 0,
          baseAmount: 0
        }];

        let beforeTaxAmount = 0;
        items.forEach(p => {
           p.baseAmount = p.quantity * p.rate;
           p.taxAmount = 0;
           p.totalAmount = p.baseAmount;
           beforeTaxAmount += p.baseAmount;
        });

        const dto: CreatePurchaseInvoiceDto = {
          supplierId: supplier.id.toString(),
          supplierName,
          invoiceNumber: supplierInvoiceNumber,
          invoiceDate: supplierInvoiceDate.toISOString(),
          bookingDate: (parseDate(row.getCell(4).value) || new Date()).toISOString(),
          address: String(row.getCell(5).value || '').trim() || 'Imported Address',
          creditDays: Math.max(1, parseInt(String(row.getCell(6).value || 0), 10)),
          gstNumber: supplier.gstNo || '',
          challanNumbers: String(row.getCell(7).value || '').trim() ? [String(row.getCell(7).value).trim()] : [],
          poIds: String(row.getCell(8).value || '').trim() ? [String(row.getCell(8).value).trim()] : [],
          items,
          accountSummary: {
            materialPurchase: beforeTaxAmount,
            cgst: 0,
            sgst: 0,
            igst: 0,
            grandTotal: beforeTaxAmount
          }
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

  async remove(id: number, userId: number) {
    const existing = await this.prisma.purchaseInvoice.findUnique({
      where: { id },
    });

    if (!existing) throw new NotFoundException(`Invoice ID ${id} not found`);
    if (existing.userId !== userId) throw new ForbiddenException('You do not have permission to delete this invoice');

    return this.prisma.$transaction(async (tx) => {
      // If linked to a PO, reset PO status
      if (existing.poId) {
        await tx.purchaseOrder.update({
          where: { id: existing.poId },
          data: { status: 'PENDING' }
        });
      }

      return tx.purchaseInvoice.update({
        where: { id },
        data: { status: 'DELETED' }
      });
    });
  }
}
