import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/prisma/prisma.service';
import { CreatePurchaseInvoiceDto, UpdatePurchaseInvoiceDto, ItemDto } from './invoice/dto/invoice.dto';
import { Prisma, PIStatus, TransactionType, BalanceType } from '@prisma/client';
import { PurchaseOrderService } from '../purchase-order/purchase-order.service';
import * as ExcelJS from 'exceljs';
import * as PDFDocument from 'pdfkit';
import { formatDate } from '../../../utils/dateFormatter';
import { isValidGst, determinePurchaseGst } from '../../../common/utils/gst.helper';
import { generatePISampleExcel } from '../../../common/utils/procurement-bulk-import.processor';
import { TransactionService } from '../../Finance/transaction.service';

import { ImportValidationService } from '../../../common/services/import-validation.service';

@Injectable()
export class PurchaseInvoiceService {
  constructor(
    private prisma: PrismaService,
    private poService: PurchaseOrderService,
    private transactionService: TransactionService,
    private importValidator: ImportValidationService
  ) { }

  private async updateCompletionStatusesAfterInvoice(invoiceId: number, tx: any) {
    const inv = await tx.purchaseInvoice.findUnique({
      where: { id: invoiceId },
      include: { items: true }
    });
    if (!inv) return;

    // 1. Update PO Status
    if (inv.poId) {
      const po = await tx.purchaseOrder.findUnique({
        where: { id: inv.poId },
        include: {
          items: true,
          purchaseInvoices: {
            where: { status: { not: 'DELETED' } },
            include: { items: true }
          }
        }
      });
      if (po) {
        const totalPoQty = po.items.reduce((sum, item) => sum + item.quantity, 0);
        const totalInvoicedQty = (po.purchaseInvoices || []).reduce((sum, i) => {
          return sum + (i.items || []).reduce((iSum, it) => iSum + (Number(it.quantity) || 0), 0);
        }, 0);

        const grns = await tx.grn.findMany({
          where: { poId: po.id, status: { not: 'DELETED' } },
          include: { items: true }
        });
        const totalReceivedQty = (grns || []).reduce((sum, g) => sum + (g.items || []).reduce((iSum, i) => iSum + (Number(i.receivedQty) || 0), 0), 0);

        const consumedQty = Math.max(totalInvoicedQty, totalReceivedQty);

        let newStatus = po.status;
        if (consumedQty >= (totalPoQty - 0.001)) {
            if (totalInvoicedQty >= (totalPoQty - 0.001)) {
                newStatus = 'INVOICE_COMPLETED';
            } else {
                newStatus = 'GRN_COMPLETED';
            }
        } else if (consumedQty > 0) {
            newStatus = 'PARTIAL_GRN';
        } else {
            newStatus = 'PENDING';
        }

        if (po.status !== newStatus) {
            await tx.purchaseOrder.update({
                where: { id: po.id },
                data: { status: newStatus }
            });
        }
      }
    }

    // 2. Update GRN Statuses
    if (inv.challanNumber && typeof inv.challanNumber === 'string') {
      const challanIds = inv.challanNumber.split(',').map(id => id.trim());
      for (const cid of challanIds) {
        const grn = await tx.grn.findFirst({
          where: {
            OR: [
              { id: /^\d+$/.test(cid) ? parseInt(cid, 10) : -1 },
              { challanNumber: cid }
            ],
            status: { not: 'DELETED' }
          },
          include: { items: true }
        });

        if (grn) {
          const totalGrnQty = grn.items.reduce((sum, item) => sum + item.receivedQty, 0);
          
          // Find all invoices that reference this GRN
          const grnInvoices = await tx.purchaseInvoice.findMany({
            where: {
              status: { not: 'DELETED' },
              OR: [
                { challanNumber: { contains: grn.id.toString() } },
                { challanNumber: { contains: grn.challanNumber } }
              ]
            },
            include: { items: true }
          });

          const totalInvoicedForGrn = grnInvoices.reduce((sum, oInv) => {
            if (!oInv.challanNumber) return sum;
            const oIds = oInv.challanNumber.split(',').map(id => id.trim());
            if (oIds.includes(grn.id.toString()) || oIds.includes(grn.challanNumber)) {
              return sum + oInv.items.reduce((iSum, i) => iSum + i.quantity, 0);
            }
            return sum;
          }, 0);

          if (totalInvoicedForGrn >= totalGrnQty) {
            await tx.grn.update({ where: { id: grn.id }, data: { status: 'COMPLETED' } });
          } else {
            if (grn.status === 'COMPLETED') {
              await tx.grn.update({ where: { id: grn.id }, data: { status: 'GENERATED' } });
            }
          }
        }
      }
    }
  }

  async getSuppliers(userId: number) {
    return this.prisma.accountMaster.findMany({
      where: {
        userId,
        groupName: { has: 'SUNDRY_CREDITORS' },
        supplierStatus: 'ACTIVE',
      },
      select: {
        id: true,
        supplierCode: true,
        accountName: true,
        supplierCreditDays: true,
        addressLine1: true,
        addressLine2: true,
        gstNo: true,
        panNo: true,
        msmeEnabled: true,
        regType: true,
      },
      orderBy: { accountName: 'asc' },
    });
  }

  async getSupplierAccount(supplierId: string | number, userId: number) {
    const id = typeof supplierId === 'string' ? parseInt(supplierId, 10) : supplierId;
    const account = await this.prisma.accountMaster.findUnique({
      where: { id, userId },
    });
    if (!account) throw new NotFoundException('Supplier not found');
    return account;
  }

  async getSupplierPOs(supplierIdOrName: string, userId: number, excludeInvoiceId?: number) {
    if (!supplierIdOrName) return [];
    
    let accountName = String(supplierIdOrName).trim();
    
    if (/^\d+$/.test(accountName)) {
      const account = await this.prisma.accountMaster.findUnique({
        where: { id: parseInt(accountName, 10) },
      });
      if (account) {
        accountName = account.accountName;
      }
    }

    const pos = await this.prisma.purchaseOrder.findMany({
      where: {
        userId,
        supplierName: { equals: accountName, mode: 'insensitive' },
        status: { not: 'DELETED' },
      },
      include: {
        items: true,
        purchaseInvoices: {
          where: { 
            status: { not: 'DELETED' },
            ...(excludeInvoiceId ? { id: { not: excludeInvoiceId } } : {})
          },
          include: { items: true }
        },
        grn: {
          where: { status: { not: 'DELETED' } },
          include: { items: true }
        }
      },
      orderBy: { poNumber: 'desc' },
    });

    const filteredPos = pos.filter(po => {
      const totalPoQty = po.items.reduce((sum, item) => sum + item.quantity, 0);
      
      const totalInvoicedQty = po.purchaseInvoices.reduce((sum, inv) => {
        return sum + inv.items.reduce((iSum, i) => iSum + i.quantity, 0);
      }, 0);

      const totalReceivedQty = po.grn.reduce((sum, grn) => {
        return sum + grn.items.reduce((iSum, i) => iSum + i.receivedQty, 0);
      }, 0);

      if (!excludeInvoiceId && po.status === 'INVOICE_COMPLETED') {
        return false;
      }
      return (totalPoQty - totalInvoicedQty) > 0.01;
    });

    return filteredPos.map(po => ({
      id: po.id,
      poNumber: po.poNumber,
      poCreationDate: po.poCreationDate,
      totalAmount: po.totalAmount,
    }));
  }

