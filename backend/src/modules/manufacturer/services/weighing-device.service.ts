import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/prisma/prisma.service';
import { WeighmentTransactionDto } from '../dto/package.dto';

export interface WeighingDeviceRecord {
    id: string;
    stationId?: string;
    plantCode?: string;
    deviceName: string;
    location?: string;
    manufacturer: string;
    modelNumber: string;
    connectionType: string;
    serialPort: string;
    baudRate: number;
    protocol: string;
    defaultUnit: string;
    maxCapacity: number;
    minDivision: number;
    isOnline: boolean;
    lastConnectedAt: string;
}

@Injectable()
export class WeighingDeviceService {
    private weighmentLogs: any[] = [];

    constructor(private readonly prisma: PrismaService) {}

    private mapToRecord(m: any): WeighingDeviceRecord {
        const rawStationId = m.stationId || m.station_id;
        const cleanStationId = rawStationId && typeof rawStationId === 'string' && !rawStationId.includes('()') && rawStationId.trim() !== '—' && rawStationId.trim() !== '-'
            ? rawStationId.trim()
            : (rawStationId ? undefined : undefined);

        return {
            id: m.id,
            stationId: cleanStationId || undefined,
            plantCode: m.plantCode || m.plant_code || 'AB',
            deviceName: m.deviceName || m.device_name || 'Weighing Scale',
            location: m.location || undefined,
            manufacturer: m.manufacturer || 'Generic',
            modelNumber: m.modelNumber || m.model_number || '',
            connectionType: m.connectionType || m.connection_type || 'USB_SERIAL',
            serialPort: m.serialPort || m.serial_port || 'COM3',
            baudRate: Number(m.baudRate || m.baud_rate) || 9600,
            protocol: m.protocol || 'GENERIC_ASCII',
            defaultUnit: m.defaultUnit || m.default_unit || 'kg',
            maxCapacity: Number(m.maxCapacity || m.max_capacity) || 150.0,
            minDivision: Number(m.minDivision || m.min_division) || 0.005,
            isOnline: Boolean(m.isOnline ?? m.is_online ?? true),
            lastConnectedAt: m.lastConnectedAt
                ? new Date(m.lastConnectedAt).toISOString()
                : new Date().toISOString(),
        };
    }

    /**
     * Seeds initial scale devices if the user's registry is completely empty
     */
    private async ensureDefaultSeed(userId?: number) {
        try {
            const count = await this.prisma.weighingMachine.count({
                where: userId ? { OR: [{ createdBy: userId }, { createdBy: null }] } : {},
            });

            if (count === 0) {
                await this.prisma.weighingMachine.createMany({
                    data: [
                        {
                            id: 'SCALE-01',
                            stationId: 'M01',
                            plantCode: 'AB',
                            deviceName: 'Packaging Line Scale #1 (Bench)',
                            location: 'Packaging Station Bay 1',
                            manufacturer: 'Essae-Teraoka',
                            modelNumber: 'DS-215',
                            connectionType: 'USB_SERIAL',
                            serialPort: 'COM3',
                            baudRate: 9600,
                            protocol: 'GENERIC_ASCII',
                            defaultUnit: 'kg',
                            maxCapacity: 150.0,
                            minDivision: 0.005,
                            isOnline: true,
                            lastConnectedAt: new Date(),
                            createdBy: userId || null,
                        },
                        {
                            id: 'SIMULATOR-01',
                            stationId: 'M02',
                            plantCode: 'AB',
                            deviceName: 'Virtual Platform Scale Simulator',
                            location: 'Virtual Test Lab',
                            manufacturer: 'WeighPro Virtual',
                            modelNumber: 'SIM-PRO-V2',
                            connectionType: 'SIMULATOR',
                            serialPort: 'VIRTUAL',
                            baudRate: 9600,
                            protocol: 'SIMULATOR',
                            defaultUnit: 'kg',
                            maxCapacity: 500.0,
                            minDivision: 0.001,
                            isOnline: true,
                            lastConnectedAt: new Date(),
                            createdBy: userId || null,
                        },
                    ],
                    skipDuplicates: true,
                });
            }
        } catch (err) {
            console.error('Failed to seed default weighing machines:', err);
        }
    }

    /**
     * Get list of registered weighing devices from PostgreSQL
     */
    async getDevices(userId: number): Promise<WeighingDeviceRecord[]> {
        await this.ensureDefaultSeed(userId);

        const records = await this.prisma.weighingMachine.findMany({
            where: {
                OR: [{ createdBy: userId }, { createdBy: null }],
            },
            orderBy: {
                createdAt: 'asc',
            },
        });

        return records.map((r) => this.mapToRecord(r));
    }

