import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { ProductMasterRepository } from '../repositories/product-master.repository';
import { CreateProductDto, UpdateProductDto, ToggleProductStatusDto } from '../dto/product.dto';
import { MasterStatus, ProductType, Prisma } from '@prisma/client';
import * as ExcelJS from 'exceljs';
import * as PDFDocument from 'pdfkit';
import { HsnMasterService } from '../../hsn-master/hsn-master.service';
import { PrismaService } from '../../../../infrastructure/prisma/prisma.service';
import { ImportValidationService } from '../../../../common/services/import-validation.service';

interface GetProductsQuery {
    page?: number;
    limit?: number;
    search?: string;
    uom_id?: number;
    product_type?: string;
    status?: string;
}

@Injectable()
export class ProductMasterService {
    constructor(
        private readonly repository: ProductMasterRepository,
        private readonly hsnService: HsnMasterService,
        private readonly prisma: PrismaService,
        private readonly importValidator: ImportValidationService,
    ) { }

    private mapProductCategories(prod: any): any {
        let category: any = null;
        let sub_category: any = null;
        let sub_sub_category: any = null;

        const leaf = prod.category;
        if (leaf) {
            if (leaf.parent) {
                if (leaf.parent.parent) {
                    category = { id: leaf.parent.parent.id, name: leaf.parent.parent.name };
                    sub_category = { id: leaf.parent.id, name: leaf.parent.name };
                    sub_sub_category = { id: leaf.id, name: leaf.name };
                } else {
                    category = { id: leaf.parent.id, name: leaf.parent.name };
                    sub_category = { id: leaf.id, name: leaf.name };
                }
            } else {
                category = { id: leaf.id, name: leaf.name };
            }
        }

        return {
            ...prod,
            category,
            sub_category,
            sub_sub_category,
            category_id: category?.id || null,
            sub_category_id: sub_category?.id || null,
            sub_sub_category_id: sub_sub_category?.id || null,
            hsn_code: prod.hsnMaster ? prod.hsnMaster.code : prod.hsn_code,
            tax_rate: prod.hsnMaster ? parseFloat(String(prod.hsnMaster.taxRate)) : prod.tax_rate,
            hsn_description: prod.hsnMaster ? prod.hsnMaster.description : prod.hsn_description,
        };
    }

    async exportProducts(format: string, query: GetProductsQuery, userId: number) {
        const result = await this.getProducts({ ...query, page: 1, limit: 10000 }, userId);
        const products = result.products;

        if (products.length === 0) {
            throw new BadRequestException('No data available to export');
        }

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
            const worksheet = workbook.addWorksheet('Products');
            worksheet.views = [{ state: 'frozen', ySplit: 5 }];

            const isService = query.product_type === 'SERVICES';
            const nameHeader = isService ? 'Service Name' : 'Product Name';
            const codeHeader = isService ? 'Service Code' : 'Product Code';
            const hsnHeader = isService ? 'SAC Code' : 'HSN Code';

            worksheet.columns = [
                { header: 'Sr. No', key: 'srNo', width: 10 },
                { header: 'Type', key: 'productType', width: 15 },
                { header: nameHeader, key: 'productName', width: 30 },
                { header: 'Description', key: 'description', width: 35 },
                { header: codeHeader, key: 'productCode', width: 15 },
                { header: 'UOM', key: 'uom', width: 15 },
                { header: 'Category', key: 'category', width: 20 },
                { header: 'Sub Category', key: 'subCategory', width: 20 },
                { header: 'Sub-SubCategory', key: 'subSubCategory', width: 20 },
                { header: hsnHeader, key: 'hsnCode', width: 15 },
                { header: 'Tax %', key: 'taxRate', width: 10 },
                { header: 'Status', key: 'status', width: 12 },
            ];

            worksheet.getColumn('productCode').numFmt = '@';
            worksheet.getColumn('hsnCode').numFmt = '@';

            (products as any[]).forEach((prod, index) => {
                const row = worksheet.addRow({
                    srNo: index + 1,
                    productType: prod.product_type,
                    productName: prod.product_name,
                    description: prod.description || '-',
                    productCode: prod.product_code ? String(prod.product_code) : '',
                    uom: prod.uom?.gst_uom || '-',
                    category: prod.category?.name || '-',
                    subCategory: prod.sub_category?.name || '-',
                    subSubCategory: prod.sub_sub_category?.name || '-',
                    hsnCode: prod.hsn_code ? String(prod.hsn_code) : '',
                    taxRate: `${prod.tax_rate}%`,
                    status: prod.status === MasterStatus.ACTIVE ? 'Active' : 'Inactive',
                });
                row.getCell('productCode').numFmt = '@';
                row.getCell('hsnCode').numFmt = '@';
            });

            worksheet.spliceRows(1, 0, [], [], [], []);

            worksheet.mergeCells('A1:L1');
            worksheet.getCell('A1').value = 'ERP';
            worksheet.getCell('A1').font = { size: 18, bold: true };
            worksheet.getCell('A1').alignment = { horizontal: 'center', vertical: 'middle' };

            worksheet.mergeCells('A2:L2');
            worksheet.getCell('A2').value = 'Product Master Report';
            worksheet.getCell('A2').font = { size: 14 };
            worksheet.getCell('A2').alignment = { horizontal: 'center', vertical: 'middle' };

            worksheet.mergeCells('A3:L3');
            worksheet.getCell('A3').value = `Exported on: ${timestamp}`;
            worksheet.getCell('A3').font = { size: 10 };
            worksheet.getCell('A3').alignment = { horizontal: 'right', vertical: 'middle' };

            const headerRow = worksheet.getRow(5);
            headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
            headerRow.fill = {
                type: 'pattern',
                pattern: 'solid',
                fgColor: { argb: 'FF4472C4' }
            };
            headerRow.alignment = { horizontal: 'center' };

            const buffer = await workbook.xlsx.writeBuffer();
            return {
                buffer: Buffer.from(buffer),
                filename: `products_export_${Date.now()}.xlsx`,
                mimetype: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            };
        }

