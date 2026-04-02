import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../infrastructure/prisma/prisma.service';
import { MasterStatus } from '@prisma/client';

@Injectable()
export class CategoryMasterRepository {
    constructor(private prisma: PrismaService) { }

    async createCategory(data: { name: string; user_id: number; status?: MasterStatus }) {
        return this.prisma.category.create({
            data,
        });
    }

    async createSubCategory(data: { name: string; category_id: number; user_id: number; status?: MasterStatus }) {
        return this.prisma.subCategory.create({
            data: {
                name: data.name,
                user_id: data.user_id,
                category_id: data.category_id,
                status: data.status
            },
        });
    }

    async createSubSubCategory(data: { name: string; sub_category_id: number; user_id: number; status?: MasterStatus }) {
        return this.prisma.subSubCategory.create({
            data: {
                name: data.name,
                user_id: data.user_id,
                sub_category_id: data.sub_category_id,
                status: data.status
            },
        });
    }

    async findCategoryByName(name: string, userId: number) {
        return this.prisma.category.findUnique({
            where: {
                name_user_id: {
                    name,
                    user_id: userId
                }
            },
        });
    }

    async findSubCategoryByName(name: string, categoryId: number, userId: number) {
        return this.prisma.subCategory.findUnique({
            where: {
                name_category_id_user_id: {
                    name,
                    category_id: categoryId,
                    user_id: userId
                }
            },
        });
    }

    async findSubSubCategoryByName(name: string, subCategoryId: number, userId: number) {
        return this.prisma.subSubCategory.findUnique({
            where: {
                name_sub_category_id_user_id: {
                    name,
                    sub_category_id: subCategoryId,
                    user_id: userId
                }
            },
        });
    }

    async findCategoryById(id: number) {
        return this.prisma.category.findUnique({
            where: { id },
            include: { sub_categories: true }
        });
    }

    async findSubCategoryById(id: number) {
        return this.prisma.subCategory.findUnique({
            where: { id },
            include: { category: true, sub_sub_categories: true }
        });
    }

    async findSubSubCategoryById(id: number) {
        return this.prisma.subSubCategory.findUnique({
            where: { id },
            include: { sub_category: { include: { category: true } } }
        });
    }

    async getCategoriesForDropdown(userId: number, excludeId?: number) {
        // As per instructions, only Categories should be shown in Category dropdowns
        return this.prisma.category.findMany({
            where: {
                user_id: userId,
                status: 'ACTIVE',
                id: { not: excludeId },
            },
            select: {
                id: true,
                name: true,
            },
            orderBy: { name: 'asc' },
        });
    }

    async getSubCategoriesForDropdown(userId: number, categoryId: number) {
        return this.prisma.subCategory.findMany({
            where: {
                user_id: userId,
                category_id: categoryId,
                status: 'ACTIVE',
            },
            select: {
                id: true,
                name: true,
            },
            orderBy: { name: 'asc' },
        });
    }

    async getSubSubCategoriesForDropdown(userId: number, subCategoryId: number) {
        return this.prisma.subSubCategory.findMany({
            where: {
                user_id: userId,
                sub_category_id: subCategoryId,
                status: 'ACTIVE',
            },
            select: {
                id: true,
                name: true,
            },
            orderBy: { name: 'asc' },
        });
    }

    async getCategoryWithSubCategories(userId: number) {
        return this.prisma.category.findMany({
            where: { user_id: userId },
            include: {
                sub_categories: {
                    orderBy: { name: 'asc' },
                    include: {
                        sub_sub_categories: {
                            orderBy: { name: 'asc' }
                        }
                    }
                }
            },
            orderBy: { name: 'asc' },
        });
    }

    async toggleCategoryStatus(id: number, status: MasterStatus) {
        return this.prisma.category.update({
            where: { id },
            data: { status },
        });
    }

    async toggleSubCategoryStatus(id: number, status: MasterStatus) {
        return this.prisma.subCategory.update({
            where: { id },
            data: { status },
        });
    }

    async toggleSubSubCategoryStatus(id: number, status: MasterStatus) {
        return this.prisma.subSubCategory.update({
            where: { id },
            data: { status },
        });
    }

    async updateSubCategoriesStatusByCategory(categoryId: number, status: MasterStatus) {
        return this.prisma.subCategory.updateMany({
            where: { category_id: categoryId },
            data: { status },
        });
    }

    async updateSubSubCategoriesStatusBySubCategory(subCategoryId: number, status: MasterStatus) {
        return this.prisma.subSubCategory.updateMany({
            where: { sub_category_id: subCategoryId },
            data: { status },
        });
    }

