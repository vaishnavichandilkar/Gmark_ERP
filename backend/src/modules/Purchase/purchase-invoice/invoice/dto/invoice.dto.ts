import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsDateString, IsEnum, IsInt, IsNotEmpty, IsNumber, IsOptional, IsString, Min, ValidateNested, IsArray } from 'class-validator';

export enum PIStatus {
  GENERATED = 'GENERATED',
  DELETED = 'DELETED',
}

export class ItemDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  productId: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  productCode: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  productName: string;

  @ApiProperty()
  @IsNumber()
  @Min(0)
  quantity: number;

  @ApiProperty()
  @IsNumber()
  @Min(0)
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
  @IsString()
  @IsOptional()
  hsnCode?: string;

  @ApiProperty()
  @IsNumber()
  @IsOptional()
  taxPercent?: number;

  @ApiProperty()
  @IsNumber()
  @IsOptional()
  baseAmount?: number;

  @ApiProperty()
  @IsNumber()
  @IsOptional()
  taxAmount?: number;

  @ApiProperty()
  @IsNumber()
  @IsOptional()
  totalAmount?: number;

  @ApiProperty()
  @IsNumber()
  @IsOptional()
  beforeTaxAmount?: number;
}

export class AccountSummaryDto {
  @ApiProperty()
  @IsNumber()
  materialPurchase: number;

  @ApiProperty()
  @IsNumber()
  cgst: number;

  @ApiProperty()
  @IsNumber()
  sgst: number;

  @ApiProperty()
  @IsNumber()
  igst: number;

  @ApiProperty()
  @IsNumber()
  grandTotal: number;
}

export class CreatePurchaseInvoiceDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  supplierId: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  supplierName?: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  address: string;

  @ApiProperty()
  @IsNumber()
  creditDays: number;

  @ApiProperty()
  @IsString()
  @IsOptional()
  gstNumber?: string;

  @ApiProperty({ type: [String] })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  poIds?: string[];

  @ApiProperty({ type: [String] })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  challanNumbers?: string[];

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  bookingDate: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  invoiceDate: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  invoiceNumber: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsNumber()
  grandTotal?: number;

  @ApiProperty({ type: [ItemDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ItemDto)
  items: ItemDto[];

  @ApiProperty({ type: AccountSummaryDto })
  @ValidateNested()
  @Type(() => AccountSummaryDto)
  accountSummary: AccountSummaryDto;

  @ApiProperty({ type: [ItemDto], required: false })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ItemDto)
  products?: ItemDto[];
}

export class UpdatePurchaseInvoiceDto {
  @ApiProperty({ enum: PIStatus, required: false })
  @IsOptional()
  @IsEnum(PIStatus)
  status?: PIStatus;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  supplierId?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  supplierName?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  address?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsNumber()
  creditDays?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  gstNumber?: string;

  @ApiProperty({ type: [String], required: false })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  poIds?: string[];

  @ApiProperty({ type: [String], required: false })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  challanNumbers?: string[];

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  bookingDate?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  invoiceDate?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  invoiceNumber?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsNumber()
  grandTotal?: number;

  @ApiProperty({ type: [ItemDto], required: false })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ItemDto)
  items?: ItemDto[];

  @ApiProperty({ type: AccountSummaryDto, required: false })
  @IsOptional()
  @ValidateNested()
  @Type(() => AccountSummaryDto)
  accountSummary?: AccountSummaryDto;

  @ApiProperty({ type: [ItemDto], required: false })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ItemDto)
  products?: ItemDto[];
}
