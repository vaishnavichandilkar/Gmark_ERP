import { IsNotEmpty, IsString, MaxLength, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateDepartmentDto {
    @ApiProperty({ example: 'ST', description: 'Department prefix identifier (2 characters)' })
    @IsString()
    @IsNotEmpty()
    @MaxLength(10)
    prefix: string;

    @ApiProperty({ example: 'STORE', description: 'Unique department name' })
    @IsString()
    @IsNotEmpty()
    departmentName: string;
}

export class UpdateDepartmentDto extends CreateDepartmentDto {}
