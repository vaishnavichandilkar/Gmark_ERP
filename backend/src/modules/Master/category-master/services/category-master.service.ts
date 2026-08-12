import { Injectable, ConflictException, NotFoundException, BadRequestException } from '@nestjs/common';
import { MasterStatus } from '@prisma/client';
import { CategoryMasterRepository } from '../repositories/category-master.repository';
import { CreateCategoryDto, CreateSubCategoryDto, CreateSubSubCategoryDto, ToggleStatusDto, UpdateCategoryDto, UpdateSubCategoryDto, UpdateSubSubCategoryDto, MoveCategoryDto } from '../dto/category.dto';
import * as ExcelJS from 'exceljs';
import * as PDFDocument from 'pdfkit';
import { PrismaService } from '../../../../infrastructure/prisma/prisma.service';

@Injectable()
export class CategoryMasterService {
    constructor(
        private repository: CategoryMasterRepository,
        private prisma: PrismaService
    ) { }

    async calculateLevel(category: any): Promise<number> {
        let level = 1;
        let current = category;
        while (current.parent_id) {
            const parent = await this.repository.findCategoryById(current.parent_id);
            if (!parent) break;
            level++;
            current = parent;
        }
        return level;
    }

    async maxSubtreeDepth(categoryId: string): Promise<number> {
        const category = await this.repository.findCategoryById(categoryId);
        if (!category || !category.children || category.children.length === 0) {
            return 1;
        }
        let maxChildDepth = 0;
        for (const child of category.children) {
            const depth = await this.maxSubtreeDepth(child.id);
            if (depth > maxChildDepth) {
                maxChildDepth = depth;
            }
        }
        return 1 + maxChildDepth;
    }

    async createCategory(dto: CreateCategoryDto, userId: number) {
        const name = dto.name.trim();
        if (!name || name.toLowerCase() === 'null' || name.toLowerCase() === 'undefined') {
            throw new BadRequestException('Category name cannot be empty or invalid');
        }

        const existing = await this.repository.findCategoryByName(name, userId);
        if (existing) {
            throw new ConflictException('Category with this name already exists for this user');
        }

        if (dto.parent_id) {
            const parent = await this.repository.findCategoryById(dto.parent_id);
            if (!parent || parent.user_id !== userId) {
                throw new NotFoundException('Parent category not found');
            }
            const parentLevel = await this.calculateLevel(parent);
            if (parentLevel >= 3) {
                throw new BadRequestException('Cannot add child. Maximum hierarchy depth of 3 levels exceeded.');
            }
        }

        return this.repository.createCategory({
            name,
            user_id: userId,
            parent_id: dto.parent_id,
            status: dto.status,
        });
    }

