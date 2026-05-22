import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';

@Injectable()
export class OtpService {
    constructor(
        private prisma: PrismaService,
        private configService: ConfigService,
    ) { }

    async generateOtp(phone: string): Promise<string> {
        const otp = crypto.randomInt(100000, 999999).toString();
        const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes

        await this.prisma.otp.upsert({
            where: { phone },
            update: { otp, expiresAt },
            create: { phone, otp, expiresAt }
        });

        // In a real app, send OTP via SMS/Email here
        // Note: SmsService should be used for production SMS delivery
        return otp;
    }

    async verifyOtp(phone: string, otp: string): Promise<boolean> {
        const enableDevOtp = this.configService.get<string>('ENABLE_DEV_OTP') || process.env.ENABLE_DEV_OTP;
        const devOtp = this.configService.get<string>('DEV_OTP') || process.env.DEV_OTP;

        if (enableDevOtp === 'true' && otp === devOtp) {
            const record = await this.prisma.otp.findUnique({
                where: { phone },
            });
            if (record) {
                await this.prisma.otp.delete({ where: { phone } });
            }
            return true;
        }

        const record = await this.prisma.otp.findUnique({
            where: { phone },
        });

        if (!record || record.otp !== otp || record.expiresAt < new Date()) {
            return false;
        }

        await this.prisma.otp.delete({ where: { phone } });

        return true;
    }
}
