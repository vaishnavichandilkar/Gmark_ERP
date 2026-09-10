import { IsNotEmpty, IsString, IsOptional } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateShiftDto {
    @ApiProperty({ description: 'Name of the work shift', example: 'Morning Shift' })
    @IsNotEmpty({ message: 'Shift Name is required' })
    @IsString()
    shiftName: string;

    @ApiProperty({ description: 'Start time of the shift', example: '09:00 AM' })
    @IsNotEmpty({ message: 'Start Time is required' })
    @IsString()
    startTime: string;

    @ApiProperty({ description: 'End time of the shift', example: '05:00 PM' })
    @IsNotEmpty({ message: 'End Time is required' })
    @IsString()
    endTime: string;
}

export class UpdateShiftDto {
    @ApiPropertyOptional({ description: 'Name of the work shift' })
    @IsOptional()
    @IsString()
    shiftName?: string;

    @ApiPropertyOptional({ description: 'Start time of the shift' })
    @IsOptional()
    @IsString()
    startTime?: string;

    @ApiPropertyOptional({ description: 'End time of the shift' })
    @IsOptional()
    @IsString()
    endTime?: string;
}
