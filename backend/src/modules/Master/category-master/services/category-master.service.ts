import { Injectable, ConflictException, NotFoundException, BadRequestException } from '@nestjs/common';
import { MasterStatus } from '@prisma/client';
import { CategoryMasterRepository } from '../repositories/category-master.repository';
import { CreateCategoryDto, CreateSubCategoryDto, ToggleStatusDto, UpdateCategoryDto, UpdateSubCategoryDto } from '../dto/category.dto';
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

        return this.repository.toggleSubCategoryStatus(id, dto.status);
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

        for (let i = headerRowIndex + 1; i <= rowCount; i++) {
            const row = worksheet.getRow(i);
            const rawCategoryName = String(getVal(row, 'categoryName')).trim();
            const rawSubCategoryName = String(getVal(row, 'subCategoryName')).trim();

            if (!rawCategoryName && !rawSubCategoryName) continue; // Empty row
            if (rawCategoryName === '-' && rawSubCategoryName === '-') continue;

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

                    const existingSub = await this.repository.findSubCategoryByName(rawSubCategoryName, currentCategoryId, userId);
                    if (!existingSub) {
                        await this.repository.createSubCategory({
                            name: rawSubCategoryName,
                            category_id: currentCategoryId,
                            user_id: userId,
                            status: status,
                        });
                        importedSubCategories++;
                    } else if (status !== existingSub.status) {
                        // Update subcategory status if it changed
                        await this.repository.toggleSubCategoryStatus(existingSub.id, status);
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

    async demoteCategory(id: number, newParentId: number, userId: number) {
        try {
            return await this.repository.demoteCategoryToSubCategory(id, newParentId, userId);
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
            { header: 'Status', key: 'status', width: 15 },
        ];

        // Add validation for status (column C)
        (worksheet as any).dataValidations.add('C2:C100', {
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
        const categories = await this.repository.getCategoryWithSubCategories(userId);

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
                { header: 'Status', key: 'status', width: 15 },
            ];

            categories.forEach(cat => {
                // Add the main category row
                worksheet.addRow({
                    categoryName: cat.name,
                    subCategoryName: '-',
                    status: cat.status === MasterStatus.ACTIVE ? 'Active' : 'Inactive',
                });

                // Add rows for subcategories
                if (cat.sub_categories && cat.sub_categories.length > 0) {
                    cat.sub_categories.forEach((sub: any) => {
                        worksheet.addRow({
                            categoryName: '',
                            subCategoryName: sub.name,
                            status: sub.status === MasterStatus.ACTIVE ? 'Active' : 'Inactive',
                        });
                    });
                }
            });

            // Styling and headers (similar to Account Master)
            worksheet.spliceRows(1, 0, [], [], [], []);
            worksheet.mergeCells('A1:C1');
            const titleCell = worksheet.getCell('A1');
            titleCell.value = 'ERP';
            titleCell.font = { size: 18, bold: true };
            titleCell.alignment = { horizontal: 'center', vertical: 'middle' };

            worksheet.mergeCells('A2:C2');
            const subtitleCell = worksheet.getCell('A2');
            subtitleCell.value = 'Category Master Report';
            subtitleCell.font = { size: 14 };
            subtitleCell.alignment = { horizontal: 'center', vertical: 'middle' };

            worksheet.mergeCells('A3:C3');
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
                const colX = [30, 230, 450];
                const headers = ['Category Name', 'Sub Category Name', 'Status'];

                doc.rect(20, tableTop - 5, 555, 20).fill('#4472C4');
                doc.fontSize(10).font('Helvetica-Bold').fillColor('#FFFFFF');
                headers.forEach((header, i) => doc.text(header, colX[i], tableTop));

                let y = tableTop + 20;
                doc.fillColor('#000000').font('Helvetica');

                categories.forEach((cat, index) => {
                    if (y > 750) { doc.addPage(); y = 40; }
                    
                    // Main category row
                    doc.fontSize(9).font('Helvetica-Bold').text(cat.name, colX[0], y);
                    doc.text('-', colX[1], y);
                    doc.text(cat.status === MasterStatus.ACTIVE ? 'Active' : 'Inactive', colX[2], y);
                    y += 15;

                    // Subcategory rows
                    if (cat.sub_categories && cat.sub_categories.length > 0) {
                        cat.sub_categories.forEach((sub: any) => {
                            if (y > 750) { doc.addPage(); y = 40; }
                            doc.fontSize(9).font('Helvetica').text('', colX[0], y);
                            doc.text(sub.name, colX[1], y);
                            doc.text(sub.status === MasterStatus.ACTIVE ? 'Active' : 'Inactive', colX[2], y);
                            y += 15;
                        });
                    }
                    y += 10; // Extra space between categories
                });

                doc.end();
            });
        }

        throw new BadRequestException('Invalid format. Use xlsx or pdf.');
    }
}