  async generateInvoiceNumber(userId: number): Promise<string> {
    const invoices = await this.prisma.purchaseInvoice.findMany({
      where: { userId, invoiceNumber: { startsWith: 'INV-' } },
      select: { invoiceNumber: true },
    });

    let maxNumber = 0;
    for (const inv of invoices) {
      const match = inv.invoiceNumber.match(/(\d+)$/);
      if (match) {
        const num = parseInt(match[1], 10);
        if (!isNaN(num) && num > maxNumber) {
          maxNumber = num;
        }
      }
    }

    let nextNumber = maxNumber + 1;
    let candidate = `INV-${nextNumber.toString().padStart(4, '0')}`;

    while (await this.prisma.purchaseInvoice.findFirst({ where: { userId, invoiceNumber: candidate } })) {
      nextNumber++;
      candidate = `INV-${nextNumber.toString().padStart(4, '0')}`;
    }

    return candidate;
  }

  private async validateInvoiceDate(invoiceDate: Date, poIds: string[] | undefined, challanNumbers: string[] | undefined, userId: number) {
    const today = new Date();
    today.setHours(23, 59, 59, 999);

    let resolvedPoIds: string[] = [];
    if (poIds) {
      if (typeof poIds === 'string') {
        try {
          resolvedPoIds = JSON.parse(poIds);
        } catch {
          resolvedPoIds = [poIds];
        }
      } else if (Array.isArray(poIds)) {
        resolvedPoIds = poIds;
      }
    }
    resolvedPoIds = resolvedPoIds.map(n => String(n).trim()).filter(Boolean);

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
    
    const hasPO = resolvedPoIds.length > 0;
    const hasGRN = resolvedChallanNumbers.length > 0;

    if (hasPO && hasGRN) {
      // Condition 1B: Supplier Invoice Date Validation (GRN Exists)
      // Rule: Supplier Invoice Date allowed from: Last GRN Date for that Supplier → Till Today
      // Message: Supplier Invoice Date must be between Last GRN Date and Current Date.
      let lastGrnDate: Date | null = null;
      const grns = await this.prisma.grn.findMany({
        where: { id: { in: resolvedChallanNumbers.map(n => Number(n)).filter(n => !isNaN(n)) }, userId }
      });
      grns.forEach(g => {
        if (!lastGrnDate || g.grnDate > lastGrnDate) lastGrnDate = g.grnDate;
      });

      if (lastGrnDate) {
        const minOnlyDate = new Date(lastGrnDate);
        minOnlyDate.setHours(0, 0, 0, 0);
        const invOnlyDate = new Date(invoiceDate);
        invOnlyDate.setHours(0, 0, 0, 0);

        if (invOnlyDate < minOnlyDate || invoiceDate > today) {
          throw new BadRequestException('Supplier Invoice Date must be between Last GRN Date and Current Date.');
        }
      } else if (invoiceDate > today) {
        throw new BadRequestException('Supplier Invoice Date must be between Last GRN Date and Current Date.');
      }
    } else if (hasPO && !hasGRN) {
      // Condition 1C: Direct Invoice Against PO (Without GRN)
      // Rule: Supplier Invoice Date allowed from: PO Date → Till Today
      // Message: Supplier Invoice Date must be between PO Date and Current Date.
      let poDate: Date | null = null;
      const pos = await this.prisma.purchaseOrder.findMany({
        where: {
          userId,
          OR: [
            { poNumber: { in: resolvedPoIds } },
            { id: { in: resolvedPoIds.map(id => Number(id)).filter(id => !isNaN(id)) } }
          ]
        }
      });
      pos.forEach(p => {
        if (!poDate || p.poCreationDate > poDate) poDate = p.poCreationDate;
      });

      if (poDate) {
        const minOnlyDate = new Date(poDate);
        minOnlyDate.setHours(0, 0, 0, 0);
        const invOnlyDate = new Date(invoiceDate);
        invOnlyDate.setHours(0, 0, 0, 0);

        if (invOnlyDate < minOnlyDate || invoiceDate > today) {
          throw new BadRequestException('Supplier Invoice Date must be between PO Date and Current Date.');
        }
      } else if (invoiceDate > today) {
        throw new BadRequestException('Supplier Invoice Date must be between PO Date and Current Date.');
      }
    } else if (!hasPO && hasGRN) {
      // Condition 2B: Supplier Invoice Date Validation
      // Rule: Supplier Invoice Date allowed from: GRN Date → Till Today
      // Message: Supplier Invoice Date must be between GRN Date and Current Date.
      let grnDate: Date | null = null;
      const grns = await this.prisma.grn.findMany({
        where: { id: { in: resolvedChallanNumbers.map(n => Number(n)).filter(n => !isNaN(n)) }, userId }
      });
      grns.forEach(g => {
        if (!grnDate || g.grnDate > grnDate) grnDate = g.grnDate;
      });

      if (grnDate) {
        const minOnlyDate = new Date(grnDate);
        minOnlyDate.setHours(0, 0, 0, 0);
        const invOnlyDate = new Date(invoiceDate);
        invOnlyDate.setHours(0, 0, 0, 0);

        if (invOnlyDate < minOnlyDate || invoiceDate > today) {
          throw new BadRequestException('Supplier Invoice Date must be between GRN Date and Current Date.');
        }
      } else if (invoiceDate > today) {
        throw new BadRequestException('Supplier Invoice Date must be between GRN Date and Current Date.');
      }
    } else {
      // Condition 3: Direct Purchase Invoice Without PO and Without GRN
      // Rule: Supplier Invoice Date allowed from: Financial Year Start Date → Till Today
      // Message: Supplier Invoice Date must be within current financial year.
      const now = new Date();
      const fyStart = new Date(now.getMonth() < 3 ? now.getFullYear() - 1 : now.getFullYear(), 3, 1);
      fyStart.setHours(0, 0, 0, 0);

      const minOnlyDate = new Date(fyStart);
      minOnlyDate.setHours(0, 0, 0, 0);
      const invOnlyDate = new Date(invoiceDate);
      invOnlyDate.setHours(0, 0, 0, 0);

      if (invOnlyDate < minOnlyDate || invoiceDate > today) {
        throw new BadRequestException('Supplier Invoice Date must be within current financial year.');
      }
    }
  }

