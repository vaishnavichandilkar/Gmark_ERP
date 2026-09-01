import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/prisma/prisma.service';
import { CreateDepartmentDto, UpdateDepartmentDto } from './dto/department-master.dto';

@Injectable()
export class DepartmentMasterService {
    constructor(private prisma: PrismaService) { }

    async create(dto: CreateDepartmentDto, userId: number) {
        const prefix = dto.prefix.trim().toUpperCase();
        const departmentName = dto.departmentName.trim();

        // Check for duplicates
        const existing = await this.prisma.departmentMaster.findFirst({
            where: {
                userId,
                departmentName: { equals: departmentName, mode: 'insensitive' },
                status: 'ACTIVE',
            }
        });

        if (existing) {
            throw new ConflictException(`Department with name "${departmentName}" already exists.`);
        }

        return this.prisma.departmentMaster.create({
            data: {
                prefix,
                departmentName,
                userId,
                status: 'ACTIVE',
            }
        });
    }

    async findAll(userId: number, search?: string) {
        const where: any = {
            userId,
            status: 'ACTIVE',
        };

        if (search) {
            const s = search.trim();
            where.OR = [
                { departmentName: { contains: s, mode: 'insensitive' } },
                { prefix: { contains: s, mode: 'insensitive' } },
            ];
        }

        return this.prisma.departmentMaster.findMany({
            where,
            orderBy: { createdAt: 'desc' }
        });
    }

    async findOne(id: number, userId: number) {
        const dept = await this.prisma.departmentMaster.findFirst({
            where: { id, userId, status: 'ACTIVE' }
        });

        if (!dept) {
            throw new NotFoundException('Department record not found.');
        }

        return dept;
    }

    async update(id: number, dto: UpdateDepartmentDto, userId: number) {
        await this.findOne(id, userId);

        const prefix = dto.prefix.trim().toUpperCase();
        const departmentName = dto.departmentName.trim();

        // Check for duplicate names (excluding current record)
        const duplicate = await this.prisma.departmentMaster.findFirst({
            where: {
                userId,
                id: { not: id },
                departmentName: { equals: departmentName, mode: 'insensitive' },
                status: 'ACTIVE',
            }
        });

        if (duplicate) {
            throw new ConflictException(`Department with name "${departmentName}" already exists.`);
        }

        return this.prisma.departmentMaster.update({
            where: { id },
            data: {
                prefix,
                departmentName,
            }
        });
    }

    async remove(id: number, userId: number) {
        await this.findOne(id, userId);

        await this.prisma.departmentMaster.update({
            where: { id },
            data: { status: 'INACTIVE' }
        });

        return { message: 'Department deleted successfully' };
    }
}
