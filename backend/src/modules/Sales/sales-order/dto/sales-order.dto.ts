import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsDateString, IsEnum, IsInt, IsNotEmpty, IsNumber, IsOptional, IsString, ValidateNested } from 'class-validator';
import { CustomerType } from '@prisma/client';

export enum SOStatus {
    PENDING = 'PENDING',
    PARTIAL_CHALLAN = 'PARTIAL_CHALLAN',
    CHALLAN_COMPLETED = 'CHALLAN_COMPLETED',
    INVOICE_COMPLETED = 'INVOICE_COMPLETED',
    INVOICE_GENERATED = 'INVOICE_GENERATED',
    DELETED = 'DELETED',
}

export class CreateSalesOrderItemDto {
    @ApiProperty()
    @IsString()
    @IsNotEmpty()
    productCode: string;

    @ApiProperty()
    @IsInt()
    @IsOptional()
    productId?: number;

    @ApiProperty()
    @IsString()
    @IsNotEmpty()
    productName: string;

    @ApiProperty()
    @IsString()
    @IsNotEmpty()
    hsnCode: string;

    @ApiProperty()
    @IsNumber()
    @IsNotEmpty()
    quantity: number;

    @ApiProperty()
    @IsNumber()
    @IsNotEmpty()
    rate: number;

    @ApiProperty()
    @IsString()
    @IsNotEmpty()
    uom: string;

    @ApiProperty()
    @IsNumber()
    @IsOptional()
    discount?: number;

    @ApiProperty()
    @IsNumber()
    @IsOptional()
    discountPercent: number;

    @ApiProperty()
    @IsNumber()
    @IsOptional()
    discountAmount: number;

    @ApiProperty()
    @IsNumber()
    @IsNotEmpty()
    taxPercent: number;

    @ApiProperty({ required: false })
    @IsString()
    @IsOptional()
    printDescription?: string;

    @ApiPropertyOptional()
    @IsString()
    @IsOptional()
    description?: string;
}

export class CreateSalesOrderDto {
    @ApiProperty()
    @IsInt()
    @IsNotEmpty()
    customerId: number;

    @ApiProperty({ enum: CustomerType })
    @IsEnum(CustomerType)
    @IsNotEmpty()
    customerType: CustomerType;

    @ApiProperty()
    @IsInt()
    @IsNotEmpty()
    creditDays: number;

    @ApiProperty()
    @IsString()
    @IsOptional()
    address?: string;

    @ApiProperty()
    @IsString()
    @IsOptional()
    gstNo?: string;

    @ApiProperty()
    @IsString()
    @IsOptional()
    panNo?: string;

    @ApiProperty()
    @IsString()
    @IsOptional()
    soNumber?: string;

    @ApiProperty()
    @IsDateString()
    @IsOptional()
    soCreationDate?: string;

    @ApiProperty()
    @IsDateString()
    @IsNotEmpty()
    expiryDate: string;

    @ApiPropertyOptional()
    @IsString()
    @IsOptional()
    customerPoNumber?: string;

    @ApiPropertyOptional()
    @IsString()
    @IsOptional()
    customerPoFile?: string;

    @ApiPropertyOptional()
    @IsNumber()
    @IsOptional()
    customerAmt?: number;

    @ApiPropertyOptional()
    @IsNumber()
    @IsOptional()
    customerAmtExclTax?: number;

    @ApiPropertyOptional()
    @IsNumber()
    @IsOptional()
    customerAmtInclTax?: number;

    @ApiPropertyOptional()
    @IsDateString()
    @IsOptional()
    poDate?: string;

    @ApiPropertyOptional()
    @IsDateString()
    @IsOptional()
    poExpiryDate?: string;

    @ApiProperty({ type: [CreateSalesOrderItemDto] })
    @ValidateNested({ each: true })
    @Type(() => CreateSalesOrderItemDto)
    items: CreateSalesOrderItemDto[];
}

export class UpdateSalesOrderDto {
    @ApiProperty({ required: false })
    @IsOptional()
    @IsInt()
    customerId?: number;

    @ApiProperty({ enum: CustomerType, required: false })
    @IsOptional()
    @IsEnum(CustomerType)
    customerType?: CustomerType;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsInt()
    creditDays?: number;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsString()
    address?: string;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsString()
    gstNo?: string;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsString()
    panNo?: string;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsString()
    soNumber?: string;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsDateString()
    soCreationDate?: string;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsDateString()
    expiryDate?: string;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsString()
    customerPoNumber?: string;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsString()
    customerPoFile?: string;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsNumber()
    customerAmt?: number;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsNumber()
    customerAmtExclTax?: number;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsNumber()
    customerAmtInclTax?: number;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsDateString()
    poDate?: string;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsDateString()
    poExpiryDate?: string;

    @ApiProperty({ enum: SOStatus, required: false })
    @IsOptional()
    @IsEnum(SOStatus)
    status?: SOStatus;

    @ApiProperty({ type: [CreateSalesOrderItemDto], required: false })
    @IsOptional()
    @ValidateNested({ each: true })
    @Type(() => CreateSalesOrderItemDto)
    items?: CreateSalesOrderItemDto[];
}
