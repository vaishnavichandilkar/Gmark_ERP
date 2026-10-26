import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/prisma/prisma.service';
import { LabelGeneratorService } from './label-generator.service';
import { CreatePackageDto, PackageQueryDto } from '../dto/package.dto';
import { formatPackageNumber, formatPackagingTimestamp } from '../utils/serial-formatter.util';

export interface PackageRecord {
    id: number;
    serial_number: string;
    package_number: string;
    product_id: number;
    product_name: string;
    product_code: string;
    company_name: string;
    net_weight: number;
    gross_weight: number;
    tare_weight: number;
    weight_unit: string;
    weight_source: string;
    plant_code: string;
    machine_id: string;
    label_size: string;
    label_status: string;
    print_status: string;
    reprint_count: number;
    inventory_status: string;
    dispatched_at?: string;
    dispatched_by?: number;
    barcode_data?: string;
    created_at: string;
    created_by: number;
    raw_payload?: string;
}

@Injectable()
export class PackageService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly labelGeneratorService: LabelGeneratorService,
    ) {}

    /**
     * Map Prisma ManufacturedPackage record to PackageRecord interface
     */
    private mapToPackageRecord(m: any): PackageRecord {
        let cleanMachineId = m.machineId ? String(m.machineId).trim() : '';
        if (!cleanMachineId || cleanMachineId.includes('()') || cleanMachineId === '—' || cleanMachineId === '-') {
            cleanMachineId = 'M01';
        }
        let cleanSerial = m.serialNumber ? String(m.serialNumber).trim() : '';
        if (cleanSerial.includes('()') || cleanSerial.includes('—')) {
            cleanSerial = cleanSerial.replace(/[-—\s]+\(\)/g, '-M01').replace(/—/g, '-');
        }

        return {
            id: m.id,
            serial_number: cleanSerial || m.serialNumber,
            package_number: m.packageNumber,
            product_id: m.productId,
            product_name: m.productName,
            product_code: m.productCode,
            company_name: m.companyName,
            net_weight: Number(m.netWeight),
            gross_weight: m.grossWeight != null ? Number(m.grossWeight) : Number(m.netWeight),
            tare_weight: m.tareWeight != null ? Number(m.tareWeight) : 0,
            weight_unit: m.weightUnit || 'kg',
            weight_source: m.weightSource || 'HARDWARE_SCALE',
            plant_code: m.plantCode || 'AB',
            machine_id: cleanMachineId,
            label_size: m.labelSize || '100x50',
            label_status: m.labelStatus || 'CREATED',
            print_status: m.printStatus || 'PRINTED',
            reprint_count: m.reprintCount || 0,
            inventory_status: m.inventoryStatus || 'IN_STOCK',
            dispatched_at: m.dispatchedAt ? new Date(m.dispatchedAt).toISOString() : undefined,
            dispatched_by: m.dispatchedBy || undefined,
            barcode_data: m.barcodeData || undefined,
            created_at: new Date(m.createdAt).toISOString(),
            created_by: m.createdBy || 0,
            raw_payload: m.rawPayload || undefined,
        };
    }

    /**
     * Helper to lookup a product by ID, optionally validating seller ownership
     */
    public async getProductDetail(productId: number, userId?: number) {
        const product = await this.prisma.product.findUnique({
            where: { id: Number(productId) },
        });

        if (!product || product.is_deleted) {
            return null;
        }

        if (userId && product.created_by !== userId) {
            throw new ForbiddenException('Access denied: Product does not belong to the authenticated seller');
        }

        return product;
    }

    /**
     * Helper to lookup shop details by user ID
     */
    public async getShopDetail(userId: number) {
        return this.prisma.shopDetail.findUnique({
            where: { userId: Number(userId) },
        });
    }

    /**
     * Register a new package weighed at the packaging station with atomic PostgreSQL persistence
     */
    async createPackage(userId: number, dto: CreatePackageDto) {
        // 1. Verify Product exists in database and belongs to the authenticated seller
        const product = await this.prisma.product.findUnique({
            where: { id: Number(dto.productId) },
        });

        if (!product || product.is_deleted) {
            throw new NotFoundException(`Product with ID ${dto.productId} not found or is inactive`);
        }

        if (product.created_by !== userId) {
            throw new ForbiddenException('Access denied: Product does not belong to the authenticated seller');
        }

        const productName = product.product_name;
        const productCode = product.product_code;

        // 2. Fetch authoritative company name from ShopDetail
        let companyName = 'GMARK MANUFACTURING PVT LTD';
        try {
            const shop = await this.prisma.shopDetail.findUnique({
                where: { userId },
            });
            if (shop && shop.shopName) {
                companyName = shop.shopName;
            }
        } catch (_) {}

        // 3. Concurrency-safe, persistent atomic daily sequence allocation in PostgreSQL
        const now = new Date();
        const yy = String(now.getFullYear()).slice(-2);
        const mm = String(now.getMonth() + 1).padStart(2, '0');
        const dd = String(now.getDate()).padStart(2, '0');
        const datePrefix = `${yy}${mm}${dd}`;

        const plantCode = (dto.plantCode || 'AB').trim().toUpperCase();
        if (!/^[A-Z0-9]{2}$/.test(plantCode)) {
            throw new BadRequestException(`Invalid plant code: "${plantCode}". Must be exactly 2 alphanumeric characters (e.g. "AB").`);
        }
        let machineId = (dto.machineId || 'M01').trim().toUpperCase();
        if (!machineId || machineId.includes('()') || machineId === '—' || machineId === '-') {
            machineId = 'M01';
        }

        const netWeight = parseFloat(Number(dto.netWeight).toFixed(3));
        const tareWeight = dto.tareWeight != null ? parseFloat(Number(dto.tareWeight).toFixed(3)) : 0;
        const grossWeight = dto.grossWeight != null ? parseFloat(Number(dto.grossWeight).toFixed(3)) : netWeight + tareWeight;

        // Execute in database transaction to prevent race conditions & duplicate serials
        const createdPackage = await this.prisma.$transaction(async (tx) => {
            const seqRecord = await tx.dailySerialSequence.upsert({
                where: {
                    unique_daily_sequence: {
                        datePrefix,
                        plantCode,
                        userId,
                    },
                },
                update: {
                    lastNumber: { increment: 1 },
                },
                create: {
                    datePrefix,
                    plantCode,
                    userId,
                    lastNumber: 1,
                },
            });

            const sequence = seqRecord.lastNumber;
            const packageNumber = formatPackageNumber(now, sequence, plantCode);
            const serialNumber = `${packageNumber}-${machineId}`;

            const safeProduct = productName.replace(/\|/g, '\\|');
            const unitLower = (dto.weightUnit || 'kg').toLowerCase();
            const barcodePayload = `${safeProduct} | ${netWeight.toFixed(2)} ${unitLower} | ${serialNumber}`;

            return tx.manufacturedPackage.create({
                data: {
                    serialNumber,
                    packageNumber,
                    productId: dto.productId,
                    productName,
                    productCode,
                    companyName,
                    netWeight,
                    grossWeight,
                    tareWeight,
                    weightUnit: (dto.weightUnit || 'kg').toLowerCase(),
                    weightSource: dto.weightSource || 'HARDWARE_SCALE',
                    plantCode,
                    machineId,
                    labelSize: dto.labelSize || '150x100',
                    labelStatus: 'CREATED',
                    printStatus: 'PRINTED',
                    reprintCount: 0,
                    inventoryStatus: 'IN_STOCK',
                    barcodeData: barcodePayload,
                    rawPayload: dto.rawPayload || null,
                    createdBy: userId,
                },
            });
        });

        // 4. Generate thermal barcode label PDF buffer
        const labelPdf = await this.labelGeneratorService.generateBatchPdf({
            labelSize: (dto.labelSize as any) || '150x100',
            items: [
                {
                    companyName,
                    productName,
                    netWeight,
                    serialNumber: createdPackage.serialNumber,
                    barcodePayload: createdPackage.barcodeData || undefined,
                    isProduction: true,
                },
            ],
        });

        const packageRecord = this.mapToPackageRecord(createdPackage);

        return {
            success: true,
            package: packageRecord,
            labelPdfBase64: labelPdf.toString('base64'),
        };
    }

    /**
     * Retrieve paginated packages history from PostgreSQL with search, filters, and summary metrics
     */
    async getPackages(userId: number, query: PackageQueryDto) {
        const {
            page = 1,
            limit = 25,
            search = '',
            productId,
            dateFrom,
            dateTo,
            status,
        } = query;

        // Base where condition strictly enforced to authenticated seller's products
        const where: any = {
            product: {
                created_by: userId,
            },
        };

        // Search query across serial, product, machine, status, barcode
        if (search && search.trim()) {
            let q = search.trim();
            // If operator scanned a complete pipe-delimited Code 128 barcode
            if (q.includes('|')) {
                const parts = q.split('|').map((s) => s.trim());
                if (parts.length >= 5) {
                    q = parts[3]; // Extracted serial number from 5-field barcode
                } else if (parts.length >= 2) {
                    q = parts[parts.length - 1]; // Extracted serial number from 3-field barcode
                }
            } else if (q.startsWith('{')) {
                try {
                    const parsed = JSON.parse(q);
                    if (parsed.serial) q = parsed.serial;
                } catch {
                    // ignore JSON error
                }
            }

            where.AND = [
                {
                    OR: [
                        { serialNumber: { contains: q, mode: 'insensitive' } },
                        { packageNumber: { contains: q, mode: 'insensitive' } },
                        { productName: { contains: q, mode: 'insensitive' } },
                        { productCode: { contains: q, mode: 'insensitive' } },
                        { machineId: { contains: q, mode: 'insensitive' } },
                        { plantCode: { contains: q, mode: 'insensitive' } },
                        { barcodeData: { contains: q, mode: 'insensitive' } },
                    ],
                },
            ];
        }

        // Product filter
        if (productId) {
            where.productId = Number(productId);
        }

        // Date filter
        if (dateFrom || dateTo) {
            where.createdAt = {};
            if (dateFrom) {
                where.createdAt.gte = new Date(dateFrom);
            }
            if (dateTo) {
                const to = new Date(dateTo);
                to.setHours(23, 59, 59, 999);
                where.createdAt.lte = to;
            }
        }

        // Status filter
        if (status && status !== 'ALL') {
            where.labelStatus = status.toUpperCase();
        }

        const pageNum = Number(page) || 1;
        const limitNum = Number(limit) || 25;
        const skip = (pageNum - 1) * limitNum;

        const [total, dbRecords, aggregateResult] = await Promise.all([
            this.prisma.manufacturedPackage.count({ where }),
            this.prisma.manufacturedPackage.findMany({
                where,
                skip,
                take: limitNum,
                orderBy: { createdAt: 'desc' },
            }),
            this.prisma.manufacturedPackage.aggregate({
                where,
                _sum: { netWeight: true },
                _count: { id: true },
            }),
        ]);

        const mapped = dbRecords.map((m) => this.mapToPackageRecord(m));

        const totalNetWeight = aggregateResult._sum.netWeight != null
            ? parseFloat(Number(aggregateResult._sum.netWeight).toFixed(3))
            : 0;
        const avgNetWeight = total > 0 ? parseFloat((totalNetWeight / total).toFixed(3)) : 0;

        return {
            data: mapped,
            packages: mapped, // Backward compatibility
            pagination: {
                page: pageNum,
                limit: limitNum,
                total,
                totalPages: Math.ceil(total / limitNum) || 1,
            },
            summary: {
                totalPackages: total,
                totalNetWeight,
                activePackages: total,
                avgNetWeight,
            },
        };
    }

    /**
     * Retrieve single package details by ID from PostgreSQL with strict seller ownership check
     */
    async getPackageById(userId: number, id: number): Promise<PackageRecord> {
        const pkg = await this.prisma.manufacturedPackage.findFirst({
            where: {
                id: Number(id),
                product: { created_by: userId },
            },
        });

        if (!pkg) {
            const existsUnderOtherSeller = await this.prisma.manufacturedPackage.findUnique({
                where: { id: Number(id) },
                select: { id: true, product: { select: { created_by: true } } },
            });

            if (existsUnderOtherSeller) {
                throw new ForbiddenException('Access denied: Package does not belong to the authenticated seller');
            }

            throw new NotFoundException(`Package with ID ${id} not found`);
        }

        return this.mapToPackageRecord(pkg);
    }

    /**
     * Generate thermal label reprint with persistent database audit tracking and strict seller ownership check
     */
    async reprintPackage(userId: number, id: number, reason?: string) {
        const pkg = await this.prisma.manufacturedPackage.findFirst({
            where: {
                id: Number(id),
                product: { created_by: userId },
            },
        });

        if (!pkg) {
            const existsUnderOtherSeller = await this.prisma.manufacturedPackage.findUnique({
                where: { id: Number(id) },
                select: { id: true, product: { select: { created_by: true } } },
            });

            if (existsUnderOtherSeller) {
                throw new ForbiddenException('Access denied: Package does not belong to the authenticated seller');
            }

            throw new NotFoundException(`Package with ID ${id} not found`);
        }

        // Increment reprint count and create audit log in transaction
        const updatedPkg = await this.prisma.$transaction(async (tx) => {
            await tx.labelReprintLog.create({
                data: {
                    packageId: pkg.id,
                    reason: reason || 'Label reprint requested from Packaging Station',
                    reprintedBy: userId,
                },
            });

            return tx.manufacturedPackage.update({
                where: { id: pkg.id },
                data: {
                    reprintCount: { increment: 1 },
                },
            });
        });

        const safeProduct = (updatedPkg.productName || 'PRODUCT').replace(/\|/g, '\\|');
        const unitLower = (updatedPkg.weightUnit || 'kg').toLowerCase();
        const barcodePayload = (updatedPkg.barcodeData && !updatedPkg.barcodeData.startsWith('{'))
            ? updatedPkg.barcodeData
            : `${safeProduct} | ${Number(updatedPkg.netWeight).toFixed(2)} ${unitLower} | ${updatedPkg.serialNumber}`;

        const labelPdf = await this.labelGeneratorService.generateBatchPdf({
            labelSize: (updatedPkg.labelSize as any) || '150x100',
            items: [
                {
                    companyName: updatedPkg.companyName,
                    productName: updatedPkg.productName,
                    netWeight: Number(updatedPkg.netWeight),
                    serialNumber: updatedPkg.serialNumber,
                    barcodePayload,
                    isProduction: true,
                },
            ],
        });

        const mapped = this.mapToPackageRecord(updatedPkg);

        return {
            success: true,
            package: mapped,
            reprintCount: mapped.reprint_count,
            labelPdfBase64: labelPdf.toString('base64'),
        };
    }

    /**
     * Clean and extract unique package serial number from scanned Code 128 payload
     */
    public extractSerialNumberFromBarcode(barcodePayload: string): string {
        if (!barcodePayload || typeof barcodePayload !== 'string') return '';
        let s = barcodePayload.trim();

        // 1. Pipe-separated format: Product | Weight | Serial
        if (s.includes('|')) {
            const parts = s.split('|').map((part) => part.trim());
            s = parts[parts.length - 1];
        } else if (s.startsWith('{')) {
            try {
                const parsed = JSON.parse(s);
                if (parsed.serial) s = String(parsed.serial).trim();
            } catch {
                // ignore
            }
        }

        // Clean legacy machine suffixes
        if (s.includes('()') || s.includes('—')) {
            s = s.replace(/[-—\s]+\(\)/g, '-M01').replace(/—/g, '-');
        }

        return s;
    }

    /**
     * Read-only package lookup by barcode without modifying stock or dispatch status
     */
    async lookupPackage(userId: number, barcodePayload: string): Promise<PackageRecord> {
        const serial = this.extractSerialNumberFromBarcode(barcodePayload);
        if (!serial) {
            throw new BadRequestException('Invalid or empty barcode payload');
        }

        const pkg = await this.prisma.manufacturedPackage.findFirst({
            where: {
                OR: [
                    { serialNumber: serial },
                    { packageNumber: serial },
                ],
                product: { created_by: userId },
            },
            include: {
                product: {
                    include: { uom: true },
                },
            },
        });

        if (!pkg) {
            const existsForOther = await this.prisma.manufacturedPackage.findFirst({
                where: {
                    OR: [
                        { serialNumber: serial },
                        { packageNumber: serial },
                    ],
                },
                select: { id: true, product: { select: { created_by: true } } },
            });

            if (existsForOther && existsForOther.product.created_by !== userId) {
                throw new ForbiddenException('Access denied: Package belongs to another seller');
            }

            throw new NotFoundException(`No package found matching barcode "${serial}"`);
        }

        return this.mapToPackageRecord(pkg);
    }

    /**
     * Explicit Inventory Out scanning workflow:
     * 1. Extract serial number from single Code 128 barcode payload
     * 2. Retrieve package and enforce authenticated seller ownership
     * 3. Validate package status (prevents duplicate dispatch & duplicate stock deduction)
     * 4. Determine package quantity based on product UOM
     * 5. Atomically update inventoryStatus to INVENTORY_OUT with timestamp
     * 6. Return updated package and movement audit details
     */
    async scanOutPackage(userId: number, barcodePayload: string) {
        const serial = this.extractSerialNumberFromBarcode(barcodePayload);
        if (!serial) {
            throw new BadRequestException('Barcode payload is required for inventory-out scanning');
        }

        // 1. Retrieve package with product and UOM details
        const pkg = await this.prisma.manufacturedPackage.findFirst({
            where: {
                OR: [
                    { serialNumber: serial },
                    { packageNumber: serial },
                ],
            },
            include: {
                product: {
                    include: { uom: true },
                },
            },
        });

        if (!pkg) {
            throw new NotFoundException(`No package found with serial number "${serial}"`);
        }

        // 2. Strict seller isolation
        if (pkg.product.created_by !== userId && pkg.createdBy !== userId) {
            throw new ForbiddenException('Access denied: Package belongs to another seller');
        }

        // 3. Prevent duplicate scan and double stock deduction
        if (pkg.inventoryStatus === 'INVENTORY_OUT') {
            const dispatchTime = pkg.dispatchedAt ? new Date(pkg.dispatchedAt).toLocaleString() : 'previously';
            throw new BadRequestException(
                `Duplicate scan rejected: Package ${pkg.serialNumber} is ALREADY marked as INVENTORY OUT (Dispatched on ${dispatchTime})`
            );
        }

        if (pkg.labelStatus === 'CANCELLED') {
            throw new BadRequestException(`Cannot dispatch package ${pkg.serialNumber}: Package label is marked as CANCELLED`);
        }

        // 4. Determine quantity based on product UOM
        const uomName = (pkg.product?.uom?.unit_name || '').toLowerCase().trim();
        const gstUom = (pkg.product?.uom?.gst_uom || '').toUpperCase().trim();
        const isWeightBased = uomName === 'kg' || uomName === 'kgs' || uomName === 'kilogram' || uomName === 'gm' || uomName === 'grams' || gstUom === 'KGS' || gstUom === 'GMS';
        const quantity = isWeightBased ? Number(pkg.netWeight) : 1;

        // 5. Atomic database transition to INVENTORY_OUT
        const updatedPkg = await this.prisma.manufacturedPackage.update({
            where: { id: pkg.id },
            data: {
                inventoryStatus: 'INVENTORY_OUT',
                dispatchedAt: new Date(),
                dispatchedBy: userId,
            },
            include: {
                product: true,
            },
        });

        const mappedRecord = this.mapToPackageRecord(updatedPkg);

        return {
            success: true,
            message: `Package ${updatedPkg.serialNumber} successfully recorded as INVENTORY OUT`,
            package: mappedRecord,
            inventoryMovement: {
                movementType: 'INVENTORY_OUT',
                packageId: updatedPkg.id,
                serialNumber: updatedPkg.serialNumber,
                productId: updatedPkg.productId,
                productName: updatedPkg.productName,
                productCode: updatedPkg.productCode,
                quantity,
                uom: pkg.product?.uom?.unit_name || pkg.weightUnit || 'PCS',
                netWeight: Number(updatedPkg.netWeight),
                dispatchedAt: updatedPkg.dispatchedAt,
                dispatchedBy: userId,
            },
        };
    }
}
