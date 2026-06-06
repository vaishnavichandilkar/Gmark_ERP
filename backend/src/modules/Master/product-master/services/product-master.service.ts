import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { ProductMasterRepository } from '../repositories/product-master.repository';
import { CreateProductDto, UpdateProductDto, ToggleProductStatusDto } from '../dto/product.dto';
import { MasterStatus, ProductType } from '@prisma/client';
import * as ExcelJS from 'exceljs';
import * as PDFDocument from 'pdfkit';
import { HsnMasterService } from '../../hsn-master/hsn-master.service';
import { PrismaService } from '../../../../infrastructure/prisma/prisma.service';

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
        private readonly prisma: PrismaService
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

            worksheet.mergeCells('A1:J1');
            worksheet.getCell('A1').value = 'ERP';
            worksheet.getCell('A1').font = { size: 18, bold: true };
            worksheet.getCell('A1').alignment = { horizontal: 'center', vertical: 'middle' };

            worksheet.mergeCells('A2:J2');
            worksheet.getCell('A2').value = 'Product Master Report';
            worksheet.getCell('A2').font = { size: 14 };
            worksheet.getCell('A2').alignment = { horizontal: 'center', vertical: 'middle' };

            worksheet.mergeCells('A3:J3');
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
                const colX = [20, 50, 95, 215, 275, 325, 425, 525, 605, 665];
                const headers = [
                    'Sr.', 'Type', nameHeader, codeHeader, 'UOM',
                    'Category', 'Sub Category', hsnHeader, 'Tax%', 'Status'
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

                    doc.fontSize(7);
                    doc.text((index + 1).toString(), colX[0], y);
                    doc.text(prod.product_type, colX[1], y);
                    doc.text(prod.product_name, colX[2], y, { width: 110 });
                    doc.text(prod.product_code, colX[3], y);
                    doc.text(prod.uom?.gst_uom || '-', colX[4], y);
                    doc.text(prod.category?.name || '-', colX[5], y, { width: 90 });
                    doc.text(prod.sub_category?.name || '-', colX[6], y, { width: 90 });
                    doc.text(prod.hsn_code, colX[7], y);
                    doc.text(`${prod.tax_rate}%`, colX[8], y);
                    doc.text(prod.status === MasterStatus.ACTIVE ? 'Active' : 'Inactive', colX[9], y);

                    y += 18;
                });

                doc.end();
            });
        }

        throw new BadRequestException('Format is required. Please use xlsx or pdf.');
    }

    async generateProductCode(userId: number, type?: ProductType): Promise<string> {
        const prefix = type === ProductType.SERVICES ? 'SV' : 'PD';
        const defaultCode = type === ProductType.SERVICES ? 'SV00001' : 'PD00001';
        const padLength = 5;

        const lastCode = await this.repository.getLastProductCode(userId, prefix);
        if (!lastCode) {
            return defaultCode;
        }

        const match = lastCode.match(/\d+/);
        if (!match) {
            return defaultCode;
        }

        const numericPart = parseInt(match[0], 10);
        const nextNumeric = numericPart + 1;
        return `${prefix}${nextNumeric.toString().padStart(padLength, '0')}`;
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
        return this.repository.softDelete(id);
    }

    async downloadSample() {
        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('Sample Data');
        worksheet.views = [{ state: 'frozen', ySplit: 1 }];

        const headers = ['Type*', 'Product Name*', 'UOM*', 'Category*', 'Sub Category*', 'Sub Sub Category', 'HSN/SAC Code*', 'Product Description', 'Status'];
        worksheet.addRow(headers);

        const headerRow = worksheet.getRow(1);
        headerRow.font = { bold: true };
        headerRow.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFD3D3D3' }
        };

        for (let i = 2; i <= 1000; i++) {
            worksheet.getCell(`A${i}`).dataValidation = {
                type: 'list',
                allowBlank: true,
                formulae: ['"GOODS,SERVICES"'],
                showInputMessage: true,
                promptTitle: 'Select Type',
                prompt: 'Choose one of:\nGOODS,\nSERVICES'
            };
            worksheet.getCell(`I${i}`).dataValidation = {
                type: 'list',
                allowBlank: true,
                formulae: ['"ACTIVE,INACTIVE"'],
                showInputMessage: true,
                promptTitle: 'Select Status',
                prompt: 'Choose one of:\nACTIVE,\nINACTIVE'
            };
            worksheet.getCell(`G${i}`).numFmt = '@';
        }

        worksheet.columns = headers.map(() => ({ width: 22 }));

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

        let imported = 0;
        let failed = 0;
        let duplicates = 0;
        const errors: string[] = [];
        const prisma = (this.repository as any).prisma;

        let headerRowIndex = -1;
        const colMap: Record<string, number> = {};

        for (let r = 1; r <= Math.min(rowCount, 10); r++) {
            const row = worksheet.getRow(r);
            let foundHeaders = false;
            row.eachCell((cell, colNumber) => {
                const val = String(cell.value || '').trim().toLowerCase();
                if (val.includes('prod code') || val.includes('product code')) colMap['prodCode'] = colNumber;
                if (val.includes('product name') || val.includes('service name')) { colMap['prodName'] = colNumber; foundHeaders = true; }
                if (val.includes('uom')) colMap['uom'] = colNumber;
                if (val.includes('type') || val.includes('product type')) colMap['productType'] = colNumber;
                if (val.includes('category')) colMap['category'] = colNumber;
                if (val.includes('sub category')) colMap['subCategory'] = colNumber;
                if (val.includes('sub sub category') || val.includes('sub-sub category') || val.includes('sub-subcategory')) colMap['subSubCategory'] = colNumber;
                if (val.includes('hsn') || val.includes('sac')) colMap['hsn'] = colNumber;
                if (val.includes('product description') || val.includes('description') || val.includes('service description')) colMap['description'] = colNumber;
                if (val === 'status') colMap['status'] = colNumber;
            });

            if (foundHeaders) {
                headerRowIndex = r;
                break;
            }
        }

        if (headerRowIndex === -1) {
            throw new BadRequestException('Could not find Product Name or Service Name column in the provided Excel file.');
        }

        const getVal = (row: ExcelJS.Row, key: string, defaultVal: any = '') => {
            const colIdx = colMap[key];
            if (!colIdx) return defaultVal;
            const cell = row.getCell(colIdx);
            const textValue = cell.text;
            if (textValue !== undefined && textValue !== null && textValue !== '') {
                return textValue;
            }
            return cell.value !== undefined && cell.value !== null ? cell.value : defaultVal;
        };

        for (let i = headerRowIndex + 1; i <= rowCount; i++) {
            const row = worksheet.getRow(i);

            const prodCode = String(getVal(row, 'prodCode')).trim();
            const prodName = String(getVal(row, 'prodName')).trim();
            const description = String(getVal(row, 'description')).trim();

            if (!prodName || prodName === '-') continue;

            try {
                let uomName = String(getVal(row, 'uom')).trim();
                let uom = uomName && uomName !== '-' ? await prisma.unitMaster.findFirst({ where: { user_id: userId, unit_name: uomName } }) : null;
                if (!uom && uomName && uomName !== '-') {
                    let gstUom = 'OTH';
                    const nameLower = uomName.toLowerCase();
                    if (nameLower.includes('weight') || nameLower.includes('kilogram') || nameLower === 'kg' || nameLower === 'kgs') gstUom = 'KGS';
                    else if (nameLower.includes('number') || nameLower.includes('nos') || nameLower === 'unit' || nameLower === 'pc' || nameLower === 'pcs') gstUom = 'NOS';
                    else if (nameLower.includes('gram')) gstUom = 'GMS';
                    else if (nameLower.includes('liter') || nameLower.includes('litre')) gstUom = 'LTR';
                    else if (nameLower.includes('meter') || nameLower.includes('metre')) gstUom = 'MTR';
                    else if (nameLower.includes('packet') || nameLower.includes('pkt')) gstUom = 'PAC';
                    else if (nameLower.includes('box')) gstUom = 'BOX';

                    uom = await prisma.unitMaster.findFirst({ where: { user_id: userId, gst_uom: gstUom } });
                    if (!uom) {
                        uom = await prisma.unitMaster.create({
                            data: { 
                                user_id: userId, 
                                unit_name: uomName, 
                                gst_uom: gstUom, 
                                full_name_of_measurement: uomName, 
                                source: 'USER' 
                            }
                        });
                    }
                }
                if (!uom) uom = await prisma.unitMaster.findFirst({ where: { user_id: userId } });
                if (!uom) {
                    uom = await prisma.unitMaster.create({
                        data: { user_id: userId, unit_name: 'NOS', gst_uom: 'NOS', full_name_of_measurement: 'Numbers', source: 'SYSTEM' }
                    });
                }
                let uom_id: number = uom.id;

                const productTypeRaw = String(getVal(row, 'productType')).trim().toUpperCase();
                let productType: ProductType = productTypeRaw === 'SERVICES' ? ProductType.SERVICES : ProductType.GOODS;

                let catName = String(getVal(row, 'category')).trim();
                let cat = catName && catName !== '-' ? await prisma.category.findFirst({ where: { user_id: userId, name: catName, parent_id: null } }) : null;
                if (!cat && catName && catName !== '-') {
                    cat = await prisma.category.create({ data: { user_id: userId, name: catName } });
                }
                if (!cat) cat = await prisma.category.findFirst({ where: { user_id: userId, parent_id: null } });
                if (!cat) {
                    cat = await prisma.category.create({ data: { user_id: userId, name: 'General' } });
                }
                let category_id: string = cat.id;

                let subCatName = String(getVal(row, 'subCategory')).trim();
                let subCat = subCatName && subCatName !== '-' ? await prisma.category.findFirst({ where: { user_id: userId, parent_id: category_id, name: subCatName } }) : null;
                if (!subCat && subCatName && subCatName !== '-') {
                    subCat = await prisma.category.create({ data: { user_id: userId, parent_id: category_id, name: subCatName } });
                }
                if (subCat) {
                    category_id = subCat.id;
                }

                let subSubCatName = String(getVal(row, 'subSubCategory')).trim();
                if (subSubCatName && subSubCatName !== '-' && subSubCatName !== '') {
                    let subSub = await prisma.category.findFirst({
                        where: { user_id: userId, parent_id: category_id, name: { equals: subSubCatName, mode: 'insensitive' } }
                    });
                    if (!subSub) {
                        subSub = await prisma.category.create({
                            data: { user_id: userId, parent_id: category_id, name: subSubCatName }
                        });
                    }
                    category_id = subSub.id;
                }

                let hsnCode = String(getVal(row, 'hsn')).trim();
                if (/^\d+$/.test(hsnCode) && hsnCode.length % 2 !== 0) {
                    hsnCode = '0' + hsnCode;
                }
                
                let hsnMasterId = '';
                let taxRateValue = 0;
                let hsnDescValue = '';

                if (hsnCode && hsnCode !== '-') {
                    const hsnMaster = await prisma.hsnMaster.findFirst({
                        where: { code: hsnCode, createdBy: userId }
                    });
                    if (!hsnMaster) {
                        throw new BadRequestException(`${productType === ProductType.SERVICES ? 'SAC' : 'HSN'} Code does not exist in HSN Master.`);
                    }
                    if (productType === ProductType.SERVICES && hsnMaster.type !== 'SAC') {
                        throw new BadRequestException('Please select a valid SAC Code for Services.');
                    }
                    if (productType === ProductType.GOODS && hsnMaster.type !== 'HSN') {
                        throw new BadRequestException('Please select a valid HSN Code for Goods.');
                    }
                    hsnMasterId = hsnMaster.id;
                    taxRateValue = parseFloat(String(hsnMaster.taxRate));
                    hsnDescValue = hsnMaster.description || '';
                } else {
                    throw new BadRequestException(`${productType === ProductType.SERVICES ? 'SAC' : 'HSN'} Code is required`);
                }

                const statusStr = String(getVal(row, 'status')).trim().toUpperCase();
                const status = statusStr === 'INACTIVE' ? MasterStatus.INACTIVE : MasterStatus.ACTIVE;

                let codeToUse = prodCode;
                if (!codeToUse || codeToUse === '-') {
                    codeToUse = await this.generateProductCode(userId, productType);
                }

                const existing = await prisma.product.findFirst({
                    where: {
                        created_by: userId,
                        OR: [
                            { product_code: { equals: codeToUse, mode: 'insensitive' } },
                            { product_name: { equals: prodName, mode: 'insensitive' } }
                        ]
                    },
                });

                if (existing) {
                    duplicates++;
                    continue;
                }

                await this.repository.createProduct({
                    product_name: prodName,
                    product_code: codeToUse,
                    uom_id,
                    product_type: productType,
                    category_id,
                    hsnMasterId,
                    hsn_code: hsnCode,
                    tax_rate: taxRateValue,
                    hsn_description: hsnDescValue,
                    description: (description && description !== '-') ? description : '',
                    status,
                    created_by: userId,
                });
                imported++;

            } catch (error) {
                failed++;
                errors.push(`Row ${i} (${prodName}): ${error.message}`);
            }
        }

        if (imported === 0 && failed > 0) {
            throw new BadRequestException(`Import failed: ${errors[0]}`);
        }

        if (imported === 0 && duplicates > 0 && failed === 0) {
            return {
                success: true,
                message: `No new products/services imported. ${duplicates} duplicate rows were skipped.`,
            };
        }

        if (imported === 0 && failed === 0) {
            throw new BadRequestException('No data found to import');
        }

        return {
            success: true,
            message: `Successfully imported ${imported} products/services. ${duplicates} duplicate rows were skipped.${failed > 0 ? ' ' + failed + ' failed.' : ''}`,
            errors: failed > 0 ? errors : undefined,
        };
    }
}