    async createSubCategory(dto: CreateSubCategoryDto, userId: number) {
        const name = dto.name.trim();
        if (!name || name.toLowerCase() === 'null' || name.toLowerCase() === 'undefined') {
            throw new BadRequestException('Sub Category name cannot be empty or invalid');
        }

        const category = await this.repository.findCategoryById(dto.category_id);
        if (!category || category.user_id !== userId) {
            throw new NotFoundException('Category not found or does not belong to you');
        }

        if (category.status === MasterStatus.INACTIVE) {
            throw new BadRequestException('Cannot create Sub Category under an INACTIVE Category');
        }

        const parentLevel = await this.calculateLevel(category);
        if (parentLevel >= 3) {
            throw new BadRequestException('Cannot add child. Maximum hierarchy depth of 3 levels exceeded.');
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
        if (!name || name.toLowerCase() === 'null' || name.toLowerCase() === 'undefined') {
            throw new BadRequestException('Sub Sub Category name cannot be empty or invalid');
        }

        const subCategory = await this.repository.findSubCategoryById(dto.sub_category_id);
        if (!subCategory || subCategory.user_id !== userId) {
            throw new NotFoundException('Sub Category not found or does not belong to you');
        }

        if (subCategory.status === MasterStatus.INACTIVE) {
            throw new BadRequestException('Cannot create Sub Sub Category under an INACTIVE Sub Category');
        }

        const parentLevel = await this.calculateLevel(subCategory);
        if (parentLevel >= 3) {
            throw new BadRequestException('Cannot add child. Maximum hierarchy depth of 3 levels exceeded.');
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

    async getCategoriesForDropdown(userId: number, excludeId?: string) {
        return this.repository.getCategoriesForDropdown(userId, excludeId);
    }

    async getCategoryListing(userId: number) {
        return this.repository.getCategoryWithSubCategories(userId);
    }

    async toggleCategoryStatus(id: string, dto: ToggleStatusDto, userId: number) {
        const category = await this.repository.findCategoryById(id);
        if (!category || category.user_id !== userId) {
            throw new NotFoundException('Category not found or does not belong to you');
        }

        const updatedCategory = await this.repository.toggleCategoryStatus(id, dto.status);

        if (dto.status === MasterStatus.INACTIVE) {
            await this.repository.updateSubCategoriesStatusByCategory(id, MasterStatus.INACTIVE);
        }

        return updatedCategory;
    }

    async toggleSubCategoryStatus(id: string, dto: ToggleStatusDto, userId: number) {
        return this.toggleCategoryStatus(id, dto, userId);
    }

    async toggleSubSubCategoryStatus(id: string, dto: ToggleStatusDto, userId: number) {
        return this.toggleCategoryStatus(id, dto, userId);
    }

    async updateCategory(id: string, dto: { name: string }, userId: number) {
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

    async updateSubCategory(id: string, dto: UpdateSubCategoryDto, userId: number) {
        const name = dto.name.trim();
        if (!name) throw new BadRequestException('Sub Category name cannot be empty');

        const subCategory = await this.repository.findSubCategoryById(id);
        if (!subCategory || subCategory.user_id !== userId) throw new NotFoundException('Sub Category not found or does not belong to you');

        const newCategoryId = dto.category_id || subCategory.parent_id;
        if (newCategoryId !== subCategory.parent_id) {
            if (newCategoryId) {
                const newCategory = await this.repository.findCategoryById(newCategoryId);
                if (!newCategory || newCategory.user_id !== userId) {
                    throw new BadRequestException('Selected category is invalid');
                }
            }
        }

        const existing = await this.repository.findSubCategoryByName(name, newCategoryId!, userId);
        if (existing && existing.id !== id) {
            throw new ConflictException('Sub Category with this name already exists in this category');
        }

        return this.repository.updateSubCategoryContent(id, name, dto.category_id);
    }

    async updateSubSubCategory(id: string, dto: UpdateSubSubCategoryDto, userId: number) {
        const name = dto.name.trim();
        if (!name) throw new BadRequestException('Sub Sub Category name cannot be empty');

        const subSubCategory = await this.repository.findSubSubCategoryById(id);
        if (!subSubCategory || subSubCategory.user_id !== userId) throw new NotFoundException('Sub Sub Category not found or does not belong to you');

        const newSubCategoryId = dto.sub_category_id || subSubCategory.parent_id;
        if (newSubCategoryId !== subSubCategory.parent_id) {
            if (newSubCategoryId) {
                const newSubCategory = await this.repository.findSubCategoryById(newSubCategoryId);
                if (!newSubCategory || newSubCategory.user_id !== userId) {
                    throw new BadRequestException('Selected sub category is invalid');
                }
            }
        }

        const existing = await this.repository.findSubSubCategoryByName(name, newSubCategoryId!, userId);
        if (existing && existing.id !== id) {
            throw new ConflictException('Sub Sub Category with this name already exists in this sub category');
        }

        return this.repository.updateSubSubCategoryContent(id, name, dto.sub_category_id);
    }

    async moveCategory(id: string, dto: MoveCategoryDto, userId: number) {
        const category = await this.repository.findCategoryById(id);
        if (!category || category.user_id !== userId) {
            throw new NotFoundException('Category not found');
        }

        const targetParentId = dto.targetParentId || null;

        // Rule 1: Self-parenting
        if (id === targetParentId) {
            throw new BadRequestException('Category cannot become its own parent.');
        }

        let oldParentName = 'NULL';
        if (category.parent_id) {
            const oldParent = await this.repository.findCategoryById(category.parent_id);
            oldParentName = oldParent?.name || 'NULL';
        }

        let newParentName = 'NULL';
        let newLevel = 1;

        if (targetParentId) {
            // Rule 2: Circular reference check
            let currentParentId = targetParentId;
            while (currentParentId) {
                if (currentParentId === id) {
                    throw new BadRequestException('Cannot move category inside its own descendant.');
                }
                const pNode = await this.repository.findCategoryById(currentParentId);
                currentParentId = pNode?.parent_id || null;
            }

            const targetParent = await this.repository.findCategoryById(targetParentId);
            if (!targetParent || targetParent.user_id !== userId) {
                throw new BadRequestException('Target parent category not found.');
            }
            newParentName = targetParent.name;

            const targetParentLevel = await this.calculateLevel(targetParent);
            newLevel = targetParentLevel + 1;
        }

        // Rule 3 & 4: Depth validation
        const subtreeHeight = await this.maxSubtreeDepth(id);
        if (newLevel + subtreeHeight - 1 > 3) {
            throw new BadRequestException('Move exceeds maximum hierarchy depth of 3.');
        }

        const oldLevel = await this.calculateLevel(category);
        const updated = await this.repository.moveCategory(id, targetParentId);

        // Audit log
        await this.repository.createAuditLog(userId, 'CATEGORY_MOVED', 'Category', {
            action: 'CATEGORY_MOVED',
            category: category.name,
            oldParent: oldParentName,
            newParent: newParentName,
            oldLevel,
            newLevel
        });

        return updated;
    }

    async getMoveOptions(id: string, userId: number) {
        const category = await this.repository.findCategoryById(id);
        if (!category || category.user_id !== userId) {
            throw new NotFoundException('Category not found');
        }

        const currentLevel = await this.calculateLevel(category);
        const subtreeHeight = await this.maxSubtreeDepth(id);

        const moveToLevel1 = (1 + subtreeHeight - 1) <= 3;
        const moveToLevel2 = (2 + subtreeHeight - 1) <= 3;
        const moveToLevel3 = (3 + subtreeHeight - 1) <= 3;

        const allCategories = await this.repository.getCategoriesForMoveOptions(userId, id);

        const descendantIds = new Set<string>();
        await this.collectDescendantIds(id, descendantIds);

        const eligibleLevel1: any[] = [];
        const eligibleLevel2: any[] = [];

        for (const cat of allCategories) {
            if (descendantIds.has(cat.id)) {
                continue;
            }

            const catLevel = await this.calculateLevel(cat);

            if (catLevel === 1 && moveToLevel2) {
                eligibleLevel1.push({ id: cat.id, name: cat.name });
            }

            if (catLevel === 2 && moveToLevel3) {
                const parentNode = await this.repository.findCategoryById(cat.parent_id);
                const parentName = parentNode ? parentNode.name : 'Root';
                eligibleLevel2.push({
                    id: cat.id,
                    name: cat.name,
                    categoryName: parentName
                });
            }
        }

        return {
            currentLevel,
            moveToLevel1,
            moveToLevel2,
            moveToLevel3,
            eligibleParents: {
                level1: eligibleLevel1,
                level2: eligibleLevel2
            }
        };
    }

    private async collectDescendantIds(id: string, ids: Set<string>) {
        const category = await this.repository.findCategoryById(id);
        if (category && category.children) {
            for (const child of category.children) {
                ids.add(child.id);
                await this.collectDescendantIds(child.id, ids);
            }
        }
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
        let importedSubSubCategories = 0;
        let duplicates = 0;
        let failed = 0;
        const errors: string[] = [];

        let headerRowIndex = -1;
        const colMap: Record<string, number> = {};

        for (let r = 1; r <= Math.min(rowCount, 10); r++) {
            const row = worksheet.getRow(r);
            let foundHeaders = false;
            row.eachCell((cell, colNumber) => {
                const val = String(cell.value || '').trim().toLowerCase().replace(/[*]/g, '');
                if (val === 'category' || val === 'category name') { colMap['categoryName'] = colNumber; foundHeaders = true; }
                if (val === 'sub category' || val === 'sub category name') colMap['subCategoryName'] = colNumber;
                if (val === 'sub sub category' || val === 'sub sub category name') colMap['subSubCategoryName'] = colNumber;
            });

            if (foundHeaders) {
                headerRowIndex = r;
                break;
            }
        }

        if (headerRowIndex === -1) {
            throw new BadRequestException('Could not find Category name column in the provided Excel file.');
        }

        const getValStr = (row: ExcelJS.Row, key: string): string => {
            const colIdx = colMap[key];
            if (!colIdx) return '';
            const val = row.getCell(colIdx).value;
            if (val === null || val === undefined) return '';
            const strVal = String(val).trim();
            return strVal === 'null' || strVal === 'undefined' ? '' : strVal;
        };

        let currentCategoryId: string | null = null;
        let currentSubCategoryId: string | null = null;

        for (let i = headerRowIndex + 1; i <= rowCount; i++) {
            const row = worksheet.getRow(i);
            const rawCategoryName = getValStr(row, 'categoryName');
            const rawSubCategoryName = getValStr(row, 'subCategoryName');
            const rawSubSubCategoryName = getValStr(row, 'subSubCategoryName');

            if (!rawCategoryName && !rawSubCategoryName && !rawSubSubCategoryName) continue;
            if (rawCategoryName === '-' && rawSubCategoryName === '-' && rawSubSubCategoryName === '-') continue;

            try {
                if (rawCategoryName) {
                    let category = await this.repository.findCategoryByName(rawCategoryName, userId);
                    if (!category) {
                        category = await this.repository.createCategory({
                            name: rawCategoryName,
                            user_id: userId,
                            status: MasterStatus.ACTIVE,
                        });
                        importedCategories++;
                    } else {
                        duplicates++;
                    }
                    currentCategoryId = category.id;
                    currentSubCategoryId = null; // reset subcategory context
                }

                if (rawSubCategoryName) {
                    if (!currentCategoryId) {
                        throw new BadRequestException('Sub category found without a parent category preceding it');
                    }
                    let subCategory = await this.repository.findSubCategoryByName(rawSubCategoryName, currentCategoryId, userId);
                    if (!subCategory) {
                        subCategory = await this.repository.createSubCategory({
                            name: rawSubCategoryName,
                            category_id: currentCategoryId,
                            user_id: userId,
                            status: MasterStatus.ACTIVE,
                        });
                        importedSubCategories++;
                    } else {
                        duplicates++;
                    }
                    currentSubCategoryId = subCategory.id;
                }

                if (rawSubSubCategoryName) {
                    if (!currentSubCategoryId) {
                        throw new BadRequestException('Sub sub category found without a parent sub category preceding it');
                    }
                    const existingSubSub = await this.repository.findSubSubCategoryByName(rawSubSubCategoryName, currentSubCategoryId, userId);
                    if (!existingSubSub) {
                        await this.repository.createSubSubCategory({
                            name: rawSubSubCategoryName,
                            sub_category_id: currentSubCategoryId,
                            user_id: userId,
                            status: MasterStatus.ACTIVE,
                        });
                        importedSubSubCategories++;
                    } else {
                        duplicates++;
                    }
                }
            } catch (error) {
                failed++;
                errors.push(`Row ${i} (${[rawCategoryName, rawSubCategoryName, rawSubSubCategoryName].filter(Boolean).join(' > ')}): ${error.message}`);
            }
        }

        const totalImported = importedCategories + importedSubCategories + importedSubSubCategories;

        if (totalImported === 0 && failed > 0) {
            throw new BadRequestException(`Import failed: ${errors[0]}`);
        }

        if (totalImported === 0 && duplicates > 0 && failed === 0) {
            return {
                success: true,
                message: `No new categories imported. ${duplicates} duplicate records found in file were skipped.`,
            };
        }

        if (totalImported === 0 && failed === 0) {
            throw new BadRequestException('No data found to import');
        }

        return {
            success: true,
            message: `Imported ${importedCategories} categories, ${importedSubCategories} sub-categories, and ${importedSubSubCategories} sub-sub-categories.${duplicates > 0 ? ` ${duplicates} duplicate records were skipped.` : ''}${failed > 0 ? ` ${failed} rows failed.` : ''}`,
            errors: failed > 0 ? errors : undefined,
        };
    }

    async promoteSubCategory(id: string, userId: number) {
        return this.moveCategory(id, { targetParentId: null }, userId);
    }

    async promoteSubSubToSub(id: string, newParentCatId: string, userId: number) {
        return this.moveCategory(id, { targetParentId: newParentCatId }, userId);
    }

    async promoteSubSubToCategory(id: string, userId: number) {
        return this.moveCategory(id, { targetParentId: null }, userId);
    }

    async demoteCategory(id: string, newParentId: string, userId: number) {
        return this.moveCategory(id, { targetParentId: newParentId }, userId);
    }

    async demoteCategoryToSubSubCategory(id: string, newParentSubId: string, userId: number) {
        return this.moveCategory(id, { targetParentId: newParentSubId }, userId);
    }

    async demoteSubCategoryToSubSub(id: string, newParentSubId: string, userId: number) {
        return this.moveCategory(id, { targetParentId: newParentSubId }, userId);
    }

    async exportCategories(format: string, userId: number) {
        const categories = await this.repository.getCategoryWithSubCategories(userId);

        if (categories.length === 0) {
            throw new BadRequestException('No data available to export');
        }

        const flattenedData: any[] = [];
        categories.forEach(cat => {
            const subCats = cat.sub_categories || [];
            if (subCats.length > 0) {
                subCats.forEach((sub: any) => {
                    const subSubCats = sub.sub_sub_categories || [];
                    if (subSubCats.length > 0) {
                        subSubCats.forEach((ss: any) => {
                            flattenedData.push({
                                categoryName: cat.name,
                                subCategoryName: sub.name,
                                subSubCategoryName: ss.name,
                                status: cat.status === MasterStatus.ACTIVE && sub.status === MasterStatus.ACTIVE && ss.status === MasterStatus.ACTIVE ? 'Active' : 'Inactive'
                            });
                        });
                    } else {
                        flattenedData.push({
                            categoryName: cat.name,
                            subCategoryName: sub.name,
                            subSubCategoryName: '',
                            status: cat.status === MasterStatus.ACTIVE && sub.status === MasterStatus.ACTIVE ? 'Active' : 'Inactive'
                        });
                    }
                });
            } else {
                flattenedData.push({
                    categoryName: cat.name,
                    subCategoryName: '',
                    subSubCategoryName: '',
                    status: cat.status === MasterStatus.ACTIVE ? 'Active' : 'Inactive'
                });
            }
        });

        const now = new Date();
        const pad = (n: number) => n.toString().padStart(2, '0');
        const timestamp = `${pad(now.getDate())}/${pad(now.getMonth() + 1)}/${now.getFullYear()}, ${pad(now.getHours() % 12 || 12)}:${pad(now.getMinutes())}:${pad(now.getSeconds())} ${now.getHours() >= 12 ? 'pm' : 'am'}`;

        if (format === 'xlsx') {
            const workbook = new ExcelJS.Workbook();
            const worksheet = workbook.addWorksheet('Categories');
            worksheet.views = [{ state: 'frozen', ySplit: 5 }];

            worksheet.columns = [
                { header: 'Category Name', key: 'categoryName', width: 30 },
                { header: 'Sub Category', key: 'subCategoryName', width: 30 },
                { header: 'Sub Sub Category', key: 'subSubCategoryName', width: 30 },
                { header: 'Status', key: 'status', width: 15 }
            ];

            flattenedData.forEach((item) => {
                worksheet.addRow(item);
            });

            worksheet.spliceRows(1, 0, [], [], [], []);
            worksheet.mergeCells('A1:D1');
            worksheet.getCell('A1').value = 'ERP';
            worksheet.getCell('A1').font = { size: 18, bold: true };
            worksheet.getCell('A1').alignment = { horizontal: 'center' };

            worksheet.mergeCells('A2:D2');
            worksheet.getCell('A2').value = 'Category Master Report';
            worksheet.getCell('A2').font = { size: 14 };
            worksheet.getCell('A2').alignment = { horizontal: 'center' };

            worksheet.mergeCells('A3:D3');
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
                const colX = [40, 170, 310, 460];
                const headers = ['Category Name', 'Sub Category', 'Sub Sub Category', 'Status'];

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

                    doc.text(item.categoryName, colX[0], y, { width: 120 });
                    doc.text(item.subCategoryName || '-', colX[1], y, { width: 130 });
                    doc.text(item.subSubCategoryName || '-', colX[2], y, { width: 140 });
                    doc.text(item.status, colX[3], y);
                    y += 18;
                });

                doc.end();
            });
        }

        throw new BadRequestException('Invalid export format. Use xlsx or pdf.');
    }

