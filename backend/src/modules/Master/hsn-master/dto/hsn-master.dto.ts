import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsOptional, IsEnum, Matches, Length, IsIn, IsBoolean } from 'class-validator';
import { HsnMasterType } from '@prisma/client';
import { Type } from 'class-transformer';

export class CreateHsnMasterDto {
    @ApiProperty({ enum: HsnMasterType, example: HsnMasterType.HSN })
    @IsEnum(HsnMasterType, { message: 'Type is required.' })
    @IsNotEmpty({ message: 'Type is required.' })
    type: HsnMasterType;

    @ApiProperty({ example: '123456' })
    @IsNotEmpty({ message: 'HSN/SAC Code is required.' })
    @IsString({ message: 'HSN/SAC Code is required.' })
    @Matches(/^\d+$/, { message: 'Code must contain only numeric values.' })
    @Length(6, 8, { message: 'Code must be between 6 and 8 digits.' })
    code: string;

    @ApiProperty({ example: 18 })
    @IsNotEmpty({ message: 'Tax Rate is required.' })
    @Type(() => Number)
    @IsIn([0, 5, 12, 18, 28], { message: 'Tax Rate must be one of: 0%, 5%, 12%, 18%, 28%' })
    taxRate: number;

    @ApiProperty({ example: 'Goods taxation rate 18 percent', required: true })
    @IsNotEmpty({ message: 'Description is required.' })
    @IsString({ message: 'Description must be a string.' })
    description: string;

    @ApiProperty({ example: true, required: false })
    @IsOptional()
    @IsBoolean()
    isActive?: boolean;
}

export class UpdateHsnMasterDto {
    @ApiProperty({ enum: HsnMasterType, example: HsnMasterType.HSN, required: false })
    @IsOptional()
    @IsEnum(HsnMasterType, { message: 'Type must be HSN or SAC.' })
    type?: HsnMasterType;

    @ApiProperty({ example: '123456', required: false })
    @IsOptional()
    @IsString()
    @Matches(/^\d+$/, { message: 'Code must contain only numeric values.' })
    @Length(6, 8, { message: 'Code must be between 6 and 8 digits.' })
    code?: string;

    @ApiProperty({ example: 18, required: false })
    @IsOptional()
    @Type(() => Number)
    @IsIn([0, 5, 12, 18, 28], { message: 'Tax Rate must be one of: 0%, 5%, 12%, 18%, 28%' })
    taxRate?: number;

    @ApiProperty({ example: 'Goods taxation rate 18 percent', required: false })
    @IsOptional()
    @IsString({ message: 'Description must be a string.' })
    @IsNotEmpty({ message: 'Description cannot be empty.' })
    description?: string;

    @ApiProperty({ example: true, required: false })
    @IsOptional()
    @IsBoolean()
    isActive?: boolean;
}

export class HsnQueryDto {
    @ApiProperty({ required: false })
    @IsOptional()
    @IsString()
    search?: string;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsString()
    format?: string;

    @ApiProperty({ enum: HsnMasterType, required: false })
    @IsOptional()
    @IsEnum(HsnMasterType)
    type?: HsnMasterType;

    @ApiProperty({ required: false })
    @IsOptional()
    @Type(() => Number)
    @IsIn([0, 5, 12, 18, 28])
    taxRate?: number;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsString()
    isActive?: string; // Checked as string in query query params e.g. 'true' or 'false'

    @ApiProperty({ required: false, default: '1' })
    @IsOptional()
    @IsString()
    page?: string;

    @ApiProperty({ required: false, default: '15' })
    @IsOptional()
    @IsString()
    limit?: string;

    @ApiProperty({ required: false, default: 'createdAt' })
    @IsOptional()
    @IsString()
    sortBy?: string;

    @ApiProperty({ required: false, enum: ['asc', 'desc'], default: 'desc' })
    @IsOptional()
    @IsEnum(['asc', 'desc'])
    sortOrder?: 'asc' | 'desc';
}
