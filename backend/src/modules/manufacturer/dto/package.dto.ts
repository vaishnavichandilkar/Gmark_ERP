import { IsNotEmpty, IsNumber, IsOptional, IsString, Min, Max, Matches } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreatePackageDto {
    @ApiProperty({ description: 'ID of the product being packaged' })
    @IsNotEmpty()
    @IsNumber()
    productId: number;

    @ApiProperty({ description: 'Net weight captured from weighing scale or manual entry' })
    @IsNotEmpty()
    @IsNumber()
    @Min(0.001)
    @Max(100000)
    netWeight: number;

    @ApiPropertyOptional({ description: 'Gross weight from scale platform' })
    @IsOptional()
    @IsNumber()
    grossWeight?: number;

    @ApiPropertyOptional({ description: 'Tare container weight' })
    @IsOptional()
    @IsNumber()
    tareWeight?: number;

    @ApiPropertyOptional({ description: 'Measurement unit', default: 'kg' })
    @IsOptional()
    @IsString()
    weightUnit?: string;

    @ApiPropertyOptional({
        description: 'Source of the weight reading',
        enum: ['HARDWARE_SCALE', 'SCALE_SIMULATOR', 'MANUAL_ENTRY'],
        default: 'HARDWARE_SCALE',
    })
    @IsOptional()
    @IsString()
    weightSource?: string;

    @ApiPropertyOptional({ description: 'Plant code (2 chars)', default: 'AB' })
    @IsOptional()
    @IsString()
    plantCode?: string;

    @ApiPropertyOptional({ description: 'Station or Machine ID', default: 'M01' })
    @IsOptional()
    @IsString()
    machineId?: string;

    @ApiPropertyOptional({ description: 'Thermal label size', enum: ['100x50', '75x50'], default: '100x50' })
    @IsOptional()
    @IsString()
    labelSize?: string;

    @ApiPropertyOptional({ description: 'Raw serial stream payload for audit trail' })
    @IsOptional()
    @IsString()
    rawPayload?: string;
}

export class PackageQueryDto {
    @ApiPropertyOptional({ description: 'Page number', default: 1 })
    @IsOptional()
    page?: number;

    @ApiPropertyOptional({ description: 'Items per page', default: 10 })
    @IsOptional()
    limit?: number;

    @ApiPropertyOptional({ description: 'Search term across serial, product, code' })
    @IsOptional()
    @IsString()
    search?: string;

    @ApiPropertyOptional({ description: 'Filter by Product ID' })
    @IsOptional()
    productId?: number;

    @ApiPropertyOptional({ description: 'Filter from creation date (ISO or YYYY-MM-DD)' })
    @IsOptional()
    @IsString()
    dateFrom?: string;

    @ApiPropertyOptional({ description: 'Filter to creation date (ISO or YYYY-MM-DD)' })
    @IsOptional()
    @IsString()
    dateTo?: string;

    @ApiPropertyOptional({ description: 'Filter by status (CREATED, PRINTED, CANCELLED)' })
    @IsOptional()
    @IsString()
    status?: string;
}

export class WeighmentTransactionDto {
    @ApiPropertyOptional({ description: 'ID of the weighing device' })
    @IsOptional()
    @IsString()
    deviceId?: string;

    @ApiProperty({ description: 'Product ID' })
    @IsNotEmpty()
    @IsNumber()
    productId: number;

    @ApiProperty({ description: 'Gross weight' })
    @IsNotEmpty()
    @IsNumber()
    grossWeight: number;

    @ApiProperty({ description: 'Tare weight' })
    @IsNotEmpty()
    @IsNumber()
    tareWeight: number;

    @ApiProperty({ description: 'Net weight' })
    @IsNotEmpty()
    @IsNumber()
    netWeight: number;

    @ApiProperty({ description: 'Unit' })
    @IsNotEmpty()
    @IsString()
    unit: string;

    @ApiProperty({ description: 'Whether reading was stable at capture' })
    @IsNotEmpty()
    isStable: boolean;

    @ApiPropertyOptional({ description: 'Calculation method' })
    @IsOptional()
    @IsString()
    calculationMethod?: string;

    @ApiPropertyOptional({ description: 'Raw ASCII scale stream data' })
    @IsOptional()
    @IsString()
    rawPayload?: string;
}
