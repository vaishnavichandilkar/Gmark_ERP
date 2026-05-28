import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/prisma/prisma.service';
import { CreatePurchaseOrderDto, UpdatePurchaseOrderDto } from './dto/purchase-order.dto';
import { Prisma } from '@prisma/client';
import * as ExcelJS from 'exceljs';
import * as PDFDocument from 'pdfkit';

@Injectable()
export class PurchaseOrderService {
  constructor(private prisma: PrismaService) {}

  async generatePONumber(userId: number): Promise<string> {
    const lastPO = await this.prisma.purchaseOrder.findFirst({
      where: { userId },
      orderBy: { id: 'desc' },
      select: { poNumber: true },
    });

    if (!lastPO) {
      return 'PO00001';
    }

    const lastNumber = parseInt(lastPO.poNumber.replace('PO', ''), 10);
    return `PO${(lastNumber + 1).toString().padStart(5, '0')}`;
  }

  async getNextNumber(userId: number) {
    const poNumber = await this.generatePONumber(userId);
    return { poNumber };
  }

  async getSupplierDetails(supplierId: number, userId: number) {
    const supplier = await this.prisma.accountMaster.findFirst({
      where: { id: supplierId, userId },
    });

    if (!supplier) {
      throw new NotFoundException('Supplier not found or access denied');
    }

    return {
      supplierName: supplier.accountName,
      address: supplier.addressLine1 + (supplier.addressLine2 ? ', ' + supplier.addressLine2 : ''),
      gstNumber: supplier.gstNo,
      creditDays: supplier.supplierCreditDays || 0,
    };
  }

  public calculateItemValues(item: any, isGstApplicable: boolean = true) {
    const qty = Number(item.quantity) || 0;
    const rate = Number(item.rate) || 0;
    const baseTotal = qty * rate;
    
    let discountPercent = Number(item.discountPercent) || 0;
    let discountAmount = Number(item.discountAmount) || 0;

    if (discountAmount > 0 && (discountPercent === 0 || isNaN(discountPercent))) {
      discountPercent = baseTotal > 0 ? (discountAmount / baseTotal) * 100 : 0;
    } else {
      discountAmount = (baseTotal * discountPercent) / 100;
    }

    const beforeTaxAmount = baseTotal - discountAmount;
    const taxAmount = isGstApplicable ? ((beforeTaxAmount * (Number(item.taxPercent) || 0)) / 100) : 0;
    const totalAmount = beforeTaxAmount + taxAmount;

    return {
      ...item,
      discountPercent,
      discountAmount,
      beforeTaxAmount,
      taxAmount,
      totalAmount,
      printDescription: item.printDescription || item.description || item.productName || '',
    };
  }

