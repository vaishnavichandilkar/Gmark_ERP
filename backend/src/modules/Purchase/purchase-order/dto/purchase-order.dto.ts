import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsDateString, IsEnum, IsInt, IsNotEmpty, IsNumber, IsOptional, IsString, ValidateNested } from 'class-validator';

export enum POStatus {
  PENDING = 'PENDING',
  PARTIAL_GRN = 'PARTIAL_GRN',
  GRN_COMPLETED = 'GRN_COMPLETED',
  INVOICE_COMPLETED = 'INVOICE_COMPLETED',
  INVOICE_GENERATED = 'INVOICE_GENERATED',
  DELETED = 'DELETED',
}

export class CreatePurchaseOrderItemDto {
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

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  description?: string;
}

export class CreatePurchaseOrderDto {
  @ApiProperty()
  @IsInt()
  @IsNotEmpty()
  supplierId: number;

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
  poNumber?: string;

  @ApiProperty()
  @IsDateString()
  @IsOptional()
  poCreationDate?: string;

  @ApiProperty()
  @IsDateString()
  @IsNotEmpty()
  expiryDate: string;

  @ApiProperty({ type: [CreatePurchaseOrderItemDto] })
  @ValidateNested({ each: true })
  @Type(() => CreatePurchaseOrderItemDto)
  items: CreatePurchaseOrderItemDto[];
}

export class UpdatePurchaseOrderDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsInt()
  supplierId?: number;

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
  poNumber?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsDateString()
  poCreationDate?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsDateString()
  expiryDate?: string;

  @ApiProperty({ enum: POStatus, required: false })
  @IsOptional()
  @IsEnum(POStatus)
  status?: POStatus;

  @ApiProperty({ type: [CreatePurchaseOrderItemDto], required: false })
  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => CreatePurchaseOrderItemDto)
  items?: CreatePurchaseOrderItemDto[];
}
