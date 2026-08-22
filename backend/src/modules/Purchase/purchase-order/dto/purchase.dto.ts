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

export class CreatePurchaseItemDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  productCode: string;

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
  quantity: number;

  @ApiProperty()
  @IsNumber()
  rate: number;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  uom: string;

  @ApiProperty()
  @IsNumber()
  discountPercent: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsNumber()
  taxPercent: number = 0;
}

export class CreatePurchaseDto {
  @ApiProperty()
  @IsInt()
  @IsNotEmpty()
  supplierId: number;

  @ApiProperty()
  @IsInt()
  @IsNotEmpty()
  creditDays: number;

  @ApiProperty()
  @IsDateString()
  @IsNotEmpty()
  expiryDate: string;

  @ApiProperty({ type: [CreatePurchaseItemDto] })
  @ValidateNested({ each: true })
  @Type(() => CreatePurchaseItemDto)
  items: CreatePurchaseItemDto[];
}

export class UpdatePurchaseDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsInt()
  creditDays?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsDateString()
  expiryDate?: string;

  @ApiProperty({ enum: POStatus, required: false })
  @IsOptional()
  @IsEnum(POStatus)
  status?: POStatus;

  @ApiProperty({ type: [CreatePurchaseItemDto], required: false })
  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => CreatePurchaseItemDto)
  items?: CreatePurchaseItemDto[];
}
