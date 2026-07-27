import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../infrastructure/prisma/prisma.service';
import { MasterStatus } from '@prisma/client';

@Injectable()
export class CategoryMasterRepository {
    constructor(private prisma: PrismaService) { }

    async createAuditLog(userId: number, action: string, resource: string, details: any) {
        return this.prisma.auditLog.create({
            data: {
                userId,
                action,
                resource,
                details
            }
        });
    }

    async createCategory(data: { name: string; user_id: number; parent_id?: string | null; status?: MasterStatus }) {
        return this.prisma.category.create({
            data: {
                name: data.name,
                user_id: data.user_id,
                parent_id: data.parent_id || null,
                status: data.status
            },
        });
    }

    async createSubCategory(data: { name: string; category_id: string; user_id: number; status?: MasterStatus }) {
        return this.createCategory({
            name: data.name,
            user_id: data.user_id,
            parent_id: data.category_id,
            status: data.status
        });
    }

    async createSubSubCategory(data: { name: string; sub_category_id: string; user_id: number; status?: MasterStatus }) {
        return this.createCategory({
            name: data.name,
            user_id: data.user_id,
            parent_id: data.sub_category_id,
            status: data.status
        });
    }

    async findCategoryByName(name: string, userId: number) {
        return this.prisma.category.findFirst({
            where: {
                name: { equals: name, mode: 'insensitive' },
                user_id: userId,
                parent_id: null
            },
        });
    }

    async findSubCategoryByName(name: string, categoryId: string, userId: number) {
        return this.prisma.category.findFirst({
            where: {
                name: { equals: name, mode: 'insensitive' },
                parent_id: categoryId,
                user_id: userId
            },
        });
    }

    async findSubSubCategoryByName(name: string, subCategoryId: string, userId: number) {
        return this.prisma.category.findFirst({
            where: {
                name: { equals: name, mode: 'insensitive' },
                parent_id: subCategoryId,
                user_id: userId
            },
        });
    }

    async findCategoryById(id: string) {
        return this.prisma.category.findUnique({
            where: { id },
            include: { children: true }
        });
    }

    async findSubCategoryById(id: string) {
        return this.prisma.category.findUnique({
            where: { id },
            include: { parent: true }
        });
    }

    async findSubSubCategoryById(id: string) {
        return this.prisma.category.findUnique({
            where: { id },
            include: {
                parent: {
                    include: { parent: true }
                }
            }
        });
    }

    async getCategoriesForDropdown(userId: number, excludeId?: string) {
        return this.prisma.category.findMany({
            where: {
                user_id: userId,
                status: 'ACTIVE',
                parent_id: null,
                id: { not: excludeId },
            },
            select: {
                id: true,
                name: true,
            },
            orderBy: { name: 'asc' },
        });
    }

    async getCategoriesForMoveOptions(userId: number, excludeId?: string) {
        return this.prisma.category.findMany({
            where: {
                user_id: userId,
                status: 'ACTIVE',
                id: { not: excludeId },
            },
            select: {
                id: true,
                name: true,
                parent_id: true,
            },
            orderBy: { name: 'asc' },
        });
    }

    async getCategoryWithSubCategories(userId: number) {
        try {
            await this.prisma.category.deleteMany({
                where: {
                    user_id: userId,
                    OR: [
                        { name: 'null' },
                        { name: 'undefined' },
                        { name: '' }
                    ]
                }
            });
        } catch (e) {
            console.error('Error auto-cleaning invalid categories:', e);
        }

        const categories = await this.prisma.category.findMany({
            where: { user_id: userId, parent_id: null },
            include: {
                children: {
                    include: {
                        children: {
                            orderBy: { name: 'asc' }
                        }
                    },
                    orderBy: { name: 'asc' }
                }
            },
            orderBy: { name: 'asc' },
        });

        return categories.map(cat => this.mapHierarchy(cat));
    }

    private mapHierarchy(cat: any): any {
        const isInvalidName = (n: any) => !n || typeof n !== 'string' || !n.trim() || n.trim().toLowerCase() === 'null' || n.trim().toLowerCase() === 'undefined';

        const subCategories = (cat.children || [])
            .filter((sub: any) => !isInvalidName(sub?.name))
            .map((sub: any) => ({
                id: sub.id,
                name: sub.name,
                category_id: sub.parent_id,
                user_id: sub.user_id,
                status: sub.status,
                created_at: sub.created_at,
                updated_at: sub.updated_at,
                sub_sub_categories: (sub.children || [])
                    .filter((ss: any) => !isInvalidName(ss?.name))
                    .map((ss: any) => ({
                        id: ss.id,
                        name: ss.name,
                        sub_category_id: ss.parent_id,
                        user_id: ss.user_id,
                        status: ss.status,
                        created_at: ss.created_at,
                        updated_at: ss.updated_at
                    }))
            }));

        return {
            id: cat.id,
            name: cat.name,
            user_id: cat.user_id,
            parent_id: cat.parent_id,
            status: cat.status,
            created_at: cat.created_at,
            updated_at: cat.updated_at,
            sub_categories: subCategories
        };
    }

    async toggleCategoryStatus(id: string, status: MasterStatus) {
        return this.prisma.category.update({
            where: { id },
            data: { status },
        });
    }

    async toggleSubCategoryStatus(id: string, status: MasterStatus) {
        return this.toggleCategoryStatus(id, status);
    }

    async toggleSubSubCategoryStatus(id: string, status: MasterStatus) {
        return this.toggleCategoryStatus(id, status);
    }

    async updateSubCategoriesStatusByCategory(categoryId: string, status: MasterStatus) {
        const subCategories = await this.prisma.category.findMany({
            where: { parent_id: categoryId },
            select: { id: true }
        });

        const subCategoryIds = subCategories.map(s => s.id);

        if (subCategoryIds.length > 0) {
            await this.prisma.category.updateMany({
                where: { parent_id: { in: subCategoryIds } },
                data: { status }
            });
        }

        return this.prisma.category.updateMany({
            where: { parent_id: categoryId },
            data: { status },
        });
    }

    async updateSubSubCategoriesStatusBySubCategory(subCategoryId: string, status: MasterStatus) {
        return this.prisma.category.updateMany({
            where: { parent_id: subCategoryId },
            data: { status },
        });
    }

    async updateCategoryName(id: string, name: string) {
        return this.prisma.category.update({
            where: { id },
            data: { name },
        });
    }

    async updateCategoryData(id: string, data: { name?: string; parent_id?: string | null }) {
        return this.prisma.category.update({
            where: { id },
            data,
        });
    }

    async updateSubCategoryContent(id: string, name: string, category_id?: string) {
        return this.prisma.category.update({
            where: { id },
            data: {
                name,
                parent_id: category_id === undefined ? undefined : category_id
            }
        });
    }

    async updateSubSubCategoryContent(id: string, name: string, sub_category_id?: string) {
        return this.prisma.category.update({
            where: { id },
            data: {
                name,
                parent_id: sub_category_id === undefined ? undefined : sub_category_id
            }
        });
    }

    async moveCategory(categoryId: string, targetParentId: string | null) {
        return this.prisma.category.update({
            where: { id: categoryId },
            data: { parent_id: targetParentId }
        });
    }
}