  async create(createDto: CreatePurchaseOrderDto, userId: number) {
    const fullSupplier = await this.prisma.accountMaster.findUnique({
      where: { id: createDto.supplierId }
    });
    if (!fullSupplier) {
      throw new BadRequestException('Supplier not found');
    }
    if (fullSupplier.status !== 'ACTIVE' || fullSupplier.supplierStatus !== 'ACTIVE') {
      throw new BadRequestException('Supplier is inactive. New purchase transactions are not allowed.');
    }

    const supplier = await this.getSupplierDetails(createDto.supplierId, userId);
    
    // Requirement 4 & 8: Prefer passed poNumber (if validly unique) or generate new
    const poNumber = createDto.poNumber || await this.generatePONumber(userId);

    const userGstDoc = await this.prisma.sellerDocument.findFirst({
        where: { uploadedByUserId: userId, type: 'GST' },
        select: { name: true }
    });
    const userGst = userGstDoc?.name;

    const isGstApplicable = Boolean(createDto.gstNo || supplier.gstNumber);
    const processedItems = createDto.items.map(item => this.calculateItemValues(item, isGstApplicable));

    const totalAmount = processedItems.reduce((sum, item) => sum + (item.quantity * item.rate) - item.discountAmount, 0);
    const totalTaxAmount = processedItems.reduce((sum, item) => sum + (Number(item.taxAmount) || 0), 0);
    const totalGrandTotal = processedItems.reduce((sum, item) => sum + (Number(item.totalAmount) || 0), 0);

    console.log('Creating PO with Number:', poNumber, 'for User:', userId);
    return this.prisma.$transaction(async (tx) => {
      const po = await tx.purchaseOrder.create({
        data: {
          poNumber,
          supplierName: supplier.supplierName,
          address: createDto.address || supplier.address,
          creditDays: createDto.creditDays,
          poCreationDate: new Date(), // Enforce current date (Condition 1)
          expiryDate: new Date(createDto.expiryDate),
          gstNumber: createDto.gstNo || supplier.gstNumber,
          taxAmount: totalTaxAmount,
          totalAmount: totalGrandTotal,
          userId,
          status: 'PENDING',
          items: {
            create: processedItems.map(item => ({
              productCode: item.productCode,
              productName: item.productName,
              hsnCode: item.hsnCode,
              quantity: item.quantity,
              rate: item.rate,
              uom: item.uom,
              discountPercent: item.discountPercent,
              discountAmount: item.discountAmount,
              taxPercent: Number(item.taxPercent) || 0,
              taxAmount: Number(item.taxAmount) || 0,
              beforeTaxAmount: Number(item.beforeTaxAmount) || 0,
              totalAmount: Number(item.totalAmount) || 0,
              productId: item.productId ? parseInt(item.productId, 10) : null,
              printDescription: item.printDescription,
            })),
          },
        },
        include: { items: true },
      });
      console.log('Created PO Object:', JSON.stringify(po, null, 2));
      return po;
    });
  }

