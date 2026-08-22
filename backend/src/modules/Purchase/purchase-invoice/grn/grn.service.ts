import { Injectable, NotFoundException, BadRequestException, ForbiddenException, OnModuleInit } from '@nestjs/common';
import { isValidGst, determinePurchaseGst } from '../../../../common/utils/gst.helper';
import { PrismaService } from '../../../../infrastructure/prisma/prisma.service';
import { CreateGrnDto, UpdateGrnDto } from './dto/grn.dto';
import { PurchaseOrderService } from '../../purchase-order/purchase-order.service';
import * as ExcelJS from 'exceljs';
import * as PDFDocument from 'pdfkit';
import { formatDate } from '../../../../utils/dateFormatter';
import { generateGRNSampleExcel } from '../../../../common/utils/procurement-bulk-import.processor';

import { ImportValidationService } from '../../../../common/services/import-validation.service';

@Injectable()
export class GrnService implements OnModuleInit {
  constructor(
    private prisma: PrismaService,
    private poService: PurchaseOrderService,
    private importValidator: ImportValidationService
  ) { }

  async onModuleInit() {
    await this.backfillGrnNumbers();
  }

  private async backfillGrnNumbers(userId?: number) {
    try {
      const unnumberedGrns = await this.prisma.grn.findMany({
        where: {
          grnNumber: null,
          ...(userId ? { userId } : {})
        },
        orderBy: { id: 'asc' }
      });

      if (unnumberedGrns.length > 0) {
        // Group by userId if running globally
        const userMap = new Map<number, typeof unnumberedGrns>();
        unnumberedGrns.forEach(g => {
          const list = userMap.get(g.userId) || [];
          list.push(g);
          userMap.set(g.userId, list);
        });

        for (const [uId, grns] of userMap.entries()) {
          const existingGrns = await this.prisma.grn.findMany({
            where: { userId: uId, grnNumber: { not: null } },
            select: { grnNumber: true }
          });
          const existingNumbers = new Set(existingGrns.map(g => g.grnNumber));

          let counter = 1;
          for (const g of grns) {
            let candidate = `GRN-${String(counter).padStart(4, '0')}`;
            while (existingNumbers.has(candidate)) {
              counter++;
              candidate = `GRN-${String(counter).padStart(4, '0')}`;
            }
            await this.prisma.grn.update({
              where: { id: g.id },
              data: { grnNumber: candidate }
            });
            existingNumbers.add(candidate);
            counter++;
          }
        }
      }
    } catch (e) {
      console.error('Error backfilling GRN numbers:', e);
    }
  }

  async generateGrnNumber(userId: number): Promise<string> {
    await this.backfillGrnNumbers(userId);

    const count = await this.prisma.grn.count({
      where: { userId }
    });
    let nextNum = count + 1;
    let formattedNumber = `GRN-${String(nextNum).padStart(4, '0')}`;
    let existing = await this.prisma.grn.findFirst({
      where: { grnNumber: formattedNumber, userId }
    });
    while (existing) {
      nextNum++;
      formattedNumber = `GRN-${String(nextNum).padStart(4, '0')}`;
      existing = await this.prisma.grn.findFirst({
        where: { grnNumber: formattedNumber, userId }
      });
    }
    return formattedNumber;
  }

