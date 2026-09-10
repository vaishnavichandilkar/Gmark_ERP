import { IsEmail, IsNotEmpty, IsOptional, IsString, IsNumber, Min, ValidateIf } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';

export class CreateEmployeeDto {
    @ApiProperty({ example: 'John Doe' })
    @IsString()
    @IsNotEmpty()
    name: string;

    @ApiProperty({ example: '123 Main Street, Pune' })
    @IsString()
    @IsNotEmpty()
    address: string;

    @ApiProperty({ example: '9876543210' })
    @IsString()
    @IsNotEmpty()
    mobileNo: string;

    @ApiProperty({ example: 'IT' })
    @IsString()
    @IsNotEmpty()
    department: string;

    @ApiProperty({ example: 'john.doe@personal.com' })
    @IsEmail()
    @IsNotEmpty()
    personalEmail: string;

    @ApiPropertyOptional({ example: 'john.doe@company.com' })
    @IsOptional()
    @ValidateIf((o) => o.companyEmail && o.companyEmail.trim() !== '')
    @IsEmail()
    companyEmail?: string;

    @ApiPropertyOptional({ example: 'Day Shift (9 AM - 6 PM)' })
    @IsOptional()
    @IsString()
    shiftTiming?: string;

    @ApiProperty({ example: '2024-01-15' })
    @IsString()
    @IsNotEmpty()
    dateOfJoining: string;

    @ApiProperty({ example: '1995-05-20' })
    @IsString()
    @IsNotEmpty()
    dob: string;

    @ApiProperty({ example: 'O+' })
    @IsString()
    @IsNotEmpty()
    bloodGroup: string;

    @ApiProperty({ example: 'Software Engineer' })
    @IsString()
    @IsNotEmpty()
    designation: string;

    @ApiProperty({ example: 'Male' })
    @IsString()
    @IsNotEmpty()
    gender: string;

    @ApiProperty({ example: 'On-roll' })
    @IsString()
    @IsNotEmpty()
    employmentType: string;

    @ApiPropertyOptional({ example: 1 })
    @IsOptional()
    @Type(() => Number)
    reportingToId?: number;

    @ApiProperty({ example: 75000 })
    @IsNotEmpty()
    @Type(() => Number)
    salaryAmount: number;

    @ApiProperty({ example: 'Net Banking' })
    @IsString()
    @IsNotEmpty()
    paymentMode: string;

    // Emergency Contact
    @ApiProperty({ example: 'Jane Doe' })
    @IsString()
    @IsNotEmpty()
    emergencyName: string;

    @ApiProperty({ example: '9123456789' })
    @IsString()
    @IsNotEmpty()
    emergencyMobile: string;

    // Documents info
    @ApiProperty({ example: '1234 5678 9012' })
    @IsString()
    @IsNotEmpty()
    aadhaarNo: string;

    @ApiPropertyOptional()
    @IsOptional()
    @IsString()
    aadhaarDocUrl?: string;

    @ApiProperty({ example: 'ABCDE1234F' })
    @IsString()
    @IsNotEmpty()
    panNo: string;

    @ApiPropertyOptional()
    @IsOptional()
    @IsString()
    panDocUrl?: string;

    @ApiPropertyOptional({ example: '1234567890' })
    @IsOptional()
    @IsString()
    esicNo?: string;

    @ApiPropertyOptional()
    @IsOptional()
    @IsString()
    esicDocUrl?: string;

    @ApiPropertyOptional({ example: '100900800700' })
    @IsOptional()
    @IsString()
    uanNo?: string;

    @ApiPropertyOptional()
    @IsOptional()
    @IsString()
    uanDocUrl?: string;

    // Bank Details
    @ApiProperty({ example: 'HDFC Bank' })
    @IsString()
    @IsNotEmpty()
    bankName: string;

    @ApiProperty({ example: '1234567890' })
    @IsString()
    @IsNotEmpty()
    accountNumber: string;

    @ApiProperty({ example: 'HDFC0001234' })
    @IsString()
    @IsNotEmpty()
    ifscCode: string;

    @ApiProperty({ example: 'Main Branch' })
    @IsString()
    @IsNotEmpty()
    branch: string;
}

export class UpdateEmployeeDto extends PartialType(CreateEmployeeDto) {}
