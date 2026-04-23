import { Type } from 'class-transformer';
import { IsDateString, IsEnum, IsInt, IsNotEmpty, IsNumber, IsOptional, IsString, Min, ValidateNested, IsArray, IsBoolean } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export enum SalesInvoiceStatus {
  GENERATED = 'GENERATED',
  DELETED = 'DELETED',
}

export class SalesInvoiceItemDto {
  @ApiProperty()
  @IsNumber()
  @IsNotEmpty()
  productId: number;

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

  @ApiPropertyOptional()
  @IsNumber()
  @IsOptional()
  discountPercent?: number;

  @ApiPropertyOptional()
  @IsNumber()
  @IsOptional()
  discountAmount?: number;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  hsnCode?: string;

  @ApiPropertyOptional()
  @IsNumber()
  @IsOptional()
  taxPercent?: number;

  @ApiPropertyOptional()
  @IsNumber()
  @IsOptional()
  taxAmount?: number;

  @ApiPropertyOptional()
  @IsNumber()
  @IsOptional()
  totalAmount?: number;

  @ApiPropertyOptional()
  @IsNumber()
  @IsOptional()
  beforeTaxAmount?: number;

  @ApiPropertyOptional()
  @IsNumber()
  @IsOptional()
  totalSoQty?: number;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  printDescription?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  description?: string;
}

export class SalesInvoiceAccountSummaryDto {
  @ApiProperty()
  @IsNumber()
  materialTotal: number;

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

export class SalesInvoiceExpenseDto {
  @ApiProperty()
  @IsString()
  groupName: string;

  @ApiProperty()
  @IsNumber()
  amount: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  taxRate?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  taxAmount?: number;

  @ApiPropertyOptional()
  @IsOptional()
  isGstApplicable?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isPostGst?: boolean;
}

export class CreateSalesInvoiceDto {
  @ApiProperty()
  @IsNumber()
  @IsNotEmpty()
  customerId: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  customerName?: string;

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
  soNumbers?: string[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  soId?: number;

  @ApiProperty({ type: [String] })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  challanNumbers?: string[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  bookingDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  invoiceDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  invoiceNumber?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  customerInvoiceNumber?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  customerInvoiceDate?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsNumber()
  grandTotal?: number;

  @ApiProperty({ type: [SalesInvoiceItemDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SalesInvoiceItemDto)
  items: SalesInvoiceItemDto[];

  @ApiPropertyOptional({ type: SalesInvoiceAccountSummaryDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => SalesInvoiceAccountSummaryDto)
  accountSummary?: SalesInvoiceAccountSummaryDto;

  @ApiPropertyOptional({ type: [SalesInvoiceExpenseDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SalesInvoiceExpenseDto)
  expenses?: SalesInvoiceExpenseDto[];
}

export class UpdateSalesInvoiceDto {
  @ApiProperty({ enum: SalesInvoiceStatus, required: false })
  @IsOptional()
  @IsEnum(SalesInvoiceStatus)
  status?: SalesInvoiceStatus;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsNumber()
  customerId?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  customerName?: string;

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
  soNumbers?: string[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  soId?: number;

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

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  customerInvoiceNumber?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  customerInvoiceDate?: string;

  @ApiPropertyOptional({ type: [SalesInvoiceItemDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SalesInvoiceItemDto)
  items?: SalesInvoiceItemDto[];

  @ApiPropertyOptional({ type: SalesInvoiceAccountSummaryDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => SalesInvoiceAccountSummaryDto)
  accountSummary?: SalesInvoiceAccountSummaryDto;

  @ApiPropertyOptional({ type: [SalesInvoiceExpenseDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SalesInvoiceExpenseDto)
  expenses?: SalesInvoiceExpenseDto[];
}
