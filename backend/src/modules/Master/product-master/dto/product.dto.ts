import { IsString, IsNotEmpty, IsNumber, IsEnum, IsOptional } from 'class-validator';
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
    @IsNumber()
    @IsNotEmpty()
    category_id: number;

    @ApiProperty({ required: false })
    @IsNumber()
    @IsOptional()
    sub_category_id?: number;

    @ApiProperty({ required: false })
    @IsNumber()
    @IsOptional()
    sub_sub_category_id?: number;

    @ApiProperty()
    @IsString()
    @IsNotEmpty()
    hsn_code: string;

    @ApiProperty()
    @IsNumber()
    @IsNotEmpty()
    tax_rate: number;

    @ApiProperty()
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
    @IsNumber()
    @IsOptional()
    category_id?: number;

    @ApiProperty()
    @IsNumber()
    @IsOptional()
    sub_category_id?: number;

    @ApiProperty({ required: false })
    @IsNumber()
    @IsOptional()
    sub_sub_category_id?: number;

    @ApiProperty()
    @IsString()
    @IsOptional()
    hsn_code?: string;

    @ApiProperty()
    @IsNumber()
    @IsOptional()
    tax_rate?: number;

    @ApiProperty()
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
