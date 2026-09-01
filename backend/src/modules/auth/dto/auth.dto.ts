import { IsEmail, IsNotEmpty, IsString, MinLength, Length } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class SendLoginOtpDto {
    @ApiProperty({ example: '1234567890' })
    @IsString()
    @IsNotEmpty()
    @Length(10, 15)
    phone: string;
}

export class LoginDto {
    @ApiProperty({ example: '1234567890' })
    @IsString()
    @IsNotEmpty()
    @Length(10, 15)
    phone: string;

    @ApiProperty({ example: '123456' })
    @IsString()
    @IsNotEmpty()
    otp: string;
}

export class RefreshTokenDto {
    @ApiProperty()
    @IsString()
    @IsNotEmpty()
    refreshToken: string;
}

export class LoginWithPasswordDto {
    @ApiProperty({ example: 'admin@weighpro.com' })
    @IsString()
    @IsNotEmpty()
    identifier: string;

    @ApiProperty({ example: 'password123' })
    @IsString()
    @IsNotEmpty()
    password: string;
}