  async findAll(query: { filter?: 'all' | 'pending' | 'expiring' | 'expired' | 'completed' | 'deleted', search?: string }, userId: number) {
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    const fortyEightHoursLater = new Date(startOfToday.getTime() + 48 * 60 * 60 * 1000);
    fortyEightHoursLater.setHours(23, 59, 59, 999);

    const where: Prisma.PurchaseOrderWhereInput = { userId };

    // Apply Filter-specific conditions
    switch (query.filter) {
      case 'pending':
        where.status = 'PENDING';
        where.expiryDate = { gte: startOfToday };
        break;
      case 'expiring': {
        where.expiryDate = { gte: startOfToday, lte: fortyEightHoursLater };
        break;
      }
      case 'expired':
        where.expiryDate = { lt: startOfToday };
        break;
      case 'completed':
        where.status = { in: ['INVOICE_COMPLETED', 'INVOICE_GENERATED'] } as any;
        break;
      case 'deleted':
        where.status = 'DELETED';
        break;
      default:
        // 'all' or undefined: include everything by default now as requested
        break;
    }

    // Apply search if provided (searching by poNumber or supplierName)
    if (query.search) {
      where.OR = [
        { poNumber: { contains: query.search, mode: 'insensitive' } },
        { supplierName: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    return this.prisma.purchaseOrder.findMany({
      where,
      include: { items: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: number, userId: number) {
    const po = await this.prisma.purchaseOrder.findFirst({
      where: { id, userId },
      include: { 
        items: true,
        grn: {
          include: { items: true }
        }
      },
    });

    if (!po) throw new NotFoundException(`PO ID ${id} not found`);

    // Calculate received quantity for each item
    const itemsWithReceived = po.items.map(item => {
      let receivedQty = 0;
      
      po.grn.forEach(grn => {
        grn.items.forEach(grnItem => {
          if (grnItem.productCode === item.productCode) {
            receivedQty += grnItem.receivedQty;
          }
        });
      });

      return {
        ...item,
        receivedQty
      };
    });

    return {
      ...po,
      items: itemsWithReceived
    };
  }

  async update(id: number, updateDto: UpdatePurchaseOrderDto, userId: number) {
    const po = await this.findOne(id, userId);
    if (po.status === 'INVOICE_COMPLETED' || po.status === 'DELETED') {
      throw new ForbiddenException(`Update forbidden in status ${po.status}`);
    }

    return this.prisma.$transaction(async (tx) => {
      const data: any = {
        creditDays: updateDto.creditDays ?? po.creditDays,
        expiryDate: updateDto.expiryDate ? new Date(updateDto.expiryDate) : po.expiryDate,
        status: updateDto.status ?? (po.status as any),
        address: updateDto.address ?? po.address,
        gstNumber: updateDto.gstNo ?? po.gstNumber,
        poNumber: updateDto.poNumber ?? po.poNumber,
        poCreationDate: updateDto.poCreationDate ? new Date(updateDto.poCreationDate) : po.poCreationDate,
      };

      if (updateDto.supplierId) {
        const supplier = await tx.accountMaster.findUnique({ where: { id: updateDto.supplierId } });
        if (supplier) {
          data.supplierName = supplier.accountName;
          // Only override if not explicitly provided in DTO
          if (!updateDto.address) data.address = supplier.addressLine1;
          if (!updateDto.gstNo) data.gstNumber = supplier.gstNo;
        }
      }

      if (updateDto.items) {
        const userGstDoc = await tx.sellerDocument.findFirst({
            where: { uploadedByUserId: userId, type: 'GST' },
            select: { name: true }
        });
        const userGst = userGstDoc?.name;
        
        const isGstApplicable = Boolean(updateDto.gstNo || data.gstNumber || po.gstNumber);
        const processedItems = updateDto.items.map(item => this.calculateItemValues(item, isGstApplicable));
        const totalTaxAmount = processedItems.reduce((sum, item) => sum + (Number(item.taxAmount) || 0), 0);
        const totalGrandTotal = processedItems.reduce((sum, item) => sum + (Number(item.totalAmount) || 0), 0);
        
        data.taxAmount = totalTaxAmount;
        data.totalAmount = totalGrandTotal;
        
        data.items = { 
          create: processedItems.map(item => ({
            productCode: item.productCode,
            productName: item.productName,
            hsnCode: item.hsnCode,
            quantity: item.quantity,
            rate: item.rate,
            uom: item.uom,
            discountPercent: item.discountPercent,
            discountAmount: item.discountAmount,
            taxPercent: Number(item.taxPercent) || 0,
            taxAmount: Number(item.taxAmount) || 0,
            beforeTaxAmount: Number(item.beforeTaxAmount) || 0,
            totalAmount: Number(item.totalAmount) || 0,
            printDescription: item.printDescription
          }))
        };

        await tx.purchaseOrderItem.deleteMany({ where: { purchaseOrderId: id } });
      }

      return tx.purchaseOrder.update({
        where: { id },
        data: data as any,
        include: { items: true },
      });
    });
  }

  async softDelete(id: number, userId: number) {
    const po = await this.findOne(id, userId);
    if (po.status === 'DELETED') return po;
    return this.prisma.purchaseOrder.update({
      where: { id },
      data: { status: 'DELETED' },
    });
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

  async printPurchaseOrder(id: number, userId: number) {
    const po = await this.prisma.purchaseOrder.findFirst({
      where: { id, userId },
      include: { items: true, user: { include: { shopDetail: true } } },
    });

    if (!po) throw new NotFoundException('PO not found');

    const business = po.user.shopDetail;
    const items = po.items;

    // Determine GST Breakdown (Simplified)
    // In a real scenario, compare business state and supplier state
    // For now, let's assume SGST/CGST split
    const isInterState = false; 
    const sgst = isInterState ? 0 : po.taxAmount / 2;
    const cgst = isInterState ? 0 : po.taxAmount / 2;
    const igst = isInterState ? po.taxAmount : 0;
    const amountInWords = this.numberToWords(po.totalAmount + po.taxAmount);

    return new Promise<any>((resolve) => {
      const doc = new PDFDocument({ margin: 20, size: 'A4' });
      const buffers: Buffer[] = [];
      doc.on('data', buffers.push.bind(buffers));
      doc.on('end', () => {
        resolve({
          buffer: Buffer.concat(buffers),
          filename: `PO_${po.poNumber}.pdf`,
          mimetype: 'application/pdf',
        });
      });

      // Layout Constants
      const pageWidth = 555;
      const startX = 20;
      let y = 20;

      // Draw Main Border
      doc.rect(startX, y, pageWidth, 780).stroke();

      // Header Row 1: Company Logo (Simplified) and Name
      doc.circle(startX + 30, y + 25, 20).fill('#05341f');
      doc.fillColor('#000000').fontSize(20).font('Helvetica-Bold').text(business?.shopName || 'COMPANY NAME', startX + 60, y + 20, { align: 'center', width: pageWidth - 120 });
      y += 50;

      // Header Row 2: Address
      doc.rect(startX, y, pageWidth, 25).stroke();
      doc.fontSize(10).font('Helvetica').text(`${business?.address || ''}, ${business?.district || ''}, ${business?.state || ''}`, startX, y + 7, { align: 'center', width: pageWidth });
      y += 25;

      // Header Row 3: Contact Info
      doc.rect(startX, y, pageWidth, 25).stroke();
      doc.fontSize(8).text(`Phone No.: +91 0000000000    Email: company@email.com    Website: company.com`, startX, y + 7, { align: 'center', width: pageWidth });
      y += 25;

      // Header Row 4: Title
      doc.rect(startX, y, pageWidth, 25).stroke();
      doc.fontSize(12).font('Helvetica-Bold').text('PURCHASE ORDER', startX, y + 7, { align: 'center', width: pageWidth });
      y += 25;

      // Header Row 5: GST/State
      doc.rect(startX, y, pageWidth, 25).stroke();
      doc.fontSize(8).font('Helvetica-Bold').text(`GSTIN : ${po.gstNumber || '-'}`, startX + 10, y + 8);
      doc.text(`State Code : 27 Maharashtra`, startX + 220, y + 8);
      y += 25;

      // Row 6 & 7: Supplier and PO Info
      const row6Height = 60;
      doc.rect(startX, y, pageWidth, row6Height).stroke();
      doc.moveTo(startX + 280, y).lineTo(startX + 280, y + row6Height).stroke();
      
      doc.fontSize(9).font('Helvetica-Bold').text('M/S.', startX + 10, y + 10);
      doc.text(po.supplierName, startX + 60, y + 10);
      doc.fontSize(8).font('Helvetica').text(po.address, startX + 10, y + 25, { width: 250 });

      doc.fontSize(9).font('Helvetica-Bold').text('PO No. :', startX + 290, y + 10);
      doc.font('Helvetica').text(po.poNumber, startX + 340, y + 10);
      doc.font('Helvetica-Bold').text('PO Creation Date :', startX + 420, y + 10);
      doc.font('Helvetica').text(new Date(po.poCreationDate).toLocaleDateString(), startX + 500, y + 10);

      doc.font('Helvetica-Bold').text('Pay. Terms :', startX + 290, y + 35);
      doc.font('Helvetica').text(`${po.creditDays} days`, startX + 345, y + 35);
      y += row6Height;

      doc.rect(startX, y, pageWidth, 25).stroke();
      doc.moveTo(startX + 280, y).lineTo(startX + 280, y + 25).stroke();
      doc.font('Helvetica-Bold').text('Supplier Code :', startX + 10, y + 8);
      doc.font('Helvetica').text('SP00001', startX + 80, y + 8);
      doc.font('Helvetica-Bold').text('Expiry Date :', startX + 290, y + 8);
      doc.font('Helvetica').text(new Date(po.expiryDate).toLocaleDateString(), startX + 350, y + 8);
      y += 25;

      // Items Table Header
      const colX = [startX, startX + 25, startX + 220, startX + 270, startX + 310, startX + 360, startX + 400, startX + 450, startX + 490];
      const colW = [25, 195, 50, 40, 50, 40, 50, 40, 65];
      const tableHeaders = ['Sn.', 'Description', 'HSN/SAC', 'Tax%', 'Quantity', 'Units', 'Rate', 'Dis%', 'Amount'];

      doc.rect(startX, y, pageWidth, 25).stroke();
      doc.fontSize(8).font('Helvetica-Bold');
      tableHeaders.forEach((h, i) => {
        doc.text(h, colX[i] + 5, y + 8);
        if (i > 0) doc.moveTo(colX[i], y).lineTo(colX[i], y + 25).stroke();
      });
      y += 25;

      // Table Rows
      doc.font('Helvetica').fontSize(8);
      items.forEach((item, idx) => {
        const rowHeight = 30; // Dynamic height could be handled here
        doc.rect(startX, y, pageWidth, rowHeight).stroke();
        doc.text(`${idx + 1}`, colX[0] + 5, y + 10);
        doc.text(item.productName, colX[1] + 5, y + 10);
        doc.text(item.hsnCode, colX[2] + 5, y + 10);
        doc.text(`${item.taxPercent}%`, colX[3] + 5, y + 10);
        doc.text(`${item.quantity}`, colX[4] + 5, y + 10);
        doc.text(item.uom, colX[5] + 5, y + 10);
        doc.text(`${item.rate}`, colX[6] + 5, y + 10);
        doc.text(`${item.discountPercent}%`, colX[7] + 5, y + 10);
        doc.text(`${item.totalAmount}`, colX[8] + 5, y + 10);

        // Vertical lines
        for (let j = 1; j < colX.length; j++) {
           doc.moveTo(colX[j], y).lineTo(colX[j], y + rowHeight).stroke();
        }
        y += rowHeight;
      });

      // Summary
      const summaryW = 85;
      const summaryLabelX = pageWidth + startX - summaryW - 65;
      const summaryValueX = pageWidth + startX - summaryW;

      const addSummaryRow = (label: string, value: string) => {
        doc.rect(startX, y, pageWidth, 25).stroke();
        doc.moveTo(summaryLabelX, y).lineTo(summaryLabelX, y + 25).stroke();
        doc.moveTo(summaryValueX, y).lineTo(summaryValueX, y + 25).stroke();
        doc.fontSize(8).font('Helvetica-Bold').text(label, summaryLabelX + 5, y + 8, { align: 'right', width: 60 });
        doc.font('Helvetica').text(value, summaryValueX + 5, y + 8);
        y += 25;
      };

      addSummaryRow('Sub Total', (po.totalAmount - po.taxAmount).toFixed(2));
      addSummaryRow('SGST', sgst.toFixed(2));
      addSummaryRow('CGST', cgst.toFixed(2));
      addSummaryRow('IGST', igst.toFixed(2));

      // Grand Total Row
      doc.rect(startX, y, pageWidth, 30).stroke();
      doc.moveTo(summaryLabelX, y).lineTo(summaryLabelX, y + 30).stroke();
      doc.moveTo(summaryValueX, y).lineTo(summaryValueX, y + 30).stroke();
      doc.fontSize(8).font('Helvetica-Bold').text('Amount In Words :', startX + 10, y + 10);
      doc.font('Helvetica').text(amountInWords, startX + 90, y + 10, { width: summaryLabelX - startX - 100 });
      
      doc.font('Helvetica-Bold').text('Total', summaryLabelX + 5, y + 10, { align: 'right', width: 60 });
      doc.fontSize(10).text(po.totalAmount.toFixed(2), summaryValueX + 5, y + 10);
      y += 30;

      // Footer
      y += 20;
      doc.fontSize(9).font('Helvetica-Bold').text(`For ${business?.shopName || 'COMPANY NAME'}`, startX, y, { align: 'right', width: pageWidth - 20 });
      y += 60;
      doc.fontSize(9).font('Helvetica-Bold').text('authorised Signatory', startX, y, { align: 'right', width: pageWidth - 20 });

      doc.end();
    });
  }

  async exportPurchaseOrders(userId: number, format: string, query: { filter?: any; search?: string }) {
    const orders = await this.findAll(query, userId);

    if (orders.length === 0) {
      throw new BadRequestException('No data available to export');
    }

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

    const formatDate = (date: Date) => {
      const d = new Date(date);
      return `${pad(d.getDate())}-${pad(d.getMonth() + 1)}-${d.getFullYear()}`;
    };

    const getDerivedStatus = (order: any) => {
      const status = order.status;
      const expDate = new Date(order.expiryDate);
      expDate.setHours(23, 59, 59, 999);
      const currentTime = new Date();

      if (status === 'INVOICE_COMPLETED') return 'COMPLETED';
      if (status === 'GRN_COMPLETED') return 'GRN COMPLETED';
      if (status === 'DELETED') return 'DELETED';
      if (expDate < currentTime) return 'EXPIRED';

      const diffHrs = (expDate.getTime() - currentTime.getTime()) / (1000 * 60 * 60);
      if (diffHrs > 0 && diffHrs <= 48) return 'EXPIRING SOON';

      return 'PENDING';
    };

    if (format === 'xlsx') {
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet('Purchase Orders');
      
      worksheet.columns = [
        { header: 'PO No', key: 'poNumber', width: 15 },
        { header: 'Supplier Name', key: 'supplierName', width: 30 },
        { header: 'Creation Date', key: 'poCreationDate', width: 18 },
        { header: 'Expiry Date', key: 'expiryDate', width: 18 },
        { header: 'GST Number', key: 'gstNumber', width: 22 },
        { header: 'Credit Days', key: 'creditDays', width: 12 },
        { header: 'Tax Amount', key: 'taxAmount', width: 15 },
        { header: 'Total Amount', key: 'totalAmount', width: 15 },
        { header: 'Status', key: 'derivedStatus', width: 18 },
      ];

      orders.forEach((order) => {
        worksheet.addRow({
          poNumber: order.poNumber,
          supplierName: order.supplierName,
          poCreationDate: formatDate(order.poCreationDate),
          expiryDate: formatDate(order.expiryDate),
          gstNumber: order.gstNumber || '-',
          creditDays: order.creditDays || 0,
          taxAmount: Number(order.taxAmount || 0).toFixed(2),
          totalAmount: Number(order.totalAmount || 0).toFixed(2),
          derivedStatus: getDerivedStatus(order),
        });
      });

      worksheet.spliceRows(1, 0, [], [], [], []);
      worksheet.mergeCells('A1:I1');
      const titleCell = worksheet.getCell('A1');
      titleCell.value = 'ERP';
      titleCell.font = { size: 18, bold: true };
      titleCell.alignment = { horizontal: 'center', vertical: 'middle' };

      worksheet.mergeCells('A2:I2');
      const subtitleCell = worksheet.getCell('A2');
      subtitleCell.value = 'Purchase Orders Report';
      subtitleCell.font = { size: 14 };
      subtitleCell.alignment = { horizontal: 'center', vertical: 'middle' };

      worksheet.mergeCells('A3:I3');
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
        filename: `purchase_orders_${Date.now()}.xlsx`,
        mimetype: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      };
    } else if (format === 'pdf') {
      return new Promise<any>((resolve) => {
        const doc = new PDFDocument({ margin: 20, size: 'A4', layout: 'landscape' });
        const buffers: Buffer[] = [];
        doc.on('data', buffers.push.bind(buffers));
        doc.on('end', () => resolve({ buffer: Buffer.concat(buffers), filename: `purchase_orders_${Date.now()}.pdf`, mimetype: 'application/pdf' }));

        doc.fontSize(18).font('Helvetica-Bold').text('ERP', { align: 'center' });
        doc.fontSize(14).font('Helvetica').text('Purchase Orders Report', { align: 'center' });
        doc.moveDown(0.5);
        doc.fontSize(10).text(`Exported on: ${timestamp}`, { align: 'right' });
        doc.moveDown();

        const tableTop = 100;
        const colX = [20, 100, 260, 340, 420, 520, 580, 660, 740];
        const headers = ['PO No', 'Supplier Name', 'Cr. Date', 'Exp. Date', 'GST Number', 'Cr. Days', 'Tax Amt', 'Total Amt', 'Status'];

        doc.rect(15, tableTop - 5, 785, 20).fill('#4472C4');
        doc.fontSize(8).font('Helvetica-Bold').fillColor('#FFFFFF');
        headers.forEach((h, i) => doc.text(h, colX[i], tableTop));

        let y = tableTop + 20;
        doc.fillColor('#000000').font('Helvetica');

        orders.forEach((order, index) => {
          if (y > 550) {
            doc.addPage({ margin: 20, size: 'A4', layout: 'landscape' });
            y = 40;
            doc.rect(15, y - 5, 785, 20).fill('#4472C4');
            doc.fontSize(8).font('Helvetica-Bold').fillColor('#FFFFFF');
            headers.forEach((h, i) => doc.text(h, colX[i], y));
            y += 20;
            doc.fillColor('#000000').font('Helvetica');
          }

          if (index % 2 === 1) {
            doc.rect(15, y - 3, 785, 15).fill('#F2F2F2').fillColor('#000000');
          }

          doc.fontSize(7);
          doc.text(order.poNumber, colX[0], y);
          doc.text(order.supplierName.substring(0, 30), colX[1], y, { width: 150 });
          doc.text(formatDate(order.poCreationDate), colX[2], y);
          doc.text(formatDate(order.expiryDate), colX[3], y);
          doc.text(order.gstNumber || '-', colX[4], y);
          doc.text((order.creditDays || 0).toString(), colX[5], y);
          doc.text(Number(order.taxAmount || 0).toFixed(2), colX[6], y);
          doc.text(Number(order.totalAmount || 0).toFixed(2), colX[7], y);
          doc.text(getDerivedStatus(order), colX[8], y);
          y += 20;
        });

        doc.end();
      });
    }

    throw new BadRequestException('Invalid format. Use xlsx or pdf.');
  }

  async importPurchaseOrders(buffer: Buffer, userId: number) {
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

    let imported = 0;
    let failed = 0;
    const errors: string[] = [];

    const colMap: Record<string, number> = {};
    let headerRowIndex = -1;

    // 1. Detect Headers
    for (let r = 1; r <= Math.min(rowCount, 10); r++) {
      const row = worksheet.getRow(r);
      let found = false;
      row.eachCell((cell, colNumber) => {
        const val = String(cell.value || '').trim().toLowerCase();
        if (val.includes('supplier name')) { colMap['supplierName'] = colNumber; found = true; }
        if (val.includes('credit days')) colMap['creditDays'] = colNumber;
        if (val.includes('expiry date')) colMap['expiryDate'] = colNumber;
        if (val.includes('product code')) colMap['productCode'] = colNumber;
        if (val.includes('quantity')) colMap['quantity'] = colNumber;
        if (val.includes('rate')) colMap['rate'] = colNumber;
        if (val.includes('discount %')) colMap['discountPercent'] = colNumber;
        if (val.includes('discount amount') || val.includes('dis amt')) colMap['discountAmount'] = colNumber;
        if (val.includes('tax')) colMap['taxPercent'] = colNumber;
        if (val.includes('print description') || val.includes('info')) colMap['printDescription'] = colNumber;
      });
      if (found) {
        headerRowIndex = r;
        break;
      }
    }

    if (headerRowIndex === -1) {
      throw new BadRequestException('Could not find mandatory columns. Please use the provided template.');
    }

    const getVal = (row: ExcelJS.Row, key: string) => {
      const colIdx = colMap[key];
      return colIdx ? row.getCell(colIdx).value : null;
    };

    // 2. Process Rows
    for (let i = headerRowIndex + 1; i <= rowCount; i++) {
      const row = worksheet.getRow(i);
      const supplierName = String(getVal(row, 'supplierName') || '').trim();
      if (!supplierName || supplierName === '-') continue;

      try {
        // Find or Auto-Create Supplier
        let supplier = await this.prisma.accountMaster.findFirst({
          where: { accountName: { equals: supplierName, mode: 'insensitive' }, userId }
        });
        
        if (!supplier) {
          // Auto-create basic supplier if missing
          supplier = await this.prisma.accountMaster.create({
            data: {
              accountName: supplierName,
              groupName: ["Sundry Creditors"],
              panNo: "AUTOIMPORT", // Placeholder
              addressLine1: "Direct Import",
              pincode: "000000",
              state: "Maharashtra", // Default state
              prefix: "Mr",
              contactPersonName: supplierName,
              mobileNo: "0000000000",
              userId
            }
          });
        }

        // Find or Auto-Create Product
        const productCode = String(getVal(row, 'productCode') || '').trim();
        const productName = String(getVal(row, 'productName') || productCode).trim();
        let product = await this.prisma.product.findFirst({
          where: { product_code: { equals: productCode, mode: 'insensitive' }, created_by: userId }
        });

        if (!product) {
          // Get first available defaults for mandatory master refs
          const firstUom = await this.prisma.unitMaster.findFirst();
          const firstCat = await this.prisma.category.findFirst();
          const firstSub = await this.prisma.subCategory.findFirst();

          product = await this.prisma.product.create({
            data: {
              product_name: productName,
              product_code: productCode,
              uom_id: firstUom?.id || 1,
              category_id: firstCat?.id || 1,
              sub_category_id: firstSub?.id || 1,
              product_type: "GOODS",
              hsn_code: "0000",
              tax_rate: parseFloat(String(getVal(row, 'taxPercent') || 0)),
              created_by: userId
            }
          });
        }

        // Prepare PO Data
        const expiryVal = getVal(row, 'expiryDate');
        let finalExpiry: Date;
        if (expiryVal instanceof Date) {
          finalExpiry = expiryVal;
        } else if (typeof expiryVal === 'string' || typeof expiryVal === 'number') {
          finalExpiry = new Date(expiryVal);
        } else {
          finalExpiry = new Date();
        }

        const dto: CreatePurchaseOrderDto = {
          supplierId: supplier.id,
          creditDays: parseInt(String(getVal(row, 'creditDays') || supplier.supplierCreditDays || 0), 10),
          expiryDate: finalExpiry.toISOString().split('T')[0],
          items: [{
            productCode: product.product_code,
            productName: product.product_name,
            hsnCode: product.hsn_code,
            quantity: parseFloat(String(getVal(row, 'quantity') || 0)),
            rate: parseFloat(String(getVal(row, 'rate') || 0)),
            uom: product.uom_id ? (await this.prisma.unitMaster.findUnique({ where: { id: product.uom_id } }))?.unit_name || 'NOS' : 'NOS',
            discountPercent: parseFloat(String(getVal(row, 'discountPercent') || 0)),
            discountAmount: parseFloat(String(getVal(row, 'discountAmount') || 0)),
            taxPercent: parseFloat(String(getVal(row, 'taxPercent') || product.tax_rate || 0)),
            printDescription: String(getVal(row, 'printDescription') || '')
          }]
        };

        // Basic validation
        if (isNaN(new Date(dto.expiryDate).getTime())) throw new Error('Invalid Expiry Date');
        if (dto.items[0].quantity <= 0) throw new Error('Quantity must be greater than 0');

        await this.create(dto, userId);
        imported++;
      } catch (err) {
        failed++;
        errors.push(`Row ${i}: ${err.message}`);
      }
    }

    if (imported === 0 && failed > 0) throw new BadRequestException(`Import failed: ${errors[0]}`);

    return {
      success: true,
      message: `Imported ${imported} Purchase Orders. ${failed > 0 ? failed + ' rows failed.' : ''}`,
      errors: failed > 0 ? errors : undefined,
    };
  }

  async downloadSample() {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Purchase Order Sample');

    const headers = [
      'Supplier Name*', 'Credit Days', 'Expiry Date (YYYY-MM-DD)*', 'Product Code*', 'Quantity*', 'Rate*', 'Discount %', 'Discount Amount', 'Tax %', 'Print Description'
    ];
    worksheet.addRow(headers);
    
    // Removed sample rows as requested

    const headerRow = worksheet.getRow(1);
    headerRow.font = { bold: true };
    headerRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFD3D3D3' }
    };

    worksheet.columns = headers.map(() => ({ width: 22 }));

    const buffer = await workbook.xlsx.writeBuffer();
    return {
      buffer: Buffer.from(buffer),
      filename: 'purchase_order_sample.xlsx',
      mimetype: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    };
  }
}