  private async calculateGrnTotals(dto: CreateGrnDto, userId: number, existingId?: number) {
    const bookingDate = new Date(); // Enforced (Condition 1 & 2)
    const grnDate = new Date(dto.grnDate || new Date());
    const today = new Date();
    today.setHours(23, 59, 59, 999);

    if (dto.poId) {
      const po = await this.prisma.purchaseOrder.findFirst({
        where: { id: Number(dto.poId), userId },
        include: { items: true }
      });
      if (!po) {
        throw new BadRequestException('Purchase Order not found or unauthorized');
      }
      const poDate = new Date(po.poCreationDate);
      poDate.setHours(0, 0, 0, 0);
      const grnOnlyDate = new Date(grnDate);
      grnOnlyDate.setHours(0, 0, 0, 0);
      
      if (grnOnlyDate < poDate || grnDate > today) {
        throw new BadRequestException('Supplier Challan Date must be between PO Date and Current Date.');
      }

      for (const item of dto.items) {
        const poItem = po.items.find(
          (i: any) =>
            (item.productCode && i.productCode && i.productCode.toLowerCase().trim() === item.productCode.toLowerCase().trim()) ||
            (item.productName && i.productName && i.productName.toLowerCase().trim() === item.productName.toLowerCase().trim())
        );
        if (poItem && Math.abs(Number(poItem.rate) - Number(item.rate)) > 0.001) {
          throw new BadRequestException(
            `Rate for product '${item.productName}' (${item.rate}) does not match Purchase Order '${po.poNumber}' rate (${poItem.rate}). Rate cannot be changed when linked to a PO.`
          );
        }
      }
    } else {
      const now = new Date();
      const fyStart = new Date(now.getMonth() < 3 ? now.getFullYear() - 1 : now.getFullYear(), 3, 1);
      fyStart.setHours(0, 0, 0, 0);
      const grnOnlyDate = new Date(grnDate);
      grnOnlyDate.setHours(0, 0, 0, 0);

      if (grnOnlyDate < fyStart || grnDate > today) {
        throw new BadRequestException('Supplier Challan Date must be within current financial year.');
      }
    }

    const company = await this.prisma.shopDetail.findUnique({
      where: { userId },
      select: { state: true }
    });

    const supplier = await this.prisma.accountMaster.findFirst({
      where: {
        userId,
        accountName: { equals: dto.supplierName, mode: 'insensitive' }
      },
      select: { state: true, gstNo: true, status: true, supplierStatus: true, msmeEnabled: true, msmeId: true, regType: true, supplierCreditDays: true }
    });

    if (!company) throw new BadRequestException('Company shop details not found');
    if (!supplier) throw new BadRequestException(`Supplier '${dto.supplierName}' not found in Account Master`);

    if (supplier.status !== 'ACTIVE' || supplier.supplierStatus !== 'ACTIVE') {
      throw new BadRequestException('Supplier is inactive. New purchase transactions are not allowed.');
    }

    const supplierMsmeActive = supplier.msmeEnabled;
    const supplierMsmeType = supplier.regType === 'Manufacturing' || supplier.regType === 'Service';
    const hasSupplierMsmeId = supplier.msmeId && supplier.msmeId.trim() !== '' && supplier.msmeId.trim().toUpperCase() !== 'N/A';
    const isSupplierMsme = Boolean(supplierMsmeActive && supplierMsmeType && hasSupplierMsmeId);

    const creditDays = dto.creditDays !== undefined && dto.creditDays !== null ? dto.creditDays : (supplier.supplierCreditDays || 0);

    if (isSupplierMsme && creditDays > 45) {
      throw new BadRequestException('MSME supplier payment terms cannot exceed 45 days as per MSME compliance rules.');
    }

    // Fetch user's registered GST
    const userGstDoc = await this.prisma.sellerDocument.findFirst({
        where: { uploadedByUserId: userId, type: 'GST', url: 'N/A' },
        select: { name: true }
    });
    const userGst = userGstDoc?.name;

    const companyState = (company.state || "").trim().toLowerCase();
    const supplierState = (supplier.state || "").trim().toLowerCase();
    const supplierGst = dto.gstNumber || supplier.gstNo;

    let isGstApplicable = Boolean(supplierGst);
    let isRcm = false;
    let isInterState = false;

    if (isGstApplicable) {
        const userCode = userGst ? userGst.substring(0, 2) : null;
        const supplierCode = supplierGst.substring(0, 2);

        if (userGst && /^\d{2}$/.test(userCode) && /^\d{2}$/.test(supplierCode)) {
            isInterState = userCode !== supplierCode;
        } else {
            isInterState = companyState !== supplierState;
        }
    }

    let totalQuantity = 0;
    let taxableAmount = 0;
    let totalTaxAmount = 0;

    const productCodes = Array.from(new Set(
      dto.items.map(item => item.productCode).filter(Boolean)
    ));

    const receivedAggr = await this.prisma.grnItem.groupBy({
      by: ['productCode'],
      where: {
        grn: {
          userId,
          supplierName: dto.supplierName,
          poNumber: dto.poNumber || undefined,
          status: { not: 'DELETED' },
          id: existingId ? { not: existingId } : undefined
        },
        productCode: { in: productCodes }
      },
      _sum: { receivedQty: true }
    });

    const receivedMap = new Map<string, number>();
    for (const a of receivedAggr) {
      if (a.productCode) {
        receivedMap.set(a.productCode, a._sum.receivedQty || 0);
      }
    }

    const itemsToCreate = [];
    for (const item of dto.items) {
      if (item.quantity < 0 || item.rate < 0) {
        throw new BadRequestException(`Quantity and Rate cannot be negative for product ${item.productName}`);
      }

      const receivedPoQty = receivedMap.get(item.productCode) || 0;
      const totalPoQty = Number(item.totalPoQty || 0);
      const currentReceived = Number(item.quantity);
      const remainingQty = totalPoQty > 0 ? totalPoQty - (receivedPoQty + currentReceived) : 0;

      const discountAmount = Number(item.discountAmt || 0);
      const beforeTaxAmount = (currentReceived * Number(item.rate)) - discountAmount;
      const taxPercent = Number(item.taxPercent || 0);
      const itemTaxAmount = isGstApplicable ? (beforeTaxAmount * taxPercent) / 100 : 0;
      const totalAmount = beforeTaxAmount + itemTaxAmount;

      totalQuantity += currentReceived;
      taxableAmount += beforeTaxAmount;
      totalTaxAmount += itemTaxAmount;

      itemsToCreate.push({
        productId: (item.productId && !isNaN(Number(item.productId))) ? parseInt(String(item.productId), 10) : null,
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

    const gstResult = determinePurchaseGst(
      supplierGst,
      userGst,
      company.state,
      supplier.state,
      taxableAmount + expenseTotal, // base for percent calculation (if percent was used)
      0,                            // percent
      totalTaxAmount + expenseTaxTotal // preCalculated tax
    );

    const cgstAmount = gstResult.cgstAmount;
    const sgstAmount = gstResult.sgstAmount;
    const igstAmount = gstResult.igstAmount;
    const finalTaxTotal = gstResult.totalGstAmount;

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

  private async updatePOStatusAfterGrn(poId: number, tx: any) {
    const po = await tx.purchaseOrder.findUnique({
      where: { id: poId },
      include: {
        items: true,
        grn: {
          where: { status: { not: 'DELETED' } },
          include: { items: true }
        },
        purchaseInvoices: {
          where: { status: { not: 'DELETED' } },
          include: { items: true }
        }
      }
    });

    if (po) {
      const totalPoQty = po.items.reduce((sum, item) => sum + item.quantity, 0);
      
      const totalReceivedQty = (po.grn || []).reduce((sum, grn) => {
        return sum + (grn.items || []).reduce((iSum, i) => iSum + (Number(i.receivedQty) || 0), 0);
      }, 0);

      const totalInvoicedQty = (po.purchaseInvoices || []).reduce((sum, inv) => {
        return sum + (inv.items || []).reduce((iSum, i) => iSum + (Number(i.quantity) || 0), 0);
      }, 0);

      const consumedQty = Math.max(totalReceivedQty, totalInvoicedQty);

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
          where: { id: poId },
          data: { status: newStatus }
        });
      }
    }
  }

  async create(createDto: CreateGrnDto, userId: number, uploadedFilePath?: string) {
    console.log('Creating GRN for Supplier:', createDto.supplierName, 'PO:', createDto.poNumber, 'User:', userId);
    try {
      const grnNumber = createDto.grnNumber || createDto.grnNo || await this.generateGrnNumber(userId);
      const totals = await this.calculateGrnTotals(createDto, userId);
      console.log('GRN Calculated Totals:', JSON.stringify(totals, null, 2));

      return await this.prisma.$transaction(async (tx) => {
        const grn = await tx.grn.create({
          data: {
            grnNumber,
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
            poId: (createDto.poId && !isNaN(Number(createDto.poId))) ? Number(createDto.poId) : null,
            items: { create: totals.itemsToCreate },
            expenses: { create: totals.expensesToCreate }
          },
          include: { items: true, expenses: true },
        });

        if (createDto.poId) {
          await this.updatePOStatusAfterGrn(Number(createDto.poId), tx);
        }

        console.log('Created GRN Object:', JSON.stringify(grn, null, 2));
        return grn;
      });
    } catch (error) {
      console.error('GRN CREATE ERROR:', error);
      if (error instanceof BadRequestException) throw error;
      throw new BadRequestException(`Failed to create GRN: ${error.message}`);
    }
  }

  async getSupplierPOsForGrn(supplierName: string, userId: number) {
    if (!supplierName) return [];

    const pos = await this.prisma.purchaseOrder.findMany({
      where: {
        userId,
        supplierName: { equals: supplierName, mode: 'insensitive' },
        status: { not: 'DELETED' },
      },
      include: {
        items: true,
        grn: {
          where: { status: { not: 'DELETED' } },
          include: { items: true }
        },
        purchaseInvoices: {
          where: { status: { not: 'DELETED' } },
          include: { items: true }
        }
      },
      orderBy: { poNumber: 'desc' },
    });

    const filteredPos = pos.filter(po => {
      const totalPoQty = po.items.reduce((sum, item) => sum + item.quantity, 0);
      
      const totalReceivedQty = po.grn.reduce((sum, grn) => {
        return sum + grn.items.reduce((iSum, i) => iSum + i.receivedQty, 0);
      }, 0);

      return (totalPoQty - totalReceivedQty) > 0.01;
    });

    return filteredPos.map(po => ({
      id: po.id,
      poNumber: po.poNumber,
    }));
  }

  async getSupplierChallans(supplierName: string, userId: number, excludeInvoiceId?: number) {
    // 1. Fetch all GRNs for the supplier
    const grns = await this.prisma.grn.findMany({
      where: {
        userId,
        supplierName: { equals: supplierName, mode: 'insensitive' },
        status: { not: 'DELETED' }
      },
      include: {
        items: true,
      },
      orderBy: { createdAt: 'desc' }
    });

    // 2. Fetch all invoices that might refer to these GRNs
    const invoices = await this.prisma.purchaseInvoice.findMany({
      where: { 
        userId, 
        status: { not: 'DELETED' },
        ...(excludeInvoiceId ? { id: { not: excludeInvoiceId } } : {})
      },
      include: { items: true }
    });

    // 3. Filter GRNs based on invoiced quantity
    return grns.filter(grn => {
      const totalGrnQty = grn.items.reduce((sum, item) => sum + item.receivedQty, 0);
      
      // Calculate how much of this GRN has been invoiced
      const totalInvoicedQty = invoices.reduce((sum, inv) => {
        if (inv.challanNumber) {
          const challanIds = inv.challanNumber.split(',').map(id => id.trim());
          if (challanIds.includes(grn.id.toString()) || challanIds.includes(grn.challanNumber)) {
            // If the invoice is for this GRN, count its items
            // This is a simplification: we assume the invoice items correspond to the GRNs listed
            return sum + inv.items.reduce((iSum, i) => iSum + i.quantity, 0);
          }
        }
        return sum;
      }, 0);

      return totalInvoicedQty < totalGrnQty;
    });
  }

  async getReceivedQty(supplierName: string, productCode: string, userId: number, poNumber?: string) {
    const [grnSum, invSum] = await Promise.all([
        this.prisma.grnItem.aggregate({
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
        }),
        this.prisma.purchaseInvoiceItem.aggregate({
          where: {
            purchaseInvoice: {
              userId,
              supplierName: { equals: supplierName, mode: 'insensitive' },
              poNumber: poNumber || undefined,
              status: { not: 'DELETED' }
            },
            productCode
          },
          _sum: { quantity: true }
        })
    ]);

    const totalReceived = grnSum._sum.receivedQty || 0;
    const totalInvoiced = invSum._sum.quantity || 0;

    return { receivedPoQty: Math.max(totalReceived, totalInvoiced) };
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
        { grnNumber: { contains: query.search, mode: 'insensitive' } },
        { poNumber: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.max(1, Number(query.limit) || 10);
    const skip = (page - 1) * limit;

    const [data, total, allMatching] = await Promise.all([
      this.prisma.grn.findMany({
        where,
        include: { items: true, expenses: true },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.grn.count({ where }),
      this.prisma.grn.findMany({
        where,
        select: {
          grandTotal: true,
          items: { select: { beforeTaxAmount: true, taxAmount: true } }
        }
      })
    ]);

    let grandTaxable = 0;
    let grandTax = 0;
    let grandTotalSum = 0;
    for (const g of allMatching) {
      const taxable = g.items?.reduce((sum, i) => sum + (Number(i.beforeTaxAmount) || 0), 0) || 0;
      const tax = g.items?.reduce((sum, i) => sum + (Number(i.taxAmount) || 0), 0) || 0;
      const gross = Number(g.grandTotal || (taxable + tax));
      grandTaxable += taxable;
      grandTax += tax;
      grandTotalSum += gross;
    }

    const invoices = await this.prisma.purchaseInvoice.findMany({
      where: { userId: query.userId, status: { not: 'DELETED' } },
      select: { challanNumber: true }
    });

    const mappedData = data.map(grn => {
      const isLinked = invoices.some(inv => {
        if (!inv.challanNumber) return false;
        const challanIds = inv.challanNumber.split(',').map(idx => idx.trim());
        return challanIds.includes(grn.id.toString()) || challanIds.includes(grn.challanNumber);
      });
      const formattedGrnNo = grn.grnNumber || `GRN-${String(grn.id).padStart(4, '0')}`;
      return { ...grn, grnNumber: formattedGrnNo, grnNo: formattedGrnNo, isInvoiced: isLinked };
    });

    return {
      data: mappedData,
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
    const grn = await this.prisma.grn.findFirst({
      where: { id, userId },
      include: { items: true, expenses: true },
    });
    if (!grn) throw new NotFoundException(`GRN ID ${id} not found or access denied`);

    const invoices = await this.prisma.purchaseInvoice.findMany({
      where: { userId, status: { not: 'DELETED' } },
      select: { challanNumber: true }
    });
    const isLinked = invoices.some(inv => {
      if (!inv.challanNumber) return false;
      const challanIds = inv.challanNumber.split(',').map(idx => idx.trim());
      return challanIds.includes(id.toString()) || challanIds.includes(grn.challanNumber);
    });

    return { ...grn, isInvoiced: isLinked };
  }
 
  async update(id: number, updateDto: any, userId: number, uploadedFilePath?: string) {
    const existing = await this.findOne(id, userId);
    if (!existing) throw new NotFoundException(`GRN ID ${id} not found`);

    // Check if GRN is linked to any Purchase Invoice
    const invoices = await this.prisma.purchaseInvoice.findMany({
      where: { userId, status: { not: 'DELETED' } },
      select: { challanNumber: true }
    });
    const isLinked = invoices.some(inv => {
      if (!inv.challanNumber) return false;
      const challanIds = inv.challanNumber.split(',').map(idx => idx.trim());
      return challanIds.includes(id.toString()) || challanIds.includes(existing.challanNumber);
    });
    if (isLinked) {
      throw new ForbiddenException(`GRN cannot be edited because it is linked to a Purchase Invoice.`);
    }

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

      const updated = await tx.grn.update({
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

      if (updated.poId) {
        await this.updatePOStatusAfterGrn(Number(updated.poId), tx);
      }
      
      // If the poId changed, we might need to update the old PO too
      if (existing.poId && existing.poId !== updated.poId) {
        await this.updatePOStatusAfterGrn(Number(existing.poId), tx);
      }

      return updated;
    });
  }

  async remove(id: number, userId: number) {
    const existing = await this.prisma.grn.findUnique({ where: { id } });
    if (!existing || existing.userId !== userId) throw new NotFoundException('GRN not found');

    // Check if GRN is linked to any Purchase Invoice
    const invoices = await this.prisma.purchaseInvoice.findMany({
      where: { userId, status: { not: 'DELETED' } },
      select: { challanNumber: true }
    });
    const isLinked = invoices.some(inv => {
      if (!inv.challanNumber) return false;
      const challanIds = inv.challanNumber.split(',').map(idx => idx.trim());
      return challanIds.includes(id.toString()) || challanIds.includes(existing.challanNumber);
    });
    if (isLinked) {
      throw new ForbiddenException(`GRN cannot be deleted because it is linked to a Purchase Invoice.`);
    }

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.grn.update({ 
        where: { id },
        data: { status: 'DELETED' }
      });
      
      if (updated.poId) {
        await this.updatePOStatusAfterGrn(Number(updated.poId), tx);
      }
      
      return updated;
    });
  }

  async exportGrns(format: string, query: { search?: string, userId: number }) {
    const grns = await this.findAll({ search: query.search, userId: query.userId, page: 1, limit: 100000 });

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
      worksheet.views = [{ state: 'frozen', ySplit: 5 }];
      worksheet.columns = [
        { header: 'SR NO', key: 'srNo', width: 8 },
        { header: 'GRN NO', key: 'grnNo', width: 16 },
        { header: 'SUPPLIER CHALLAN NUMBER', key: 'challanNumber', width: 25 },
        { header: 'SUPPLIER NAME', key: 'supplierName', width: 28 },
        { header: 'SUPPLIER CHALLAN DATE', key: 'challanDate', width: 22 },
        { header: 'BOOKING DATE', key: 'bookingDate', width: 16 },
        { header: 'PO NO', key: 'poNumber', width: 16 },
        { header: 'GST NUMBER', key: 'gstNumber', width: 18 },
        { header: 'CREDIT DAYS', key: 'creditDays', width: 14 },
        { header: 'TAXABLE AMOUNT', key: 'taxableAmount', width: 18 },
        { header: 'TAX AMOUNT', key: 'taxAmount', width: 16 },
        { header: 'TOTAL AMOUNT', key: 'grandTotal', width: 18 },
        { header: 'STATUS', key: 'status', width: 14 },
      ];

      grns.data.forEach((g, idx) => {
        const taxable = g.items?.reduce((sum, i) => sum + (Number(i.beforeTaxAmount) || 0), 0) || Number(g.taxableAmount) || 0;
        const tax = g.items?.reduce((sum, i) => sum + (Number(i.taxAmount) || 0), 0) || (Number(g.cgstAmount || 0) + Number(g.sgstAmount || 0) + Number(g.igstAmount || 0)) || 0;
        const gross = Number(g.grandTotal || (taxable + tax));
        const statusLabel = g.status === 'DELETED' ? 'Deleted' : (g.isInvoiced ? 'Invoiced' : 'Generated');

        worksheet.addRow({
          srNo: idx + 1,
          grnNo: g.grnNumber || g.grnNo || `GRN-${String(g.id).padStart(4, '0')}`,
          challanNumber: g.challanNumber || '-',
          supplierName: g.supplierName || '-',
          challanDate: formatDate(g.grnDate),
          bookingDate: formatDate(g.bookingDate),
          poNumber: g.poNumber || '-',
          gstNumber: g.gstNumber || '-',
          creditDays: g.creditDays || 0,
          taxableAmount: taxable,
          taxAmount: tax,
          grandTotal: gross,
          status: statusLabel,
        });
      });

      worksheet.spliceRows(1, 0, [], [], [], []);
      worksheet.mergeCells('A1:M1');
      const titleCell = worksheet.getCell('A1');
      titleCell.value = 'ERP';
      titleCell.font = { size: 18, bold: true };
      titleCell.alignment = { horizontal: 'center', vertical: 'middle' };

      worksheet.mergeCells('A2:M2');
      const subtitleCell = worksheet.getCell('A2');
      subtitleCell.value = 'Goods Receipt Note Report';
      subtitleCell.font = { size: 14 };
      subtitleCell.alignment = { horizontal: 'center', vertical: 'middle' };

      worksheet.mergeCells('A3:M3');
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
        const doc = new PDFDocument({ margin: 15, size: 'A4', layout: 'landscape' });
        const buffers: Buffer[] = [];
        doc.on('data', buffers.push.bind(buffers));
        doc.on('end', () => resolve({ buffer: Buffer.concat(buffers), filename: `grns_${Date.now()}.pdf`, mimetype: 'application/pdf' }));

        doc.fontSize(16).font('Helvetica-Bold').text('ERP', { align: 'center' });
        doc.fontSize(12).font('Helvetica').text('Goods Receipt Note Report', { align: 'center' });
        doc.moveDown(0.3);
        doc.fontSize(9).text(`Exported on: ${timestamp}`, { align: 'right' });
        doc.moveDown(0.5);

        const tableTop = 85;
        const colX = [15, 45, 110, 175, 260, 320, 375, 430, 490, 530, 585, 640, 700];
        const headers = ['SR', 'GRN NO', 'Challan No', 'Supplier Name', 'Challan Dt', 'Book Dt', 'PO No', 'GST No', 'Credit', 'Taxable', 'Tax', 'Total', 'Status'];

        doc.rect(10, tableTop - 5, 820, 20).fill('#4472C4');
        doc.fontSize(7).font('Helvetica-Bold').fillColor('#FFFFFF');
        headers.forEach((h, i) => doc.text(h, colX[i], tableTop));

        let y = tableTop + 20;
        doc.fillColor('#000000').font('Helvetica');

        grns.data.forEach((g, index) => {
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

          const taxable = g.items?.reduce((sum, i) => sum + (Number(i.beforeTaxAmount) || 0), 0) || Number(g.taxableAmount) || 0;
          const tax = g.items?.reduce((sum, i) => sum + (Number(i.taxAmount) || 0), 0) || (Number(g.cgstAmount || 0) + Number(g.sgstAmount || 0) + Number(g.igstAmount || 0)) || 0;
          const gross = Number(g.grandTotal || (taxable + tax));
          const statusLabel = g.status === 'DELETED' ? 'Deleted' : (g.isInvoiced ? 'Invoiced' : 'Generated');

          doc.fontSize(6);
          doc.text(String(index + 1), colX[0], y);
          doc.text(g.grnNumber || g.grnNo || `GRN-${String(g.id).padStart(4, '0')}`, colX[1], y, { width: 60 });
          doc.text((g.challanNumber || '-').substring(0, 12), colX[2], y, { width: 60 });
          doc.text((g.supplierName || '-').substring(0, 18), colX[3], y, { width: 80 });
          doc.text(formatDate(g.grnDate), colX[4], y);
          doc.text(formatDate(g.bookingDate), colX[5], y);
          doc.text((g.poNumber || '-').substring(0, 10), colX[6], y);
          doc.text((g.gstNumber || '-').substring(0, 12), colX[7], y);
          doc.text(String(g.creditDays || 0), colX[8], y);
          doc.text(taxable.toFixed(2), colX[9], y);
          doc.text(tax.toFixed(2), colX[10], y);
          doc.text(gross.toFixed(2), colX[11], y);
          doc.text(statusLabel, colX[12], y);
          y += 18;
        });

        doc.end();
      });
    }
  }

