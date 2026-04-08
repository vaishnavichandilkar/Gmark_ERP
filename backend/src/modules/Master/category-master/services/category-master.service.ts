import { Injectable, ConflictException, NotFoundException, BadRequestException } from '@nestjs/common';
import { MasterStatus } from '@prisma/client';
import { CategoryMasterRepository } from '../repositories/category-master.repository';
import { CreateCategoryDto, CreateSubCategoryDto, CreateSubSubCategoryDto, ToggleStatusDto, UpdateCategoryDto, UpdateSubCategoryDto, UpdateSubSubCategoryDto } from '../dto/category.dto';
import * as ExcelJS from 'exceljs';
import * as PDFDocument from 'pdfkit';

@Injectable()
export class CategoryMasterService {
    constructor(private repository: CategoryMasterRepository) { }

    async createCategory(dto: CreateCategoryDto, userId: number) {
        const name = dto.name.trim();
        if (!name) {
            throw new BadRequestException('Category name cannot be empty');
        }

        const existing = await this.repository.findCategoryByName(name, userId);
        if (existing) {
            throw new ConflictException('Category with this name already exists for this user');
        }

        return this.repository.createCategory({
            name,
            user_id: userId,
            status: dto.status,
        });
    }

    async createSubCategory(dto: CreateSubCategoryDto, userId: number) {
        const name = dto.name.trim();
        if (!name) {
            throw new BadRequestException('Sub Category name cannot be empty');
        }

        // Check if category exists and belongs to user
        const category = await this.repository.findCategoryById(dto.category_id);
        if (!category || category.user_id !== userId) {
            throw new NotFoundException('Category not found or does not belong to you');
        }

        // Check if category is ACTIVE
        if (category.status === MasterStatus.INACTIVE) {
            throw new BadRequestException('Cannot create Sub Category under an INACTIVE Category');
        }

        const existing = await this.repository.findSubCategoryByName(name, dto.category_id, userId);
        if (existing) {
            throw new ConflictException('Sub Category with this name already exists in this category');
        }

        return this.repository.createSubCategory({
            name,
            category_id: dto.category_id,
            user_id: userId,
            status: dto.status,
        });
    }

    async createSubSubCategory(dto: CreateSubSubCategoryDto, userId: number) {
        const name = dto.name.trim();
        if (!name) {
            throw new BadRequestException('Sub Sub Category name cannot be empty');
        }

        // Check if sub category exists and belongs to user
        const subCategory = await this.repository.findSubCategoryById(dto.sub_category_id);
        if (!subCategory || subCategory.user_id !== userId) {
            throw new NotFoundException('Sub Category not found or does not belong to you');
        }

        // Check if sub category is ACTIVE
        if (subCategory.status === MasterStatus.INACTIVE) {
            throw new BadRequestException('Cannot create Sub Sub Category under an INACTIVE Sub Category');
        }

        const existing = await this.repository.findSubSubCategoryByName(name, dto.sub_category_id, userId);
        if (existing) {
            throw new ConflictException('Sub Sub Category with this name already exists in this sub category');
        }

        return this.repository.createSubSubCategory({
            name,
            sub_category_id: dto.sub_category_id,
            user_id: userId,
            status: dto.status,
        });
    }

    async getCategoriesForDropdown(userId: number, excludeId?: number) {
        // As per instructions, only Categories (from categories table) are shown
        return this.repository.getCategoriesForDropdown(userId, excludeId);
    }

    async getCategoryListing(userId: number) {
        return this.repository.getCategoryWithSubCategories(userId);
    }

    async toggleCategoryStatus(id: number, dto: ToggleStatusDto, userId: number) {
        const category = await this.repository.findCategoryById(id);
        if (!category || category.user_id !== userId) {
            throw new NotFoundException('Category not found or does not belong to you');
        }

        const updatedCategory = await this.repository.toggleCategoryStatus(id, dto.status);

        // If Category is set to INACTIVE, set all its Sub Categories to INACTIVE
        if (dto.status === MasterStatus.INACTIVE) {
            await this.repository.updateSubCategoriesStatusByCategory(id, MasterStatus.INACTIVE);
        }

        return updatedCategory;
    }

    async toggleSubCategoryStatus(id: number, dto: ToggleStatusDto, userId: number) {
        const subCategory = await this.repository.findSubCategoryById(id);

        if (!subCategory || subCategory.user_id !== userId) {
            throw new NotFoundException('Sub Category not found or does not belong to you');
        }

        // If activating Sub Category, check if parent Category is ACTIVE
        if (dto.status === MasterStatus.ACTIVE) {
            const category = await this.repository.findCategoryById(subCategory.category_id);
            if (!category || category.status === MasterStatus.INACTIVE) {
                throw new BadRequestException('Cannot activate Sub Category while parent Category is INACTIVE');
            }
        }

        const updatedSubCategory = await this.repository.toggleSubCategoryStatus(id, dto.status);

        // If Sub Category is set to INACTIVE, set all its Sub Sub Categories to INACTIVE
        if (dto.status === MasterStatus.INACTIVE) {
            await this.repository.updateSubSubCategoriesStatusBySubCategory(id, MasterStatus.INACTIVE);
        }

        return updatedSubCategory;
    }