    async downloadSample() {
        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('Sample Data');
        worksheet.views = [{ state: 'frozen', ySplit: 1 }];

        const headers = ['Category Name*', 'Sub Category', 'Sub Sub Category'];
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
            insertRows: true,
            deleteRows: true,
            sort: true,
            autoFilter: true,
        });

        const buffer = await workbook.xlsx.writeBuffer();
        return {
            buffer: Buffer.from(buffer),
            filename: 'Category_Master_Sample.xlsx',
            mimetype: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        };
    }

    async deleteCategory(id: string, userId: number) {
        const category = await this.prisma.category.findFirst({
            where: { id, user_id: userId }
        });
        if (!category) {
            throw new NotFoundException(`Category not found`);
        }

        // 1. Check if the category has sub-categories
        const hasChildren = await this.prisma.category.findFirst({
            where: { parent_id: id }
        });
        if (hasChildren) {
            throw new BadRequestException('Cannot delete category because it has sub-categories');
        }

        // 2. Check if the category is currently linked to any active products
        const hasProducts = await this.prisma.product.findFirst({
            where: { category_id: id, is_deleted: false }
        });
        if (hasProducts) {
            throw new BadRequestException('Cannot delete category because it is in use by one or more products');
        }

        return this.prisma.category.delete({
            where: { id }
        });
    }
}