    async updateSubSubCategoriesStatusByCategory(categoryId: number, status: MasterStatus) {
        // Find all sub-categories of this category first
        const subs = await this.prisma.subCategory.findMany({
            where: { category_id: categoryId },
            select: { id: true }
        });
        const subIds = subs.map(s => s.id);

        return this.prisma.subSubCategory.updateMany({
            where: { sub_category_id: { in: subIds } },
            data: { status },
        });
    }

    async updateCategoryName(id: number, name: string) {
        return this.prisma.category.update({
            where: { id },
            data: { name },
        });
    }

    async updateCategoryData(id: number, data: { name?: string }) {
        return this.prisma.category.update({
            where: { id },
            data,
        });
    }

    async updateSubCategoryContent(id: number, name: string, category_id?: number) {
        return this.prisma.subCategory.update({
            where: { id },
            data: {
                name,
                ...(category_id !== undefined && { category_id })
            }
        });
    }

    async updateSubSubCategoryContent(id: number, name: string, sub_category_id?: number) {
        return this.prisma.subSubCategory.update({
            where: { id },
            data: {
                name,
                ...(sub_category_id !== undefined && { sub_category_id })
            }
        });
    }

    async promoteSubCategory(subCategoryId: number, userId: number) {
        return this.prisma.$transaction(async (tx) => {
            const subCategory = await tx.subCategory.findUnique({
                where: { id: subCategoryId },
                include: {
                    products: true,
                    sub_sub_categories: true
                },
            });

            if (!subCategory || subCategory.user_id !== userId) {
                throw new Error('Sub-category not found.');
            }

            // NEW RULE: Cannot promote if has sub-sub-categories
            if (subCategory.sub_sub_categories && subCategory.sub_sub_categories.length > 0) {
                throw new Error('SubCategory cannot be moved because it has SubSubCategories');
            }

            // Check if name already exists as a major Category
            const existingCategory = await tx.category.findFirst({
                where: { name: subCategory.name, user_id: userId }
            });

            if (existingCategory) {
                throw new Error('Category name already exists.');
            }

            // 1. Create the new Category
            const newCategory = await tx.category.create({
                data: {
                    name: subCategory.name,
                    user_id: userId,
                    status: subCategory.status,
                },
            });

            // 2. Re-link Products (if any)
            if (subCategory.products && subCategory.products.length > 0) {
                // Create a "General" sub-category for the new category to house orphaned products
                const defaultSub = await tx.subCategory.create({
                    data: {
                        name: 'General',
                        category_id: newCategory.id,
                        user_id: userId,
                        status: 'ACTIVE',
                    },
                });

                await tx.product.updateMany({
                    where: { sub_category_id: subCategoryId },
                    data: {
                        category_id: newCategory.id,
                        sub_category_id: defaultSub.id,
                    },
                });
            }

            // 3. Delete old SubCategory
            await tx.subCategory.delete({
                where: { id: subCategoryId },
            });

            return newCategory;
        });
    }

    async demoteCategoryToSubCategory(categoryId: number, newParentCategoryId: number, userId: number) {
        return this.prisma.$transaction(async (tx) => {
            const category = await tx.category.findUnique({
                where: { id: categoryId },
                include: { sub_categories: true },
            });

            if (!category || category.user_id !== userId) {
                throw new Error('Category not found.');
            }

            if (category.id === newParentCategoryId) {
                throw new Error('A category cannot be moved under itself.');
            }

            // BUSINESS RULE: A category can move to sub-category only if it has no sub-categories under it.
            if (category.sub_categories && category.sub_categories.length > 0) {
                throw new Error(`${category.name} has sub-categories. Cannot move to sub-category.`);
            }

            // Check if sub-category name already exists under new parent
            const existingSub = await tx.subCategory.findFirst({
                where: { name: category.name, category_id: newParentCategoryId, user_id: userId },
            });

            if (existingSub) {
                throw new Error(`${category.name} sub-category already exists in target parent.`);
            }

            // 1. Create new SubCategory
            const newSubCategory = await tx.subCategory.create({
                data: {
                    name: category.name,
                    category_id: newParentCategoryId,
                    user_id: userId,
                    status: category.status,
                },
            });

            // 2. Re-link Products
            await tx.product.updateMany({
                where: { category_id: categoryId },
                data: {
                    category_id: newParentCategoryId,
                    sub_category_id: newSubCategory.id
                }
            });

            // 3. Delete old Category
            await tx.category.delete({
                where: { id: categoryId },
            });

            return newSubCategory;
        });
    }

    async hasChildren(id: number, type: 'category' | 'sub_category' | 'sub_sub_category'): Promise<boolean> {
        if (type === 'category') {
            const count = await this.prisma.subCategory.count({ where: { category_id: id } });
            return count > 0;
        }
        if (type === 'sub_category') {
            const count = await this.prisma.subSubCategory.count({ where: { sub_category_id: id } });
            return count > 0;
        }
        return false; // SubSubCategory has no children
    }
}
