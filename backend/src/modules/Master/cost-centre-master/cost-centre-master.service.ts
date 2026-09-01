import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/prisma/prisma.service';
import { CreateCostCentreDto, UpdateCostCentreDto } from './dto/cost-centre-master.dto';

@Injectable()
export class CostCentreMasterService {
    constructor(private prisma: PrismaService) { }

    async create(dto: CreateCostCentreDto, userId: number) {
        const prefix = dto.prefix.trim().toUpperCase();
        const costCentreName = dto.costCentreName.trim();

        // Check for duplicates
        const existing = await this.prisma.costCentreMaster.findFirst({
            where: {
                userId,
                costCentreName: { equals: costCentreName, mode: 'insensitive' },
                status: 'ACTIVE',
            }
        });

        if (existing) {
            throw new ConflictException(`Cost Centre with name "${costCentreName}" already exists.`);
        }

        return this.prisma.costCentreMaster.create({
            data: {
                prefix,
                costCentreName,
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
                { costCentreName: { contains: s, mode: 'insensitive' } },
                { prefix: { contains: s, mode: 'insensitive' } },
            ];
        }

        return this.prisma.costCentreMaster.findMany({
            where,
            orderBy: { createdAt: 'desc' }
        });
    }

    async findOne(id: number, userId: number) {
        const costCentre = await this.prisma.costCentreMaster.findFirst({
            where: { id, userId, status: 'ACTIVE' }
        });

        if (!costCentre) {
            throw new NotFoundException('Cost Centre record not found.');
        }

        return costCentre;
    }

    async update(id: number, dto: UpdateCostCentreDto, userId: number) {
        await this.findOne(id, userId);

        const prefix = dto.prefix.trim().toUpperCase();
        const costCentreName = dto.costCentreName.trim();

        // Check for duplicate names (excluding current record)
        const duplicate = await this.prisma.costCentreMaster.findFirst({
            where: {
                userId,
                id: { not: id },
                costCentreName: { equals: costCentreName, mode: 'insensitive' },
                status: 'ACTIVE',
            }
        });

        if (duplicate) {
            throw new ConflictException(`Cost Centre with name "${costCentreName}" already exists.`);
        }

        return this.prisma.costCentreMaster.update({
            where: { id },
            data: {
                prefix,
                costCentreName,
            }
        });
    }

    async remove(id: number, userId: number) {
        await this.findOne(id, userId);

        await this.prisma.costCentreMaster.update({
            where: { id },
            data: { status: 'INACTIVE' }
        });

        return { message: 'Cost Centre deleted successfully' };
    }
}
