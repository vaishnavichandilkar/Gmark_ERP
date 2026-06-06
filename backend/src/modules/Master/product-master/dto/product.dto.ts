import { IsString, IsNotEmpty, IsNumber, IsEnum, IsOptional, IsUUID } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { ProductType, MasterStatus } from '@prisma/client';

export class CreateProductDto {
    @ApiProperty()
    @IsString()
    @IsNotEmpty()
    product_name: string;

    @ApiProperty()
    @IsNumber()
    @IsNotEmpty()
    uom_id: number;

    @ApiProperty()
    @IsEnum(ProductType)
    @IsNotEmpty()
    product_type: ProductType;

    @ApiProperty()
    @IsUUID('4')
    @IsNotEmpty()
    category_id: string;

    @ApiProperty()
    @IsUUID('4', { message: 'Please select a valid HSN/SAC Code.' })
    @IsNotEmpty({ message: 'HSN/SAC Code is required.' })
    hsnMasterId: string;

    @ApiProperty({ required: false })
    @IsString()
    @IsOptional()
    hsn_code?: string;

    @ApiProperty({ required: false })
    @IsNumber()
    @IsOptional()
    tax_rate?: number;

    @ApiProperty({ required: false })
    @IsString()
    @IsOptional()
    hsn_description?: string;

    @ApiProperty()
    @IsString()
    @IsOptional()
    description?: string;
}

export class UpdateProductDto {
    @ApiProperty()
    @IsString()
    @IsOptional()
    product_name?: string;

    @ApiProperty()
    @IsNumber()
    @IsOptional()
    uom_id?: number;

    @ApiProperty()
    @IsEnum(ProductType)
    @IsOptional()
    product_type?: ProductType;

    @ApiProperty()
    @IsUUID('4')
    @IsOptional()
    category_id?: string;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsUUID('4', { message: 'Please select a valid HSN/SAC Code.' })
    hsnMasterId?: string;

    @ApiProperty({ required: false })
    @IsString()
    @IsOptional()
    hsn_code?: string;

    @ApiProperty({ required: false })
    @IsNumber()
    @IsOptional()
    tax_rate?: number;

    @ApiProperty({ required: false })
    @IsString()
    @IsOptional()
    hsn_description?: string;

    @ApiProperty()
    @IsString()
    @IsOptional()
    description?: string;
}

export class ToggleProductStatusDto {
    @ApiProperty({ enum: MasterStatus })
    @IsEnum(MasterStatus)
    @IsNotEmpty()
    status: MasterStatus;
}
