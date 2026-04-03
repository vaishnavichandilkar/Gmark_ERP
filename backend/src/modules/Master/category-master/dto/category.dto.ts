import { IsString, IsNotEmpty, IsInt, IsOptional, IsEnum } from 'class-validator';
import { MasterStatus } from '@prisma/client';

export class CreateCategoryDto {
    @IsString()
    @IsNotEmpty()
    name: string;

    @IsEnum(MasterStatus)
    @IsOptional()
    status?: MasterStatus;
}

export class CreateSubCategoryDto {
    @IsString()
    @IsNotEmpty()
    name: string;

    @IsInt()
    @IsNotEmpty()
    category_id: number;

    @IsEnum(MasterStatus)
    @IsOptional()
    status?: MasterStatus;
}

export class ToggleStatusDto {
    @IsEnum(MasterStatus)
    @IsNotEmpty()
    status: MasterStatus;
}

export class UpdateCategoryDto {
    @IsString()
    @IsNotEmpty()
    name: string;
}

export class UpdateSubCategoryDto {
    @IsString()
    @IsNotEmpty()
    name: string;

    @IsInt()
    @IsOptional()
    category_id?: number;
}

export class CreateSubSubCategoryDto {
    @IsString()
    @IsNotEmpty()
    name: string;

    @IsInt()
    @IsNotEmpty()
    sub_category_id: number;

    @IsEnum(MasterStatus)
    @IsOptional()
    status?: MasterStatus;
}

export class UpdateSubSubCategoryDto {
    @IsString()
    @IsNotEmpty()
    name: string;

    @IsInt()
    @IsOptional()
    sub_category_id?: number;
}