        if (format === 'pdf') {
            return new Promise<any>((resolve) => {
                const doc = new PDFDocument({ margin: 20, size: 'A4', layout: 'landscape' });
                const buffers: Buffer[] = [];

                doc.on('data', buffers.push.bind(buffers));
                doc.on('end', () => {
                    const pdfData = Buffer.concat(buffers);
                    resolve({
                        buffer: pdfData,
                        filename: `products_export_${Date.now()}.pdf`,
                        mimetype: 'application/pdf',
                    });
                });

                doc.fontSize(18).font('Helvetica-Bold').text('ERP', { align: 'center' });
                doc.fontSize(14).font('Helvetica').text('Product Master Report', { align: 'center' });
                doc.moveDown(0.5);
                doc.fontSize(10).text(`Exported on: ${timestamp}`, { align: 'right' });
                doc.moveDown();

                const isService = query.product_type === 'SERVICES';
                const nameHeader = isService ? 'Service Name' : 'Product Name';
                const codeHeader = isService ? 'Service Code' : 'Product Code';
                const hsnHeader = isService ? 'SAC' : 'HSN';

                const tableTop = 100;
                const colX = [20, 40, 80, 180, 290, 355, 395, 480, 565, 650, 700, 735];
                const headers = [
                    'Sr.', 'Type', nameHeader, 'Description', codeHeader, 'UOM',
                    'Category', 'Sub Category', 'Sub-SubCategory', hsnHeader, 'Tax%', 'Status'
                ];

                doc.rect(15, tableTop - 5, 805, 20).fill('#4472C4');
                doc.fontSize(8).font('Helvetica-Bold').fillColor('#FFFFFF');

                headers.forEach((header, i) => {
                    doc.text(header, colX[i], tableTop);
                });

                let y = tableTop + 20;
                doc.fillColor('#000000').font('Helvetica');

                products.forEach((prod: any, index) => {
                    if (y > 550) {
                        doc.addPage({ margin: 20, size: 'A4', layout: 'landscape' });
                        y = 40;
                        doc.rect(15, y - 5, 805, 20).fill('#4472C4');
                        doc.fontSize(8).font('Helvetica-Bold').fillColor('#FFFFFF');
                        headers.forEach((header, i) => {
                            doc.text(header, colX[i], y);
                        });
                        y += 20;
                        doc.fillColor('#000000').font('Helvetica');
                    }

                    if (index % 2 === 1) {
                        doc.rect(15, y - 3, 805, 15).fill('#F2F2F2').fillColor('#000000');
                    }

                    doc.fontSize(6.5);
                    doc.text((index + 1).toString(), colX[0], y);
                    doc.text(prod.product_type, colX[1], y);
                    doc.text(prod.product_name, colX[2], y, { width: 95, height: 12, ellipsis: true });
                    doc.text(prod.description || '-', colX[3], y, { width: 105, height: 12, ellipsis: true });
                    doc.text(prod.product_code || '-', colX[4], y, { width: 60, height: 12, ellipsis: true });
                    doc.text(prod.uom?.gst_uom || '-', colX[5], y);
                    doc.text(prod.category?.name || '-', colX[6], y, { width: 80, height: 12, ellipsis: true });
                    doc.text(prod.sub_category?.name || '-', colX[7], y, { width: 80, height: 12, ellipsis: true });
                    doc.text(prod.sub_sub_category?.name || '-', colX[8], y, { width: 80, height: 12, ellipsis: true });
                    doc.text(prod.hsn_code || '-', colX[9], y);
                    doc.text(`${prod.tax_rate}%`, colX[10], y);
                    doc.text(prod.status === MasterStatus.ACTIVE ? 'Active' : 'Inactive', colX[11], y);

                    y += 18;
                });

                doc.end();
            });
        }

