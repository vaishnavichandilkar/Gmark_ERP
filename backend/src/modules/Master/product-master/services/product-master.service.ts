import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { ProductMasterRepository } from '../repositories/product-master.repository';
import { CreateProductDto, UpdateProductDto, ToggleProductStatusDto } from '../dto/product.dto';
import { MasterStatus, ProductType } from '@prisma/client';
import * as ExcelJS from 'exceljs';
import * as PDFDocument from 'pdfkit';

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
    constructor(private readonly repository: ProductMasterRepository) { }

    // ... existing methods ...

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

            worksheet.columns = [
                { header: 'Sr. No', key: 'srNo', width: 10 },
                { header: 'Prod Code', key: 'productCode', width: 15 },
                { header: 'Product Name', key: 'productName', width: 30 },
                { header: 'UOM', key: 'uom', width: 15 },
                { header: 'Type', key: 'productType', width: 15 },
                { header: 'Category', key: 'category', width: 20 },
                { header: 'Sub Category', key: 'subCategory', width: 20 },
                { header: 'Sub-SubCategory', key: 'subSubCategory', width: 20 },
                { header: 'HSN Code', key: 'hsnCode', width: 15 },
                { header: 'Tax %', key: 'taxRate', width: 10 },
                { header: 'Status', key: 'status', width: 12 },
            ];

            (products as any[]).forEach((prod, index) => {
                worksheet.addRow({
                    srNo: index + 1,
                    productCode: prod.product_code,
                    productName: prod.product_name,
                    uom: prod.uom?.gst_uom || '-',
                    productType: prod.product_type,
                    category: prod.category?.name || '-',
                    subCategory: prod.sub_category?.name || '-',
                    subSubCategory: prod.sub_sub_category?.name || '-',
                    hsnCode: prod.hsn_code,
                    taxRate: `${prod.tax_rate}%`,
                    status: prod.status === MasterStatus.ACTIVE ? 'Active' : 'Inactive',
                });
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

                const tableTop = 100;
                const colX = [20, 50, 110, 230, 280, 340, 440, 540, 620, 680];
                const headers = [
                    'Sr.', 'Prod Code', 'Product Name', 'UOM', 'Type',
                    'Category', 'Sub Category', 'HSN', 'Tax%', 'Status'
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
                    doc.text(prod.product_code, colX[1], y);
                    doc.text(prod.product_name, colX[2], y, { width: 110 });
                    doc.text(prod.uom?.gst_uom || '-', colX[3], y);
                    doc.text(prod.product_type, colX[4], y);
                    doc.text(prod.category?.name || '-', colX[5], y, { width: 90 });
                    doc.text(prod.sub_category?.name || '-', colX[6], y, { width: 90 });
                    doc.text(prod.sub_sub_category?.name || '-', colX[7], y, { width: 90 });
                    doc.text(prod.hsn_code, colX[8], y);
                    doc.text(`${prod.tax_rate}%`, colX[9], y);
                    doc.text(prod.status === MasterStatus.ACTIVE ? 'Active' : 'Inactive', colX[10], y);

                    y += 18;
                });

                doc.end();
            });
        }

        throw new BadRequestException('Format is required. Please use xlsx or pdf.');
    }

    async generateProductCode(userId: number): Promise<string> {
        const lastCode = await this.repository.getLastProductCode(userId);
        if (!lastCode) {
            return 'PD00001';
        }

        // Extract numeric part using regex to be robust
        const match = lastCode.match(/\d+/);
        if (!match) {
            return 'PD00001';
        }

        const numericPart = parseInt(match[0], 10);
        const nextNumeric = numericPart + 1;
        return `PD${nextNumeric.toString().padStart(5, '0')}`;
    }

    async generateCodeForUser(userId: number) {
        const product_code = await this.generateProductCode(userId);
        return { product_code };
    }

    async getUomDropdown(userId: number) {
        return this.repository.getActiveUomsForDropdown(userId);
    }

    async getTaxByHsn(hsnCode: string) {
        const hsn = await this.repository.getHsnByCode(hsnCode);
        if (!hsn) throw new NotFoundException('HSN Code not found');
        return { tax_rate: Number(hsn.gst_rate) };
    }

    async getCategoryDropdown(userId: number) {
        return this.repository.getActiveCategoriesForDropdown(userId);
    }

    async getActiveSubCategories(categoryId: number, userId: number) {
        return this.repository.getActiveSubCategoriesForDropdown(categoryId, userId);
    }

    async getActiveSubSubCategories(subCategoryId: number, userId: number) {
        return this.repository.getActiveSubSubCategoriesForDropdown(subCategoryId, userId);
    }

    async createProduct(dto: CreateProductDto, userId: number) {
        // Uniqueness check
        const existing = await this.repository.findByProductName(dto.product_name, userId);
        if (existing) {
            throw new BadRequestException('Product name already exists');
        }

        const uom = await this.repository.getUomById(dto.uom_id);
        if (!uom || uom.user_id !== userId) throw new BadRequestException('No units found for this user');

        const category = await this.repository.getCategoryById(dto.category_id);
        if (!category) throw new BadRequestException('Invalid Category ID');

        // Validate SubCategory if provided
        if (dto.sub_category_id) {
            const subCategory = await this.repository.getSubCategoryById(dto.sub_category_id);
            if (!subCategory || subCategory.category_id !== dto.category_id) {
                throw new BadRequestException('Invalid Sub Category ID or it does not belong to the selected Category');
            }

            // Validate SubSubCategory if provided
            if (dto.sub_sub_category_id) {
                const subSub = await this.repository.getSubSubCategoryById(dto.sub_sub_category_id);
                if (!subSub || subSub.sub_category_id !== dto.sub_category_id) {
                    throw new BadRequestException('Invalid Sub Sub Category ID or it does not belong to the selected Sub Category');
                }
            } else {
                // Check if SubCategory HAS SubSubCategories. If so, selection is required.
                const subSubs = await this.repository.getActiveSubSubCategoriesForDropdown(dto.sub_category_id, userId);
                if (subSubs.length > 0) {
                    throw new BadRequestException('Sub-SubCategory is required for this SubCategory');
                }
            }
        }

        const hsn = await this.repository.getHsnByCode(dto.hsn_code);
        if (!hsn) throw new BadRequestException('HSN Code not found in master');

        const product_code = await this.generateProductCode(userId);

        return this.repository.createProduct({
            product_name: dto.product_name,
            product_code,
            uom_id: dto.uom_id,
            product_type: dto.product_type as ProductType,
            category_id: dto.category_id,
            sub_category_id: dto.sub_category_id,
            sub_sub_category_id: dto.sub_sub_category_id,
            hsn_code: dto.hsn_code,
            tax_rate: Number(hsn.gst_rate),
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

        if (dto.category_id || dto.sub_category_id || dto.sub_sub_category_id) {
            const catId = dto.category_id || product.category_id;
            const subCatId = dto.sub_category_id || product.sub_category_id;
            const subSubId = dto.sub_sub_category_id || (dto.sub_category_id ? null : product.sub_sub_category_id);

            if (subCatId) {
                const subCategory = await this.repository.getSubCategoryById(subCatId);
                if (!subCategory || subCategory.category_id !== catId) {
                    throw new BadRequestException('Invalid Category/Sub Category relation');
                }

                if (subSubId) {
                    const subSub = await this.repository.getSubSubCategoryById(subSubId);
                    if (!subSub || subSub.sub_category_id !== subCatId) {
                        throw new BadRequestException('Invalid Sub Category/Sub Sub Category relation');
                    }
                } else {
                    // Check if SubCategory has children. If yes, SubSub selection is required.
                    const subSubs = await this.repository.getActiveSubSubCategoriesForDropdown(subCatId, userId);
                    if (subSubs.length > 0) {
                        throw new BadRequestException('Sub-SubCategory is required for this SubCategory');
                    }
                }
            } else if (subSubId) {
                // If sub_category is removed but sub_sub is somehow present
                 throw new BadRequestException('Cannot have Sub-SubCategory without SubCategory');
            }
        }

        if (dto.hsn_code) {
            const hsn = await this.repository.getHsnByCode(dto.hsn_code);
            if (!hsn) throw new BadRequestException('HSN Code not found in master');
            updateData.tax_rate = Number(hsn.gst_rate);
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

        return this.repository.getProducts({
            skip,
            take: limit,
            searchTerm: query.search,
            uom_id: query.uom_id ? parseInt(query.uom_id.toString(), 10) : undefined,
            product_type,
            status,
            created_by: userId,
            isExport: (query as any).isExport
        });
    }

    async getProductById(id: number, userId: number) {
        const product = await this.repository.findProductById(id);
        if (!product || product.created_by !== userId) throw new NotFoundException('Product not found');
        return product;
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

        const headers = ['Product Name*', 'UOM*', 'Product Type*', 'Category*', 'Sub Category*', 'HSN Code*', 'Product Description', 'Status'];
        worksheet.addRow(headers);

        const headerRow = worksheet.getRow(1);
        headerRow.font = { bold: true };
        headerRow.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFD3D3D3' }
        };

        // Adding Product Type Data Validation (dropdown) to 'C' column (3rd column)
        // Adding Status Data Validation (dropdown) to 'H' column (8th column)
        for (let i = 2; i <= 1000; i++) {
            worksheet.getCell(`C${i}`).dataValidation = {
                type: 'list',
                allowBlank: true,
                formulae: ['"GOODS,SERVICES"']
            };
            worksheet.getCell(`H${i}`).dataValidation = {
                type: 'list',
                allowBlank: true,
                formulae: ['"ACTIVE,INACTIVE"']
            };
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
                if (val.includes('product name')) { colMap['prodName'] = colNumber; foundHeaders = true; }
                if (val.includes('uom')) colMap['uom'] = colNumber;
                if (val.includes('type') || val.includes('product type')) colMap['productType'] = colNumber;
                if (val.includes('category')) colMap['category'] = colNumber;
                if (val.includes('sub category')) colMap['subCategory'] = colNumber;
                if (val.includes('hsn code') || val.includes('hsn')) colMap['hsn'] = colNumber;
                if (val.includes('product description') || val.includes('description')) colMap['description'] = colNumber;
                if (val === 'status') colMap['status'] = colNumber;
            });

            if (foundHeaders) {
                headerRowIndex = r;
                break;
            }
        }

        if (headerRowIndex === -1) {
            throw new BadRequestException('Could not find Product Name column in the provided Excel file.');
        }

        const getVal = (row: ExcelJS.Row, key: string, defaultVal: any = '') => {
            const colIdx = colMap[key];
            if (!colIdx) return defaultVal;
            return row.getCell(colIdx).value;
        };

        for (let i = headerRowIndex + 1; i <= rowCount; i++) {
            const row = worksheet.getRow(i);

            const prodCode = String(getVal(row, 'prodCode')).trim();
            const prodName = String(getVal(row, 'prodName')).trim();
            const description = String(getVal(row, 'description')).trim();

            if (!prodName || prodName === '-') continue; // Skip empty rows

            try {
                let uomName = String(getVal(row, 'uom')).trim();
                let uom = uomName && uomName !== '-' ? await prisma.unitMaster.findFirst({ where: { user_id: userId, unit_name: uomName } }) : null;
                if (!uom && uomName && uomName !== '-') {
                    uom = await prisma.unitMaster.create({
                        data: { user_id: userId, unit_name: uomName, gst_uom: 'OTH', full_name_of_measurement: uomName, source: 'USER' }
                    });
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
                let cat = catName && catName !== '-' ? await prisma.category.findFirst({ where: { user_id: userId, name: catName } }) : null;
                if (!cat && catName && catName !== '-') {
                    cat = await prisma.category.create({ data: { user_id: userId, name: catName } });
                }
                if (!cat) cat = await prisma.category.findFirst({ where: { user_id: userId } });
                if (!cat) {
                    cat = await prisma.category.create({ data: { user_id: userId, name: 'General' } });
                }
                let category_id: number = cat.id;

                let subCatName = String(getVal(row, 'subCategory')).trim();
                let subCat = subCatName && subCatName !== '-' ? await prisma.subCategory.findFirst({ where: { user_id: userId, category_id, name: subCatName } }) : null;
                if (!subCat && subCatName && subCatName !== '-') {
                    subCat = await prisma.subCategory.create({ data: { user_id: userId, category_id, name: subCatName } });
                }
                if (!subCat) subCat = await prisma.subCategory.findFirst({ where: { user_id: userId, category_id } });
                if (!subCat) {
                    subCat = await prisma.subCategory.create({ data: { user_id: userId, category_id, name: 'General Sub' } });
                }
                let sub_category_id: number = subCat.id;

                let hsnCode = String(getVal(row, 'hsn')).trim();
                let hsn = hsnCode && hsnCode !== '-' ? await prisma.hsnMaster.findUnique({ where: { hsn_code: hsnCode } }) : null;
                if (!hsn && hsnCode && hsnCode !== '-') {
                    hsn = await prisma.hsnMaster.create({ data: { hsn_code: hsnCode, description: 'Auto Created', gst_rate: 0, created_by: userId } });
                }
                if (!hsn) hsn = await prisma.hsnMaster.findFirst();
                if (!hsn) {
                    hsn = await prisma.hsnMaster.create({ data: { hsn_code: '0000', description: 'Default HSN', gst_rate: 0, created_by: userId } });
                }

                const statusStr = String(getVal(row, 'status')).trim().toUpperCase();
                const status = statusStr === 'INACTIVE' ? MasterStatus.INACTIVE : MasterStatus.ACTIVE;

                let codeToUse = prodCode;
                if (!codeToUse || codeToUse === '-') {
                    codeToUse = await this.generateProductCode(userId);
                }

                const existing = await prisma.product.findFirst({
                    where: { created_by: userId, OR: [{ product_code: codeToUse }, { product_name: prodName }] },
                });

                if (existing) {
                    await this.repository.updateProduct(existing.id, {
                        product_name: prodName,
                        product_code: codeToUse,
                        uom_id,
                        product_type: productType,
                        category_id,
                        sub_category_id,
                        hsn_code: hsn.hsn_code,
                        tax_rate: Number(hsn.gst_rate),
                        description: description && description !== '-' ? description : undefined,
                        status
                    });
                } else {
                    await this.repository.createProduct({
                        product_name: prodName,
                        product_code: codeToUse,
                        uom_id,
                        product_type: productType,
                        category_id,
                        sub_category_id,
                        hsn_code: hsn.hsn_code,
                        tax_rate: Number(hsn.gst_rate),
                        description: description && description !== '-' ? description : undefined,
                        status,
                        created_by: userId,
                    });
                }
                imported++;

            } catch (error) {
                failed++;
                errors.push(`Row ${i} (${prodName}): ${error.message}`);
            }
        }

        if (imported === 0 && failed > 0) {
            throw new BadRequestException(`Import failed: ${errors[0]}`);
        }

        if (imported === 0 && failed === 0) {
            throw new BadRequestException('No data found to import');
        }

        return {
            success: true,
            message: `Imported ${imported} products. ${failed > 0 ? failed + ' rows failed.' : ''}`,
            errors: failed > 0 ? errors : undefined,
        };
    }
}
