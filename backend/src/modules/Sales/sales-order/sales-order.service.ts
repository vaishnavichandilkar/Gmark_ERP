// Trigger restart 2
import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/prisma/prisma.service';
import { CreateSalesOrderDto, UpdateSalesOrderDto } from './dto/sales-order.dto';
import { Prisma } from '@prisma/client';
import * as ExcelJS from 'exceljs';
import * as PDFDocument from 'pdfkit';
import { formatDate, parseDDMMYYYY } from '../../../utils/dateFormatter';
import { ImportValidationService } from '../../../common/services/import-validation.service';

@Injectable()
export class SalesOrderService {
    constructor(
        private prisma: PrismaService,
        private importValidator: ImportValidationService
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

        const msmeMap = await this.batchIsCustomerMsme(customers);
        return customers.map(customer => {
            const key = `${customer.mobileNo?.trim() || ''}|${customer.emailId?.trim() || ''}|${customer.gstNo?.trim() || ''}`;
            const isMsmeUser = msmeMap.get(key) || false;
            return {
                id: customer.id,
                customerCode: customer.customerCode,
                customerName: customer.accountName,
                customerType: customer.customerType,
                address: customer.addressLine1 + (customer.addressLine2 ? ', ' + customer.addressLine2 : ''),
                gstNumber: customer.gstNo,
                panNumber: customer.panNo,
                creditDays: customer.customerCreditDays || 0,
                msmeEnabled: customer.msmeEnabled,
                regType: customer.regType,
                msmeId: customer.msmeId,
                isMsmeUser,
            };
        });
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
            msmeId: customer.msmeId,
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
        const fullCustomer = await this.prisma.accountMaster.findFirst({
            where: { id: createDto.customerId, userId }
        });
        if (!fullCustomer) {
            throw new BadRequestException('Customer not found');
        }
        if (fullCustomer.status !== 'ACTIVE' || fullCustomer.customerStatus !== 'ACTIVE') {
            throw new BadRequestException('Customer is inactive. New sales transactions are not allowed.');
        }

        const sellerMsme = await this.isSellerMsme(userId);

        if (sellerMsme && createDto.creditDays > 45) {
            const entered = createDto.creditDays;
            createDto.creditDays = 45;
            await this.prisma.auditLog.create({
                data: {
                    userId,
                    action: 'MSME_AUTO_CORRECT',
                    resource: 'SalesOrder',
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

        const customer = await this._getCustomerDetails(createDto.customerId);
        
        const userGstDoc = await this.prisma.sellerDocument.findFirst({
            where: { uploadedByUserId: userId, type: 'GST', url: 'N/A' },
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

        // Validate PO Amounts if PO Type is Written
        const isWrittenPo = createDto.customerPoNumber && createDto.customerPoNumber.trim().toLowerCase() !== 'verbal';
        if (isWrittenPo) {
            if (createDto.customerAmtExclTax === undefined || createDto.customerAmtExclTax === null) {
                throw new BadRequestException('Customer PO Amount (Excl. Tax) is required for Written PO Type.');
            }
            if (createDto.customerAmtInclTax === undefined || createDto.customerAmtInclTax === null) {
                throw new BadRequestException('Customer PO Amount (Incl. Tax) is required for Written PO Type.');
            }
            if (Math.abs(Number(createDto.customerAmtExclTax) - totalAmount) >= 0.01) {
                throw new BadRequestException(`Customer PO Amount (Excl. Tax) must match Sub Total (₹${totalAmount.toFixed(2)})`);
            }
            if (Math.abs(Number(createDto.customerAmtInclTax) - grandTotal) >= 0.01) {
                throw new BadRequestException(`Customer PO Amount (Incl. Tax) must match Grand Total (₹${grandTotal.toFixed(2)})`);
            }
        }

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
                        customerAmtExclTax: createDto.customerAmtExclTax !== undefined && createDto.customerAmtExclTax !== null ? Number(createDto.customerAmtExclTax) : null,
                        customerAmtInclTax: createDto.customerAmtInclTax !== undefined && createDto.customerAmtInclTax !== null ? Number(createDto.customerAmtInclTax) : null,
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

        if (query.filter && query.filter !== 'all') {
            switch (query.filter) {
                case 'pending':
                    where.status = 'PENDING';
                    where.expiryDate = { gte: startOfToday };
                    break;
                case 'expiring': {
                    where.status = 'PENDING';
                    where.expiryDate = { gte: startOfToday, lte: fortyEightHoursLater };
                    break;
                }
                case 'expired':
                    where.status = 'PENDING';
                    where.expiryDate = { lt: startOfToday };
                    break;
                case 'completed':
                    where.status = { in: ['INVOICE_COMPLETED', 'INVOICE_GENERATED', 'CHALLAN_COMPLETED'] } as any;
                    break;
                case 'deleted':
                    where.status = 'DELETED';
                    break;
                default:
                    break;
            }
        } else {
            where.status = { not: 'DELETED' };
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
                    include: { items: true }
                },
                salesInvoices: {
                    where: { status: { not: 'DELETED' } },
                    include: { items: true }
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
                    include: { items: true }
                },
                salesInvoices: {
                    where: { status: { not: 'DELETED' } },
                    include: { items: true }
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

        const customerId = updateDto.customerId;
        let customer;
        if (customerId) {
            customer = await this.prisma.accountMaster.findUnique({ where: { id: customerId } });
        } else {
            customer = await this.prisma.accountMaster.findFirst({
                where: { accountName: so.customerName, userId }
            });
        }

        const sellerMsme = await this.isSellerMsme(userId);

        if (sellerMsme) {
            const creditDays = updateDto.creditDays !== undefined ? updateDto.creditDays : so.creditDays;
            if (creditDays > 45) {
                const entered = creditDays;
                updateDto.creditDays = 45;
                await this.prisma.auditLog.create({
                    data: {
                        userId,
                        action: 'MSME_AUTO_CORRECT',
                        resource: 'SalesOrder',
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

        return this.prisma.$transaction(async (tx) => {
            const data: any = {
                creditDays: updateDto.creditDays ?? so.creditDays,
                expiryDate: updateDto.expiryDate ? new Date(updateDto.expiryDate) : so.expiryDate,
                customerPoNumber: updateDto.customerPoNumber !== undefined ? updateDto.customerPoNumber : so.customerPoNumber,
                poDate: updateDto.poDate !== undefined ? (updateDto.poDate ? new Date(updateDto.poDate) : null) : so.poDate,
                poExpiryDate: updateDto.poExpiryDate !== undefined ? (updateDto.poExpiryDate ? new Date(updateDto.poExpiryDate) : null) : so.poExpiryDate,
                customerAmt: updateDto.customerAmt !== undefined ? (updateDto.customerAmt !== null ? Number(updateDto.customerAmt) : null) : so.customerAmt,
                customerAmtExclTax: updateDto.customerAmtExclTax !== undefined ? (updateDto.customerAmtExclTax !== null ? Number(updateDto.customerAmtExclTax) : null) : so.customerAmtExclTax,
                customerAmtInclTax: updateDto.customerAmtInclTax !== undefined ? (updateDto.customerAmtInclTax !== null ? Number(updateDto.customerAmtInclTax) : null) : so.customerAmtInclTax,
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
                    where: { uploadedByUserId: userId, type: 'GST', url: 'N/A' },
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

            const finalPoNumber = data.customerPoNumber;
            const isFinalWrittenPo = finalPoNumber && finalPoNumber.trim().toLowerCase() !== 'verbal';
            if (isFinalWrittenPo) {
                const finalAmtExcl = data.customerAmtExclTax;
                const finalAmtIncl = data.customerAmtInclTax;
                const finalTotalAmount = data.totalAmount !== undefined ? data.totalAmount : so.totalAmount;
                const finalGrandTotal = data.grandTotal !== undefined ? data.grandTotal : so.grandTotal;

                if (finalAmtExcl === undefined || finalAmtExcl === null) {
                    throw new BadRequestException('Customer PO Amount (Excl. Tax) is required for Written PO Type.');
                }
                if (finalAmtIncl === undefined || finalAmtIncl === null) {
                    throw new BadRequestException('Customer PO Amount (Incl. Tax) is required for Written PO Type.');
                }
                if (Math.abs(Number(finalAmtExcl) - finalTotalAmount) >= 0.01) {
                    throw new BadRequestException(`Customer PO Amount (Excl. Tax) must match Sub Total (₹${finalTotalAmount.toFixed(2)})`);
                }
                if (Math.abs(Number(finalAmtIncl) - finalGrandTotal) >= 0.01) {
                    throw new BadRequestException(`Customer PO Amount (Incl. Tax) must match Grand Total (₹${finalGrandTotal.toFixed(2)})`);
                }
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
            data: { 
                status: 'DELETED',
                soNumber: `${so.soNumber}_DELETED_${Date.now()}`
            },
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
        const so = await this.prisma.salesOrder.findFirst({
            where: { id, userId },
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
            doc.font('Helvetica').text(formatDate(so.soCreationDate), startX + 500, y + 10);

            doc.font('Helvetica-Bold').text('Pay. Terms :', startX + 290, y + 35);
            doc.font('Helvetica').text(`${so.creditDays} days`, startX + 345, y + 35);
            y += row6Height;

            doc.rect(startX, y, pageWidth, 25).stroke();
            doc.moveTo(startX + 280, y).lineTo(startX + 280, y + 25).stroke();
            doc.font('Helvetica-Bold').text('Customer Code :', startX + 10, y + 8);
            doc.font('Helvetica').text('CU00001', startX + 80, y + 8);
            doc.font('Helvetica-Bold').text('Expiry Date :', startX + 290, y + 8);
            doc.font('Helvetica').text(formatDate(so.expiryDate), startX + 350, y + 8);
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

        const getDerivedStatus = (order: any) => {
            const status = order.status;
            const expDate = new Date(order.expiryDate);
            expDate.setHours(23, 59, 59, 999);
            const currentTime = new Date();

            if (status === 'INVOICE_COMPLETED' || status === 'INVOICE_GENERATED' || status === 'CHALLAN_COMPLETED' || status === 'COMPLETED' || status === 'completed') return 'COMPLETED';
            if (status === 'DELETED' || status === 'deleted') return 'DELETED';
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
                { header: 'SR NO', key: 'srNo', width: 8 },
                { header: 'SO NO', key: 'soNumber', width: 16 },
                { header: 'CUSTOMER NAME', key: 'customerName', width: 28 },
                { header: 'SO CREATION DATE', key: 'soCreationDate', width: 18 },
                { header: 'EXPIRY DATE', key: 'expiryDate', width: 16 },
                { header: 'GST NUMBER', key: 'gstNumber', width: 18 },
                { header: 'CREDIT DAYS', key: 'creditDays', width: 14 },
                { header: 'TAXABLE AMOUNT', key: 'taxableAmount', width: 18 },
                { header: 'TAX AMOUNT', key: 'taxAmount', width: 16 },
                { header: 'TOTAL AMOUNT', key: 'grandTotal', width: 18 },
                { header: 'STATUS', key: 'derivedStatus', width: 18 },
            ];

            orders.forEach((order, idx) => {
                const taxable = Number(order.totalAmount || 0);
                const gross = Number(order.grandTotal || (taxable + Number(order.taxAmount || 0)));
                worksheet.addRow({
                    srNo: idx + 1,
                    soNumber: order.soNumber,
                    customerName: order.customerName,
                    soCreationDate: formatDate(order.soCreationDate),
                    expiryDate: formatDate(order.expiryDate),
                    gstNumber: order.gstNumber || '-',
                    creditDays: order.creditDays || 0,
                    taxableAmount: taxable.toFixed(2),
                    taxAmount: Number(order.taxAmount || 0).toFixed(2),
                    grandTotal: gross.toFixed(2),
                    derivedStatus: getDerivedStatus(order),
                });
            });

            worksheet.spliceRows(1, 0,
                ['Sales Orders Report'],
                [`Exported on: ${timestamp}`],
                []
            );

            worksheet.mergeCells('A1:K1');
            const titleCell = worksheet.getCell('A1');
            titleCell.font = { size: 16, bold: true, color: { argb: 'FF073318' } };
            titleCell.alignment = { horizontal: 'center', vertical: 'middle' };

            worksheet.mergeCells('A2:K2');
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
                const doc = new PDFDocument({ margin: 15, size: 'A4', layout: 'landscape' });
                const buffers: Buffer[] = [];
                doc.on('data', buffers.push.bind(buffers));
                doc.on('end', () => {
                    resolve({
                        buffer: Buffer.concat(buffers),
                        filename: `sales_orders_${Date.now()}.pdf`,
                        mimetype: 'application/pdf',
                    });
                });

                doc.fillColor('#073318').fontSize(18).font('Helvetica-Bold').text('Sales Orders Report', { align: 'center' });
                doc.moveDown(0.3);
                doc.fillColor('#666666').fontSize(9).font('Helvetica').text(`Exported on: ${timestamp}`, { align: 'right' });
                doc.moveDown(0.5);

                const tableTop = 85;
                const colX = [15, 45, 120, 210, 275, 335, 400, 450, 515, 575, 645];
                const headers = ['SR', 'SO Number', 'Customer Name', 'Cr Date', 'Exp Date', 'GST No', 'Credit', 'Taxable', 'Tax', 'Total', 'Status'];

                doc.rect(10, tableTop - 5, 820, 20).fill('#073318');

                doc.fillColor('#FFFFFF').fontSize(7).font('Helvetica-Bold');
                headers.forEach((h, i) => {
                    doc.text(h, colX[i], tableTop);
                });

                doc.fillColor('#000000').font('Helvetica').fontSize(6);
                let y = tableTop + 20;

                orders.forEach((order, index) => {
                    if (y > 540) {
                        doc.addPage({ layout: 'landscape', margin: 15 });
                        y = 35;
                        doc.rect(10, y - 5, 820, 20).fill('#073318');
                        doc.fillColor('#FFFFFF').fontSize(7).font('Helvetica-Bold');
                        headers.forEach((h, i) => doc.text(h, colX[i], y));
                        doc.fillColor('#000000').font('Helvetica').fontSize(6);
                        y += 20;
                    }

                    if (index % 2 === 1) {
                        doc.save().fillColor('#F9FAFB').rect(10, y - 2, 820, 16).fill().restore();
                    }

                    const taxable = Number(order.totalAmount || 0);
                    const gross = Number(order.grandTotal || (taxable + Number(order.taxAmount || 0)));

                    doc.text(String(index + 1), colX[0], y);
                    doc.text(order.soNumber, colX[1], y, { width: 70 });
                    doc.text((order.customerName || '-').substring(0, 18), colX[2], y, { width: 85 });
                    doc.text(formatDate(order.soCreationDate), colX[3], y);
                    doc.text(formatDate(order.expiryDate), colX[4], y);
                    doc.text((order.gstNumber || '-').substring(0, 12), colX[5], y);
                    doc.text(String(order.creditDays || 0), colX[6], y);
                    doc.text(taxable.toFixed(2), colX[7], y);
                    doc.text(Number(order.taxAmount || 0).toFixed(2), colX[8], y);
                    doc.text(gross.toFixed(2), colX[9], y);

                    const status = getDerivedStatus(order);
                    if (status === 'EXPIRED' || status === 'DELETED') doc.fillColor('#DC2626');
                    else if (status === 'COMPLETED') doc.fillColor('#059669');
                    else if (status === 'EXPIRING SOON') doc.fillColor('#D97706');
                    else doc.fillColor('#EA580C');

                    doc.font('Helvetica-Bold').text(status, colX[10], y);
                    doc.fillColor('#000000').font('Helvetica');

                    y += 18;
                });

                doc.end();
            });
        }

        throw new BadRequestException('Invalid format. Use xlsx or pdf.');
    }

  async downloadSample() {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Sales Order Template');
    worksheet.views = [{ state: 'frozen', ySplit: 1 }];

    const headers = [
      'SO Number*', 'SO Date* (DD/MM/YYYY)', 'Expiry Date* (DD/MM/YYYY)', 'Customer Name*',
      'Customer PO Type* (Verbal/Written)', 'PO Date (DD/MM/YYYY)', 'PO Expiry Date (DD/MM/YYYY)',
      'PO Amount (Excluding Tax)', 'PO Amount (Including Tax)',
      'Product Name*', 'Quantity*', 'Rate*', 'Discount (₹)', 'Discount (%)'
    ];
    const headerRow = worksheet.getRow(1);
    headerRow.height = 28;
    headers.forEach((h, idx) => {
      const cell = headerRow.getCell(idx + 1);
      const isRequired = h.includes('*');
      cell.value = h;
      cell.font = { bold: true, color: { argb: isRequired ? 'FF9F1239' : 'FF334155' }, size: 11 };
      cell.alignment = { vertical: 'middle', horizontal: 'center' };
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: isRequired ? 'FFFEE2E2' : 'FFF8FAFC' }
      };
      cell.border = {
        top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        bottom: { style: 'medium', color: { argb: isRequired ? 'FFFECDD3' : 'FFE2E8F0' } },
        right: { style: 'thin', color: { argb: 'FFE2E8F0' } },
      };
    });



    const dateColLetters = ['B', 'C', 'F', 'G'];
    for (let i = 2; i <= 1000; i++) {
      worksheet.getCell(`E${i}`).dataValidation = {
        type: 'list',
        allowBlank: true,
        formulae: ['"Verbal,Written"'],
        showInputMessage: true,
        promptTitle: 'Customer PO Type',
        prompt: 'Choose one of: Verbal, Written'
      };

      dateColLetters.forEach((colLetter) => {
        const cellRef = `${colLetter}${i}`;
        const cell = worksheet.getCell(cellRef);
        cell.numFmt = '@';
        cell.dataValidation = {
          type: 'custom',
          allowBlank: true,
          formulae: [`OR(ISBLANK(${cellRef}), ${cellRef}="", AND(ISNUMBER(VALUE(LEFT(${cellRef},2))), ISNUMBER(VALUE(MID(${cellRef},4,2))), ISNUMBER(VALUE(RIGHT(${cellRef},4))), VALUE(MID(${cellRef},4,2))>=1, VALUE(MID(${cellRef},4,2))<=12, VALUE(LEFT(${cellRef},2))>=1, VALUE(LEFT(${cellRef},2))<=DAY(DATE(VALUE(RIGHT(${cellRef},4)), VALUE(MID(${cellRef},4,2))+1, 0))))`],
          showInputMessage: true,
          promptTitle: 'Date Format Required',
          prompt: 'Please enter date in DD/MM/YYYY format (e.g. 20/08/2026).',
          showErrorMessage: true,
          errorTitle: 'Invalid Date Format',
          error: 'Date must be entered in valid DD/MM/YYYY format (e.g. 20/08/2026). Month must be between 01 and 12.'
        };
      });
    }

    worksheet.columns = headers.map((h, i) => {
      let width = Math.max(25, h.length + 6);
      if (i === 3) width = 30; // Customer Name
      if (i === 9) width = 30; // Product Name
      return { width };
    });

    headerRow.eachCell((cell) => { cell.protection = { locked: true }; });
    for (let r = 2; r <= 1000; r++) {
      const row = worksheet.getRow(r);
      for (let c = 1; c <= headers.length; c++) {
        row.getCell(c).protection = { locked: false };
      }
    }
    await worksheet.protect('', {
      selectLockedCells: true,
      selectUnlockedCells: true,
      formatCells: true,
      formatColumns: true,
      formatRows: true,
      insertRows: true,
      deleteRows: true,
      sort: true,
      autoFilter: true,
    });

    const buffer = await workbook.xlsx.writeBuffer();
    return {
      buffer: Buffer.from(buffer),
      filename: 'Sales_Order_Import_Sample.xlsx',
      mimetype: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    };
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
        if (val.includes('so number')) { colMap['soNumber'] = colNumber; found = true; }
        if (val.includes('so date')) colMap['soDate'] = colNumber;
        if (val.includes('expiry date') && !val.includes('po expiry')) colMap['expiryDate'] = colNumber;
        if (val.includes('customer name')) colMap['customerName'] = colNumber;
        if (val.includes('customer type') || val.includes('customer po type') || val.includes('po type')) colMap['customerType'] = colNumber;
        if (val.includes('po number')) colMap['poNumber'] = colNumber;
        if (val.includes('po date')) colMap['poDate'] = colNumber;
        if (val.includes('po expiry')) colMap['poExpiryDate'] = colNumber;
        if (val.includes('po amount (excl') || val.includes('po amt (excl') || val.includes('po amount excluding')) colMap['poAmtExclTax'] = colNumber;
        if (val.includes('po amount (incl') || val.includes('po amt (incl') || val.includes('po amount including')) colMap['poAmtInclTax'] = colNumber;
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

    // Scan first 10 rows to detect if user uploaded a PO file or wrong template
    let isPoFile = false;
    let isGrnFile = false;

    for (let r = 1; r <= Math.min(rowCount, 10); r++) {
      const row = worksheet.getRow(r);
      row.eachCell((cell) => {
        const val = String(cell.value || '').trim().toLowerCase();
        if (val.includes('grn no') || val.includes('grn number') || val.includes('supplier challan')) {
          isGrnFile = true;
        }
        if (
          val.includes('po date') || 
          val.includes('po expiry') || 
          val.includes('supplier name') || 
          (val.includes('po no') && !val.includes('so') && !val.includes('customer po'))
        ) {
          isPoFile = true;
        }
      });
    }

    if (!colMap['soNumber']) {
      throw new BadRequestException('Invalid template format');
    }

    const mandatoryCols = ['soNumber', 'soDate', 'expiryDate', 'customerName', 'customerType', 'productName', 'quantity', 'rate'];
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
        val = val.result;
      }
      if (val && (val instanceof Date || Object.prototype.toString.call(val) === '[object Date]' || typeof (val as any).getTime === 'function')) {
        return val;
      }
      return String(val !== undefined && val !== null ? val : '').trim();
    };

    // Preload Lookups
    const [dbCustomers, dbProducts, userShop, userGstDoc, existingSos] = await Promise.all([
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
        where: { uploadedByUserId: userId, type: 'GST' },
        orderBy: { createdAt: 'desc' },
        select: { name: true }
      }),
      this.prisma.salesOrder.findMany({
        where: { userId, status: { not: 'DELETED' } },
        select: { soNumber: true }
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

    const dbSoNumbers = new Set(existingSos.map(so => so.soNumber.toLowerCase().trim()));
    const importedSoNumbersInFile = new Set<string>();

    const parsedRows: any[] = [];
    const groupMap = new Map<string, any[]>();

    for (let r = headerRowIndex + 1; r <= rowCount; r++) {
      const row = worksheet.getRow(r);
      const soNumber = getVal(row, 'soNumber');
      if (!soNumber || soNumber === '-') continue;

      const item = {
        rowNum: r,
        originalRowValues: row.values,
        soNumber,
        soDateStr: getVal(row, 'soDate'),
        expiryDateStr: getVal(row, 'expiryDate'),
        customerName: getVal(row, 'customerName'),
        customerTypeStr: getVal(row, 'customerType'),
        poNumber: getVal(row, 'poNumber'),
        poDateStr: getVal(row, 'poDate'),
        poExpiryDateStr: getVal(row, 'poExpiryDate'),
        poAmtExclTaxStr: getVal(row, 'poAmtExclTax'),
        poAmtInclTaxStr: getVal(row, 'poAmtInclTax'),
        productName: getVal(row, 'productName'),
        quantityStr: getVal(row, 'quantity'),
        rateStr: getVal(row, 'rate'),
        discountAmountStr: getVal(row, 'discountAmount'),
        discountPercentStr: getVal(row, 'discountPercent'),
      };

      parsedRows.push(item);
      if (!groupMap.has(soNumber)) {
        groupMap.set(soNumber, []);
      }
      groupMap.get(soNumber).push(item);
    }

    if (groupMap.size === 0) {
      throw new BadRequestException('Invalid template format');
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

    for (const [soNumber, rows] of groupMap.entries()) {
      const groupErrors: string[] = [];
      const firstRow = rows[0];

      const dateConsistencyErrors = this.importValidator.validateGroupDateConsistency(
        rows,
        'SO Number',
        soNumber,
        [
          { key: 'soDateStr', label: 'SO Date' },
          { key: 'expiryDateStr', label: 'SO Expiry Date' },
          { key: 'poDateStr', label: 'Customer PO Date' },
          { key: 'poExpiryDateStr', label: 'Customer PO Expiry Date' },
        ]
      );
      groupErrors.push(...dateConsistencyErrors);

      // Check duplicate SO Number
      if (dbSoNumbers.has(soNumber.toLowerCase())) {
        groupErrors.push(`Record already exists.`);
      }
      if (importedSoNumbersInFile.has(soNumber.toLowerCase())) {
        groupErrors.push(`Duplicate SO Number in file.`);
      }

      // Customer check
      const custName = firstRow.customerName;
      const customer = customerMap.get(custName.toLowerCase());
      if (!customer) {
        groupErrors.push(`Customer "${custName}" not found. Please create the customer first.`);
      }

      // Customer type logic
      const custType = firstRow.customerTypeStr.toLowerCase();
      if (custType !== 'verbal' && custType !== 'written') {
        groupErrors.push(`Invalid Customer Type. Allowed values are Verbal or Written.`);
      }

      const parsedSoDate = parseDDMMYYYY(firstRow.soDateStr);
      const parsedExpiryDate = parseDDMMYYYY(firstRow.expiryDateStr);
      if (!parsedSoDate) groupErrors.push(`Invalid SO Date format. Please use DD/MM/YYYY.`);
      if (!parsedExpiryDate) groupErrors.push(`Invalid Expiry Date format. Please use DD/MM/YYYY.`);
      if (parsedSoDate && parsedExpiryDate && parsedExpiryDate < parsedSoDate) {
        groupErrors.push(`Expiry Date must be greater than or equal to SO Date.`);
      }

      let poDate: Date | null = null;
      let poExpiryDate: Date | null = null;
      let poAmtExcl = 0;
      let poAmtIncl = 0;

      const rawPoNo = firstRow.poNumber ? firstRow.poNumber.trim() : '';
      const resolvedPoNumber = (rawPoNo && rawPoNo.toLowerCase() !== 'verbal' && rawPoNo !== firstRow.soNumber?.trim()) ? rawPoNo : 'verbal';

      if (custType === 'verbal') {
        const hasPoDate = Boolean(firstRow.poDateStr && firstRow.poDateStr.trim());
        const hasPoExpiryDate = Boolean(firstRow.poExpiryDateStr && firstRow.poExpiryDateStr.trim());
        const hasPoAmtExcl = Boolean(firstRow.poAmtExclTaxStr && firstRow.poAmtExclTaxStr.trim());
        const hasPoAmtIncl = Boolean(firstRow.poAmtInclTaxStr && firstRow.poAmtInclTaxStr.trim());

        if (hasPoDate || hasPoExpiryDate || hasPoAmtExcl || hasPoAmtIncl) {
          groupErrors.push(`When Customer PO Type is Verbal, PO Date, PO Expiry Date, PO Amount (Excluding Tax), and PO Amount (Including Tax) must be left blank.`);
        }
      } else if (custType === 'written') {
        if (!rawPoNo || rawPoNo.toLowerCase() === 'verbal') {
          groupErrors.push(`PO Number is required for Written Customer PO Type.`);
        }

        if (!firstRow.poDateStr || !firstRow.poDateStr.trim()) {
          groupErrors.push(`PO Date (DD/MM/YYYY) is required for Written Customer PO Type.`);
        } else {
          poDate = parseDDMMYYYY(firstRow.poDateStr);
          if (!poDate) {
            groupErrors.push(`PO Date must be in valid DD/MM/YYYY format.`);
          }
        }

        if (!firstRow.poExpiryDateStr || !firstRow.poExpiryDateStr.trim()) {
          groupErrors.push(`PO Expiry Date (DD/MM/YYYY) is required for Written Customer PO Type.`);
        } else {
          poExpiryDate = parseDDMMYYYY(firstRow.poExpiryDateStr);
          if (!poExpiryDate) {
            groupErrors.push(`PO Expiry Date must be in valid DD/MM/YYYY format.`);
          }
        }

        if (poDate && poExpiryDate && poExpiryDate < poDate) {
          groupErrors.push(`PO Expiry Date must be greater than or equal to PO Date.`);
        }

        const rawExcl = firstRow.poAmtExclTaxStr ? firstRow.poAmtExclTaxStr.trim() : '';
        const rawIncl = firstRow.poAmtInclTaxStr ? firstRow.poAmtInclTaxStr.trim() : '';

        if (!rawExcl) {
          groupErrors.push(`PO Amount (Excluding Tax) is required for Written Customer PO Type.`);
        } else {
          poAmtExcl = parseFloat(rawExcl);
          if (isNaN(poAmtExcl) || poAmtExcl <= 0) {
            groupErrors.push(`PO Amount (Excluding Tax) must be a positive number.`);
          }
        }

        if (!rawIncl) {
          groupErrors.push(`PO Amount (Including Tax) is required for Written Customer PO Type.`);
        } else {
          poAmtIncl = parseFloat(rawIncl);
          if (isNaN(poAmtIncl) || poAmtIncl <= 0) {
            groupErrors.push(`PO Amount (Including Tax) must be a positive number.`);
          }
        }
      }

      // Check items
      const processedItems: any[] = [];
      let totalAmount = 0;
      let totalTaxAmount = 0;
      let grandTotal = 0;

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
        const customerGst = customer?.gstNo;
        const customerState = (customer?.state || "").trim().toLowerCase();

        const isInterState = this.importValidator.determineIsInterState(
          userGst,
          companyState,
          customerGst,
          customerState
        );

        const taxAmount = isGstApplicable ? ((beforeTaxAmount * taxRate) / 100) : 0;
        const totalItemAmount = beforeTaxAmount + taxAmount;

        totalAmount += beforeTaxAmount;
        totalTaxAmount += taxAmount;
        grandTotal += totalItemAmount;

        processedItems.push({
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
          totalAmount: totalItemAmount
        });
      }

      // Check PO Amount match for Written PO
      if (groupErrors.length === 0 && custType === 'written') {
        if (Math.abs(poAmtExcl - totalAmount) >= 0.01) {
          groupErrors.push(`PO Amount (Excluding Tax) does not match calculated Before Tax Amount.`);
        }
        if (Math.abs(poAmtIncl - grandTotal) >= 0.01) {
          groupErrors.push(`PO Amount (Including Tax) does not match calculated Invoice Amount.`);
        }
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
        // Validation passed, create in database
        try {
          await this.prisma.$transaction(async (tx) => {
            await tx.salesOrder.create({
              data: {
                soNumber,
                customerName: customer.accountName,
                customerType: (customer.customerType as any) || 'retailer',
                address: customer.addressLine1 + (customer.addressLine2 ? ', ' + customer.addressLine2 : ''),
                creditDays: customer.customerCreditDays || 0,
                soCreationDate: new Date(),
                expiryDate: parsedExpiryDate,
                customerPoNumber: resolvedPoNumber || null,
                poDate: poDate || null,
                poExpiryDate: poExpiryDate || null,
                customerAmt: poAmtIncl || null,
                customerAmtExclTax: poAmtExcl || null,
                customerAmtInclTax: poAmtIncl || null,
                gstNumber: customer.gstNo || '',
                panNumber: customer.panNo || '',
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
                    printDescription: item.productName
                  }))
                }
              }
            });
          });
          importedSoNumbersInFile.add(soNumber.toLowerCase());
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

    // Build Response files
    const headers = [
      'SO Number*', 'SO Date*', 'Expiry Date*', 'Customer Name*',
      'Customer PO Type* (Verbal/Written)', 'PO Date', 'PO Expiry Date',
      'PO Amount (Excluding Tax)', 'PO Amount (Including Tax)',
      'Product Name*', 'Quantity*', 'Rate*', 'Discount (₹)', 'Discount (%)'
    ];

    const successWb = new ExcelJS.Workbook();
    const successWs = successWb.addWorksheet('Success Reports');
    successWs.addRow(headers);
    successWs.getRow(1).font = { bold: true };
    successWs.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD3D3D3' } };
    successRows.forEach(r => {
      // Reconstruct values ignoring first element (since Row values is 1-indexed array from ExcelJS)
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
      // Pad to headers length
      while (rowVals.length < headers.length) rowVals.push('');
      rowVals[headers.length] = r.error;
      failedWs.addRow(rowVals);
    });
    const failedBuffer = await failedWb.xlsx.writeBuffer();

    return {
      success: failedRows.length === 0,
      summary: {
        totalRows: parsedRows.length,
        successful: successRows.length,
        failed: failedRows.length
      },
      totalRows: parsedRows.length,
      successful: successRows.length,
      failed: failedRows.length,
      errors: rowErrors,
      successFile: Buffer.from(successBuffer).toString('base64'),
      errorFile: Buffer.from(failedBuffer).toString('base64')
    };
  }
}