    /**
     * Register a new weighing machine in PostgreSQL
     */
    async createDevice(userId: number, dto: any): Promise<WeighingDeviceRecord> {
        let candidateId = (dto.id && String(dto.id).trim()) || '';
        if (!candidateId) {
            const count = await this.prisma.weighingMachine.count();
            candidateId = `SCALE-0${count + 1}`;
        }

        // Verify if ID already exists, if so generate suffix
        const existing = await this.prisma.weighingMachine.findUnique({
            where: { id: candidateId },
        });
        if (existing) {
            candidateId = `${candidateId}-${Date.now().toString().slice(-4)}`;
        }

        const created = await this.prisma.weighingMachine.create({
            data: {
                id: candidateId,
                stationId: dto.stationId || 'M01',
                plantCode: dto.plantCode || 'AB',
                deviceName: dto.deviceName || 'New Weighing Scale',
                location: dto.location || null,
                manufacturer: dto.manufacturer || 'Standard',
                modelNumber: dto.modelNumber || 'GEN-100',
                connectionType: dto.connectionType || 'USB_SERIAL',
                serialPort: dto.serialPort || 'COM3',
                baudRate: Number(dto.baudRate) || 9600,
                protocol: dto.protocol || 'GENERIC_ASCII',
                defaultUnit: dto.defaultUnit || 'kg',
                maxCapacity: Number(dto.maxCapacity) || 150.0,
                minDivision: Number(dto.minDivision) || 0.005,
                isOnline: dto.isOnline !== undefined ? Boolean(dto.isOnline) : true,
                lastConnectedAt: new Date(),
                createdBy: userId,
            },
        });

        return this.mapToRecord(created);
    }

    /**
     * Update an existing weighing machine in PostgreSQL
     */
    async updateDevice(userId: number, id: string, dto: any): Promise<WeighingDeviceRecord> {
        const existing = await this.prisma.weighingMachine.findUnique({
            where: { id },
        });

        if (!existing) {
            throw new NotFoundException(`Device with ID ${id} not found`);
        }

        if (existing.createdBy && existing.createdBy !== userId) {
            throw new ForbiddenException('Access denied: Device belongs to another user');
        }

        const updated = await this.prisma.weighingMachine.update({
            where: { id },
            data: {
                stationId: dto.stationId !== undefined ? dto.stationId : existing.stationId,
                plantCode: dto.plantCode !== undefined ? dto.plantCode : existing.plantCode,
                deviceName: dto.deviceName !== undefined ? dto.deviceName : existing.deviceName,
                location: dto.location !== undefined ? dto.location : existing.location,
                manufacturer: dto.manufacturer !== undefined ? dto.manufacturer : existing.manufacturer,
                modelNumber: dto.modelNumber !== undefined ? dto.modelNumber : existing.modelNumber,
                connectionType: dto.connectionType !== undefined ? dto.connectionType : existing.connectionType,
                serialPort: dto.serialPort !== undefined ? dto.serialPort : existing.serialPort,
                baudRate: dto.baudRate !== undefined ? Number(dto.baudRate) : existing.baudRate,
                protocol: dto.protocol !== undefined ? dto.protocol : existing.protocol,
                defaultUnit: dto.defaultUnit !== undefined ? dto.defaultUnit : existing.defaultUnit,
                maxCapacity: dto.maxCapacity !== undefined ? Number(dto.maxCapacity) : existing.maxCapacity,
                minDivision: dto.minDivision !== undefined ? Number(dto.minDivision) : existing.minDivision,
                isOnline: dto.isOnline !== undefined ? Boolean(dto.isOnline) : existing.isOnline,
                lastConnectedAt: new Date(),
            },
        });

        return this.mapToRecord(updated);
    }

    /**
     * Delete a weighing machine from PostgreSQL
     */
    async deleteDevice(userId: number, id: string): Promise<{ success: boolean }> {
        const existing = await this.prisma.weighingMachine.findUnique({
            where: { id },
        });

        if (!existing) {
            throw new NotFoundException(`Device with ID ${id} not found`);
        }

        if (existing.createdBy && existing.createdBy !== userId) {
            throw new ForbiddenException('Access denied: Device belongs to another user');
        }

        await this.prisma.weighingMachine.delete({
            where: { id },
        });

        return { success: true };
    }

    /**
     * Record an audited weighment transaction in PostgreSQL
     */
    async recordWeighment(userId: number, dto: WeighmentTransactionDto) {
        const netWeight = Number(dto.netWeight) || 0;
        const grossWeight = dto.grossWeight != null ? Number(dto.grossWeight) : netWeight;
        const tareWeight = dto.tareWeight != null ? Number(dto.tareWeight) : 0;

        const record = await this.prisma.weighmentTransaction.create({
            data: {
                machineId: dto.deviceId || null,
                grossWeight,
                tareWeight,
                netWeight,
                unit: dto.unit || 'kg',
                isStable: dto.isStable ?? true,
                weightSource: 'HARDWARE_SCALE',
                rawPayload: dto.rawPayload || null,
                operatorId: userId,
            },
        });

        return {
            success: true,
            weighment: {
                id: record.id,
                userId: record.operatorId,
                deviceId: record.machineId,
                productId: dto.productId,
                grossWeight: Number(record.grossWeight),
                tareWeight: record.tareWeight != null ? Number(record.tareWeight) : 0,
                netWeight: Number(record.netWeight),
                unit: record.unit,
                isStable: record.isStable,
                rawPayload: record.rawPayload,
                capturedAt: record.timestamp.toISOString(),
            },
        };
    }
}