    async toggleSubSubCategoryStatus(id: number, dto: ToggleStatusDto, userId: number) {
        const subSubCategory = await this.repository.findSubSubCategoryById(id);

        if (!subSubCategory || subSubCategory.user_id !== userId) {
            throw new NotFoundException('Sub Sub Category not found or does not belong to you');
        }

        // If activating Sub Sub Category, check if parent Sub Category is ACTIVE
        if (dto.status === MasterStatus.ACTIVE) {
            const subCategory = await this.repository.findSubCategoryById(subSubCategory.sub_category_id);
            if (!subCategory || subCategory.status === MasterStatus.INACTIVE) {
                throw new BadRequestException('Cannot activate Sub Sub Category while parent Sub Category is INACTIVE');
            }
        }

        return this.repository.toggleSubSubCategoryStatus(id, dto.status);
    }

    async updateCategory(id: number, dto: { name: string }, userId: number) {
        const name = dto.name.trim();
        if (!name) throw new BadRequestException('Category name cannot be empty');

        const category = await this.repository.findCategoryById(id);
        if (!category || category.user_id !== userId) throw new NotFoundException('Category not found or does not belong to you');

        const existing = await this.repository.findCategoryByName(name, userId);
        if (existing && existing.id !== id) {
            throw new ConflictException('Category with this name already exists');
        }

        return this.repository.updateCategoryData(id, { name });
    }

    async updateSubCategory(id: number, dto: UpdateSubCategoryDto, userId: number) {
        const name = dto.name.trim();
        if (!name) throw new BadRequestException('Sub Category name cannot be empty');

        const subCategory = await this.repository.findSubCategoryById(id);
        if (!subCategory || subCategory.user_id !== userId) throw new NotFoundException('Sub Category not found or does not belong to you');

        // Check if category_id is being changed
        const newCategoryId = dto.category_id || subCategory.category_id;
        if (newCategoryId !== subCategory.category_id) {
            const newCategory = await this.repository.findCategoryById(newCategoryId);
            if (!newCategory || newCategory.user_id !== userId) {
                throw new BadRequestException('Selected category is invalid');
            }
        }

        const existing = await this.repository.findSubCategoryByName(name, newCategoryId, userId);
        if (existing && existing.id !== id) {
            throw new ConflictException('Sub Category with this name already exists in this category');
        }

        return this.repository.updateSubCategoryContent(id, name, dto.category_id);
    }

    async updateSubSubCategory(id: number, dto: UpdateSubSubCategoryDto, userId: number) {
        const name = dto.name.trim();
        if (!name) throw new BadRequestException('Sub Sub Category name cannot be empty');

        const subSubCategory = await this.repository.findSubSubCategoryById(id);
        if (!subSubCategory || subSubCategory.user_id !== userId) throw new NotFoundException('Sub Sub Category not found or does not belong to you');

        // Check if sub_category_id is being changed
        const newSubCategoryId = dto.sub_category_id || subSubCategory.sub_category_id;
        if (newSubCategoryId !== subSubCategory.sub_category_id) {
            const newSubCategory = await this.repository.findSubCategoryById(newSubCategoryId);
            if (!newSubCategory || newSubCategory.user_id !== userId) {
                throw new BadRequestException('Selected sub category is invalid');
            }
        }

        const existing = await this.repository.findSubSubCategoryByName(name, newSubCategoryId, userId);
        if (existing && existing.id !== id) {
            throw new ConflictException('Sub Sub Category with this name already exists in this sub category');
        }

        return this.repository.updateSubSubCategoryContent(id, name, dto.sub_category_id);
    }

