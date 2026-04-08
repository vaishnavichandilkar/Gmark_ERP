import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsString, IsNumber, IsNotEmpty, IsOptional, IsArray, ValidateNested, IsDateString } from 'class-validator';

export class CreateGrnItemDto {
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
}

export class CreateGrnDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  supplierName: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  address?: string;

  @ApiPropertyOptional()
  @IsNumber()
  @IsOptional()
  creditDays?: number;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  bookingDate?: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  challanNumber: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  poNumber?: string;

  @ApiPropertyOptional()
  @IsNumber()
  @IsOptional()
  poId?: number;

  @ApiProperty({ type: [CreateGrnItemDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateGrnItemDto)
  items: CreateGrnItemDto[];
}

export class UpdateGrnDto {
  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  supplierName?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  address?: string;

  @ApiPropertyOptional()
  @IsNumber()
  @IsOptional()
  creditDays?: number;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  bookingDate?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  challanNumber?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  poNumber?: string;

  @ApiPropertyOptional()
  @IsNumber()
  @IsOptional()
  poId?: number;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  status?: string;

  @ApiPropertyOptional({ type: [CreateGrnItemDto] })
  @IsArray()
  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => CreateGrnItemDto)
  items?: CreateGrnItemDto[];
}
