import { IsString, IsNotEmpty, IsEnum, IsNumber, IsArray, ValidateNested, IsOptional, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { PaymentMode } from '@prisma/client';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class VoucherItemSettlementDto {
  @ApiPropertyOptional()
  @IsNumber()
  @IsOptional()
  invoiceId?: number;

  @ApiPropertyOptional()
  @IsNumber()
  @IsOptional()
  voucherId?: number;

  @ApiPropertyOptional()
  @IsNumber()
  @IsOptional()
  settlementId?: number;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  settlementType: string; // 'ADVANCE', 'AGAINST_REFERENCE', 'ON_ACCOUNT', 'ABSORB_VOUCHER'

  @ApiProperty()
  @IsNumber()
  @IsNotEmpty()
  settledAmount: number;
}

export class VoucherItemDto {
  @ApiProperty()
  @IsNumber()
  @IsNotEmpty()
  accountId: number;

  @ApiProperty()
  @IsNumber()
  @Min(0)
  @IsNotEmpty()
  amount: number;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  accountType?: string;

  @ApiPropertyOptional({ type: [VoucherItemSettlementDto] })
  @IsArray()
  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => VoucherItemSettlementDto)
  settlements?: VoucherItemSettlementDto[];
}

export class CreateVoucherDto {
  @ApiProperty({ example: '2026-05-15' })
  @IsString()
  @IsNotEmpty()
  voucherDate: string;

  @ApiProperty()
  @IsNumber()
  @IsNotEmpty()
  bankCashLedgerId: number;

  @ApiProperty({ enum: PaymentMode })
  @IsEnum(PaymentMode)
  @IsNotEmpty()
  paymentMode: PaymentMode;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  narration?: string;

  @ApiProperty({ type: [VoucherItemDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => VoucherItemDto)
  @IsNotEmpty()
  items: VoucherItemDto[];

  @ApiPropertyOptional({ type: [VoucherItemSettlementDto] })
  @IsArray()
  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => VoucherItemSettlementDto)
  settlements?: VoucherItemSettlementDto[];
}

