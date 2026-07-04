import { Injectable, InternalServerErrorException, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SNSClient, PublishCommand } from '@aws-sdk/client-sns';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import * as crypto from 'crypto';

@Injectable()
export class SmsService {
    private snsClient: SNSClient;
    private readonly MAX_RESEND_LIMIT = 3;
    private readonly OTP_EXPIRY_MINUTES = 1;

    constructor(
        private configService: ConfigService,
        private prisma: PrismaService,
    ) {
        this.snsClient = new SNSClient({
            region: this.configService.get<string>('AWS_REGION'),
            credentials: {
                accessKeyId: this.configService.get<string>('AWS_ACCESS_KEY_ID'),
                secretAccessKey: this.configService.get<string>('AWS_SECRET_ACCESS_KEY'),
            },
        });
    }

    private async sendSms(phone: string, otp: string): Promise<void> {
        const formattedPhone = this.formatPhoneNumber(phone);
        const message = `Your WeighPro verification code is: ${otp}. Valid for ${this.OTP_EXPIRY_MINUTES} minute.`;

        console.log('-------------------------------');
        console.log(`[SMS] OTP for ${phone}: ${otp}`);
        console.log('-------------------------------');

        try {
            const command = new PublishCommand({
                Message: message,
                PhoneNumber: formattedPhone,
                MessageAttributes: {
                    'AWS.SNS.SMS.SMSType': {
                        DataType: 'String',
                        StringValue: 'Transactional',
                    },
                },
            });

            await this.snsClient.send(command);
        } catch (error) {
            const isDev = 
                this.configService.get('NODE_ENV') !== 'production' || 
                !this.configService.get('AWS_ACCESS_KEY_ID') ||
                this.configService.get('ENABLE_DEV_OTP') === 'true' ||
                process.env.ENABLE_DEV_OTP === 'true';
            
            if (isDev) {
                console.log('-------------------------------');
                console.log(`[DEV MODE] OTP for ${formattedPhone}: ${otp}`);
                console.log(`[DEV MODE] Error was: ${error.message}`);
                console.log('-------------------------------');
                return; // Fallback to logs in dev
            }
            
            throw new InternalServerErrorException(`Failed to send SMS OTP: ${error.message}`);
        }
    }

    async sendOtp(phone: string): Promise<void> {
        const otp = crypto.randomInt(100000, 999999).toString();
        const now = new Date();
        const expiresAt = new Date(now.getTime() + this.OTP_EXPIRY_MINUTES * 60000);

        console.log('====================================');
        console.log(`[SMS OTP GENERATED] Phone: ${phone}, OTP: ${otp}`);
        console.log('====================================');

        // 1. Send SMS via AWS SNS
        await this.sendSms(phone, otp);

        // 2. Store/Update OTP in database
        await this.prisma.otp.upsert({
            where: { phone },
            update: {
                otp,
                expiresAt,
                isVerified: false,
                resendCount: 0,
                lastSentAt: now
            },
            create: {
                phone,
                otp,
                expiresAt,
                isVerified: false,
                resendCount: 0,
                lastSentAt: now
            },
        });
    }

    async resendOtp(phone: string): Promise<void> {
        const record = await this.prisma.otp.findUnique({
            where: { phone },
        });

        if (!record) {
            throw new BadRequestException('No OTP record found for this phone number. Please register first.');
        }

        const now = new Date();
        const secondsSinceLastSent = (now.getTime() - record.lastSentAt.getTime()) / 1000;

        // Requirement: check if 1 minute (OTP expiry) is reached
        if (secondsSinceLastSent < 60) {
            throw new BadRequestException('Please wait until OTP expires to resend');
        }

        // Requirement: Enforce a maximum resend limit (e.g., 3 times)
        if (record.resendCount >= this.MAX_RESEND_LIMIT) {
            throw new BadRequestException(`Maximum resend limit of ${this.MAX_RESEND_LIMIT} reached. Please try again later.`);
        }

        const otp = crypto.randomInt(100000, 999999).toString();
        const expiresAt = new Date(now.getTime() + this.OTP_EXPIRY_MINUTES * 60000);

        console.log('====================================');
        console.log(`[SMS OTP RESENT] Phone: ${phone}, OTP: ${otp}`);
        console.log('====================================');

        // 1. Send SMS
        await this.sendSms(phone, otp);

        // 2. Update existing OTP record
        await this.prisma.otp.update({
            where: { phone },
            data: {
                otp,
                expiresAt,
                resendCount: record.resendCount + 1,
                lastSentAt: now,
                isVerified: false,
            },
        });
    }

    private formatPhoneNumber(phone: string): string {
        let cleaned = phone.replace(/[^\d+]/g, '');
        if (cleaned.startsWith('+')) return cleaned;
        if (cleaned.length === 10) return `+91${cleaned}`;
        if (cleaned.length === 12 && cleaned.startsWith('91')) return `+${cleaned}`;
        return `+${cleaned}`;
    }

    async verifyOtp(phone: string, otp: string): Promise<boolean> {
        const enableDevOtp = this.configService.get<string>('ENABLE_DEV_OTP') || process.env.ENABLE_DEV_OTP;
        const devOtp = this.configService.get<string>('DEV_OTP') || process.env.DEV_OTP;

        if (enableDevOtp === 'true' && otp === devOtp) {
            const record = await this.prisma.otp.findUnique({
                where: { phone },
            });
            if (record) {
                await this.prisma.otp.update({
                    where: { phone },
                    data: { isVerified: true }
                });
            }
            return true;
        }

        const record = await this.prisma.otp.findUnique({
            where: { phone },
        });

        if (!record || record.otp !== otp) {
            return false;
        }

        if (record.expiresAt < new Date()) {
            // Requirement mentions "maintain proper validation for OTP verification (invalid, expired, verified)"
            return false;
        }

        await this.prisma.otp.update({
            where: { phone },
            data: { isVerified: true }
        });

        return true;
    }

    async deleteOtp(phone: string): Promise<void> {
        await this.prisma.otp.deleteMany({ where: { phone } });
    }
}