  async printGrn(id: number, userId: number) {
    const grn = await this.prisma.grn.findFirst({
      where: { id, userId },
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

  async downloadSample() {
    const buffer = await generateGRNSampleExcel();
    return {
      buffer,
      filename: 'grn_sample.xlsx',
      mimetype: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    };
  }

  async importGrns(fileBuffer: Buffer, userId: number) {
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
        if ((val.includes('grn no') || val.includes('grn number') || val.includes('grn')) && !val.includes('supplier challan') && !val.includes('date')) {
          colMap['grnNo'] = colNumber;
          found = true;
        } else if (!colMap['grnNo'] && val.includes('challan number') && !val.includes('supplier challan')) {
          colMap['grnNo'] = colNumber;
          found = true;
        }
        if (val.includes('supplier challan number') || val.includes('supplier challan no')) colMap['supplierChallanNo'] = colNumber;
        if (val.includes('supplier challan date')) colMap['supplierChallanDate'] = colNumber;
        if (val.includes('grn date') || val.includes('booking date')) colMap['grnDate'] = colNumber;
        if (val.includes('po no') || val.includes('po number')) colMap['poNo'] = colNumber;
        if (val.includes('supplier name') || val.includes('supplier')) colMap['supplierName'] = colNumber;
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
    let isSoFile = false;

    for (let r = 1; r <= Math.min(rowCount, 10); r++) {
      const row = worksheet.getRow(r);
      row.eachCell((cell) => {
        const val = String(cell.value || '').trim().toLowerCase();
        if (
          (val.includes('po number') || val.includes('po no') || val.includes('po date') || val.includes('customer po') || val.includes('expiry date') || val.includes('po amt') || val.includes('purchase order')) &&
          !val.includes('grn')
        ) {
          isPoFile = true;
        }
        if (val.includes('so no') || val.includes('so number') || val.includes('sales order')) {
          isSoFile = true;
        }
      });
    }

    if (!colMap['grnNo']) {
      throw new BadRequestException('Invalid template format');
    }

    const mandatoryCols = ['grnNo', 'supplierName', 'productName', 'quantity', 'rate'];
    const missing = mandatoryCols.filter(col => !colMap[col]);
    if (headerRowIndex === -1 || missing.length > 0) {
      throw new BadRequestException('Invalid template format');
    }

    const getVal = (row: ExcelJS.Row, key: string, defaultVal: any = '') => {
      const colIdx = colMap[key];
      if (!colIdx) return defaultVal;
      const cell = row.getCell(colIdx);
      if (cell.text && typeof cell.text === 'string' && cell.text.trim()) {
        const textVal = cell.text.trim();
        if (/^\d{1,2}[\/\.\-]\d{1,2}[\/\.\-]\d{4}$/.test(textVal)) {
          return textVal;
        }
      }
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
    const [{ supplierMap }, { productCodeMap, productNameMap }, existingGrns, existingPos, userShop, userGstDoc] = await Promise.all([
      this.importValidator.fetchAccountMasterData(userId),
      this.importValidator.fetchProductMasterData(userId),
      this.prisma.grn.findMany({
        where: { userId, status: { not: 'DELETED' } },
        select: { challanNumber: true },
      }),
      this.prisma.purchaseOrder.findMany({
        where: { userId, status: { not: 'DELETED' } },
        include: { items: true, grn: { where: { status: { not: 'DELETED' } }, include: { items: true } } },
      }),
      this.prisma.shopDetail.findUnique({ where: { userId } }),
      this.prisma.sellerDocument.findFirst({
        where: { uploadedByUserId: userId, type: 'GST' },
        orderBy: { createdAt: 'desc' },
        select: { name: true },
      }),
    ]);

    const dbGrnNumbers = new Set(existingGrns.map(g => g.challanNumber.toLowerCase().trim()));
    const importedGrnNumbersInFile = new Set<string>();

    const poMap = new Map<string, any>();
    for (const po of existingPos) {
      poMap.set(po.poNumber.toLowerCase().trim(), po);
    }

    const groupMap = new Map<string, any[]>();

    for (let r = headerRowIndex + 1; r <= rowCount; r++) {
      const row = worksheet.getRow(r);
      const grnNo = getVal(row, 'grnNo');
      if (!grnNo || grnNo === '-') continue;

      const item = {
        rowNum: r,
        originalRowValues: row.values,
        grnNo,
        grnDateStr: getVal(row, 'grnDate'),
        challanNumber: getVal(row, 'supplierChallanNo'),
        supplierChallanDate: getVal(row, 'supplierChallanDate'),
        poNo: getVal(row, 'poNo'),
        supplierName: getVal(row, 'supplierName'),
        productName: getVal(row, 'productName'),
        productCode: getVal(row, 'productCode'),
        quantityStr: getVal(row, 'quantity'),
        rateStr: getVal(row, 'rate'),
        discountAmountStr: getVal(row, 'discountAmount'),
        discountPercentStr: getVal(row, 'discountPercent'),
      };

      if (!groupMap.has(grnNo)) {
        groupMap.set(grnNo, []);
      }
      groupMap.get(grnNo)!.push(item);
    }

    if (groupMap.size === 0) {
      throw new BadRequestException('No valid data rows found in the uploaded file to import.');
    }

    const successRows: any[] = [];
    const failedRows: { rowNum: number; values: any[]; error: string }[] = [];

    const userGst = userGstDoc?.name;
    const companyState = (userShop?.state || '').trim().toLowerCase();
    const isGstApplicable = isValidGst(userGst);

    for (const [grnNo, rows] of groupMap.entries()) {
      const groupErrors: string[] = [];
      const firstRow = rows[0];

      const dateConsistencyErrors = this.importValidator.validateGroupDateConsistency(
        rows,
        'GRN No',
        grnNo,
        [
          { key: 'grnDateStr', label: 'GRN Date' },
          { key: 'supplierChallanDateStr', label: 'Supplier Challan Date' },
        ]
      );
      groupErrors.push(...dateConsistencyErrors);

      // 1. GRN Number uniqueness check
      const docNoValidation = this.importValidator.validateDocumentNumber(
        'GRN',
        grnNo,
        dbGrnNumbers,
        importedGrnNumbersInFile,
        firstRow.rowNum
      );
      if (!docNoValidation.valid) {
        groupErrors.push(docNoValidation.error);
      }

      // 2. Supplier validation & auto-fetching
      const suppValidation = this.importValidator.validateSupplier(firstRow.supplierName, supplierMap, 'GRN');
      let supplierData: any = null;
      if (!suppValidation.valid) {
        groupErrors.push(suppValidation.error);
      } else {
        supplierData = suppValidation.data;
      }

      // 3. Date validation (DD/MM/YYYY format check only)
      let parsedGrnDate: Date = new Date();
      if (firstRow.grnDateStr) {
        const dateVal = this.importValidator.validateImportDate(firstRow.grnDateStr, 'GRN Booking Date');
        if (!dateVal.valid) {
          groupErrors.push(dateVal.error);
        } else {
          parsedGrnDate = dateVal.date;
        }
      }

      // 4. Optional PO Reference validation
      let referencedPo: any = null;
      if (firstRow.poNo && firstRow.poNo.trim()) {
        const rawPoNo = firstRow.poNo.trim();
        referencedPo = poMap.get(rawPoNo.toLowerCase());
        if (!referencedPo) {
          groupErrors.push(`Purchase Order '${rawPoNo}' does not exist. Please provide a valid Purchase Order Number.`);
        } else if (supplierData && referencedPo.supplierName.toLowerCase().trim() !== supplierData.name.toLowerCase().trim()) {
          groupErrors.push(`Supplier '${supplierData.name}' does not match the supplier of Purchase Order '${rawPoNo}'.`);
        }
      }

      // 5. Products validation & remaining PO quantity check
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

        // Check remaining PO quantity if PO reference exists
        let totalPoQty = qty;
        let receivedPoQty = 0;
        let remainingPoQty = qty;

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
            totalPoQty = poItem.quantity;
            let alreadyReceived = 0;
            for (const prevGrn of referencedPo.grn || []) {
              for (const prevItem of prevGrn.items || []) {
                if (
                  prevItem.productCode.toLowerCase().trim() === prod.product_code.toLowerCase().trim() ||
                  prevItem.productName.toLowerCase().trim() === prod.product_name.toLowerCase().trim()
                ) {
                  alreadyReceived += Number(prevItem.receivedQty || 0);
                }
              }
            }
            receivedPoQty = alreadyReceived;
            remainingPoQty = Math.max(0, totalPoQty - alreadyReceived);

            if (qty > remainingPoQty) {
              groupErrors.push(
                `GRN quantity for product '${prod.product_name}' exceeds the remaining PO quantity. Available quantity: ${remainingPoQty}, Imported quantity: ${qty}.`
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
          printDescription: prod.description || prod.hsn_description || prod.product_name,
          hsnCode: prod.hsn_code || '',
          totalPoQty,
          receivedPoQty,
          receivedQty: qty,
          remainingQty: Math.max(0, remainingPoQty - qty),
          rate,
          uom: prod.uom?.unit_name || 'Nos',
          discountPercent: finalDiscPercent,
          discountAmount: finalDiscAmount,
          taxPercent: taxRate,
          taxAmount,
          beforeTaxAmount,
          totalAmount: totalItemAmount,
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
            await tx.grn.create({
              data: {
                grnNumber: grnNo,
                challanNumber: firstRow.challanNumber || '',
                poNumber: referencedPo ? referencedPo.poNumber : (firstRow.poNo || null),
                poId: referencedPo ? referencedPo.id : null,
                supplierName: supplierData.name,
                address: supplierData.address,
                creditDays: supplierData.creditDays,
                gstNumber: supplierData.gstNo,
                grnDate: firstRow.supplierChallanDate ? new Date(firstRow.supplierChallanDate) : parsedGrnDate,
                bookingDate: parsedGrnDate,
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
                    printDescription: item.printDescription,
                    hsnCode: item.hsnCode,
                    totalPoQty: item.totalPoQty,
                    receivedPoQty: item.receivedPoQty,
                    receivedQty: item.receivedQty,
                    remainingQty: item.remainingQty,
                    rate: item.rate,
                    uom: item.uom,
                    discountPercent: item.discountPercent,
                    discountAmount: item.discountAmount,
                    taxPercent: item.taxPercent,
                    taxAmount: item.taxAmount,
                    beforeTaxAmount: item.beforeTaxAmount,
                    totalAmount: item.totalAmount,
                    amount: item.amount,
                  })),
                },
              },
            });

            if (referencedPo) {
              await this.updatePOStatusAfterGrn(referencedPo.id, tx);
            }
          });

          importedGrnNumbersInFile.add(grnNo.toLowerCase());
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
      'GRN No*', 'GRN Date*', 'PO NO', 'Supplier Challan Number', 'Supplier Challan Date', 'Supplier Name*',
      'Product Name*', 'Product Code', 'Qty*', 'Rate*', 'Discount (₹)', 'Discount (%)'
    ];

    return this.importValidator.buildResponseSummary(headers, successRows, failedRows);
  }
}