  async create(createDto: CreatePurchaseInvoiceDto, userId: number, uploadedFilePath?: string) {
    let invoiceNumber = createDto.invoiceNumber;
    if (!invoiceNumber || await this.prisma.purchaseInvoice.findFirst({ where: { userId, invoiceNumber } })) {
      invoiceNumber = await this.generateInvoiceNumber(userId);
    }

    const bookingDate = new Date(); // Enforced (Condition 1, 2, 3)
    const invoiceDate = new Date(createDto.invoiceDate || new Date());
    await this.validateInvoiceDate(invoiceDate, createDto.poIds, createDto.challanNumbers, userId);

    // Supplier Logic
    const supplier = await this.prisma.accountMaster.findFirst({
      where: { id: parseInt(createDto.supplierId, 10), userId },
    });

    if (!supplier) throw new BadRequestException('Supplier not found');

    if (supplier.status !== 'ACTIVE' || supplier.supplierStatus !== 'ACTIVE') {
      throw new BadRequestException('Supplier is inactive. New purchase transactions are not allowed.');
    }

    // As per requirement: Check if supplier is valid for purchase
    // Defaulting to groupName including 'SUNDRY_CREDITORS' if type isn't natively available
    if (!supplier.groupName.includes('SUNDRY_CREDITORS') && !supplier.supplierCode) {
      throw new BadRequestException('Invalid supplier');
    }

    // Auto-fill from supplier
    const address = supplier.addressLine1 || createDto.address;
    const creditDays = (createDto.creditDays !== undefined && createDto.creditDays !== null) ? createDto.creditDays : (supplier.supplierCreditDays || 0);

    const isSupplierMsmeActive = supplier.msmeEnabled;
    const isSupplierMsmeType = supplier.regType === 'Manufacturing' || supplier.regType === 'Service';
    const hasSupplierMsmeId = supplier.msmeId && supplier.msmeId.trim() !== '' && supplier.msmeId.trim().toUpperCase() !== 'N/A';
    const isSupplierMsme = Boolean(isSupplierMsmeActive && isSupplierMsmeType && hasSupplierMsmeId);

    if (isSupplierMsme && creditDays > 45) {
      throw new BadRequestException('MSME supplier payment terms cannot exceed 45 days as per MSME compliance rules.');
    }

    const gstNo = supplier.gstNo || createDto.gstNumber;

    const company = await this.prisma.shopDetail.findUnique({
      where: { userId },
    });

    if (!company) throw new BadRequestException('Company detail not found for this user');

    // Fetch user's registered GST early for tax logic
    const userGstDoc = await this.prisma.sellerDocument.findFirst({
        where: { uploadedByUserId: userId, type: 'GST', url: 'N/A' },
        select: { name: true }
    });
    const userGst = userGstDoc?.name;
    // Purchase rule: applicable only if supplier has a valid GST
    const isGstApplicable = isValidGst(gstNo);

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
        const taxAmt = isGstApplicable ? (befTax * taxPct) / 100 : 0;
        const discPct = (qty * rate) > 0 ? (discAmt / (qty * rate)) * 100 : 0;
        
        totalTaxable += befTax;
        materialTax += taxAmt;

        const productId = i.productId ? parseInt(i.productId, 10) : null;
        let hsnCode = i.hsnCode || '';
        
        // Fetch HSN from product if missing
        if (!hsnCode && productId) {
            const product = await this.prisma.product.findFirst({
                where: { id: productId, created_by: userId },
                select: { hsn_code: true }
            });
            hsnCode = product?.hsn_code || '';
        }

        itemsToCreate.push({
            productId: productId,
            productCode: i.productCode,
            productName: i.productName,
            quantity: qty,
            rate: rate,
            uom: i.uom,
            discountPercent: discPct,
            discountAmount: discAmt,
            taxPercent: taxPct,
            taxAmount: taxAmt,
            amount: befTax + taxAmt,
            beforeTaxAmount: befTax,
            totalPoQty: i.totalPoQty || 0,
            hsnCode: hsnCode
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

    const companyState = (company.state || "").trim();
    const supplierState = (supplier.state || "").trim();

    // MODULE 3: GST DETERMINATION LOGIC (centralized)
    // Purchase rule: GST only if Supplier has a valid GST number
    const supplierGstForTax = isValidGst(gstNo) ? gstNo : null;
    const gstResult = determinePurchaseGst(
      supplierGstForTax,
      userGst,
      companyState,
      supplierState,
      totalTaxable,   // the total taxable amount
      0,              // percent not needed as we pass preCalculated
      finalTax,       // the total tax amount to be split into CGST/SGST or IGST
    );

    const isRcm = false;
    const cgst = gstResult.cgstAmount;
    const sgst = gstResult.sgstAmount;
    const igst = gstResult.igstAmount;

    // RCM: Buyer pays tax separately. Supplier invoice doesn't include it in payable total.
    const taxInTotal = isRcm ? 0 : gstResult.totalGstAmount;
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

    let finalPoIds = Array.isArray(createDto.poIds) ? [...createDto.poIds] : [];
    let autoPoId: number | null = null;
    let resolvedPoNumberStr: string | null = null;
    let resolvedPoId: number | null = null;

    if (finalPoIds.length === 0 && createDto.challanNumbers && createDto.challanNumbers.length > 0) {
        // Retrieve PO from the GRN
        const firstGrn = await this.prisma.grn.findUnique({
             where: { id: Number(createDto.challanNumbers[0]) }
        });
        if (firstGrn && firstGrn.poId) {
             finalPoIds = [firstGrn.poId.toString()];
        }
    }

    if (finalPoIds.length === 0) {
        // Do not auto-create PO when no PO is provided
    } else if (finalPoIds.length === 1) {
        const poVal = finalPoIds[0];
        if (!isNaN(Number(poVal))) {
            resolvedPoId = Number(poVal);
            const po = await this.prisma.purchaseOrder.findUnique({ where: { id: resolvedPoId } });
            if (po) {
                resolvedPoNumberStr = po.poNumber;
            }
        } else {
            resolvedPoNumberStr = poVal;
            const po = await this.prisma.purchaseOrder.findFirst({ where: { poNumber: poVal, userId } });
            if (po) {
                resolvedPoId = po.id;
            }
        }
    } else if (finalPoIds.length > 1) {
        // If multiple POs, we just stringify the IDs for poNumber for now (fallback)
        resolvedPoNumberStr = finalPoIds.join(',');
    }

    const challanNumbers = createDto.challanNumbers || [];
    const grnNumberStr = challanNumbers.length > 0 ? challanNumbers.join(',') : null;

    const invoice = await this.prisma.$transaction(async (tx) => {
      const inv = await tx.purchaseInvoice.create({
        data: {
          invoiceNumber: invoiceNumber,
          bookingDate: createDto.bookingDate ? new Date(createDto.bookingDate) : new Date(),
          invoiceDate: createDto.invoiceDate ? new Date(createDto.invoiceDate) : new Date(),
          supplierInvoiceNumber: createDto.supplierInvoiceNumber,
          supplierInvoiceDate: createDto.invoiceDate ? new Date(createDto.invoiceDate) : new Date(),
          supplierId: supplier.id,
          supplierName: supplier.accountName,
          address: createDto.address,
          creditDays: creditDays,
          gstNumber: createDto.gstNumber,
          poNumber: resolvedPoNumberStr,
          poId: resolvedPoId,
          challanNumber: grnNumberStr,
          cgstAmount: cgst,
          sgstAmount: sgst,
          igstAmount: igst,
          isRcm: isRcm,
          isInterState: gstResult.gstType === 'IGST',
          gstType: gstResult.gstType as any,
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

      // INTEGRATION: Record the transaction in the ledger
      await this.syncLedgerTransactions(inv, userId, tx);

      await this.updateCompletionStatusesAfterInvoice(inv.id, tx);
      return inv;
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

    const page = Math.max(1, Number(query?.page) || 1);
    const limit = Math.max(1, Number(query?.limit) || 10);
    const skip = (page - 1) * limit;

    const [data, total, allMatching] = await Promise.all([
      this.prisma.purchaseInvoice.findMany({
        where,
        include: { items: true, expenses: true },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.purchaseInvoice.count({ where }),
      this.prisma.purchaseInvoice.findMany({
        where,
        select: {
          taxableAmount: true,
          grandTotal: true,
          items: { select: { beforeTaxAmount: true, taxAmount: true } }
        }
      })
    ]);

    let grandTaxable = 0;
    let grandTax = 0;
    let grandTotalSum = 0;
    for (const inv of allMatching) {
      const taxable = Number(inv.taxableAmount || (inv.items?.reduce((sum, i) => sum + Number(i.beforeTaxAmount || 0), 0) || 0));
      const gross = Number(inv.grandTotal || 0);
      const tax = gross - taxable;
      grandTaxable += taxable;
      grandTax += tax;
      grandTotalSum += gross;
    }

    return {
      data,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
        grandTaxable,
        grandTax,
        grandTotal: grandTotalSum
      }
    };
  }
 
  async findOne(id: number, userId: number) {
    const invoice = await this.prisma.purchaseInvoice.findFirst({
      where: { id, userId },
      include: { items: true, expenses: true },
    });
 
    if (!invoice) throw new NotFoundException(`Invoice ID ${id} not found or access denied`);
    return invoice;
  }
 
  async update(id: number, updateDto: UpdatePurchaseInvoiceDto, userId: number, uploadedFilePath?: string) {
    const existing = await this.findOne(id, userId);

    if (!existing) throw new NotFoundException(`Invoice ID ${id} not found`);

    const company = await this.prisma.shopDetail.findUnique({
      where: { userId: existing.userId },
    });

    if (!company) throw new BadRequestException('Company detail not found');

    let resolvedPoIds: string[] = [];
    if (updateDto.poIds !== undefined) {
      if (typeof updateDto.poIds === 'string') {
        try {
          resolvedPoIds = JSON.parse(updateDto.poIds);
        } catch {
          resolvedPoIds = [updateDto.poIds];
        }
      } else if (Array.isArray(updateDto.poIds)) {
        resolvedPoIds = updateDto.poIds;
      }
    } else if (existing.poId) {
      resolvedPoIds = [existing.poId.toString()];
    }
    resolvedPoIds = resolvedPoIds.map(n => String(n).trim()).filter(Boolean);

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

    const mergedPoIds = resolvedPoIds;
    const mergedChallanNumbers = resolvedChallanNumbers;
    const mergedInvoiceDate = updateDto.invoiceDate ? new Date(updateDto.invoiceDate) : existing.supplierInvoiceDate;

    await this.validateInvoiceDate(mergedInvoiceDate, mergedPoIds, mergedChallanNumbers, userId);

    const gstNo = updateDto.gstNumber || existing.gstNumber;

    // Fetch user's registered GST early
    const userGstDoc = await this.prisma.sellerDocument.findFirst({
        where: { uploadedByUserId: existing.userId, type: 'GST', url: 'N/A' },
        select: { name: true }
    });
    const userGst = userGstDoc?.name;
    // Purchase rule: applicable only if supplier has a valid GST
    const isGstApplicable = isValidGst(gstNo);

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
            const discPct = (qty * rate) > 0 ? (discAmt / (qty * rate)) * 100 : 0;
            const taxAmt = isGstApplicable ? (befTax * taxPct) / 100 : 0;
            
            totalTaxable += befTax;
            materialTax += taxAmt;

            itemsToCreate.push({
                productId: i.productId ? parseInt(i.productId, 10) : null,
                productCode: i.productCode,
                productName: i.productName,
                quantity: qty,
                rate: rate,
                uom: i.uom,
                discountPercent: discPct,
                discountAmount: discAmt,
                taxPercent: taxPct,
                taxAmount: taxAmt,
                amount: befTax + taxAmt,
                beforeTaxAmount: befTax,
                totalPoQty: i.totalPoQty || 0,
                hsnCode: i.hsnCode || ''
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

    const companyState = (company.state || "").trim();

    // Fetch supplier info for state comparison
    const supplierInfo = await this.prisma.accountMaster.findFirst({
      where: { id: existing.supplierId, userId: existing.userId }
    });
    if (supplierInfo) {
      const isSupplierMsmeActive = supplierInfo.msmeEnabled;
      const isSupplierMsmeType = supplierInfo.regType === 'Manufacturing' || supplierInfo.regType === 'Service';
      const hasSupplierMsmeId = supplierInfo.msmeId && supplierInfo.msmeId.trim() !== '' && supplierInfo.msmeId.trim().toUpperCase() !== 'N/A';
      const isSupplierMsme = Boolean(isSupplierMsmeActive && isSupplierMsmeType && hasSupplierMsmeId);

      const creditDays = updateDto.creditDays !== undefined ? updateDto.creditDays : existing.creditDays;
      if (isSupplierMsme && creditDays > 45) {
        throw new BadRequestException('MSME supplier payment terms cannot exceed 45 days as per MSME compliance rules.');
      }
    }
    const supplierState = (supplierInfo?.state || "").trim();

    let isRcm = false;

    // MODULE 3: GST DETERMINATION LOGIC (centralized)
    // Purchase rule: GST only if Supplier has a valid GST number
    const supplierGstForTax = isValidGst(gstNo) ? gstNo : null;
    const gstResult = determinePurchaseGst(
      supplierGstForTax,
      userGst,
      companyState,
      supplierState,
      finalTax,
    );

    let cgst = gstResult.cgstAmount;
    let sgst = gstResult.sgstAmount;
    let igst = gstResult.igstAmount;

    const taxInTotal = isRcm ? 0 : gstResult.totalGstAmount;
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

        let resolvedPoId = existing.poId;
        let resolvedPoNumberStr = existing.poNumber;

        if (updateDto.poIds && resolvedPoIds.length > 0) {
            if (resolvedPoIds.length === 1) {
                const poVal = resolvedPoIds[0];
                if (!isNaN(Number(poVal))) {
                    resolvedPoId = Number(poVal);
                    const po = await tx.purchaseOrder.findUnique({ where: { id: resolvedPoId } });
                    if (po) {
                        resolvedPoNumberStr = po.poNumber;
                    }
                } else {
                    resolvedPoNumberStr = poVal;
                    const po = await tx.purchaseOrder.findFirst({ where: { poNumber: poVal, userId } });
                    if (po) {
                        resolvedPoId = po.id;
                    }
                }
            } else {
                resolvedPoNumberStr = resolvedPoIds.join(',');
                resolvedPoId = null;
            }
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
            poNumber: updateDto.poIds ? (resolvedPoIds.length > 0 ? resolvedPoNumberStr : null) : existing.poNumber,
            poId: updateDto.poIds ? resolvedPoId : existing.poId,
            challanNumber: updateDto.challanNumbers ? (resolvedChallanNumbers.length > 0 ? resolvedChallanNumbers.join(',') : null) : existing.challanNumber,
            creditDays: updateDto.creditDays ?? existing.creditDays,
            status: (updateDto.status as any) ?? existing.status,
            uploadedFilePath: (updateDto as any).removeAttachment === 'true' ? null : (uploadedFilePath || existing.uploadedFilePath),
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

        await this.updateCompletionStatusesAfterInvoice(id, tx);
        
        // Synchronize with Ledger
        await this.syncLedgerTransactions(updated, userId, tx);
        
        // If the poId was changed (though not explicitly handled in updateDto yet), 
        // we might need to update the old PO too. 
        // But the current update logic doesn't seem to support changing poId easily.

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
    const buffer = await generatePISampleExcel();
    return {
      buffer,
      filename: 'purchase_invoice_sample.xlsx',
      mimetype: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    };
  }

  async exportPurchaseInvoices(userId: number, format: string, query: { search?: string }) {
    const invoices = await this.prisma.purchaseInvoice.findMany({
      where: {
        userId,
        ...(query.search ? {
          OR: [
            { invoiceNumber: { contains: query.search, mode: 'insensitive' } },
            { supplierName: { contains: query.search, mode: 'insensitive' } },
            { supplierInvoiceNumber: { contains: query.search, mode: 'insensitive' } },
          ]
        } : {})
      },
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
      worksheet.views = [{ state: 'frozen', ySplit: 5 }];
      worksheet.columns = [
        { header: 'SR NO', key: 'srNo', width: 8 },
        { header: 'SUPPLIER INVOICE NUMBER', key: 'supplierInvoiceNumber', width: 25 },
        { header: 'SUPPLIER NAME', key: 'supplierName', width: 28 },
        { header: 'SUPPLIER INVOICE DATE', key: 'supplierInvoiceDate', width: 22 },
        { header: 'BOOKING DATE', key: 'bookingDate', width: 16 },
        { header: 'PO NO', key: 'poNumber', width: 16 },
        { header: 'GST NUMBER', key: 'gstNumber', width: 18 },
        { header: 'CREDIT DAYS', key: 'creditDays', width: 14 },
        { header: 'TAXABLE AMOUNT', key: 'taxableAmount', width: 18 },
        { header: 'TAX AMOUNT', key: 'taxAmt', width: 16 },
        { header: 'TOTAL AMOUNT', key: 'grandTotal', width: 18 },
        { header: 'STATUS', key: 'status', width: 14 },
      ];

      invoices.forEach((inv, idx) => {
        const totalTax = (Number(inv.cgstAmount || 0) + Number(inv.sgstAmount || 0) + Number(inv.igstAmount || 0));
        worksheet.addRow({
          srNo: idx + 1,
          supplierInvoiceNumber: inv.supplierInvoiceNumber || inv.invoiceNumber || '-',
          supplierName: inv.supplierName || '-',
          supplierInvoiceDate: formatDate(inv.supplierInvoiceDate),
          bookingDate: formatDate(inv.bookingDate),
          poNumber: inv.poNumber || '-',
          gstNumber: inv.gstNumber || '-',
          creditDays: inv.creditDays || 0,
          taxableAmount: inv.taxableAmount,
          taxAmt: totalTax,
          grandTotal: inv.grandTotal,
          status: inv.status,
        });
      });

      worksheet.spliceRows(1, 0, [], [], [], []);
      worksheet.mergeCells('A1:L1');
      const titleCell = worksheet.getCell('A1');
      titleCell.value = 'ERP';
      titleCell.font = { size: 18, bold: true };
      titleCell.alignment = { horizontal: 'center', vertical: 'middle' };

      worksheet.mergeCells('A2:L2');
      const subtitleCell = worksheet.getCell('A2');
      subtitleCell.value = 'Purchase Invoice Report';
      subtitleCell.font = { size: 14 };
      subtitleCell.alignment = { horizontal: 'center', vertical: 'middle' };

      worksheet.mergeCells('A3:L3');
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
        const doc = new PDFDocument({ margin: 15, size: 'A4', layout: 'landscape' });
        const buffers: Buffer[] = [];
        doc.on('data', buffers.push.bind(buffers));
        doc.on('end', () => resolve({ buffer: Buffer.concat(buffers), filename: `purchase_invoices_${Date.now()}.pdf`, mimetype: 'application/pdf' }));

        doc.fontSize(16).font('Helvetica-Bold').text('ERP', { align: 'center' });
        doc.fontSize(12).font('Helvetica').text('Purchase Invoice Report', { align: 'center' });
        doc.moveDown(0.3);
        doc.fontSize(9).text(`Exported on: ${timestamp}`, { align: 'right' });
        doc.moveDown(0.5);

        const tableTop = 85;
        const colX = [15, 45, 120, 205, 275, 335, 395, 460, 505, 565, 625, 690];
        const headers = ['SR', 'Supp Inv No', 'Supplier Name', 'Inv Date', 'Book Date', 'PO No', 'GST No', 'Credit', 'Taxable', 'Tax', 'Total', 'Status'];

        doc.rect(10, tableTop - 5, 820, 20).fill('#4472C4');
        doc.fontSize(7).font('Helvetica-Bold').fillColor('#FFFFFF');
        headers.forEach((h, i) => doc.text(h, colX[i], tableTop));

        let y = tableTop + 20;
        doc.fillColor('#000000').font('Helvetica');

        invoices.forEach((inv, index) => {
          if (y > 540) {
            doc.addPage({ margin: 15, size: 'A4', layout: 'landscape' });
            y = 35;
            doc.rect(10, y - 5, 820, 20).fill('#4472C4');
            doc.fontSize(7).font('Helvetica-Bold').fillColor('#FFFFFF');
            headers.forEach((h, i) => doc.text(h, colX[i], y));
            y += 20;
            doc.fillColor('#000000').font('Helvetica');
          }

          if (index % 2 === 1) {
            doc.rect(10, y - 3, 820, 15).fill('#F2F2F2').fillColor('#000000');
          }

          const totalTax = (Number(inv.cgstAmount || 0) + Number(inv.sgstAmount || 0) + Number(inv.igstAmount || 0));

          doc.fontSize(6);
          doc.text(String(index + 1), colX[0], y);
          doc.text((inv.supplierInvoiceNumber || inv.invoiceNumber || '-').substring(0, 14), colX[1], y, { width: 70 });
          doc.text((inv.supplierName || '-').substring(0, 18), colX[2], y, { width: 80 });
          doc.text(formatDate(inv.supplierInvoiceDate), colX[3], y);
          doc.text(formatDate(inv.bookingDate), colX[4], y);
          doc.text((inv.poNumber || '-').substring(0, 10), colX[5], y);
          doc.text((inv.gstNumber || '-').substring(0, 12), colX[6], y);
          doc.text(String(inv.creditDays || 0), colX[7], y);
          doc.text(Number(inv.taxableAmount || 0).toFixed(2), colX[8], y);
          doc.text(totalTax.toFixed(2), colX[9], y);
          doc.text(Number(inv.grandTotal || 0).toFixed(2), colX[10], y);
          doc.text(inv.status || 'GENERATED', colX[11], y);
          y += 18;
        });

        doc.end();
      });
    }
  }

  async importPurchaseInvoices(fileBuffer: Buffer, userId: number) {
    if (!fileBuffer || fileBuffer.length === 0) {
      throw new BadRequestException('Empty or invalid file uploaded');
    }

    const workbook = new ExcelJS.Workbook();
    try {
      await workbook.xlsx.load(fileBuffer as any);
    } catch (error) {
      throw new BadRequestException('Invalid Excel file format. Please upload a valid .xlsx file.');
    }
    const worksheet = workbook.worksheets[0];
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
        if (val.includes('invoice no') || val.includes('invoice number') || val.includes('supplier invoice no')) { colMap['invoiceNo'] = colNumber; found = true; }
        if (val.includes('invoice date')) colMap['invoiceDate'] = colNumber;
        if (val.includes('booking date')) colMap['bookingDate'] = colNumber;
        if (val.includes('supplier name') || val.includes('supplier')) colMap['supplierName'] = colNumber;
        if (val.includes('po number') || val.includes('po no')) colMap['poNumber'] = colNumber;
        if (val.includes('grn number') || val.includes('grn no') || val.includes('challan number')) colMap['grnNumber'] = colNumber;
        if (val.includes('product name') || val.includes('product')) colMap['productName'] = colNumber;
        if (val.includes('product code')) colMap['productCode'] = colNumber;
        if (val.includes('quantity') || val.includes('qty')) colMap['quantity'] = colNumber;
        if (val.includes('rate') || val.includes('price')) colMap['rate'] = colNumber;
        if (val.includes('discount (₹)') || val.includes('discount amount') || val.includes('discount rs')) colMap['discountAmount'] = colNumber;
        if (val.includes('discount (%)') || val.includes('discount percent')) colMap['discountPercent'] = colNumber;
      });
      if (found) {
        headerRowIndex = r;
        break;
      }
    }

    // Scan first 10 rows to detect if user uploaded a PO file or wrong template
    let isPoFile = false;

    for (let r = 1; r <= Math.min(rowCount, 10); r++) {
      const row = worksheet.getRow(r);
      row.eachCell((cell) => {
        const val = String(cell.value || '').trim().toLowerCase();
        if (
          val.includes('po number') || val.includes('po no') || val.includes('po date') || val.includes('expiry date') || (val.includes('po no') && !val.includes('invoice'))
        ) {
          isPoFile = true;
        }
      });
    }

    if (!colMap['invoiceNo']) {
      throw new BadRequestException('Invalid template format');
    }

    const mandatoryCols = ['invoiceNo', 'supplierName', 'productName', 'quantity', 'rate'];
    const missing = mandatoryCols.filter(col => !colMap[col]);
    if (headerRowIndex === -1 || missing.length > 0) {
      throw new BadRequestException('Invalid template format');
    }

    const getVal = (row: ExcelJS.Row, key: string, defaultVal: any = '') => {
      const colIdx = colMap[key];
      if (!colIdx) return defaultVal;
      const cell = row.getCell(colIdx);
      let val = cell.value;
      if (val && typeof val === 'object' && 'result' in val) {
        val = (val as any).result;
      }
      if (val && (val instanceof Date || Object.prototype.toString.call(val) === '[object Date]' || typeof (val as any).getTime === 'function')) {
        return val;
      }
      return String(val !== undefined && val !== null ? val : '').trim();
    };

    // Preload Lookups
    const [{ supplierMap }, { productCodeMap, productNameMap }, existingInvoices, existingPos, existingGrns, userShop, userGstDoc] = await Promise.all([
      this.importValidator.fetchAccountMasterData(userId),
      this.importValidator.fetchProductMasterData(userId),
      this.prisma.purchaseInvoice.findMany({
        where: { userId, status: { not: 'DELETED' } },
        select: { invoiceNumber: true, supplierInvoiceNumber: true },
      }),
      this.prisma.purchaseOrder.findMany({
        where: { userId, status: { not: 'DELETED' } },
        include: { items: true, purchaseInvoices: { where: { status: { not: 'DELETED' } }, include: { items: true } } },
      }),
      this.prisma.grn.findMany({
        where: { userId, status: { not: 'DELETED' } },
        include: { items: true },
      }),
      this.prisma.shopDetail.findUnique({ where: { userId } }),
      this.prisma.sellerDocument.findFirst({
        where: { uploadedByUserId: userId, type: 'GST' },
        orderBy: { createdAt: 'desc' },
        select: { name: true },
      }),
    ]);

    const dbInvoiceNumbers = new Set(
      existingInvoices.flatMap(i => [i.invoiceNumber.toLowerCase().trim(), i.supplierInvoiceNumber.toLowerCase().trim()])
    );
    const importedInvoiceNumbersInFile = new Set<string>();

    const poMap = new Map<string, any>();
    for (const po of existingPos) poMap.set(po.poNumber.toLowerCase().trim(), po);

    const grnMap = new Map<string, any>();
    for (const grn of existingGrns) grnMap.set(grn.challanNumber.toLowerCase().trim(), grn);

    const allPIs = await this.prisma.purchaseInvoice.findMany({
      where: { userId, status: { not: 'DELETED' } },
      include: { items: true },
    });

    const groupMap = new Map<string, any[]>();

    for (let r = headerRowIndex + 1; r <= rowCount; r++) {
      const row = worksheet.getRow(r);
      const invoiceNo = getVal(row, 'invoiceNo');
      if (!invoiceNo || invoiceNo === '-') continue;

      const item = {
        rowNum: r,
        originalRowValues: row.values,
        invoiceNo,
        invoiceDateStr: getVal(row, 'invoiceDate'),
        bookingDateStr: getVal(row, 'bookingDate'),
        supplierName: getVal(row, 'supplierName'),
        poNumber: getVal(row, 'poNumber'),
        grnNumber: getVal(row, 'grnNumber'),
        productName: getVal(row, 'productName'),
        productCode: getVal(row, 'productCode'),
        quantityStr: getVal(row, 'quantity'),
        rateStr: getVal(row, 'rate'),
        discountAmountStr: getVal(row, 'discountAmount'),
        discountPercentStr: getVal(row, 'discountPercent'),
      };

      if (!groupMap.has(invoiceNo)) {
        groupMap.set(invoiceNo, []);
      }
      groupMap.get(invoiceNo)!.push(item);
    }

    if (groupMap.size === 0) {
      throw new BadRequestException('Invalid template format');
    }

    const successRows: any[] = [];
    const failedRows: { rowNum: number; values: any[]; error: string }[] = [];

    const userGst = userGstDoc?.name;
    const companyState = (userShop?.state || '').trim().toLowerCase();
    const isGstApplicable = isValidGst(userGst);

    for (const [invoiceNo, rows] of groupMap.entries()) {
      const groupErrors: string[] = [];
      const firstRow = rows[0];

      const dateConsistencyErrors = this.importValidator.validateGroupDateConsistency(
        rows,
        'Purchase Invoice',
        invoiceNo,
        [
          { key: 'invoiceDateStr', label: 'Invoice Date' },
          { key: 'bookingDateStr', label: 'Booking Date' },
        ]
      );
      groupErrors.push(...dateConsistencyErrors);

      // 1. Invoice Number uniqueness check
      const docNoValidation = this.importValidator.validateDocumentNumber(
        'Purchase Invoice',
        invoiceNo,
        dbInvoiceNumbers,
        importedInvoiceNumbersInFile,
        firstRow.rowNum
      );
      if (!docNoValidation.valid) {
        groupErrors.push(docNoValidation.error);
      }

      // 2. Supplier validation & auto-fetching
      const suppValidation = this.importValidator.validateSupplier(firstRow.supplierName, supplierMap, 'PI');
      let supplierData: any = null;
      if (!suppValidation.valid) {
        groupErrors.push(suppValidation.error);
      } else {
        supplierData = suppValidation.data;
      }

      // 3. Date validation
      let parsedInvoiceDate: Date = new Date();
      if (firstRow.invoiceDateStr) {
        const invDateVal = this.importValidator.validateImportDate(firstRow.invoiceDateStr, 'Invoice Date');
        if (!invDateVal.valid) {
          groupErrors.push(invDateVal.error);
        } else {
          parsedInvoiceDate = invDateVal.date;
        }
      }

      let parsedBookingDate: Date = new Date();
      if (firstRow.bookingDateStr) {
        const bookDateVal = this.importValidator.validateImportDate(firstRow.bookingDateStr, 'Booking Date');
        if (!bookDateVal.valid) {
          groupErrors.push(bookDateVal.error);
        } else {
          parsedBookingDate = bookDateVal.date;
        }
      }

      // 4. Reference validation (PO Number and/or GRN Number)
      let referencedPo: any = null;
      if (firstRow.poNumber && firstRow.poNumber.trim()) {
        const rawPoNo = firstRow.poNumber.trim();
        referencedPo = poMap.get(rawPoNo.toLowerCase());
        if (!referencedPo) {
          groupErrors.push(`Purchase Order '${rawPoNo}' does not exist. Please provide a valid Purchase Order Number.`);
        } else if (supplierData && referencedPo.supplierName.toLowerCase().trim() !== supplierData.name.toLowerCase().trim()) {
          groupErrors.push(`Supplier '${supplierData.name}' does not match the supplier of Purchase Order '${rawPoNo}'.`);
        }
      }

      let referencedGrn: any = null;
      if (firstRow.grnNumber && firstRow.grnNumber.trim()) {
        const rawGrnNo = firstRow.grnNumber.trim();
        referencedGrn = grnMap.get(rawGrnNo.toLowerCase());
        if (!referencedGrn) {
          groupErrors.push(`Challan '${rawGrnNo}' does not exist. Please provide a valid Challan Number.`);
        } else if (supplierData && referencedGrn.supplierName.toLowerCase().trim() !== supplierData.name.toLowerCase().trim()) {
          groupErrors.push(`Supplier '${supplierData.name}' does not match the supplier of GRN '${rawGrnNo}'.`);
        }
      }

      // 5. Products validation & remaining quantity checks
      const processedItems: any[] = [];
      let totalAmount = 0;
      let totalTaxAmount = 0;
      let isInterState = false;

      for (const row of rows) {
        const prodVal = this.importValidator.validateProduct(
          row.productName,
          row.productCode,
          productCodeMap,
          productNameMap
        );

        if (!prodVal.valid) {
          groupErrors.push(`Row ${row.rowNum}: ${prodVal.error}`);
          continue;
        }

        const prod = prodVal.data;
        const qty = parseFloat(row.quantityStr);
        const rate = parseFloat(row.rateStr);

        if (isNaN(qty) || qty <= 0) groupErrors.push(`Row ${row.rowNum}: Quantity must be greater than 0.`);
        if (isNaN(rate) || rate < 0) groupErrors.push(`Row ${row.rowNum}: Rate must be 0 or positive.`);

        const discountAmt = parseFloat(row.discountAmountStr || '0');
        const discountPct = parseFloat(row.discountPercentStr || '0');
        if (isNaN(discountAmt) || discountAmt < 0) groupErrors.push(`Row ${row.rowNum}: Discount amount must be positive.`);
        if (isNaN(discountPct) || discountPct < 0 || discountPct > 100) groupErrors.push(`Row ${row.rowNum}: Discount percent must be between 0 and 100.`);

        // Quantity validation against PO
        if (referencedPo) {
          const poItem = referencedPo.items.find(
            (i: any) =>
              i.productCode.toLowerCase().trim() === prod.product_code.toLowerCase().trim() ||
              i.productName.toLowerCase().trim() === prod.product_name.toLowerCase().trim()
          );

          if (!poItem) {
            groupErrors.push(`Product '${prod.product_name}' is not part of Purchase Order '${referencedPo.poNumber}'.`);
          } else {
            if (Math.abs(Number(poItem.rate) - rate) > 0.001) {
              groupErrors.push(
                `Rate for product '${prod.product_name}' (${rate}) does not match the rate in Purchase Order '${referencedPo.poNumber}' (${poItem.rate}). Rate change is not allowed when linked to a PO.`
              );
            }
            const poItemDiscPct = Number(poItem.discountPercent || (poItem.quantity * poItem.rate > 0 ? (Number(poItem.discountAmount) / (poItem.quantity * poItem.rate)) * 100 : 0));
            const hasImpDisc = Boolean((row.discountPercentStr && row.discountPercentStr.trim() !== '') || (row.discountAmountStr && row.discountAmountStr.trim() !== ''));
            if (hasImpDisc && Math.abs(discountPct - poItemDiscPct) > 0.01) {
              groupErrors.push(
                `Discount for product '${prod.product_name}' (${discountPct}%) does not match the discount in Purchase Order '${referencedPo.poNumber}' (${poItemDiscPct.toFixed(2)}%). Discount change is not allowed when linked to a PO.`
              );
            }
            let alreadyInvoiced = 0;
            for (const prevPI of referencedPo.purchaseInvoices || []) {
              for (const prevItem of prevPI.items || []) {
                if (
                  prevItem.productCode.toLowerCase().trim() === prod.product_code.toLowerCase().trim() ||
                  prevItem.productName.toLowerCase().trim() === prod.product_name.toLowerCase().trim()
                ) {
                  alreadyInvoiced += Number(prevItem.quantity || 0);
                }
              }
            }
            const remainingPoQty = Math.max(0, poItem.quantity - alreadyInvoiced);
            if (qty > remainingPoQty) {
              groupErrors.push(
                `Purchase Invoice quantity for product '${prod.product_name}' exceeds the remaining PO quantity. Available quantity: ${remainingPoQty}, Imported quantity: ${qty}.`
              );
            }
          }
        }

        // Quantity validation against GRN/Challan
        if (referencedGrn) {
          const grnItem = referencedGrn.items.find(
            (i: any) =>
              i.productCode.toLowerCase().trim() === prod.product_code.toLowerCase().trim() ||
              i.productName.toLowerCase().trim() === prod.product_name.toLowerCase().trim()
          );

          if (!grnItem) {
            groupErrors.push(`Product '${prod.product_name}' is not part of GRN '${referencedGrn.challanNumber}'.`);
          } else {
            if (Math.abs(Number(grnItem.rate) - rate) > 0.001) {
              groupErrors.push(
                `Rate for product '${prod.product_name}' (${rate}) does not match the rate in GRN '${referencedGrn.challanNumber}' (${grnItem.rate}). Rate change is not allowed when linked to a GRN.`
              );
            }
            const grnItemDiscPct = Number(grnItem.discountPercent || (grnItem.receivedQty * grnItem.rate > 0 ? (Number(grnItem.discountAmount) / (grnItem.receivedQty * grnItem.rate)) * 100 : 0));
            const hasImpDisc = Boolean((row.discountPercentStr && row.discountPercentStr.trim() !== '') || (row.discountAmountStr && row.discountAmountStr.trim() !== ''));
            if (hasImpDisc && Math.abs(discountPct - grnItemDiscPct) > 0.01) {
              groupErrors.push(
                `Discount for product '${prod.product_name}' (${discountPct}%) does not match the discount in GRN '${referencedGrn.challanNumber}' (${grnItemDiscPct.toFixed(2)}%). Discount change is not allowed when linked to a GRN.`
              );
            }
            let alreadyInvoicedForGrn = 0;
            for (const prevPI of allPIs) {
              if (prevPI.challanNumber && prevPI.challanNumber.toLowerCase().includes(referencedGrn.challanNumber.toLowerCase())) {
                for (const prevItem of prevPI.items || []) {
                  if (
                    prevItem.productCode.toLowerCase().trim() === prod.product_code.toLowerCase().trim() ||
                    prevItem.productName.toLowerCase().trim() === prod.product_name.toLowerCase().trim()
                  ) {
                    alreadyInvoicedForGrn += Number(prevItem.quantity || 0);
                  }
                }
              }
            }
            const totalGrnQty = Number(grnItem.receivedQty || 0);
            const remainingGrnQty = Math.max(0, totalGrnQty - alreadyInvoicedForGrn);
            if (qty > remainingGrnQty) {
              groupErrors.push(
                `Purchase Invoice quantity for product '${prod.product_name}' exceeds the remaining Challan quantity. Available quantity: ${remainingGrnQty}, Imported quantity: ${qty}.`
              );
            }
          }
        }

        if (groupErrors.length > 0) continue;

        const baseTotal = qty * rate;
        let finalDiscPercent = discountPct;
        let finalDiscAmount = discountAmt;

        if (finalDiscAmount > 0 && finalDiscPercent === 0) {
          finalDiscPercent = baseTotal > 0 ? (finalDiscAmount / baseTotal) * 100 : 0;
        } else {
          finalDiscAmount = (baseTotal * finalDiscPercent) / 100;
        }

        const beforeTaxAmount = baseTotal - finalDiscAmount;
        const taxRate = Number(prod.tax_rate || 0);
        const supplierGst = supplierData?.gstNo;
        const supplierState = (supplierData?.state || '').trim().toLowerCase();

        isInterState = this.importValidator.determineIsInterState(
          userGst,
          companyState,
          supplierGst,
          supplierState
        );

        const taxAmount = isGstApplicable ? ((beforeTaxAmount * taxRate) / 100) : 0;
        const totalItemAmount = beforeTaxAmount + taxAmount;

        totalAmount += beforeTaxAmount;
        totalTaxAmount += taxAmount;

        processedItems.push({
          productId: prod.id,
          productCode: prod.product_code,
          productName: prod.product_name,
          hsnCode: prod.hsn_code || '',
          quantity: qty,
          rate,
          uom: prod.uom?.unit_name || 'Nos',
          discountPercent: finalDiscPercent,
          discountAmount: finalDiscAmount,
          taxPercent: taxRate,
          taxAmount,
          beforeTaxAmount,
          amount: beforeTaxAmount,
        });
      }

      if (groupErrors.length > 0) {
        const combinedErrorMsg = groupErrors.join(' | ');
        for (const row of rows) {
          failedRows.push({
            rowNum: row.rowNum,
            values: row.originalRowValues,
            error: combinedErrorMsg,
          });
        }
      } else {
        try {
          await this.prisma.$transaction(async (tx) => {
            const pi = await tx.purchaseInvoice.create({
              data: {
                invoiceNumber: invoiceNo,
                supplierInvoiceNumber: invoiceNo,
                supplierInvoiceDate: parsedInvoiceDate,
                invoiceDate: parsedInvoiceDate,
                bookingDate: parsedBookingDate,
                supplierName: supplierData.name,
                address: supplierData.address,
                creditDays: supplierData.creditDays,
                gstNumber: supplierData.gstNo,
                poNumber: referencedPo ? referencedPo.poNumber : (firstRow.poNumber || null),
                poId: referencedPo ? referencedPo.id : null,
                challanNumber: referencedGrn ? referencedGrn.challanNumber : (firstRow.grnNumber || null),
                supplierId: supplierData.id,
                taxableAmount: totalAmount,
                cgstAmount: isInterState ? 0 : totalTaxAmount / 2,
                sgstAmount: isInterState ? 0 : totalTaxAmount / 2,
                igstAmount: isInterState ? totalTaxAmount : 0,
                grandTotal: totalAmount + totalTaxAmount,
                userId,
                status: 'GENERATED',
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
                    amount: item.amount,
                  })),
                },
              },
            });
            await this.updateCompletionStatusesAfterInvoice(pi.id, tx);
          });

          importedInvoiceNumbersInFile.add(invoiceNo.toLowerCase());
          for (const row of rows) {
            successRows.push(row);
          }
        } catch (dbError: any) {
          const dbErrMsg = `Database Save Failed: ${dbError.message || dbError}`;
          for (const row of rows) {
            failedRows.push({
              rowNum: row.rowNum,
              values: row.originalRowValues,
              error: dbErrMsg,
            });
          }
        }
      }
    }

    const headers = [
      'Invoice No*', 'Invoice Date*', 'Booking Date*', 'Supplier Name*',
      'PO Number', 'GRN Number', 'Product Name*', 'Qty*', 'Rate*', 'Discount (₹)', 'Discount (%)'
    ];

    return this.importValidator.buildResponseSummary(headers, successRows, failedRows);
  }

  async printPurchaseInvoice(id: number, userId: number) {
    const inv = await this.prisma.purchaseInvoice.findFirst({
      where: { id, userId },
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
      doc.text(`Booking Date: ${formatDate(inv.bookingDate)}`, 300, y);
      y += 20;
      doc.text(`Supplier: ${inv.supplierName}`, 30, y);
      doc.text(`Inv Date: ${formatDate(inv.supplierInvoiceDate)}`, 300, y);
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
      const updated = await tx.purchaseInvoice.update({
        where: { id },
        data: { status: 'DELETED' }
      });

      // Synchronize with Ledger: Remove transaction on deletion
      await tx.transaction.deleteMany({
        where: {
          userId: updated.userId,
          invoiceNumber: updated.supplierInvoiceNumber || updated.invoiceNumber,
          transactionType: TransactionType.Purchase,
        }
      });

      // Update completion statuses of linked POs and GRNs
      await this.updateCompletionStatusesAfterInvoice(id, tx);

      return updated;
    });
  }

  private async syncLedgerTransactions(invoice: any, userId: number, tx: any) {
    const invNo = invoice.supplierInvoiceNumber || invoice.invoiceNumber;
    if (!invNo) return;

    // 1. Delete all existing transactions for this purchase invoice
    await tx.transaction.deleteMany({
      where: {
        userId,
        invoiceNumber: invNo,
        transactionType: TransactionType.Purchase,
      }
    });

    let suppId = invoice.supplierId;
    if (!suppId && invoice.supplierName) {
      const supp = await tx.accountMaster.findFirst({
        where: {
          userId,
          accountName: { equals: invoice.supplierName, mode: 'insensitive' },
        },
      });
      if (supp) suppId = supp.id;
    }

    // 2. Credit Supplier (if supplierId or matched supplier account exists)
    if (suppId) {
      await tx.transaction.create({
        data: {
          accountId: suppId,
          userId,
          bookingDate: new Date(invoice.bookingDate || invoice.invoiceDate || Date.now()),
          invoiceNumber: invNo,
          transactionType: TransactionType.Purchase,
          amount: invoice.grandTotal,
          entryType: BalanceType.Cr,
        }
      });
    }
  }
}
