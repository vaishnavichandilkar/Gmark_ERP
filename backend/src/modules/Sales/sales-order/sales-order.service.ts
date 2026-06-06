// Trigger restart 2
import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/prisma/prisma.service';
import { CreateSalesOrderDto, UpdateSalesOrderDto } from './dto/sales-order.dto';
import { Prisma } from '@prisma/client';
import * as ExcelJS from 'exceljs';
import * as PDFDocument from 'pdfkit';

@Injectable()
export class SalesOrderService {
    constructor(private prisma: PrismaService) { }

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

    async generateSONumber(userId: number, tx?: any): Promise<string> {
        const prisma = tx || this.prisma;
        const lastSO = await prisma.salesOrder.findFirst({
            where: { userId },
            orderBy: { id: 'desc' },
            select: { soNumber: true },
        });

        if (!lastSO || !lastSO.soNumber.startsWith('SO-')) {
            return 'SO-00001';
        }

        const lastNumberStr = lastSO.soNumber.split('-')[1];
        const lastNumber = parseInt(lastNumberStr, 10);

        if (isNaN(lastNumber)) {
            return 'SO-00001';
        }

        return `SO-${(lastNumber + 1).toString().padStart(5, '0')}`;
    }

    async getNextNumber(userId: number) {
        const soNumber = await this.generateSONumber(userId);
        return { soNumber };
    }

    async getCustomers(userId: number) {
        const customers = await this.prisma.accountMaster.findMany({
            where: {
                userId, // Filter by user if account master is also user-specific
                customerCode: {
                    not: null,
                },
                customerStatus: 'ACTIVE',
            },
        });

        return customers.map(customer => ({
            id: customer.id,
            customerName: customer.accountName,
            customerType: customer.customerType,
            address: customer.addressLine1 + (customer.addressLine2 ? ', ' + customer.addressLine2 : ''),
            gstNumber: customer.gstNo,
            panNumber: customer.panNo,
            creditDays: customer.customerCreditDays || 0,
            msmeEnabled: customer.msmeEnabled,
            regType: customer.regType,
        }));
    }