    async importCategories(buffer: Buffer, userId: number) {
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

        let importedCategories = 0;
        let importedSubCategories = 0;
        let failed = 0;
        const errors: string[] = [];

        let headerRowIndex = -1;
        const colMap: Record<string, number> = {};

        for (let r = 1; r <= Math.min(rowCount, 10); r++) {
            const row = worksheet.getRow(r);
            let foundHeaders = false;
            row.eachCell((cell, colNumber) => {
                const val = String(cell.value || '').trim().toLowerCase();
                if (val === 'category' || val === 'category name') { colMap['categoryName'] = colNumber; foundHeaders = true; }
                if (val === 'sub category' || val === 'sub category name') colMap['subCategoryName'] = colNumber;
            });

            if (foundHeaders) {
                headerRowIndex = r;
                break;
            }
        }

        if (headerRowIndex === -1) {
            throw new BadRequestException('Could not find Category name column in the provided Excel file.');
        }

        const getVal = (row: ExcelJS.Row, key: string, defaultVal: any = '') => {
            const colIdx = colMap[key];
            if (!colIdx) return defaultVal;
            return row.getCell(colIdx).value;
        };

        let currentCategoryId: number | null = null;

        for (let i = headerRowIndex + 1; i <= rowCount; i++) {
            const row = worksheet.getRow(i);
            const rawCategoryName = String(getVal(row, 'categoryName')).trim();
            const rawSubCategoryName = String(getVal(row, 'subCategoryName')).trim();

            if (!rawCategoryName && !rawSubCategoryName) continue; // Empty row
            if (rawCategoryName === '-' && rawSubCategoryName === '-') continue;

            try {
                if (rawCategoryName) {
                    // Try to find or create category
                    let category = await this.repository.findCategoryByName(rawCategoryName, userId);
                    if (!category) {
                        category = await this.repository.createCategory({
                            name: rawCategoryName,
                            user_id: userId,
                            status: MasterStatus.ACTIVE,
                        });
                        importedCategories++;
                    }
                    currentCategoryId = category.id;
                }

                if (rawSubCategoryName) {
                    if (!currentCategoryId) {
                        throw new BadRequestException('Sub category found without a parent category preceding it');
                    }
                    const existingSub = await this.repository.findSubCategoryByName(rawSubCategoryName, currentCategoryId, userId);
                    if (!existingSub) {
                        await this.repository.createSubCategory({
                            name: rawSubCategoryName,
                            category_id: currentCategoryId,
                            user_id: userId,
                            status: MasterStatus.ACTIVE,
                        });
                        importedSubCategories++;
                    }
                }
            } catch (error) {
                failed++;
                errors.push(`Row ${i} (${rawCategoryName || rawSubCategoryName}): ${error.message}`);
            }
        }

        if (importedCategories === 0 && importedSubCategories === 0 && failed > 0) {
            throw new BadRequestException(`Import failed: ${errors[0]}`);
        }

        if (importedCategories === 0 && importedSubCategories === 0 && failed === 0) {
            throw new BadRequestException('No data found to import');
        }

        return {
            success: true,
            message: `Imported ${importedCategories} categories and ${importedSubCategories} sub-categories. ${failed > 0 ? failed + ' rows failed.' : ''}`,
            errors: failed > 0 ? errors : undefined,
        };
    }

    async promoteSubCategory(id: number, userId: number) {
        try {
            return await this.repository.promoteSubCategoryToCategory(id, userId);
        } catch (error) {
            throw new BadRequestException(error.message);
        }
    }

    async promoteSubSubCategoryToSub(id: number, newParentCatId: number, userId: number) {
        try {
            return await this.repository.promoteSubSubCategoryToSubCategory(id, newParentCatId, userId);
        } catch (error) {
            throw new BadRequestException(error.message);
        }
    }

    async promoteSubSubToCategory(id: number, userId: number) {
        try {
            return await this.repository.promoteSubSubCategoryToCategory(id, userId);
        } catch (error) {
            throw new BadRequestException(error.message);
        }
    }

    async demoteCategory(id: number, newParentId: number, userId: number) {
        try {
            return await this.repository.demoteCategoryToSubCategory(id, newParentId, userId);
        } catch (error) {
            throw new BadRequestException(error.message);
        }
    }

    async demoteCategoryToSubSubCategory(id: number, newParentSubId: number, userId: number) {
        try {
            return await this.repository.demoteCategoryToSubSubCategory(id, newParentSubId, userId);
        } catch (error) {
            throw new BadRequestException(error.message);
        }
    }

    async demoteSubCategoryToSubSub(id: number, newParentSubId: number, userId: number) {
        try {
            return await this.repository.demoteSubCategoryToSubSubCategory(id, newParentSubId, userId);
        } catch (error) {
            throw new BadRequestException(error.message);
        }
    }

