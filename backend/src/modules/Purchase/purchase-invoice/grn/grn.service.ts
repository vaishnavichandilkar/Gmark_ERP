import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { isValidGst, determinePurchaseGst } from '../../../../common/utils/gst.helper';
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
    const bookingDate = new Date(); // Enforced (Condition 1 & 2)
    const grnDate = new Date(dto.grnDate || new Date());
    const today = new Date();
    today.setHours(23, 59, 59, 999);

    if (dto.poId) {
      const po = await this.prisma.purchaseOrder.findUnique({ where: { id: Number(dto.poId) } });
      const poDate = po ? new Date(po.poCreationDate) : null;
      if (poDate) {
        poDate.setHours(0, 0, 0, 0);
        const grnOnlyDate = new Date(grnDate);
        grnOnlyDate.setHours(0, 0, 0, 0);
        
        if (grnOnlyDate < poDate || grnDate > today) {
          throw new BadRequestException('Supplier Challan Date must be between PO Date and Current Date.');
        }
      } else if (grnDate > today) {
        throw new BadRequestException('Supplier Challan Date must be between PO Date and Current Date.');
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
      select: { state: true, gstNo: true, status: true, supplierStatus: true }
    });

    if (!company) throw new BadRequestException('Company shop details not found');
    if (!supplier) throw new BadRequestException(`Supplier '${dto.supplierName}' not found in Account Master`);

    if (supplier.status !== 'ACTIVE' || supplier.supplierStatus !== 'ACTIVE') {
      throw new BadRequestException('Supplier is inactive. New purchase transactions are not allowed.');
    }

    // Fetch user's registered GST
    const userGstDoc = await this.prisma.sellerDocument.findFirst({
        where: { uploadedByUserId: userId, type: 'GST' },
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
      if (consumedQty >= totalPoQty) {
        // If fully processed, decide which completed status to use. 
        // Invoice completion is generally the final stage.
        if (totalInvoicedQty >= totalPoQty) {
            newStatus = 'INVOICE_COMPLETED';
        } else {
            newStatus = 'GRN_COMPLETED';
        }
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
      const totals = await this.calculateGrnTotals(createDto, userId);
      console.log('GRN Calculated Totals:', JSON.stringify(totals, null, 2));

      return await this.prisma.$transaction(async (tx) => {
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
      return { ...grn, isInvoiced: isLinked };
    });

    return {
      data: mappedData,
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
