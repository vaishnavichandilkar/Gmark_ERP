import { Injectable, ConflictException, NotFoundException, BadRequestException } from '@nestjs/common';
import { MasterStatus } from '@prisma/client';
import { CategoryMasterRepository } from '../repositories/category-master.repository';
import { CreateCategoryDto, CreateSubCategoryDto, CreateSubSubCategoryDto, ToggleStatusDto, UpdateCategoryDto, UpdateSubCategoryDto, UpdateSubSubCategoryDto } from '../dto/category.dto';
import * as ExcelJS from 'exceljs';

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
}
