import { IsString, IsNotEmpty, IsEnum, IsNumber, IsArray, ValidateNested, IsOptional, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { PaymentMode } from '@prisma/client';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class VoucherItemDto {
  @ApiProperty()
  @IsNumber()
  @IsNotEmpty()
  accountId: number;

  @ApiProperty()
  @IsNumber()
  @Min(0.01)
  @IsNotEmpty()
  amount: number;
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
}
