import { IsString, IsNotEmpty, IsOptional, IsEnum, IsUUID } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { MasterStatus } from '@prisma/client';

export class CreateCategoryDto {
    @ApiProperty()
    @IsString()
    @IsNotEmpty()
    name: string;

    @ApiProperty({ required: false })
    @IsUUID('4')
    @IsOptional()
    parent_id?: string;

    @ApiProperty({ enum: MasterStatus, required: false })
    @IsEnum(MasterStatus)
    @IsOptional()
    status?: MasterStatus;
}

export class CreateSubCategoryDto {
    @ApiProperty()
    @IsString()
    @IsNotEmpty()
    name: string;

    @ApiProperty()
    @IsUUID('4')
    @IsNotEmpty()
    category_id: string;

    @ApiProperty({ enum: MasterStatus, required: false })
    @IsEnum(MasterStatus)
    @IsOptional()
    status?: MasterStatus;
}

export class CreateSubSubCategoryDto {
    @ApiProperty()
    @IsString()
    @IsNotEmpty()
    name: string;

    @ApiProperty()
    @IsUUID('4')
    @IsNotEmpty()
    sub_category_id: string;

    @ApiProperty({ enum: MasterStatus, required: false })
    @IsEnum(MasterStatus)
    @IsOptional()
    status?: MasterStatus;
}

export class UpdateCategoryDto {
    @ApiProperty()
    @IsString()
    @IsNotEmpty()
    name: string;
}

export class UpdateSubCategoryDto {
    @ApiProperty()
    @IsString()
    @IsNotEmpty()
    name: string;

    @ApiProperty({ required: false })
    @IsUUID('4')
    @IsOptional()
    category_id?: string;
}

export class UpdateSubSubCategoryDto {
    @ApiProperty()
    @IsString()
    @IsNotEmpty()
    name: string;

    @ApiProperty({ required: false })
    @IsUUID('4')
    @IsOptional()
    sub_category_id?: string;
}

export class ToggleStatusDto {
    @ApiProperty({ enum: MasterStatus })
    @IsEnum(MasterStatus)
    @IsNotEmpty()
    status: MasterStatus;
}

export class MoveCategoryDto {
    @ApiProperty({ required: false, type: String })
    @IsUUID('4')
    @IsOptional()
    targetParentId?: string | null;
}
