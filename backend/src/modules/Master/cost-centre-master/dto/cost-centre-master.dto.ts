import { IsNotEmpty, IsString, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateCostCentreDto {
    @ApiProperty({ example: 'FC', description: 'Cost centre prefix identifier (2 characters)' })
    @IsString()
    @IsNotEmpty()
    @MaxLength(10)
    prefix: string;

    @ApiProperty({ example: 'FACTORY', description: 'Unique cost centre name' })
    @IsString()
    @IsNotEmpty()
    costCentreName: string;
}

export class UpdateCostCentreDto extends CreateCostCentreDto {}
