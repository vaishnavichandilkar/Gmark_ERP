import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../infrastructure/prisma/prisma.service';
import { Prisma, ProductType, MasterStatus } from '@prisma/client';

@Injectable()
export class ProductMasterRepository {
    constructor(private readonly prisma: PrismaService) { }

    async createProduct(data: Prisma.ProductUncheckedCreateInput) {
        return this.prisma.product.create({ data });
    }

    async getLastProductCode(userId: number, prefix: string): Promise<string | null> {
        const product = await this.prisma.product.findFirst({
            where: { 
                created_by: userId,
                product_code: { startsWith: prefix }
            },
            orderBy: { id: 'desc' },
            select: { product_code: true }
        });
        return product?.product_code || null;
    }

    async findProductById(id: number) {
        return this.prisma.product.findUnique({
            where: { id, is_deleted: false },
            include: {
                uom: true,
                category: {
                    include: {
                        parent: {
                            include: {
                                parent: true
                            }
                        }
                    }
                },
                hsnMaster: true
            }
        });
    }

    async getProducts(params: {
        skip?: number;
        take?: number;
        searchTerm?: string;
        uom_id?: number;
        product_type?: ProductType;
        status?: MasterStatus;
        created_by: number;
        isExport?: boolean;
    }) {
        const { skip = 0, take = 10, searchTerm, uom_id, product_type, status, created_by, isExport } = params;

        const where: Prisma.ProductWhereInput = { is_deleted: false, created_by };

        if (searchTerm) {
            const or: Prisma.ProductWhereInput[] = [
                { product_name: { contains: searchTerm, mode: 'insensitive' } },
                { product_code: { contains: searchTerm, mode: 'insensitive' } },
                { hsn_code: { contains: searchTerm, mode: 'insensitive' } },
                { uom: { unit_name: { contains: searchTerm, mode: 'insensitive' } } },
                { category: { name: { contains: searchTerm, mode: 'insensitive' } } },
            ];

            // Add enum searches
            if (['GOODS', 'SERVICES'].some(type => type.includes(searchTerm.toUpperCase()))) {
                or.push({ product_type: { in: ['GOODS', 'SERVICES'].filter(type => type.includes(searchTerm.toUpperCase())) as ProductType[] } });
            }

            if (['ACTIVE', 'INACTIVE'].some(s => s.includes(searchTerm.toUpperCase()))) {
                or.push({ status: { in: ['ACTIVE', 'INACTIVE'].filter(s => s.includes(searchTerm.toUpperCase())) as MasterStatus[] } });
            }

            // Tax rate search
            const taxNum = parseFloat(searchTerm);
            if (!isNaN(taxNum)) {
                or.push({ tax_rate: { equals: taxNum } });
            }

            where.OR = or;
        }

        if (uom_id) where.uom_id = uom_id;
        if (product_type) where.product_type = product_type;
        if (status) where.status = status;

        const findOptions: Prisma.ProductFindManyArgs = {
            where,
            orderBy: { created_at: 'desc' },
            include: {
                uom: true,
                category: {
                    include: {
                        parent: {
                            include: {
                                parent: true
                            }
                        }
                    }
                },
                hsnMaster: true
            }
        };

        if (!isExport) {
            findOptions.skip = skip;
            findOptions.take = take;
        }

        const [products, total] = await Promise.all([
            this.prisma.product.findMany(findOptions),
            this.prisma.product.count({ where })
        ]);

        return { products, total, totalPages: isExport ? 1 : Math.ceil(total / take) };
    }

    async updateProduct(id: number, data: Prisma.ProductUncheckedUpdateInput) {
        return this.prisma.product.update({ where: { id }, data });
    }

    async toggleStatus(id: number, status: MasterStatus) {
        return this.prisma.product.update({ where: { id }, data: { status } });
    }

    async softDelete(id: number) {
        return this.prisma.product.update({ where: { id }, data: { is_deleted: true } });
    }

    async getUomById(id: number) {
        return this.prisma.unitMaster.findUnique({ where: { id } });
    }

    async getCategoryById(id: string) {
        return this.prisma.category.findUnique({ where: { id } });
    }

    async getSubCategoryById(id: string) {
        return this.prisma.category.findUnique({ where: { id } });
    }

    async getSubSubCategoryById(id: string) {
        return this.prisma.category.findUnique({ where: { id } });
    }

    async getActiveUomsForDropdown(userId: number) {
        return this.prisma.unitMaster.findMany({
            where: { user_id: userId, status: 'ACTIVE' },
            select: { id: true, unit_name: true, gst_uom: true, full_name_of_measurement: true },
            orderBy: { unit_name: 'asc' }
        });
    }

    async getActiveCategoriesForDropdown(userId: number) {
        return this.prisma.category.findMany({
            where: { user_id: userId, status: 'ACTIVE', parent_id: null },
            select: { id: true, name: true },
            orderBy: { name: 'asc' }
        });
    }

    async getActiveSubCategoriesForDropdown(categoryId: string, userId: number) {
        return this.prisma.category.findMany({
            where: { parent_id: categoryId, user_id: userId, status: 'ACTIVE' },
            select: { id: true, name: true },
            orderBy: { name: 'asc' }
        });
    }

    async getActiveSubSubCategoriesForDropdown(subCategoryId: string, userId: number) {
        return this.prisma.category.findMany({
            where: { parent_id: subCategoryId, user_id: userId, status: 'ACTIVE' },
            select: { id: true, name: true },
            orderBy: { name: 'asc' }
        });
    }

    async findByProductName(name: string, userId: number) {
        return this.prisma.product.findFirst({
            where: {
                product_name: { equals: name, mode: 'insensitive' },
                created_by: userId,
                is_deleted: false
            }
        });
    }

    async getProductNameSuggestions(searchTerm: string, userId: number) {
        return this.prisma.product.findMany({
            where: {
                product_name: { contains: searchTerm, mode: 'insensitive' },
                created_by: userId,
                is_deleted: false
            },
            select: { product_name: true },
            distinct: ['product_name'],
            take: 10,
            orderBy: { product_name: 'asc' }
        });
    }
}
