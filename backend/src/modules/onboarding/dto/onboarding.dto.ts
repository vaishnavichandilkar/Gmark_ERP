import { IsEmail, IsNotEmpty, IsString, IsOptional, Length, IsBoolean, ValidateIf, Matches, IsInt, IsEnum } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { RegType } from '@prisma/client';

export class Step1LanguageDto {
    @ApiProperty({ example: 'English', description: 'Selected language' })
    @IsString()
    @IsNotEmpty()
    language: string;

    // @ApiProperty({ example: 'uuid-of-existing-onboarding-session', description: 'Optional userId to update existing selection', required: false })
    // @IsString()
    // @IsOptional()
    userId?: number;
}

export class Step2MobileDto {
    @ApiProperty({ example: '1234567890' })
    @IsString()
    @IsNotEmpty()
    @Length(10, 15)
    phone: string;

    @ApiProperty({ example: 'Hindi', description: 'Selected language from localStorage' })
    @IsString()
    @IsOptional()
    selectedLanguage?: string;

    @ApiProperty({ example: 1, description: 'Optional userId if step 1 was already called', required: false })
    @IsInt()
    @IsOptional()
    userId?: number;
}

export class Step3VerifyDto {
    @ApiProperty({ example: '1234567890' })
    @IsString()
    @IsNotEmpty()
    phone: string;

    @ApiProperty({ example: '123456' })
    @IsString()
    @IsNotEmpty()
    otp: string;

    @ApiProperty({ example: 'uuid-from-step-1', description: 'The userId returned from Step 1' })
    @IsInt()
    @IsNotEmpty()
    userId: number;
}

export class Step4DetailsDto {
    @ApiProperty({ example: 'John' })
    @IsString()
    @IsNotEmpty()
    @Matches(/^[a-zA-Z\s]+$/, { message: 'first name must contain only letters and spaces' })
    first_name: string;

    @ApiProperty({ example: 'Doe' })
    @IsString()
    @IsNotEmpty()
    @Matches(/^[a-zA-Z\s]+$/, { message: 'last name must contain only letters and spaces' })
    last_name: string;

    @ApiProperty({ example: 'john.doe@example.com', required: true })
    @IsEmail()
    @IsNotEmpty()
    email: string;
}

export class Step5BusinessDto {
    @ApiProperty({ example: 'UDYOG-12345', required: false })
    @IsString()
    @IsOptional()
    udyogAadharNumber?: string;

    @ApiProperty({ example: '22AAAAA0000A1Z5' })
    @IsString()
    @IsOptional()
    gstNumber: string;

    @ApiProperty({ example: 'Manufacturing', required: false, enum: RegType })
    @IsEnum(RegType)
    @IsOptional()
    regType?: RegType;

    @ApiProperty({ example: 'ABCDE1234F', required: true })
    @IsString()
    @IsNotEmpty({ message: 'PAN Number is required' })
    @Transform(({ value }) => typeof value === 'string' ? value.replace(/[^a-zA-Z0-9]/g, '').toUpperCase().slice(0, 10) : value)
    @Matches(/^[A-Z]{3}[PCHF][A-Z]{1}[0-9]{4}[A-Z]{1}$/, { message: 'Invalid PAN format. PAN must contain exactly 10 characters (AAAAA9999A) with 4th character P (Individual), C (Company), H (HUF), or F (Firm/LLP)' })
    panNumber: string;
}

export class Step6ShopDto {
    @ApiProperty({ example: 'My Awesome Shop' })
    @IsString()
    @IsNotEmpty()
    shopName: string;

    @ApiProperty({ example: '123 Market Street' })
    @IsString()
    @IsNotEmpty()
    address: string;

    @ApiProperty({ example: 'Rose Village' })
    @IsString()
    @IsOptional()
    @Matches(/^[a-zA-Z\s]+$/, { message: 'village name must contain only letters and spaces' })
    village?: string;

    @ApiProperty({ example: '400001' })
    @IsString()
    @IsNotEmpty()
    @Matches(/^\d{6}$/, { message: 'pincode must be exactly 6 digits' })
    pinCode: string;

    @ApiProperty({ example: 'Maharashtra', required: false })
    @IsString()
    @IsOptional()
    state?: string;

    @ApiProperty({ example: 'Pune', required: false })
    @IsString()
    @IsOptional()
    district?: string;

    @ApiProperty({ example: 'India', required: false })
    @IsString()
    @IsOptional()
    country?: string;
}

