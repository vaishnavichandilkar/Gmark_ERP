import { Injectable, UnauthorizedException, BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { LoginDto, RefreshTokenDto, SendLoginOtpDto } from './dto/auth.dto';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { ConfigService } from '@nestjs/config';

import { SmsService } from '../otp/sms.service';

@Injectable()
export class AuthService {
    constructor(
        private prisma: PrismaService,
        private jwtService: JwtService,
        private configService: ConfigService,
        private smsService: SmsService,
    ) { }

    async sendLoginOtp(dto: SendLoginOtpDto) {
        // 1. Check if user exists in any table
        const user = await this.findUserByPhone(dto.phone);
        if (!user) throw new NotFoundException('This phone number is not registered. Please sign up or try a different number.');

        // 2. Send OTP via SMS (Generates, Sends, and Stores)
        await this.smsService.sendOtp(dto.phone);

        return { message: 'OTP sent successfully' };
    }

    async login(dto: LoginDto) {
        // 1. Verify OTP using SmsService
        const isValid = await this.smsService.verifyOtp(dto.phone, dto.otp);
        if (!isValid) {
            throw new BadRequestException('Invalid or expired OTP');
        }

        // 2. Find User and Role
        const { user, roleType } = await this.findUserAndRoleByPhone(dto.phone);
        if (!user) {
            await this.smsService.deleteOtp(dto.phone);
            throw new UnauthorizedException('User not found');
        }

        // 3. Strict Seller Verification (As per DB requirements)
        if (roleType === 'SELLER') {
            if (!user.verified) {
                throw new UnauthorizedException('Phone number not verified.');
            }
            if (user.isBlocked) {
                throw new UnauthorizedException('Account is blocked. Please contact support.');
            }
        }

        // Cleanup OTP after success
        await this.smsService.deleteOtp(dto.phone);

        // 5. Generate tokens and manage session in DB
        return this.generateTokens(user, roleType);
    }

    private async findUserByPhone(phone: string): Promise<any> {
        return this.prisma.user.findUnique({ where: { phone } });
    }

    private async findUserAndRoleByPhone(phone: string): Promise<{ user: any, roleType: string }> {
        const user = await this.prisma.user.findUnique({ where: { phone } });
        if (user) return { user, roleType: user.role.toUpperCase() };
        return { user: null, roleType: 'UNKNOWN' };
    }

    async refresh(dto: RefreshTokenDto) {
        try {
            // 1. Verify the refresh token
            const payload = this.jwtService.verify(dto.refreshToken, {
                secret: this.configService.get('jwt.refreshSecret'),
            });

            // 2. Find User and check if refresh token matches in DB
            const user = await this.prisma.user.findUnique({ 
                where: { id: payload.sub } 
            });

            if (!user) throw new UnauthorizedException('User not found');

            // Requirement 3: Database Check
            // Verify that the refresh token sent from the frontend matches the refresh token stored in the database
            if (user.refresh_token !== dto.refreshToken) {
                throw new UnauthorizedException('Invalid or expired refresh token');
            }

            // Optional: Also check Session table for added security (revocation check)
            const session = await this.prisma.session.findUnique({
                where: { jti: payload.jti }
            });

            if (!session || session.isRevoked || session.expiresAt < new Date()) {
                throw new UnauthorizedException('Session expired or revoked');
            }

            // 3. Generate new tokens
            const roleType = user.role.toUpperCase();
            return this.generateTokens(user, roleType);
        } catch (e) {
            if (e instanceof UnauthorizedException) throw e;
            throw new UnauthorizedException('Invalid refresh token');
        }
    }

    async logout(userId: number) {
        await this.prisma.session.updateMany({
            where: { userId, isRevoked: false },
            data: { isRevoked: true },
        });
        await this.prisma.user.update({
            where: { id: userId },
            data: { refresh_token: null }
        });
        return { message: 'Logged out successfully' };
    }

    private async generateTokens(user: any, roleType: string) {
        const jti = crypto.randomUUID();
        const username = user.email || user.phone || user.mobile || user.username;
        const payload = { sub: user.id, username, role: roleType, jti };

        const secret = this.configService.get('jwt.secret') || 'secret';
        const refreshSecret = this.configService.get('jwt.refreshSecret') || 'refreshSecret';

        const accessToken = this.jwtService.sign(payload, { secret });
        const refreshToken = this.jwtService.sign(payload, {
            secret: refreshSecret,
            expiresIn: '7d',
        });

        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + 7);

        // 1. Invalidate old sessions for this user (Rotate)
        await this.prisma.session.updateMany({
            where: { userId: user.id, isRevoked: false },
            data: { isRevoked: true },
        });

        // 2. Store New Session (Database Table)
        await this.prisma.session.create({
            data: {
                userId: user.id,
                userType: roleType,
                jti: jti,
                refreshTokenHash: await bcrypt.hash(refreshToken, 10),
                expiresAt: expiresAt,
            }
        });

        await this.prisma.user.update({
            where: { id: user.id },
            data: { refresh_token: refreshToken }
        });

        // 3. Fetch Profile from user_profiles table
        const userProfile = await this.prisma.userProfile.findUnique({
            where: { phone_number: user.phone }
        });

        return {
            accessToken,
            refreshToken,
            user: {
                id: user.id,
                phone: user.phone,
                name: userProfile?.name || `${user.first_name || ''} ${user.last_name || ''}`.trim() || user.phone,
                email: userProfile?.email || user.email,
                username: user.username || username,
                profileImage: userProfile?.profile_image,
                role: roleType,
                approvalStatus: user.approvalStatus,
                rejectionReason: user.rejectionReason,
                isFirstApprovalLogin: user.isFirstApprovalLogin,
                selectedLanguage: user.selected_language || 'Hindi',
            },
        };
    }
    async markApprovalLoginSeen(userId: number) {
        await this.prisma.user.update({
            where: { id: userId },
            data: { isFirstApprovalLogin: false }
        });
        return { message: 'Approval login screen marked as seen' };
    }

    async updateLanguage(userId: number, language: string) {
        await this.prisma.user.update({
            where: { id: userId },
            data: { selected_language: language }
        });
        return { message: 'Language updated successfully', language };
    }

    async resendOtp(phone: string) {
        return this.smsService.resendOtp(phone);
    }

    async updateProfile(userId: number, data: { name?: string; email?: string; profileImage?: string }) {
        const user = await this.prisma.user.findUnique({ where: { id: userId } });
        if (!user) throw new NotFoundException('User not found');

        const [firstName, ...lastNameParts] = (data.name || '').split(' ');
        const lastName = lastNameParts.join(' ');

        try {
            // Update User table basics
            await this.prisma.user.update({
                where: { id: userId },
                data: {
                    first_name: firstName || undefined,
                    last_name: lastName || undefined,
                    email: data.email,
                }
            });

            // Upsert UserProfile record based on phone_number
            const userProfile = await this.prisma.userProfile.upsert({
                where: { phone_number: user.phone },
                update: {
                    name: data.name,
                    email: data.email,
                    profile_image: data.profileImage,
                },
                create: {
                    phone_number: user.phone,
                    name: data.name,
                    email: data.email,
                    profile_image: data.profileImage,
                }
            });

            return {
                id: user.id,
                phone: user.phone,
                name: userProfile.name,
                email: userProfile.email,
                username: user.username || user.phone,
                profileImage: userProfile.profile_image,
            };
        } catch (error) {
            if (error.code === 'P2002') {
                throw new BadRequestException('Email is already registered by another user');
            }
            throw error;
        }
    }
}