    private async _getCustomerDetails(customerId: number) {
        const customer = await this.prisma.accountMaster.findUnique({
            where: { id: customerId },
        });

        if (!customer) {
            throw new NotFoundException('Customer not found');
        }

        return {
            customerName: customer.accountName,
            customerType: customer.customerType,
            address: customer.addressLine1 + (customer.addressLine2 ? ', ' + customer.addressLine2 : ''),
            gstNumber: customer.gstNo,
            panNumber: customer.panNo,
            creditDays: customer.customerCreditDays || 0,
            msmeEnabled: customer.msmeEnabled,
            regType: customer.regType,
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

    async create(createDto: CreateSalesOrderDto, userId: number, uploadedFilePath?: string) {
        const fullCustomer = await this.prisma.accountMaster.findUnique({
            where: { id: createDto.customerId }
        });
        if (!fullCustomer) {
            throw new BadRequestException('Customer not found');
        }
        if (fullCustomer.status !== 'ACTIVE' || fullCustomer.customerStatus !== 'ACTIVE') {
            throw new BadRequestException('Customer is inactive. New sales transactions are not allowed.');
        }

        const sellerMsme = await this.isSellerMsme(userId);
        const customerMsmeActive = fullCustomer.msmeEnabled;
        const customerMsmeType = fullCustomer.regType === 'Manufacturing' || fullCustomer.regType === 'Service';
        const isCustomerMsme = Boolean(customerMsmeActive && customerMsmeType);

        if ((sellerMsme || isCustomerMsme) && createDto.creditDays > 45) {
            throw new BadRequestException('Maximum credit period allowed under MSME rules is 45 days.');
        }

        const customer = await this._getCustomerDetails(createDto.customerId);
        
        const userGstDoc = await this.prisma.sellerDocument.findFirst({
            where: { uploadedByUserId: userId, type: 'GST' },
            select: { name: true }
        });
        const isValidGst = (name?: string | null) => Boolean(
            name && 
            name.trim().toUpperCase() !== 'N/A' && 
            name.trim().toUpperCase() !== 'NOT AVAILABLE' && 
            name.trim().toUpperCase() !== '-' && 
            name.trim().length >= 10
        );
        const isGstApplicable = isValidGst(userGstDoc?.name);

        const processedItems = createDto.items.map(item => this.calculateItemValues(item, isGstApplicable));

        const totalAmount = processedItems.reduce((sum, item) => sum + (item.quantity * item.rate) - item.discountAmount, 0);
        const totalTaxAmount = processedItems.reduce((sum, item) => sum + item.taxAmount, 0);
        const grandTotal = processedItems.reduce((sum, item) => sum + item.totalAmount, 0);

        try {
            return await this.prisma.$transaction(async (tx) => {
                const finalSoNumber = await this.generateSONumber(userId, tx);

                return tx.salesOrder.create({
                    data: {
                        soNumber: finalSoNumber,
                        customerName: customer.customerName,
                        customerType: (customer.customerType as any) || 'retailer',
                        address: createDto.address || customer.address,
                        creditDays: createDto.creditDays,
                        soCreationDate: new Date(),
                        expiryDate: new Date(createDto.expiryDate),
                        customerPoNumber: createDto.customerPoNumber || null,
                        poDate: createDto.poDate ? new Date(createDto.poDate) : null,
                        poExpiryDate: createDto.poExpiryDate ? new Date(createDto.poExpiryDate) : null,
                        customerAmt: createDto.customerAmt !== undefined && createDto.customerAmt !== null ? Number(createDto.customerAmt) : null,
                        customerPoFile: uploadedFilePath || null,
                        gstNumber: customer.gstNumber || createDto.gstNo || '',
                        panNumber: customer.panNumber || createDto.panNo || '',
                        totalAmount,
                        taxAmount: totalTaxAmount,
                        grandTotal,
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
                                taxPercent: item.taxPercent,
                                taxAmount: item.taxAmount,
                                totalAmount: item.totalAmount,
                                printDescription: item.printDescription,
                            })),
                        },
                    },
                    include: { items: true },
                });
            });
        } catch (e) {
            const fs = require('fs');
            fs.appendFileSync('D:\\USERS\\vaishnavi\\Desktop\\weighting_scale\\backend\\service_error.log', `[${new Date().toISOString()}] SO CREATE ERROR: ${e.message}\n${e.stack}\n\n`);
            throw e;
        }
    }

    async findAll(userId: number, query: { filter?: 'all' | 'pending' | 'expiring' | 'expired' | 'completed' | 'deleted', search?: string }) {
        const startOfToday = new Date();
        startOfToday.setHours(0, 0, 0, 0);
        const fortyEightHoursLater = new Date(startOfToday.getTime() + 48 * 60 * 60 * 1000);
        fortyEightHoursLater.setHours(23, 59, 59, 999);

        const where: Prisma.SalesOrderWhereInput = { userId };

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
                break;
        }

        if (query.search) {
            where.OR = [
                { soNumber: { contains: query.search, mode: 'insensitive' } },
                { customerName: { contains: query.search, mode: 'insensitive' } },
            ];
        }

        return this.prisma.salesOrder.findMany({
            where,
            include: {
                items: true,
                salesChallans: {
                    where: { status: { not: 'DELETED' } },
                    select: { id: true }
                },
                salesInvoices: {
                    where: { status: { not: 'DELETED' } },
                    select: { id: true }
                }
            },
            orderBy: { createdAt: 'desc' },
        });
    }

    async findOne(id: number, userId: number) {
        const so = await this.prisma.salesOrder.findFirst({
            where: { id, userId },
            include: {
                items: true,
                salesChallans: {
                    where: { status: { not: 'DELETED' } },
                    select: { id: true }
                },
                salesInvoices: {
                    where: { status: { not: 'DELETED' } },
                    select: { id: true }
                }
            },
        });

        if (!so) throw new NotFoundException(`SO ID ${id} not found`);
        return so;
    }

    async update(id: number, updateDto: UpdateSalesOrderDto, userId: number, uploadedFilePath?: string, removeAttachment: boolean = false) {
        const so = await this.findOne(id, userId);
        if (so.status === 'INVOICE_COMPLETED' || so.status === 'DELETED') {
            throw new ForbiddenException(`Update forbidden in status ${so.status}`);
        }

        // Check if SO is linked to any Sales Challan or Sales Invoice
        const linkedChallans = await this.prisma.salesChallan.count({ 
            where: { soId: id, status: { not: 'DELETED' } } 
        });
        const linkedInvoices = await this.prisma.salesInvoice.count({ 
            where: { soId: id, status: { not: 'DELETED' } } 
        });

        if (linkedChallans > 0 || linkedInvoices > 0) {
            throw new ForbiddenException(`Sales Order cannot be edited because it is linked to a Challan or Sales Invoice.`);
        }

        const sellerMsme = await this.isSellerMsme(userId);
        const customerId = updateDto.customerId;
        let customer;
        if (customerId) {
            customer = await this.prisma.accountMaster.findUnique({ where: { id: customerId } });
        } else {
            customer = await this.prisma.accountMaster.findFirst({
                where: { accountName: so.customerName, userId }
            });
        }

        if (customer) {
            const customerMsmeActive = customer.msmeEnabled;
            const customerMsmeType = customer.regType === 'Manufacturing' || customer.regType === 'Service';
            const isCustomerMsme = Boolean(customerMsmeActive && customerMsmeType);

            const creditDays = updateDto.creditDays !== undefined ? updateDto.creditDays : so.creditDays;
            if ((sellerMsme || isCustomerMsme) && creditDays > 45) {
                throw new BadRequestException('Maximum credit period allowed under MSME rules is 45 days.');
            }
        }

        return this.prisma.$transaction(async (tx) => {
            const data: any = {
                creditDays: updateDto.creditDays ?? so.creditDays,
                expiryDate: updateDto.expiryDate ? new Date(updateDto.expiryDate) : so.expiryDate,
                customerPoNumber: updateDto.customerPoNumber !== undefined ? updateDto.customerPoNumber : so.customerPoNumber,
                poDate: updateDto.poDate !== undefined ? (updateDto.poDate ? new Date(updateDto.poDate) : null) : so.poDate,
                poExpiryDate: updateDto.poExpiryDate !== undefined ? (updateDto.poExpiryDate ? new Date(updateDto.poExpiryDate) : null) : so.poExpiryDate,
                customerAmt: updateDto.customerAmt !== undefined ? (updateDto.customerAmt !== null ? Number(updateDto.customerAmt) : null) : so.customerAmt,
                customerPoFile: removeAttachment ? null : (uploadedFilePath ?? so.customerPoFile),
                status: updateDto.status ?? (so.status as any),
                address: updateDto.address ?? so.address,
                gstNumber: updateDto.gstNo ?? so.gstNumber,
                panNumber: updateDto.panNo ?? so.panNumber,
                soNumber: updateDto.soNumber ?? so.soNumber,
                soCreationDate: so.soCreationDate,
                customerType: updateDto.customerType ?? so.customerType,
            };

            if (updateDto.customerId) {
                const customer = await tx.accountMaster.findUnique({ where: { id: updateDto.customerId } });
                if (customer) {
                    data.customerName = customer.accountName;
                    data.customerType = customer.customerType;
                    if (!updateDto.address) data.address = customer.addressLine1;
                    if (!updateDto.gstNo) data.gstNumber = customer.gstNo;
                    if (!updateDto.panNo) data.panNumber = customer.panNo;
                }
            }

            if (updateDto.items) {
                const userGstDoc = await tx.sellerDocument.findFirst({
                    where: { uploadedByUserId: userId, type: 'GST' },
                    select: { name: true }
                });
                const isValidGst = (name?: string | null) => Boolean(
                    name && 
                    name.trim().toUpperCase() !== 'N/A' && 
                    name.trim().toUpperCase() !== 'NOT AVAILABLE' && 
                    name.trim().toUpperCase() !== '-' && 
                    name.trim().length >= 10
                );
                const isGstApplicable = isValidGst(userGstDoc?.name);

                const processedItems = updateDto.items.map(item => this.calculateItemValues(item, isGstApplicable));
                data.totalAmount = processedItems.reduce((sum, item) => sum + (item.quantity * item.rate) - item.discountAmount, 0);
                data.taxAmount = processedItems.reduce((sum, item) => sum + item.taxAmount, 0);
                data.grandTotal = processedItems.reduce((sum, item) => sum + item.totalAmount, 0);

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
                        taxPercent: item.taxPercent,
                        taxAmount: item.taxAmount,
                        totalAmount: item.totalAmount,
                        printDescription: item.printDescription
                    }))
                };

                await tx.salesOrderItem.deleteMany({ where: { salesOrderId: id } });
            }

            return tx.salesOrder.update({
                where: { id },
                data,
                include: { items: true },
            });
        });
    }

    async softDelete(id: number, userId: number) {
        const so = await this.findOne(id, userId);
        if (so.status === 'DELETED') return so;

        // Check if SO is linked to any Sales Challan or Sales Invoice
        const linkedChallans = await this.prisma.salesChallan.count({ 
            where: { soId: id, status: { not: 'DELETED' } } 
        });
        const linkedInvoices = await this.prisma.salesInvoice.count({ 
            where: { soId: id, status: { not: 'DELETED' } } 
        });

        if (linkedChallans > 0 || linkedInvoices > 0) {
            throw new ForbiddenException(`Sales Order cannot be deleted because it is linked to a Challan or Sales Invoice.`);
        }

        return this.prisma.salesOrder.update({
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

    async printSalesOrder(id: number, userId: number) {
        const so = await this.prisma.salesOrder.findUnique({
            where: { id },
            include: { items: true, user: { include: { shopDetail: true } } },
        });

        if (!so) throw new NotFoundException('SO not found');

        const business = so.user.shopDetail;
        const items = so.items;

        const isInterState = false;
        const sgst = isInterState ? 0 : so.taxAmount / 2;
        const cgst = isInterState ? 0 : so.taxAmount / 2;
        const igst = isInterState ? so.taxAmount : 0;
        const amountInWords = this.numberToWords(so.grandTotal);

        return new Promise<any>((resolve) => {
            const doc = new PDFDocument({ margin: 20, size: 'A4' });
            const buffers: Buffer[] = [];
            doc.on('data', buffers.push.bind(buffers));
            doc.on('end', () => {
                resolve({
                    buffer: Buffer.concat(buffers),
                    filename: `SO_${so.soNumber}.pdf`,
                    mimetype: 'application/pdf',
                });
            });

            const pageWidth = 555;
            const startX = 20;
            let y = 20;

            doc.rect(startX, y, pageWidth, 780).stroke();

            doc.circle(startX + 30, y + 25, 20).fill('#05341f');
            doc.fillColor('#000000').fontSize(20).font('Helvetica-Bold').text(business?.shopName || 'COMPANY NAME', startX + 60, y + 20, { align: 'center', width: pageWidth - 120 });
            y += 50;

            doc.rect(startX, y, pageWidth, 25).stroke();
            doc.fontSize(10).font('Helvetica').text(`${business?.address || ''}, ${business?.district || ''}, ${business?.state || ''}`, startX, y + 7, { align: 'center', width: pageWidth });
            y += 25;

            doc.rect(startX, y, pageWidth, 25).stroke();
            doc.fontSize(8).text(`Phone No.: +91 0000000000    Email: company@email.com    Website: company.com`, startX, y + 7, { align: 'center', width: pageWidth });
            y += 25;

            doc.rect(startX, y, pageWidth, 25).stroke();
            doc.fontSize(12).font('Helvetica-Bold').text('SALES ORDER', startX, y + 7, { align: 'center', width: pageWidth });
            y += 25;

            doc.rect(startX, y, pageWidth, 25).stroke();
            doc.fontSize(8).font('Helvetica-Bold').text(`GSTIN : ${so.gstNumber || '-'}`, startX + 10, y + 8);
            doc.text(`State Code : 27 Maharashtra`, startX + 220, y + 8);
            doc.text(`PAN No : ${so.panNumber || '-'}`, startX + 430, y + 8);
            y += 25;

            const row6Height = 60;
            doc.rect(startX, y, pageWidth, row6Height).stroke();
            doc.moveTo(startX + 280, y).lineTo(startX + 280, y + row6Height).stroke();

            doc.fontSize(9).font('Helvetica-Bold').text('M/S.', startX + 10, y + 10);
            doc.text(so.customerName, startX + 60, y + 10);
            doc.fontSize(8).font('Helvetica').text(so.address, startX + 10, y + 25, { width: 250 });

            doc.fontSize(9).font('Helvetica-Bold').text('SO No. :', startX + 290, y + 10);
            doc.font('Helvetica').text(so.soNumber, startX + 340, y + 10);
            doc.font('Helvetica-Bold').text('SO Creation Date :', startX + 420, y + 10);
            doc.font('Helvetica').text(new Date(so.soCreationDate).toLocaleDateString(), startX + 500, y + 10);

            doc.font('Helvetica-Bold').text('Pay. Terms :', startX + 290, y + 35);
            doc.font('Helvetica').text(`${so.creditDays} days`, startX + 345, y + 35);
            y += row6Height;

            doc.rect(startX, y, pageWidth, 25).stroke();
            doc.moveTo(startX + 280, y).lineTo(startX + 280, y + 25).stroke();
            doc.font('Helvetica-Bold').text('Customer Code :', startX + 10, y + 8);
            doc.font('Helvetica').text('CU00001', startX + 80, y + 8);
            doc.font('Helvetica-Bold').text('Expiry Date :', startX + 290, y + 8);
            doc.font('Helvetica').text(new Date(so.expiryDate).toLocaleDateString(), startX + 350, y + 8);
            y += 25;

            const colX = [startX, startX + 25, startX + 220, startX + 270, startX + 310, startX + 360, startX + 400, startX + 450, startX + 490];
            const tableHeaders = ['Sn.', 'Description', 'HSN/SAC', 'Tax%', 'Quantity', 'Units', 'Rate', 'Dis%', 'Amount'];

            doc.rect(startX, y, pageWidth, 25).stroke();
            doc.fontSize(8).font('Helvetica-Bold');
            tableHeaders.forEach((h, i) => {
                doc.text(h, colX[i] + 5, y + 8);
                if (i > 0) doc.moveTo(colX[i], y).lineTo(colX[i], y + 25).stroke();
            });
            y += 25;

            doc.font('Helvetica').fontSize(8);
            items.forEach((item, idx) => {
                const rowHeight = 30;
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

                for (let j = 1; j < colX.length; j++) {
                    doc.moveTo(colX[j], y).lineTo(colX[j], y + rowHeight).stroke();
                }
                y += rowHeight;
            });

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

            addSummaryRow('Sub Total', so.totalAmount.toFixed(2));
            addSummaryRow('SGST', sgst.toFixed(2));
            addSummaryRow('CGST', cgst.toFixed(2));
            addSummaryRow('IGST', igst.toFixed(2));

            doc.rect(startX, y, pageWidth, 30).stroke();
            doc.moveTo(summaryLabelX, y).lineTo(summaryLabelX, y + 30).stroke();
            doc.moveTo(summaryValueX, y).lineTo(summaryValueX, y + 30).stroke();
            doc.fontSize(8).font('Helvetica-Bold').text('Amount In Words :', startX + 10, y + 10);
            doc.font('Helvetica').text(amountInWords, startX + 90, y + 10, { width: summaryLabelX - startX - 100 });

            doc.font('Helvetica-Bold').text('Total', summaryLabelX + 5, y + 10, { align: 'right', width: 60 });
            doc.fontSize(10).text(so.grandTotal.toFixed(2), summaryValueX + 5, y + 10);
            y += 30;

            y += 20;
            doc.fontSize(9).font('Helvetica-Bold').text(`For ${business?.shopName || 'COMPANY NAME'}`, startX, y, { align: 'right', width: pageWidth - 20 });
            y += 60;
            doc.fontSize(9).font('Helvetica-Bold').text('authorised Signatory', startX, y, { align: 'right', width: pageWidth - 20 });

            doc.end();
        });
    }

    async exportSalesOrders(userId: number, format: string, query: { filter?: any; search?: string }) {
        const orders = await this.findAll(userId, query);

        if (orders.length === 0) {
            throw new BadRequestException('No data available to export');
        }

        const now = new Date();
        const pad = (n: number) => n.toString().padStart(2, '0');
        const timestamp = `${pad(now.getDate())}-${pad(now.getMonth() + 1)}-${now.getFullYear()} ${pad(now.getHours())}:${pad(now.getMinutes())}`;

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
            if (status === 'DELETED') return 'DELETED';
            if (expDate < currentTime) return 'EXPIRED';

            const diffHrs = (expDate.getTime() - currentTime.getTime()) / (1000 * 60 * 60);
            if (diffHrs > 0 && diffHrs <= 48) return 'EXPIRING SOON';

            return 'PENDING';
        };

        if (format === 'xlsx') {
            const workbook = new ExcelJS.Workbook();
            const worksheet = workbook.addWorksheet('Sales Orders');
            worksheet.views = [{ state: 'frozen', ySplit: 4 }];

            worksheet.columns = [
                { header: 'SO No', key: 'soNumber', width: 15 },
                { header: 'Customer Name', key: 'customerName', width: 30 },
                { header: 'Creation Date', key: 'soCreationDate', width: 18 },
                { header: 'Expiry Date', key: 'expiryDate', width: 18 },
                { header: 'Amount', key: 'totalAmount', width: 15 },
                { header: 'GST Number', key: 'gstNumber', width: 22 },
                { header: 'Credit Days', key: 'creditDays', width: 12 },
                { header: 'Tax Amount', key: 'taxAmount', width: 15 },
                { header: 'Total Amount', key: 'grandTotal', width: 15 },
                { header: 'Status', key: 'derivedStatus', width: 18 },
            ];

            orders.forEach((order) => {
                worksheet.addRow({
                    soNumber: order.soNumber,
                    customerName: order.customerName,
                    soCreationDate: formatDate(order.soCreationDate),
                    expiryDate: formatDate(order.expiryDate),
                    totalAmount: Number(order.totalAmount || 0).toFixed(2),
                    gstNumber: order.gstNumber || '-',
                    creditDays: order.creditDays || 0,
                    taxAmount: Number(order.taxAmount || 0).toFixed(2),
                    grandTotal: Number(order.grandTotal || 0).toFixed(2),
                    derivedStatus: getDerivedStatus(order),
                });
            });

            worksheet.spliceRows(1, 0,
                ['Sales Orders Report'],
                [`Exported on: ${timestamp}`],
                []
            );

            worksheet.mergeCells('A1:J1');
            const titleCell = worksheet.getCell('A1');
            titleCell.font = { size: 16, bold: true, color: { argb: 'FF073318' } };
            titleCell.alignment = { horizontal: 'center', vertical: 'middle' };

            worksheet.mergeCells('A2:J2');
            const timeCell = worksheet.getCell('A2');
            timeCell.font = { size: 10, italic: true, color: { argb: 'FF666666' } };
            timeCell.alignment = { horizontal: 'center', vertical: 'middle' };

            const headerRow = worksheet.getRow(4);
            headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
            headerRow.fill = {
                type: 'pattern',
                pattern: 'solid',
                fgColor: { argb: 'FF073318' },
            };
            headerRow.alignment = { horizontal: 'center', vertical: 'middle' };

            worksheet.eachRow((row, rowNumber) => {
                if (rowNumber >= 4) {
                    row.eachCell((cell) => {
                        cell.border = {
                            top: { style: 'thin' },
                            left: { style: 'thin' },
                            bottom: { style: 'thin' },
                            right: { style: 'thin' },
                        };
                        if (rowNumber > 4) {
                            cell.alignment = { horizontal: 'left', vertical: 'middle' };
                        }
                    });
                }
            });

            const buffer = await workbook.xlsx.writeBuffer();
            return {
                buffer: Buffer.from(buffer),
                filename: `sales_orders_${Date.now()}.xlsx`,
                mimetype: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            };
        }

        if (format === 'pdf') {
            return new Promise<any>((resolve) => {
                const doc = new PDFDocument({ margin: 20, size: 'A4', layout: 'landscape' });
                const buffers: Buffer[] = [];
                doc.on('data', buffers.push.bind(buffers));
                doc.on('end', () => {
                    resolve({
                        buffer: Buffer.concat(buffers),
                        filename: `sales_orders_${Date.now()}.pdf`,
                        mimetype: 'application/pdf',
                    });
                });

                doc.fillColor('#073318').fontSize(20).font('Helvetica-Bold').text('Sales Orders Report', { align: 'center' });
                doc.moveDown(0.5);
                doc.fillColor('#666666').fontSize(10).font('Helvetica').text(`Exported on: ${timestamp}`, { align: 'right' });
                doc.moveDown();

                const tableTop = 80;
                const colX = [20, 80, 220, 290, 360, 420, 520, 580, 650, 720];
                const colW = [60, 140, 70, 70, 60, 100, 60, 70, 70, 70];
                const headers = ['SO No', 'Customer Name', 'Cr. Date', 'Exp. Date', 'Amount', 'GST Number', 'Cr. Days', 'Tax Amt', 'Total Amt', 'Status'];

                doc.rect(20, tableTop - 5, 780, 25).fill('#073318');

                doc.fillColor('#FFFFFF').fontSize(9).font('Helvetica-Bold');
                headers.forEach((h, i) => {
                    doc.text(h, colX[i] + 2, tableTop + 5, { width: colW[i], align: 'left' });
                });

                doc.fillColor('#000000').font('Helvetica').fontSize(8);
                let y = tableTop + 25;

                orders.forEach((order, index) => {
                    if (y > 520) {
                        doc.addPage({ layout: 'landscape', margin: 20 });
                        y = 40;
                        doc.rect(20, y - 5, 780, 25).fill('#073318');
                        doc.fillColor('#FFFFFF').fontSize(9).font('Helvetica-Bold');
                        headers.forEach((h, i) => doc.text(h, colX[i] + 2, y + 5));
                        doc.fillColor('#000000').font('Helvetica').fontSize(8);
                        y += 25;
                    }

                    if (index % 2 === 1) {
                        doc.save().fillColor('#F9FAFB').rect(20, y - 2, 780, 18).fill().restore();
                    }

                    doc.text(order.soNumber, colX[0] + 2, y + 2);
                    doc.text(order.customerName.substring(0, 30), colX[1] + 2, y + 2);
                    doc.text(formatDate(order.soCreationDate), colX[2] + 2, y + 2);
                    doc.text(formatDate(order.expiryDate), colX[3] + 2, y + 2);
                    doc.text(Number(order.totalAmount || 0).toFixed(2), colX[4] + 2, y + 2);
                    doc.text(order.gstNumber || '-', colX[5] + 2, y + 2);
                    doc.text((order.creditDays || 0).toString(), colX[6] + 2, y + 2);
                    doc.text(Number(order.taxAmount || 0).toFixed(2), colX[7] + 2, y + 2);
                    doc.text(Number(order.grandTotal || 0).toFixed(2), colX[8] + 2, y + 2);

                    const status = getDerivedStatus(order);
                    if (status === 'EXPIRED' || status === 'DELETED') doc.fillColor('#DC2626');
                    else if (status === 'COMPLETED') doc.fillColor('#059669');
                    else if (status === 'EXPIRING SOON') doc.fillColor('#D97706');
                    else doc.fillColor('#EA580C');

                    doc.font('Helvetica-Bold').text(status, colX[9] + 2, y + 2);
                    doc.fillColor('#000000').font('Helvetica');

                    doc.moveTo(20, y + 15).lineTo(800, y + 15).strokeColor('#F3F4F6').lineWidth(0.5).stroke();

                    y += 18;
                });

                doc.end();
            });
        }

        throw new BadRequestException('Invalid format. Use xlsx or pdf.');
    }

    async importSalesOrders(buffer: Buffer, userId: number) {
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
                if (val.includes('customer name')) { colMap['customerName'] = colNumber; found = true; }
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
            throw new BadRequestException('Could not find mandatory columns.');
        }

        // Logic for rows would continue here (similar to purchase-order)
        return { message: 'Import logic placeholder' };
    }
}