        throw new BadRequestException('Format is required. Please use xlsx or pdf.');
    }

    async generateProductCode(
        userId: number,
        type?: ProductType,
        dbClient?: Prisma.TransactionClient,
        usedCodes?: Set<string>
    ): Promise<string> {
        const prefix = type === ProductType.SERVICES ? 'SV' : 'PD';
        const defaultCode = type === ProductType.SERVICES ? 'SV00001' : 'PD00001';
        const padLength = 5;

        const prismaClient = dbClient || this.prisma;

        const lastProduct = await prismaClient.product.findFirst({
            where: {
                created_by: userId,
                product_code: { startsWith: prefix }
            },
            orderBy: { id: 'desc' },
            select: { product_code: true }
        });

        let lastCode = lastProduct?.product_code || null;
        let nextNumeric = 1;

        if (lastCode) {
            const match = lastCode.match(/\d+/);
            if (match) {
                nextNumeric = parseInt(match[0], 10) + 1;
            }
        }

        let candidateCode = `${prefix}${nextNumeric.toString().padStart(padLength, '0')}`;

        while (usedCodes && usedCodes.has(candidateCode.toUpperCase())) {
            nextNumeric++;
            candidateCode = `${prefix}${nextNumeric.toString().padStart(padLength, '0')}`;
        }

        while (await prismaClient.product.findFirst({ where: { created_by: userId, product_code: candidateCode } })) {
            nextNumeric++;
            candidateCode = `${prefix}${nextNumeric.toString().padStart(padLength, '0')}`;
        }

        if (usedCodes) {
            usedCodes.add(candidateCode.toUpperCase());
        }

        return candidateCode;
    }

    async generateCodeForUser(userId: number, type?: ProductType) {
        const product_code = await this.generateProductCode(userId, type);
        return { product_code };
    }

    async getUomDropdown(userId: number) {
        return this.repository.getActiveUomsForDropdown(userId);
    }

    async getTaxByHsn(hsnCode: string, userId?: number) {
        return this.hsnService.getLatestTaxByCode(hsnCode, userId);
    }

    async getCategoryDropdown(userId: number) {
        return this.repository.getActiveCategoriesForDropdown(userId);
    }

    async getActiveSubCategories(categoryId: string, userId: number) {
        return this.repository.getActiveSubCategoriesForDropdown(categoryId, userId);
    }

    async getActiveSubSubCategories(subCategoryId: string, userId: number) {
        return this.repository.getActiveSubSubCategoriesForDropdown(subCategoryId, userId);
    }

    async createProduct(dto: CreateProductDto, userId: number) {
        const existing = await this.repository.findByProductName(dto.product_name, userId);
        if (existing) {
            throw new BadRequestException('Product name already exists');
        }

        const uom = await this.repository.getUomById(dto.uom_id);
        if (!uom || uom.user_id !== userId) throw new BadRequestException('No units found for this user');

        const category = await this.repository.getCategoryById(dto.category_id);
        if (!category || category.user_id !== userId) throw new BadRequestException('Invalid Category ID');

        const hsnMaster = await this.prisma.hsnMaster.findFirst({
            where: { id: dto.hsnMasterId, createdBy: userId }
        });
        if (!hsnMaster) {
            throw new BadRequestException(dto.product_type === 'SERVICES' ? 'Please select a valid SAC Code.' : 'Please select a valid HSN Code.');
        }
        if (dto.product_type === 'SERVICES' && hsnMaster.type !== 'SAC') {
            throw new BadRequestException('Please select a valid SAC Code for Services.');
        }
        if (dto.product_type === 'GOODS' && hsnMaster.type !== 'HSN') {
            throw new BadRequestException('Please select a valid HSN Code for Goods.');
        }
        if (!hsnMaster.isActive) {
            throw new BadRequestException(dto.product_type === 'SERVICES' ? 'The selected SAC Code is inactive.' : 'The selected HSN Code is inactive.');
        }

        const product_code = await this.generateProductCode(userId, dto.product_type);

        return this.repository.createProduct({
            product_name: dto.product_name,
            product_code,
            uom_id: dto.uom_id,
            product_type: dto.product_type as ProductType,
            category_id: dto.category_id,
            hsnMasterId: hsnMaster.id,
            hsn_code: hsnMaster.code,
            tax_rate: parseFloat(String(hsnMaster.taxRate)),
            hsn_description: hsnMaster.description || '',
            description: dto.description,
            created_by: userId
        });
    }

    async updateProduct(id: number, dto: UpdateProductDto, userId: number) {
        const product = await this.repository.findProductById(id);
        if (!product || product.created_by !== userId) throw new NotFoundException('Product not found');

        if (dto.product_name && dto.product_name !== product.product_name) {
            const existing = await this.repository.findByProductName(dto.product_name, userId);
            if (existing && existing.id !== id) {
                throw new BadRequestException('Product name already exists');
            }
        }

        const updateData: any = { ...dto };

        if (dto.uom_id) {
            const uom = await this.repository.getUomById(dto.uom_id);
            if (!uom || uom.user_id !== userId) throw new BadRequestException('No units found for this user');
        }

        if (dto.category_id) {
            const category = await this.repository.getCategoryById(dto.category_id);
            if (!category || category.user_id !== userId) {
                throw new BadRequestException('Invalid Category ID');
            }
        }

        if (dto.hsnMasterId) {
            const hsnMaster = await this.prisma.hsnMaster.findFirst({
                where: { id: dto.hsnMasterId, createdBy: userId }
            });
            const currentProductType = dto.product_type || product.product_type;
            if (!hsnMaster) {
                throw new BadRequestException(currentProductType === 'SERVICES' ? 'Please select a valid SAC Code.' : 'Please select a valid HSN Code.');
            }
            if (currentProductType === 'SERVICES' && hsnMaster.type !== 'SAC') {
                throw new BadRequestException('Please select a valid SAC Code for Services.');
            }
            if (currentProductType === 'GOODS' && hsnMaster.type !== 'HSN') {
                throw new BadRequestException('Please select a valid HSN Code for Goods.');
            }
            if (!hsnMaster.isActive) {
                throw new BadRequestException(currentProductType === 'SERVICES' ? 'The selected SAC Code is inactive.' : 'The selected HSN Code is inactive.');
            }
            updateData.hsnMasterId = hsnMaster.id;
            updateData.hsn_code = hsnMaster.code;
            updateData.tax_rate = parseFloat(String(hsnMaster.taxRate));
            updateData.hsn_description = hsnMaster.description || '';
        } else if (dto.product_type && dto.product_type !== product.product_type) {
            const hsnMaster = await this.prisma.hsnMaster.findFirst({
                where: { id: product.hsnMasterId }
            });
            if (hsnMaster) {
                if (dto.product_type === 'SERVICES' && hsnMaster.type !== 'SAC') {
                    throw new BadRequestException('Please select a valid SAC Code for Services.');
                }
                if (dto.product_type === 'GOODS' && hsnMaster.type !== 'HSN') {
                    throw new BadRequestException('Please select a valid HSN Code for Goods.');
                }
            }
        }

        return this.repository.updateProduct(id, updateData);
    }

    async getProductNameSuggestions(name: string, userId: number) {
        if (!name || name.length < 2) return [];
        const products = await this.repository.getProductNameSuggestions(name, userId);
        return products.map(p => p.product_name);
    }

    async checkProductNameUnique(name: string, userId: number, excludeId?: number) {
        const existing = await this.repository.findByProductName(name, userId);
        if (existing && (!excludeId || existing.id !== excludeId)) {
            return { isUnique: false };
        }
        return { isUnique: true };
    }

    async getProducts(query: GetProductsQuery, userId: number) {
        const page = Math.max(1, Number(query.page) || 1);
        const limit = Math.max(1, Number(query.limit) || 10);
        const skip = (page - 1) * limit;

        let status: any = undefined;
        if (query.status === 'ACTIVE' || query.status === 'INACTIVE') {
            status = query.status;
        }

        let product_type: any = undefined;
        if (query.product_type === 'GOODS' || query.product_type === 'SERVICES') {
            product_type = query.product_type;
        }

        const result = await this.repository.getProducts({
            skip,
            take: limit,
            searchTerm: query.search,
            uom_id: query.uom_id ? parseInt(query.uom_id.toString(), 10) : undefined,
            product_type,
            status,
            created_by: userId,
            isExport: (query as any).isExport
        });

        const mappedProducts = result.products.map((prod: any) => this.mapProductCategories(prod));

        return {
            products: mappedProducts,
            total: result.total,
            totalPages: result.totalPages
        };
    }

    async getProductById(id: number, userId: number) {
        const product = await this.repository.findProductById(id);
        if (!product || product.created_by !== userId) throw new NotFoundException('Product not found');
        return this.mapProductCategories(product);
    }

    async toggleStatus(id: number, dto: ToggleProductStatusDto, userId: number) {
        const product = await this.repository.findProductById(id);
        if (!product || product.created_by !== userId) throw new NotFoundException('Product not found');
        return this.repository.toggleStatus(id, dto.status as MasterStatus);
    }

    async deleteProduct(id: number, userId: number) {
        const product = await this.repository.findProductById(id);
        if (!product || product.created_by !== userId) throw new NotFoundException('Product not found');

        // Check if used in Purchase Orders
        const usedInPO = await this.prisma.purchaseOrderItem.findFirst({
            where: {
                OR: [
                    { productId: id },
                    { productCode: product.product_code }
                ]
            }
        });
        if (usedInPO) throw new BadRequestException('Cannot delete product because it is in use in Purchase Orders');

        // Check if used in Sales Orders
        const usedInSO = await this.prisma.salesOrderItem.findFirst({
            where: {
                productCode: product.product_code
            }
        });
        if (usedInSO) throw new BadRequestException('Cannot delete product because it is in use in Sales Orders');

        // Check if used in Purchase Invoices
        const usedInPI = await this.prisma.purchaseInvoiceItem.findFirst({
            where: {
                OR: [
                    { productId: id },
                    { productCode: product.product_code }
                ]
            }
        });
        if (usedInPI) throw new BadRequestException('Cannot delete product because it is in use in Purchase Invoices');

        // Check if used in Goods Receipt Notes (GRN)
        const usedInGRN = await this.prisma.grnItem.findFirst({
            where: {
                OR: [
                    { productId: id },
                    { productCode: product.product_code }
                ]
            }
        });
        if (usedInGRN) throw new BadRequestException('Cannot delete product because it is in use in Goods Receipt Notes (GRN)');

        // Check if used in Sales Invoices
        const usedInSI = await this.prisma.salesInvoiceItem.findFirst({
            where: {
                OR: [
                    { productId: id },
                    { productCode: product.product_code }
                ]
            }
        });
        if (usedInSI) throw new BadRequestException('Cannot delete product because it is in use in Sales Invoices');

        // Check if used in Sales Challans
        const usedInSC = await this.prisma.salesChallanItem.findFirst({
            where: {
                OR: [
                    { productId: id },
                    { productCode: product.product_code }
                ]
            }
        });
        if (usedInSC) throw new BadRequestException('Cannot delete product because it is in use in Sales Challans');

        return this.repository.softDelete(id);
    }

    async downloadSample() {
        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('Sample Data');
        worksheet.views = [{ state: 'frozen', ySplit: 1 }];

        const headers = [
            'Type*', 'Product Name*', 'UOM*', 'Category*',
            'Sub Category*', 'Sub Sub Category', 'HSN/SAC Code*', 'Description'
        ];
        const headerRow = worksheet.getRow(1);
        headerRow.height = 28;
        headers.forEach((h, idx) => {
            const cell = headerRow.getCell(idx + 1);
            const isRequired = h.includes('*');
            cell.value = h;
            cell.font = { bold: true, color: { argb: isRequired ? 'FF881337' : 'FF1E293B' }, size: 11 };
            cell.alignment = { vertical: 'middle', horizontal: 'center' };
            cell.fill = {
                type: 'pattern',
                pattern: 'solid',
                fgColor: { argb: isRequired ? 'FFFECDD3' : 'FFF1F5F9' }
            };
            cell.border = {
                top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
                left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
                bottom: { style: 'medium', color: { argb: isRequired ? 'FFFDA4AF' : 'FFCBD5E1' } },
                right: { style: 'thin', color: { argb: 'FFE2E8F0' } },
            };
        });

        for (let i = 2; i <= 1000; i++) {
            worksheet.getCell(`A${i}`).dataValidation = {
                type: 'list',
                allowBlank: true,
                formulae: ['"GOODS,SERVICES"'],
                showInputMessage: true,
                promptTitle: 'Select Type',
                prompt: 'Choose one of:\nGOODS,\nSERVICES'
            };
            worksheet.getCell(`G${i}`).numFmt = '@';
        }

        worksheet.columns = headers.map((h) => ({ width: Math.max(25, h.length + 6) }));

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
            filename: 'Product_Master_Sample.xlsx',
            mimetype: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        };
    }

    async importProducts(buffer: Buffer, userId: number) {
        const workbook = new ExcelJS.Workbook();
        await workbook.xlsx.load(buffer as any);
        const worksheet = workbook.getWorksheet(1);

        if (!worksheet) {
            throw new BadRequestException('Invalid Excel file format');
        }

        const rowCount = worksheet.rowCount;
        if (rowCount < 2) {
            throw new BadRequestException('No data found to import');
        }

        const headers = [
            'Type*', 'Product Name*', 'UOM*', 'Category*',
            'Sub Category*', 'Sub Sub Category', 'HSN/SAC Code*', 'Description'
        ];

        // 1. Pre-load Master Data for this User to optimize validation performance
        const [uomList, categoryList, hsnMasterList, legacyHsnList, existingProducts] = await Promise.all([
            this.prisma.unitMaster.findMany({ where: { user_id: userId, status: 'ACTIVE' } }),
            this.prisma.category.findMany({
                where: { user_id: userId, status: 'ACTIVE' },
                include: { parent: { include: { parent: true } } }
            }),
            this.prisma.hsnMaster.findMany({ where: { createdBy: userId, isActive: true } }),
            this.prisma.hsn.findMany({ where: { active: true } }),
            this.prisma.product.findMany({
                where: { created_by: userId, is_deleted: false },
                select: { product_name: true }
            })
        ]);

        // Build UOM lookup map (case-insensitive name or gst_uom)
        const uomMap = new Map<string, number>();
        uomList.forEach(u => {
            uomMap.set(u.unit_name.toLowerCase().trim(), u.id);
            if (u.gst_uom) uomMap.set(u.gst_uom.toLowerCase().trim(), u.id);
            if (u.full_name_of_measurement) uomMap.set(u.full_name_of_measurement.toLowerCase().trim(), u.id);
        });

        // Build Category Hierarchy tree
        const level1Map = new Map<string, any>();
        categoryList.filter(c => !c.parent_id).forEach(c => {
            level1Map.set(c.name.toLowerCase().trim(), c);
        });

        const level2Categories = categoryList.filter(c => c.parent_id && !c.parent?.parent_id);
        const level3Categories = categoryList.filter(c => c.parent_id && c.parent?.parent_id);

        // Build HSN Lookup Map: HsnMaster takes precedence over legacy Hsn
        const hsnMap = new Map<string, { code: string; type: 'HSN' | 'SAC'; taxRate: number; description: string; hsnMasterId: string | null }>();
        legacyHsnList.forEach(h => {
            const codeKey = h.hsnCode.toLowerCase().trim();
            const rate = h.rate ? Number(h.rate) : 0;
            const hType = (h.type && h.type.toUpperCase() === 'SAC') ? 'SAC' : 'HSN';
            hsnMap.set(codeKey, {
                code: h.hsnCode,
                type: hType,
                taxRate: rate,
                description: h.description || '',
                hsnMasterId: null
            });
        });
        hsnMasterList.forEach(h => {
            const codeKey = h.code.toLowerCase().trim();
            const hType = (h.type && String(h.type).toUpperCase() === 'SAC') ? 'SAC' : 'HSN';
            hsnMap.set(codeKey, {
                code: h.code,
                type: hType,
                taxRate: Number(h.taxRate),
                description: h.description || '',
                hsnMasterId: h.id
            });
        });

        // Build Existing DB Products set for duplicate checking
        const dbProductNames = new Set<string>(
            existingProducts.map(p => p.product_name.toLowerCase().trim())
        );

        // Track in-file duplicates
        const fileProductNames = new Set<string>();

        // Dynamic Header Mapping
        let headerRowIndex = 1;
        const colMap: Record<string, number> = {
            type: 1, prodName: 2, uom: 3, category: 4,
            subCategory: 5, subSubCategory: 6, hsn: 7, taxRate: 8, description: 9
        };

        for (let r = 1; r <= Math.min(rowCount, 10); r++) {
            const row = worksheet.getRow(r);
            let foundHeaders = false;
            row.eachCell((cell, colNumber) => {
                const val = String(cell.value || '').trim().toLowerCase();
                if (val.includes('product name') || val.includes('service name')) { colMap['prodName'] = colNumber; foundHeaders = true; }
                else if (val.includes('type') || val.includes('product type')) colMap['type'] = colNumber;
                else if (val.includes('uom') || val.includes('unit')) colMap['uom'] = colNumber;
                else if (val.includes('sub sub category') || val.includes('sub-sub category') || val.includes('sub-subcategory')) colMap['subSubCategory'] = colNumber;
                else if (val.includes('sub category') || val.includes('sub-category') || val.includes('subcategory')) colMap['subCategory'] = colNumber;
                else if (val.includes('category')) colMap['category'] = colNumber;
                else if (val.includes('hsn') || val.includes('sac')) colMap['hsn'] = colNumber;
                else if (val.includes('tax rate') || val.includes('tax %')) colMap['taxRate'] = colNumber;
                else if (val.includes('description')) colMap['description'] = colNumber;
            });
            if (foundHeaders) {
                headerRowIndex = r;
                break;
            }
        }

        const getVal = (row: ExcelJS.Row, key: string, defaultVal: string = '') => {
            const colIdx = colMap[key];
            if (!colIdx) return defaultVal;
            const cell = row.getCell(colIdx);
            const textValue = cell.text;
            if (textValue !== undefined && textValue !== null && textValue !== '') {
                return String(textValue).trim();
            }
            return cell.value !== undefined && cell.value !== null ? String(cell.value).trim() : defaultVal;
        };

        const validRows: Array<{
            rowNum: number;
            data: {
                prodName: string;
                typeUpper: ProductType;
                uomId: number;
                categoryId: string;
                hsnCode: string;
                taxRate: number;
                description: string;
                hsnMasterId: string | null;
            };
            originalValues: any[];
        }> = [];

        const failedRows: Array<{ rowNum: number; values: any[]; error: string }> = [];

        for (let i = headerRowIndex + 1; i <= rowCount; i++) {
            const row = worksheet.getRow(i);

            const rawValues = [
                getVal(row, 'type'),
                getVal(row, 'prodName'),
                getVal(row, 'uom'),
                getVal(row, 'category'),
                getVal(row, 'subCategory'),
                getVal(row, 'subSubCategory'),
                getVal(row, 'hsn'),
                getVal(row, 'taxRate'),
                getVal(row, 'description')
            ];

            const typeRaw = rawValues[0];
            const prodName = rawValues[1];
            const uomRaw = rawValues[2];
            const catRaw = rawValues[3];
            const subCatRaw = rawValues[4];
            const subSubCatRaw = rawValues[5];
            const hsnRaw = rawValues[6];

            // Skip completely empty rows
            if (!typeRaw && !prodName && !uomRaw && !catRaw && !subCatRaw && !subSubCatRaw && !hsnRaw) {
                continue;
            }

            // STEP 2: Validate mandatory fields
            if (!typeRaw) {
                failedRows.push({ rowNum: i, values: rawValues, error: 'Type is required.' });
                continue;
            }
            if (!prodName) {
                failedRows.push({ rowNum: i, values: rawValues, error: 'Product Name is required.' });
                continue;
            }
            if (!uomRaw) {
                failedRows.push({ rowNum: i, values: rawValues, error: 'UOM is required.' });
                continue;
            }
            if (!catRaw) {
                failedRows.push({ rowNum: i, values: rawValues, error: 'Category is required.' });
                continue;
            }
            if (!subCatRaw) {
                failedRows.push({ rowNum: i, values: rawValues, error: 'Sub Category is required.' });
                continue;
            }
            if (!hsnRaw) {
                failedRows.push({ rowNum: i, values: rawValues, error: 'HSN/SAC Code is required.' });
                continue;
            }

            const normalizedProdName = prodName.toLowerCase();

            // STEP 3: Duplicate Check - In Uploaded Excel File
            if (fileProductNames.has(normalizedProdName)) {
                failedRows.push({
                    rowNum: i,
                    values: rawValues,
                    error: 'Duplicate product found in uploaded Excel file. Product cannot be imported more than once.'
                });
                continue;
            }

            // STEP 4: Duplicate Check - Against Product Master DB
            if (dbProductNames.has(normalizedProdName)) {
                failedRows.push({
                    rowNum: i,
                    values: rawValues,
                    error: 'Product already exists in Product Master. Duplicate product cannot be imported.'
                });
                continue;
            }

            // Record as seen in file for subsequent row duplicate checking
            fileProductNames.add(normalizedProdName);

            // STEP 5: Validate Type
            const typeUpper = typeRaw.toUpperCase();
            if (typeUpper !== 'GOODS' && typeUpper !== 'SERVICES') {
                failedRows.push({
                    rowNum: i,
                    values: rawValues,
                    error: 'Invalid Type. Allowed values are GOODS or SERVICES.'
                });
                continue;
            }

            // STEP 6: Validate UOM exists in UOM Master
            const uomId = uomMap.get(uomRaw.toLowerCase());
            if (!uomId) {
                failedRows.push({
                    rowNum: i,
                    values: rawValues,
                    error: `UOM "${uomRaw}" does not exist in UOM Master. Please create the UOM first.`
                });
                continue;
            }

            // STEP 7: Validate Category exists in Category Master
            const categoryObj = level1Map.get(catRaw.toLowerCase());
            if (!categoryObj) {
                failedRows.push({
                    rowNum: i,
                    values: rawValues,
                    error: `Category "${catRaw}" does not exist in Category Master. Please create the Category first.`
                });
                continue;
            }

            // STEP 8 & 9: Validate Sub Category exists and belongs to selected Category
            const matchingSubCats = level2Categories.filter(
                sc => sc.name.toLowerCase().trim() === subCatRaw.toLowerCase()
            );

            if (matchingSubCats.length === 0) {
                failedRows.push({
                    rowNum: i,
                    values: rawValues,
                    error: `Sub Category "${subCatRaw}" does not exist in Category Master. Please create the Sub Category first.`
                });
                continue;
            }

            const validSubCat = matchingSubCats.find(sc => sc.parent_id === categoryObj.id);
            if (!validSubCat) {
                failedRows.push({
                    rowNum: i,
                    values: rawValues,
                    error: `Sub Category "${subCatRaw}" does not belong to the selected Category "${catRaw}".`
                });
                continue;
            }

            // STEP 10, 11 & 12: Validate Sub Sub Category (if provided)
            let targetCategoryId = validSubCat.id;

            if (subSubCatRaw) {
                const matchingSubSubCats = level3Categories.filter(
                    ssc => ssc.name.toLowerCase().trim() === subSubCatRaw.toLowerCase()
                );

                if (matchingSubSubCats.length === 0) {
                    failedRows.push({
                        rowNum: i,
                        values: rawValues,
                        error: `Sub Sub Category "${subSubCatRaw}" does not exist in Category Master. Please create the Sub Sub Category first.`
                    });
                    continue;
                }

                const validSubSubCat = matchingSubSubCats.find(ssc => ssc.parent_id === validSubCat.id);
                if (!validSubSubCat) {
                    failedRows.push({
                        rowNum: i,
                        values: rawValues,
                        error: `Sub Sub Category "${subSubCatRaw}" does not belong to the selected Sub Category "${subCatRaw}".`
                    });
                    continue;
                }

                targetCategoryId = validSubSubCat.id;
            }

            // STEP 13: Validate HSN/SAC Code exists in HSN Master
            const hsnObj = hsnMap.get(hsnRaw.toLowerCase());
            if (!hsnObj) {
                failedRows.push({
                    rowNum: i,
                    values: rawValues,
                    error: `HSN/SAC Code "${hsnRaw}" does not exist in HSN Master. Please create the HSN/SAC Code first.`
                });
                continue;
            }

            // STEP 13b: Validate Type vs HSN/SAC Master type compatibility
            if (typeUpper === 'GOODS' && hsnObj.type === 'SAC') {
                failedRows.push({
                    rowNum: i,
                    values: rawValues,
                    error: `Code "${hsnRaw}" is a SAC Code. Goods must use an HSN Code.`
                });
                continue;
            }

            if (typeUpper === 'SERVICES' && hsnObj.type === 'HSN') {
                failedRows.push({
                    rowNum: i,
                    values: rawValues,
                    error: `Code "${hsnRaw}" is an HSN Code. Services must use a SAC Code.`
                });
                continue;
            }

            // STEP 14, 15 & 16: Derive Tax Rate and Description from HSN Master (overriding Excel)
            const derivedTaxRate = hsnObj.taxRate;
            const derivedDescription = hsnObj.description;

            validRows.push({
                rowNum: i,
                data: {
                    prodName,
                    typeUpper: typeUpper as ProductType,
                    uomId,
                    categoryId: targetCategoryId,
                    hsnCode: hsnObj.code,
                    taxRate: derivedTaxRate,
                    description: derivedDescription,
                    hsnMasterId: hsnObj.hsnMasterId,
                },
                originalValues: rawValues
            });
        }

        // STEP 20: Transaction Safety - Insert all valid products in a database transaction
        const successRows: any[] = [];

        if (validRows.length > 0) {
            const usedCodes = new Set<string>();
            await this.prisma.$transaction(async (tx) => {
                for (const validItem of validRows) {
                    const product_code = await this.generateProductCode(userId, validItem.data.typeUpper, tx, usedCodes);

                    await tx.product.create({
                        data: {
                            product_name: validItem.data.prodName,
                            product_code,
                            product_type: validItem.data.typeUpper,
                            uom_id: validItem.data.uomId,
                            category_id: validItem.data.categoryId,
                            hsn_code: validItem.data.hsnCode,
                            tax_rate: validItem.data.taxRate,
                            description: validItem.data.description,
                            hsn_description: validItem.data.description,
                            hsnMasterId: validItem.data.hsnMasterId,
                            created_by: userId,
                            status: MasterStatus.ACTIVE
                        }
                    });

                    // Format values for success Excel report (including authoritative derived description)
                    const updatedValues = [...validItem.originalValues];
                    updatedValues[7] = validItem.data.description;

                    successRows.push({
                        rowNum: validItem.rowNum,
                        originalRowValues: [null, ...updatedValues]
                    });
                }
            });
        }

        // Return standardized summary response with base64 Success & Error Excel reports
        return this.importValidator.buildResponseSummary(headers, successRows, failedRows);
    }
}