    async exportCategories(format: string, userId: number) {
        const categories = await this.repository.getCategoryWithSubCategories(userId);

        if (categories.length === 0) {
            throw new BadRequestException('No data available to export');
        }

        const flattenedData = [];
        categories.forEach(cat => {
            flattenedData.push({
                name: cat.name,
                level: 'Category',
                parent: '-',
                status: cat.status === MasterStatus.ACTIVE ? 'Active' : 'Inactive'
            });

            (cat.sub_categories || []).forEach(sub => {
                flattenedData.push({
                    name: sub.name,
                    level: 'Sub Category',
                    parent: cat.name,
                    status: sub.status === MasterStatus.ACTIVE ? 'Active' : 'Inactive'
                });

                (sub.sub_sub_categories || []).forEach(ss => {
                    flattenedData.push({
                        name: ss.name,
                        level: 'Sub-SubCategory',
                        parent: sub.name,
                        status: ss.status === MasterStatus.ACTIVE ? 'Active' : 'Inactive'
                    });
                });
            });
        });

        const now = new Date();
        const pad = (n: number) => n.toString().padStart(2, '0');
        const timestamp = `${pad(now.getDate())}/${pad(now.getMonth() + 1)}/${now.getFullYear()}, ${pad(now.getHours() % 12 || 12)}:${pad(now.getMinutes())}:${pad(now.getSeconds())} ${now.getHours() >= 12 ? 'pm' : 'am'}`;

        if (format === 'xlsx') {
            const workbook = new ExcelJS.Workbook();
            const worksheet = workbook.addWorksheet('Categories');

            worksheet.columns = [
                { header: 'Sr. No', key: 'srNo', width: 10 },
                { header: 'Name', key: 'name', width: 35 },
                { header: 'Hierarchy Level', key: 'level', width: 20 },
                { header: 'Parent Name', key: 'parent', width: 30 },
                { header: 'Status', key: 'status', width: 12 }
            ];

            flattenedData.forEach((item, index) => {
                worksheet.addRow({
                    srNo: index + 1,
                    ...item
                });
            });

            worksheet.spliceRows(1, 0, [], [], [], []);
            worksheet.mergeCells('A1:E1');
            worksheet.getCell('A1').value = 'ERP';
            worksheet.getCell('A1').font = { size: 18, bold: true };
            worksheet.getCell('A1').alignment = { horizontal: 'center' };

            worksheet.mergeCells('A2:E2');
            worksheet.getCell('A2').value = 'Category Master Report';
            worksheet.getCell('A2').font = { size: 14 };
            worksheet.getCell('A2').alignment = { horizontal: 'center' };

            worksheet.mergeCells('A3:E3');
            worksheet.getCell('A3').value = `Exported on: ${timestamp}`;
            worksheet.getCell('A3').alignment = { horizontal: 'right' };

            const headerRow = worksheet.getRow(5);
            headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
            headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4472C4' } };

            const buffer = await workbook.xlsx.writeBuffer();
            return {
                buffer: Buffer.from(buffer),
                filename: `category_master_${Date.now()}.xlsx`,
                mimetype: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
            };
        }

        if (format === 'pdf') {
            return new Promise<any>((resolve) => {
                const doc = new PDFDocument({ margin: 30, size: 'A4' });
                const buffers: Buffer[] = [];
                doc.on('data', buffers.push.bind(buffers));
                doc.on('end', () => {
                    resolve({
                        buffer: Buffer.concat(buffers),
                        filename: `category_master_${Date.now()}.pdf`,
                        mimetype: 'application/pdf'
                    });
                });

                doc.fontSize(18).font('Helvetica-Bold').text('ERP', { align: 'center' });
                doc.fontSize(14).font('Helvetica').text('Category Master Report', { align: 'center' });
                doc.fontSize(10).text(`Exported on: ${timestamp}`, { align: 'right' });
                doc.moveDown();

                const tableTop = 100;
                const colX = [40, 80, 240, 380, 480];
                const headers = ['Sr.', 'Name', 'Hierarchy Level', 'Parent Name', 'Status'];

                doc.rect(30, tableTop - 5, 535, 20).fill('#4472C4');
                doc.fontSize(10).font('Helvetica-Bold').fillColor('#FFFFFF');
                headers.forEach((h, i) => doc.text(h, colX[i], tableTop));

                let y = tableTop + 20;
                doc.fillColor('#000000').font('Helvetica').fontSize(9);

                flattenedData.forEach((item, i) => {
                    if (y > 750) {
                        doc.addPage();
                        y = 50;
                        doc.rect(30, y - 5, 535, 20).fill('#4472C4');
                        doc.fillColor('#FFFFFF').font('Helvetica-Bold');
                        headers.forEach((h, idx) => doc.text(h, colX[idx], y));
                        y += 20;
                        doc.fillColor('#000000').font('Helvetica');
                    }

                    if (i % 2 === 1) doc.rect(30, y - 3, 535, 15).fill('#F2F2F2').fillColor('#000000');

                    doc.text((i + 1).toString(), colX[0], y);
                    doc.text(item.name, colX[1], y, { width: 150 });
                    doc.text(item.level, colX[2], y);
                    doc.text(item.parent, colX[3], y, { width: 90 });
                    doc.text(item.status, colX[4], y);
                    y += 18;
                });

                doc.end();
            });
        }

        throw new BadRequestException('Invalid export format. Use xlsx or pdf.');
    }
}
