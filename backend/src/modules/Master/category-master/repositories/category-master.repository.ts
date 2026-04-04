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
            include: { category: true }
        });
    }

    async findSubSubCategoryById(id: number) {
        return this.prisma.subSubCategory.findUnique({
            where: { id },
            include: {
                sub_category: {
                    include: { category: true }
                }
            }
        });
    }

    async getCategoriesForDropdown(userId: number, excludeId?: number) {
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

    async getCategoryWithSubCategories(userId: number) {
        return this.prisma.category.findMany({
            where: { user_id: userId },
            include: {
                sub_categories: {
                    include: {
                        sub_sub_categories: {
                            orderBy: { name: 'asc' }
                        }
                    },
                    orderBy: { name: 'asc' }
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
        const subCategories = await this.prisma.subCategory.findMany({
            where: { category_id: categoryId },
            select: { id: true }
        });

        const subCategoryIds = subCategories.map(s => s.id);

        if (subCategoryIds.length > 0) {
            await this.prisma.subSubCategory.updateMany({
                where: { sub_category_id: { in: subCategoryIds } },
                data: { status }
            });
        }

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

    // --- HIERARCHY MOVE LOGIC ---

    async promoteSubCategoryToCategory(subCategoryId: number, userId: number) {
        return this.prisma.$transaction(async (tx) => {
            const subCategory = await tx.subCategory.findUnique({
                where: { id: subCategoryId },
                include: { sub_sub_categories: true, products: true },
            });

            if (!subCategory || subCategory.user_id !== userId) throw new Error("Sub-category not found.");

            const checkCat = await tx.category.findFirst({ where: { name: subCategory.name, user_id: userId } });
            if (checkCat) throw new Error(`Category "${subCategory.name}" already exists.`);

            const newRoot = await tx.category.create({
                data: { name: subCategory.name, user_id: userId, status: subCategory.status }
            });

            if (subCategory.sub_sub_categories?.length > 0) {
                for (const ss of subCategory.sub_sub_categories) {
                    const newSub = await tx.subCategory.create({
                        data: { name: ss.name, category_id: newRoot.id, user_id: userId, status: ss.status }
                    });
                    await tx.product.updateMany({
                        where: { sub_sub_category_id: ss.id },
                        data: { category_id: newRoot.id, sub_category_id: newSub.id, sub_sub_category_id: null }
                    });
                    await tx.subSubCategory.delete({ where: { id: ss.id } });
                }
            }

            // Products in L2 can't point to L1 if L2 is mandatory.
            const firstChild = await tx.subCategory.findFirst({ where: { category_id: newRoot.id } });
            if (firstChild) {
                await tx.product.updateMany({
                    where: { sub_category_id: subCategoryId, sub_sub_category_id: null },
                    data: { category_id: newRoot.id, sub_category_id: firstChild.id }
                });
            } else {
                const pc = await tx.product.count({ where: { sub_category_id: subCategoryId, sub_sub_category_id: null } });
                if (pc > 0) throw new Error("Cannot promote SubCategory with products but no Level-3 children to provide SubCategory targets.");
            }

            await tx.subCategory.delete({ where: { id: subCategoryId } });
            return newRoot;
        });
    }

    async promoteSubSubCategoryToSubCategory(subSubCategoryId: number, newParentCategoryId: number, userId: number) {
        return this.prisma.$transaction(async (tx) => {
            const subSubCategory = await tx.subSubCategory.findUnique({
                where: { id: subSubCategoryId },
            });

            if (!subSubCategory || subSubCategory.user_id !== userId) {
                throw new Error('Sub-sub-category not found.');
            }

            const existingSub = await tx.subCategory.findFirst({
                where: { name: subSubCategory.name, category_id: newParentCategoryId, user_id: userId }
            });

            if (existingSub) {
                throw new Error(`Sub-category "${subSubCategory.name}" already exists in target Category.`);
            }

            const newSubCategory = await tx.subCategory.create({
                data: {
                    name: subSubCategory.name,
                    category_id: newParentCategoryId,
                    user_id: userId,
                    status: subSubCategory.status
                }
            });

            await tx.product.updateMany({
                where: { sub_sub_category_id: subSubCategoryId },
                data: {
                    category_id: newParentCategoryId,
                    sub_category_id: newSubCategory.id,
                    sub_sub_category_id: null
                }
            });

            await tx.subSubCategory.delete({ where: { id: subSubCategoryId } });

            return newSubCategory;
        });
    }

    async promoteSubSubCategoryToCategory(subSubCategoryId: number, userId: number) {
        return this.prisma.$transaction(async (tx) => {
            const subSub = await tx.subSubCategory.findUnique({ where: { id: subSubCategoryId } });
            if (!subSub || subSub.user_id !== userId) throw new Error("Sub-sub-category not found.");

            const checkCat = await tx.category.findFirst({ where: { name: subSub.name, user_id: userId } });
            if (checkCat) throw new Error(`Category "${subSub.name}" already exists.`);

            const pc = await tx.product.count({ where: { sub_sub_category_id: subSubCategoryId } });
            if (pc > 0) throw new Error("Cannot convert Sub-SubCategory to Category as its products require a SubCategory parent in the 3-level hierarchy.");

            const root = await tx.category.create({
                data: { name: subSub.name, user_id: userId, status: subSub.status }
            });
            await tx.subSubCategory.delete({ where: { id: subSubCategoryId } });
            return root;
        });
    }

    async demoteCategoryToSubCategory(categoryId: number, newParentCategoryId: number, userId: number) {
        return this.prisma.$transaction(async (tx) => {
            const category = await tx.category.findUnique({
                where: { id: categoryId },
                include: { sub_categories: { include: { sub_sub_categories: true } } },
            });

            if (!category || category.user_id !== userId) throw new Error('Category not found.');

            const subCount = category.sub_categories.length;
            if (subCount > 1) {
                throw new Error('Category cannot be moved because it has multiple SubCategories');
            }

            const existingSub = await tx.subCategory.findFirst({
                where: { name: category.name, category_id: newParentCategoryId, user_id: userId }
            });
            if (existingSub) throw new Error(`${category.name} already exists in target Category.`);

            // Create the new SubCategory record (Level 2)
            const newSub = await tx.subCategory.create({
                data: {
                    name: category.name,
                    category_id: newParentCategoryId,
                    user_id: userId,
                    status: category.status
                }
            });

            // If it has exactly 1 subcategory, propagate it to SubSubCategory (Level 3)
            if (subCount === 1) {
                const oldSub = category.sub_categories[0];
                const newSubSub = await tx.subSubCategory.create({
                    data: {
                        name: oldSub.name,
                        sub_category_id: newSub.id,
                        user_id: userId,
                        status: oldSub.status
                    }
                });

                // Move products: Path was (Category A -> SubCategory B). Now it is (Category X -> SubCategory A -> SubSubCategory B)
                await tx.product.updateMany({
                    where: { sub_category_id: oldSub.id, category_id: categoryId },
                    data: {
                        category_id: newParentCategoryId,
                        sub_category_id: newSub.id,
                        sub_sub_category_id: newSubSub.id
                    }
                });

                // If the old subcategory had its own sub-subcategories, they would become 4th level which is BLOCKED.
                // But our 3-level rule means SubSubCategories were children of the oldSub.
                // Converting oldSub (L2) to L3 means its children (L3) became orphans or must be blocked.
                if (oldSub.sub_sub_categories && oldSub.sub_sub_categories.length > 0) {
                    throw new Error('Cannot demote Category because its SubCategory child already has Sub-SubCategories (violates 3-level depth)');
                }

                await tx.subCategory.delete({ where: { id: oldSub.id } });
            }

            await tx.category.delete({ where: { id: categoryId } });
            return newSub;
        });
    }

    async demoteCategoryToSubSubCategory(categoryId: number, newParentSubCategoryId: number, userId: number) {
        return this.prisma.$transaction(async (tx) => {
            const category = await tx.category.findUnique({
                where: { id: categoryId },
                include: { sub_categories: true },
            });

            if (!category || category.user_id !== userId) throw new Error('Category not found.');

            if (category.sub_categories && category.sub_categories.length > 0) {
                throw new Error('Category with SubCategories can only be moved to SubCategory level (under another Category)');
            }

            const parentSub = await tx.subCategory.findUnique({ where: { id: newParentSubCategoryId } });
            if (!parentSub) throw new Error('Target Sub-category not found.');

            const existingSubSub = await tx.subSubCategory.findFirst({
                where: { name: category.name, sub_category_id: newParentSubCategoryId, user_id: userId }
            });
            if (existingSubSub) throw new Error(`${category.name} already exists in target Sub-category.`);

            const newSubSub = await tx.subSubCategory.create({
                data: {
                    name: category.name,
                    sub_category_id: newParentSubCategoryId,
                    user_id: userId,
                    status: category.status
                }
            });

            // Path: Category A. Now: Category X -> SubCategory Y -> SubSubCategory A
            await tx.product.updateMany({
                where: { category_id: categoryId },
                data: {
                    category_id: parentSub.category_id,
                    sub_category_id: parentSub.id,
                    sub_sub_category_id: newSubSub.id
                }
            });

            await tx.category.delete({ where: { id: categoryId } });
            return newSubSub;
        });
    }

    async demoteSubCategoryToSubSubCategory(subCategoryId: number, newParentSubCategoryId: number, userId: number) {
        return this.prisma.$transaction(async (tx) => {
            const subCategory = await tx.subCategory.findUnique({
                where: { id: subCategoryId },
                include: { sub_sub_categories: true }
            });

            if (!subCategory || subCategory.user_id !== userId) {
                throw new Error('Sub-category not found.');
            }

            if (subCategory.sub_sub_categories && subCategory.sub_sub_categories.length > 0) {
                throw new Error(`${subCategory.name} has Sub-SubCategories. Cannot move to a lower level.`);
            }

            const parentSub = await tx.subCategory.findUnique({ where: { id: newParentSubCategoryId } });
            if (!parentSub) throw new Error('Target Sub-category not found.');

            const existingSubSub = await tx.subSubCategory.findFirst({
                where: { name: subCategory.name, sub_category_id: newParentSubCategoryId, user_id: userId }
            });
            if (existingSubSub) throw new Error(`${subCategory.name} already exists in target Sub-category.`);

            const newSubSub = await tx.subSubCategory.create({
                data: {
                    name: subCategory.name,
                    sub_category_id: newParentSubCategoryId,
                    user_id: userId,
                    status: subCategory.status
                }
            });

            await tx.product.updateMany({
                where: { sub_category_id: subCategoryId },
                data: {
                    category_id: parentSub.category_id,
                    sub_category_id: parentSub.id,
                    sub_sub_category_id: newSubSub.id
                }
            });

            await tx.subCategory.delete({ where: { id: subCategoryId } });

            return newSubSub;
        });
    }
}
