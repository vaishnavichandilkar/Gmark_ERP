import { IsEmail, IsNotEmpty, IsOptional, IsString, Length } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateUserDto {
    @ApiProperty({ example: 'John Doe' })
    @IsString()
    @IsNotEmpty()
    name: string;

    @ApiPropertyOptional({ example: '9876543210' })
    @IsOptional()
    @IsString()
    phone?: string;

    @ApiPropertyOptional({ example: 'john@example.com' })
    @IsOptional()
    @IsEmail()
    email?: string;

    @ApiPropertyOptional({ example: 'john_user' })
    @IsOptional()
    @IsString()
    username?: string;

    @ApiPropertyOptional({ example: 'Password123' })
    @IsOptional()
    @IsString()
    password?: string;

    @ApiPropertyOptional({ example: 'USER' })
    @IsOptional()
    @IsString()
    role?: string;

    @ApiPropertyOptional()
    @IsOptional()
    permissions?: any;
}

export class UpdateUserDto {
    @ApiPropertyOptional({ example: 'John Doe' })
    @IsOptional()
    @IsString()
    name?: string;

    @ApiPropertyOptional({ example: '9876543210' })
    @IsOptional()
    @IsString()
    phone?: string;

    @ApiPropertyOptional({ example: 'john@example.com' })
    @IsOptional()
    @IsEmail()
    email?: string;

    @ApiPropertyOptional({ example: 'USER' })
    @IsOptional()
    @IsString()
    role?: string;

    @ApiPropertyOptional()
    @IsOptional()
    permissions?: any;
}

export class ResetPasswordDto {
    @ApiProperty({ example: 'NewPassword123' })
    @IsString()
    @IsNotEmpty()
    @Length(6, 50)
    newPassword: string;
}
