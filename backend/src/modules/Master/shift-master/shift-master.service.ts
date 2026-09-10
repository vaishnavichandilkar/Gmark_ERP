import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/prisma/prisma.service';
import { CreateShiftDto, UpdateShiftDto } from './dto/shift-master.dto';

@Injectable()
export class ShiftMasterService {
    constructor(private prisma: PrismaService) { }

    async create(dto: CreateShiftDto, userId: number) {
        const shiftName = dto.shiftName.trim();
        const startTime = dto.startTime.trim();
        const endTime = dto.endTime.trim();

        // Check for duplicates
        const existing = await this.prisma.shiftMaster.findFirst({
            where: {
                userId,
                shiftName: { equals: shiftName, mode: 'insensitive' },
                status: 'ACTIVE',
            }
        });

        if (existing) {
            throw new ConflictException(`Shift with name "${shiftName}" already exists.`);
        }

        return this.prisma.shiftMaster.create({
            data: {
                shiftName,
                startTime,
                endTime,
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
                { shiftName: { contains: s, mode: 'insensitive' } },
                { startTime: { contains: s, mode: 'insensitive' } },
                { endTime: { contains: s, mode: 'insensitive' } },
            ];
        }

        return this.prisma.shiftMaster.findMany({
            where,
            orderBy: { createdAt: 'desc' }
        });
    }

    async findOne(id: number, userId: number) {
        const shift = await this.prisma.shiftMaster.findFirst({
            where: { id, userId, status: 'ACTIVE' }
        });

        if (!shift) {
            throw new NotFoundException('Shift record not found.');
        }

        return shift;
    }

    async update(id: number, dto: UpdateShiftDto, userId: number) {
        await this.findOne(id, userId);

        const updateData: any = {};

        if (dto.shiftName !== undefined) {
            const shiftName = dto.shiftName.trim();
            // Check for duplicate names (excluding current record)
            const duplicate = await this.prisma.shiftMaster.findFirst({
                where: {
                    userId,
                    id: { not: id },
                    shiftName: { equals: shiftName, mode: 'insensitive' },
                    status: 'ACTIVE',
                }
            });

            if (duplicate) {
                throw new ConflictException(`Shift with name "${shiftName}" already exists.`);
            }
            updateData.shiftName = shiftName;
        }

        if (dto.startTime !== undefined) {
            updateData.startTime = dto.startTime.trim();
        }

        if (dto.endTime !== undefined) {
            updateData.endTime = dto.endTime.trim();
        }

        return this.prisma.shiftMaster.update({
            where: { id },
            data: updateData
        });
    }

    async remove(id: number, userId: number) {
        await this.findOne(id, userId);

        await this.prisma.shiftMaster.update({
            where: { id },
            data: { status: 'INACTIVE' }
        });

        return { message: 'Shift deleted successfully' };
    }
}
