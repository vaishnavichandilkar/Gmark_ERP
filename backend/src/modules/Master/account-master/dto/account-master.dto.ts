import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsNumber,
  IsBoolean,
  IsEmail,
  Matches,
  IsEnum,
  ValidateIf,
  IsArray,
  ValidateNested,
  ArrayMinSize,
  ArrayUnique,
  IsUrl,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { Type, Transform } from 'class-transformer';
import { ContactPrefix, MasterStatus, BalanceType, RegUnder, RegType, CustomerType } from '@prisma/client';

export enum GroupNameEnum {
  SUNDRY_CREDITORS = 'SUNDRY_CREDITORS',
  SUNDRY_DEBTORS = 'SUNDRY_DEBTORS',
  BANK = 'BANK',
  CASH = 'CASH',
}


export class CreateAccountMasterDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  accountName: string;

  @ApiProperty({ type: [String], enum: GroupNameEnum })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayUnique()
  @IsEnum(GroupNameEnum, { each: true })
  @IsNotEmpty()
  groupName: GroupNameEnum[];

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  @Matches(/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/, { message: 'Invalid GST format' })
  gstNo?: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @Transform(({ value }) => typeof value === 'string' ? value.trim().toUpperCase() : value)
  @Matches(/^[A-Z]{3}[PCHFATBLJG][A-Z]{1}[0-9]{4}[A-Z]{1}$/, { message: 'Invalid PAN format. Must be a valid 10-character PAN (e.g., ABCPE1234F) where the 4th character is one of: P, C, H, F, A, T, B, L, J, G' })
  panNo: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  addressLine1: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  addressLine2?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  @Matches(/^\d{6}$/, { message: 'Pincode must be exactly 6 digits' })
  pincode?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  area?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  subDistrict?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  district?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  state?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  country?: string;

  // Contact Persons
  @ApiProperty({ enum: ContactPrefix })
  @IsEnum(ContactPrefix)
  @IsNotEmpty()
  prefix: ContactPrefix;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  contactPersonName: string;

  @ApiPropertyOptional()
  @IsEmail()
  @IsOptional()
  emailId?: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @Matches(/^\d{10}$/, { message: 'Mobile number must be exactly 10 digits' })
  mobileNo: string;

  @ApiPropertyOptional()
  @ValidateIf(o => o.groupName?.includes(GroupNameEnum.SUNDRY_CREDITORS))
  @IsString()
  @IsNotEmpty({ message: 'Supplier Code is required when Sundry Creditors is selected.' })
  supplierCode?: string;

  @ApiPropertyOptional()
  @ValidateIf(o => o.groupName?.includes(GroupNameEnum.SUNDRY_DEBTORS))
  @IsString()
  @IsNotEmpty({ message: 'Customer Code is required when Sundry Debtors is selected.' })
  customerCode?: string;

  // Supplier Details
  @ApiPropertyOptional()
  @ValidateIf(o => o.groupName?.includes(GroupNameEnum.SUNDRY_CREDITORS))
  @Type(() => Number)
  @IsNumber()
  @IsNotEmpty({ message: 'Supplier credit days is required' })
  supplierCreditDays?: number;

  @ApiPropertyOptional()
  @ValidateIf(o => o.groupName?.includes(GroupNameEnum.SUNDRY_CREDITORS))
  @Type(() => Number)
  @IsNumber()
  @IsNotEmpty({ message: 'Supplier opening balance is required' })
  supplierOpeningBalance?: number;

  @ApiPropertyOptional({ enum: BalanceType })
  @ValidateIf(o => o.groupName?.includes(GroupNameEnum.SUNDRY_CREDITORS))
  @IsEnum(BalanceType)
  @IsNotEmpty({ message: 'Supplier balance type is required' })
  supplierBalanceType?: BalanceType;

  // Customer Details
  @ApiPropertyOptional()
  @ValidateIf(o => o.groupName?.includes(GroupNameEnum.SUNDRY_DEBTORS))
  @Type(() => Number)
  @IsNumber()
  @IsNotEmpty({ message: 'Customer credit days is required' })
  customerCreditDays?: number;

  @ApiPropertyOptional()
  @ValidateIf(o => o.groupName?.includes(GroupNameEnum.SUNDRY_DEBTORS))
  @Type(() => Number)
  @IsNumber()
  @IsNotEmpty({ message: 'Customer opening balance is required' })
  customerOpeningBalance?: number;

  @ApiPropertyOptional({ enum: BalanceType })
  @ValidateIf(o => o.groupName?.includes(GroupNameEnum.SUNDRY_DEBTORS))
  @IsEnum(BalanceType)
  @IsNotEmpty({ message: 'Customer balance type is required' })
  customerBalanceType?: BalanceType;

  // MSME Details
  @ApiPropertyOptional({ enum: CustomerType })
  @ValidateIf(o => o.groupName?.includes(GroupNameEnum.SUNDRY_DEBTORS))
  @IsEnum(CustomerType)
  @IsNotEmpty({ message: 'Customer type is required' })
  customerType?: CustomerType;

  @ApiPropertyOptional()
  @IsBoolean()
  @IsOptional()
  msmeEnabled?: boolean;

  @ApiPropertyOptional()
  @ValidateIf(o => o.msmeEnabled === true)
  @IsString()
  @IsNotEmpty()
  @Matches(/^UDYAM-[A-Z]{2}-\d{2}-\d{7}$/, { message: 'MSME ID must follow the pattern UDYAM-XX-12-1234567' })
  msmeId?: string;

  @ApiPropertyOptional({ enum: RegUnder })
  @ValidateIf(o => o.msmeEnabled === true)
  @IsEnum(RegUnder)
  @IsNotEmpty()
  regUnder?: RegUnder;

  @ApiPropertyOptional({ enum: RegType })
  @ValidateIf(o => o.msmeEnabled === true)
  @IsEnum(RegType)
  @IsNotEmpty()
  regType?: RegType;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  msmeCertificateUrl?: string;

  @ApiPropertyOptional()
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  otherDocuments?: string[];

  @ApiPropertyOptional()
  @IsOptional()
  otherDocumentNames?: string | string[];

  @ApiPropertyOptional({ enum: MasterStatus })
  @IsEnum(MasterStatus)
  @IsOptional()
  status?: MasterStatus;
}

export class UpdateAccountMasterDto extends PartialType(CreateAccountMasterDto) {}

export class UpdateAccountStatusDto {
  @ApiProperty({ enum: MasterStatus })
  @IsEnum(MasterStatus)
  @IsNotEmpty()
  status: MasterStatus;

  @ApiPropertyOptional({ enum: MasterStatus })
  @IsEnum(MasterStatus)
  @IsOptional()
  customerStatus?: MasterStatus;

  @ApiPropertyOptional({ enum: MasterStatus })
  @IsEnum(MasterStatus)
  @IsOptional()
  supplierStatus?: MasterStatus;
}
