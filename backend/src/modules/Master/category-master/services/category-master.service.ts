import { Injectable, ConflictException, NotFoundException, BadRequestException } from '@nestjs/common';
import { MasterStatus } from '@prisma/client';
import { CategoryMasterRepository } from '../repositories/category-master.repository';
import { CreateCategoryDto, CreateSubCategoryDto, CreateSubSubCategoryDto, ToggleStatusDto, UpdateCategoryDto, UpdateSubCategoryDto, UpdateSubSubCategoryDto } from '../dto/category.dto';
import * as ExcelJS from 'exceljs';
import * as PDFDocument from 'pdfkit';
import * as fs from 'fs';
import * as path from 'path';

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

    async getSubCategoriesForDropdown(userId: number, categoryId: number) {
        return this.repository.getSubCategoriesForDropdown(userId, categoryId);
    }

    async getSubSubCategoriesForDropdown(userId: number, subCategoryId: number) {
        return this.repository.getSubSubCategoriesForDropdown(userId, subCategoryId);
    }
    async getHierarchyStats(userId: number) {
        return this.repository.getHierarchyStats(userId);
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

        // If Category is set to INACTIVE, set all its Sub Categories AND Sub Sub Categories to INACTIVE
        if (dto.status === MasterStatus.INACTIVE) {
            await this.repository.updateSubCategoriesStatusByCategory(id, MasterStatus.INACTIVE);
            await this.repository.updateSubSubCategoriesStatusByCategory(id, MasterStatus.INACTIVE);
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

        const updatedSub = await this.repository.toggleSubCategoryStatus(id, dto.status);

        // If Sub Category is set to INACTIVE, set all its Sub Sub Categories to INACTIVE
        if (dto.status === MasterStatus.INACTIVE) {
            await this.repository.updateSubSubCategoriesStatusBySubCategory(id, MasterStatus.INACTIVE);
        }

        return updatedSub;
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
                if (val === 'sub sub category' || val === 'sub sub category name') colMap['subSubCategoryName'] = colNumber;
                if (val === 'status') colMap['status'] = colNumber;
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
        let currentSubCategoryId: number | null = null;

        for (let i = headerRowIndex + 1; i <= rowCount; i++) {
            const row = worksheet.getRow(i);
            const rawCategoryName = String(getVal(row, 'categoryName') || '').trim();
            const rawSubCategoryName = String(getVal(row, 'subCategoryName') || '').trim();
            const rawSubSubCategoryName = String(getVal(row, 'subSubCategoryName') || '').trim();

            if (!rawCategoryName && !rawSubCategoryName && !rawSubSubCategoryName) continue; // Empty row
            if (rawCategoryName === '-' && rawSubCategoryName === '-' && rawSubSubCategoryName === '-') continue;

            try {
                if (rawCategoryName) {
                    // Handle status for category
                    const statusStr = String(getVal(row, 'status')).trim().toLowerCase();
                    const status = statusStr === 'inactive' ? MasterStatus.INACTIVE : MasterStatus.ACTIVE;

                    // Try to find or create category
                    let category = await this.repository.findCategoryByName(rawCategoryName, userId);
                    if (!category) {
                        category = await this.repository.createCategory({
                            name: rawCategoryName,
                            user_id: userId,
                            status: status,
                        });
                        importedCategories++;
                    } else if (status !== category.status) {
                        // Update status if it changed
                        await this.repository.toggleCategoryStatus(category.id, status);
                    }
                    currentCategoryId = category.id;
                }

                if (rawSubCategoryName) {
                    if (!currentCategoryId) {
                        throw new BadRequestException('Sub category found without a parent category preceding it');
                    }

                    const statusStr = String(getVal(row, 'status')).trim().toLowerCase();
                    const status = statusStr === 'inactive' ? MasterStatus.INACTIVE : MasterStatus.ACTIVE;

                    let subCategory = await this.repository.findSubCategoryByName(rawSubCategoryName, currentCategoryId, userId);
                    if (!subCategory) {
                        subCategory = await this.repository.createSubCategory({
                            name: rawSubCategoryName,
                            category_id: currentCategoryId,
                            user_id: userId,
                            status: status,
                        });
                        importedSubCategories++;
                    } else if (status !== subCategory.status) {
                        await this.repository.toggleSubCategoryStatus(subCategory.id, status);
                    }
                    currentSubCategoryId = subCategory.id;
                }

                if (rawSubSubCategoryName) {
                    if (!currentSubCategoryId) {
                        throw new BadRequestException('Sub sub category found without a parent sub category preceding it');
                    }

                    const statusStr = String(getVal(row, 'status')).trim().toLowerCase();
                    const status = statusStr === 'inactive' ? MasterStatus.INACTIVE : MasterStatus.ACTIVE;

                    const existingSubSub = await this.repository.findSubSubCategoryByName(rawSubSubCategoryName, currentSubCategoryId, userId);
                    if (!existingSubSub) {
                        await this.repository.createSubSubCategory({
                            name: rawSubSubCategoryName,
                            sub_category_id: currentSubCategoryId,
                            user_id: userId,
                            status: status,
                        });
                        // We can track sub_sub_categories count too if needed, but for now just increment a general counter or keep it simple
                    } else if (status !== existingSubSub.status) {
                        await this.repository.toggleSubSubCategoryStatus(existingSubSub.id, status);
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
            return await this.repository.promoteSubCategory(id, userId);
        } catch (error) {
            throw new BadRequestException(error.message);
        }
    }

    async promoteSubSubCategory(id: number, targetLevel: 'sub_category' | 'category', userId: number, newCategoryId?: number) {
        try {
            if (targetLevel === 'sub_category') {
                if (!newCategoryId) {
                    throw new BadRequestException('Target parent category is required');
                }
                return await this.repository.promoteSubSubToSubCategory(id, userId, newCategoryId);
            } else if (targetLevel === 'category') {
                return await this.repository.promoteSubSubToCategory(id, userId);
            } else {
                throw new BadRequestException('Invalid target level');
            }
        } catch (error) {
            if (error instanceof BadRequestException) throw error;
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

    async getSampleExcel() {
        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('Sample Data');

        worksheet.columns = [
            { header: 'Category Name', key: 'category_name', width: 30 },
            { header: 'Sub Category', key: 'sub_category', width: 30 },
            { header: 'Sub Sub Category', key: 'sub_sub_category', width: 30 },
            { header: 'Status', key: 'status', width: 15 },
        ];

        // Add validation for status (column D)
        (worksheet as any).dataValidations.add('D2:D100', {
            type: 'list',
            allowBlank: true,
            formulae: ['"active,inactive"'],
            showErrorMessage: true,
            errorTitle: 'Invalid Status',
            error: 'Please select from the list (active, inactive)'
        });

        const buffer = await workbook.xlsx.writeBuffer();
        return buffer;
    }

    async exportCategories(format: string, userId: number) {
        const categories = await this.repository.getCategoryWithSubCategories(userId) as any[];

        if (categories.length === 0) {
            throw new BadRequestException('No data available to export');
        }

        const now = new Date();
        const pad = (n: number) => n.toString().padStart(2, '0');
        const timestamp = `${pad(now.getDate())}/${pad(now.getMonth() + 1)}/${now.getFullYear()}, ${pad(now.getHours() % 12 || 12)}:${pad(now.getMinutes())}:${pad(now.getSeconds())} ${now.getHours() >= 12 ? 'pm' : 'am'}`;

        if (format === 'xlsx') {
            const workbook = new ExcelJS.Workbook();
            const worksheet = workbook.addWorksheet('Categories');

            worksheet.columns = [
                { header: 'Category Name', key: 'categoryName', width: 30 },
                { header: 'Sub Category Name', key: 'subCategoryName', width: 30 },
                { header: 'Sub Sub Category Name', key: 'subSubCategoryName', width: 30 },
                { header: 'Status', key: 'status', width: 15 },
            ];

            categories.forEach(cat => {
                worksheet.addRow({
                    categoryName: cat.name,
                    subCategoryName: '-',
                    subSubCategoryName: '-',
                    status: cat.status === MasterStatus.ACTIVE ? 'Active' : 'Inactive',
                });

                if (cat.sub_categories && cat.sub_categories.length > 0) {
                    cat.sub_categories.forEach((sub: any) => {
                        worksheet.addRow({
                            categoryName: '',
                            subCategoryName: sub.name,
                            subSubCategoryName: '-',
                            status: sub.status === MasterStatus.ACTIVE ? 'Active' : 'Inactive',
                        });

                        if (sub.sub_sub_categories && sub.sub_sub_categories.length > 0) {
                            sub.sub_sub_categories.forEach((subSub: any) => {
                                worksheet.addRow({
                                    categoryName: '',
                                    subCategoryName: '',
                                    subSubCategoryName: subSub.name,
                                    status: subSub.status === MasterStatus.ACTIVE ? 'Active' : 'Inactive',
                                });
                            });
                        }
                    });
                }
            });

            // Styling and headers
            worksheet.spliceRows(1, 0, [], [], [], []);
            worksheet.mergeCells('A1:D1');
            const titleCell = worksheet.getCell('A1');
            titleCell.value = 'ERP';
            titleCell.font = { size: 18, bold: true };
            titleCell.alignment = { horizontal: 'center', vertical: 'middle' };

            worksheet.mergeCells('A2:D2');
            const subtitleCell = worksheet.getCell('A2');
            subtitleCell.value = 'Category Master Report';
            subtitleCell.font = { size: 14 };
            subtitleCell.alignment = { horizontal: 'center', vertical: 'middle' };

            worksheet.mergeCells('A3:D3');
            const timestampCell = worksheet.getCell('A3');
            timestampCell.value = `Exported on: ${timestamp}`;
            timestampCell.font = { size: 10 };
            timestampCell.alignment = { horizontal: 'right', vertical: 'middle' };

            const headerRow = worksheet.getRow(5);
            headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
            headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4472C4' } };
            headerRow.alignment = { horizontal: 'center', vertical: 'middle' };

            const buffer = await workbook.xlsx.writeBuffer();
            return {
                buffer: Buffer.from(buffer),
                filename: `categories_export_${Date.now()}.xlsx`,
                mimetype: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            };
        }

        if (format === 'pdf') {
            return new Promise<any>((resolve, reject) => {
                const doc = new PDFDocument({ margin: 20, size: 'A4' });
                const buffers: Buffer[] = [];
                doc.on('data', buffers.push.bind(buffers));
                doc.on('end', () => {
                    resolve({
                        buffer: Buffer.concat(buffers),
                        filename: `categories_export_${Date.now()}.pdf`,
                        mimetype: 'application/pdf',
                    });
                });

                doc.fontSize(18).font('Helvetica-Bold').text('ERP', { align: 'center' });
                doc.fontSize(14).font('Helvetica').text('Category Master Report', { align: 'center' });
                doc.moveDown(0.5);
                doc.fontSize(10).text(`Exported on: ${timestamp}`, { align: 'right' });
                doc.moveDown();

                const tableTop = 100;
                const colX = [30, 180, 330, 480];
                const headers = ['Category', 'Sub Category', 'Sub Sub Category', 'Status'];

                doc.rect(20, tableTop - 5, 555, 20).fill('#4472C4');
                doc.fontSize(10).font('Helvetica-Bold').fillColor('#FFFFFF');
                headers.forEach((header, i) => doc.text(header, colX[i], tableTop));

                let y = tableTop + 20;
                doc.fillColor('#000000').font('Helvetica');

                categories.forEach((cat) => {
                    if (y > 750) { doc.addPage(); y = 40; }

                    doc.fontSize(9).font('Helvetica-Bold').text(cat.name, colX[0], y);
                    doc.text('-', colX[1], y);
                    doc.text('-', colX[2], y);
                    doc.text(cat.status === MasterStatus.ACTIVE ? 'Active' : 'Inactive', colX[3], y);
                    y += 15;

                    if (cat.sub_categories && cat.sub_categories.length > 0) {
                        cat.sub_categories.forEach((sub: any) => {
                            if (y > 750) { doc.addPage(); y = 40; }
                            doc.fontSize(9).font('Helvetica').text('', colX[0], y);
                            doc.text(sub.name, colX[1], y);
                            doc.text('-', colX[2], y);
                            doc.text(sub.status === MasterStatus.ACTIVE ? 'Active' : 'Inactive', colX[3], y);
                            y += 15;

                            if (sub.sub_sub_categories && sub.sub_sub_categories.length > 0) {
                                sub.sub_sub_categories.forEach((subSub: any) => {
                                    if (y > 750) { doc.addPage(); y = 40; }
                                    doc.fontSize(9).font('Helvetica').text('', colX[0], y);
                                    doc.text('', colX[1], y);
                                    doc.text(subSub.name, colX[2], y);
                                    doc.text(subSub.status === MasterStatus.ACTIVE ? 'Active' : 'Inactive', colX[3], y);
                                    y += 15;
                                });
                            }
                        });
                    }
                    y += 10;
                });

                doc.end();
            });
        }

        throw new BadRequestException('Invalid format. Use xlsx or pdf.');
    }

    async hasChildren(id: number, type: 'category' | 'sub_category' | 'sub_sub_category') {
        return this.repository.hasChildren(id, type);
    }
}
