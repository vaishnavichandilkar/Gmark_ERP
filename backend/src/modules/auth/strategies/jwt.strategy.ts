import { ExtractJwt, Strategy } from 'passport-jwt';
import { PassportStrategy } from '@nestjs/passport';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../../infrastructure/prisma/prisma.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
    constructor(
        private configService: ConfigService,
        private prisma: PrismaService,
    ) {
        super({
            jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
            ignoreExpiration: false,
            secretOrKey: configService.get<string>('jwt.secret') || 'secret',
        });
    }

    async validate(payload: any) {
        // 1. Strict Session Validation (Matching Session ID in DB)
        const session = await this.prisma.session.findUnique({
            where: { jti: payload.jti }
        });

        if (!session || session.isRevoked || session.expiresAt < new Date()) {
            throw new UnauthorizedException('Session expired or revoked. Please log in again.');
        }

        // Platform User (Superadmin, Seller, Buyer)
        const user = await this.prisma.user.findUnique({
            where: { id: payload.sub },
        });

        if (!user || user.isBlocked) {
            throw new UnauthorizedException('Account blocked or not found');
        }

        const userProfile = await this.prisma.userProfile.findUnique({
            where: { phone_number: user.phone }
        });

        const shopDetail = await this.prisma.shopDetail.findUnique({
            where: { userId: user.id }
        });

        const gstDoc = await this.prisma.sellerDocument.findFirst({
            where: { uploadedByUserId: user.id, type: 'GST', url: 'N/A' },
            select: { name: true }
        });

        return {
            id: user.id,
            userId: user.id,
            firstName: user.first_name,
            lastName: user.last_name,
            phone: user.phone,
            name: userProfile?.name || `${user.first_name || ''} ${user.last_name || ''}`.trim() || user.phone,
            email: userProfile?.email || user.email,
            username: user.username || user.phone,
            profileImage: userProfile?.profile_image,
            role: user.role.toUpperCase(),
            isApproved: user.isApproved,
            approvalStatus: user.approvalStatus || 'PENDING',
            rejectionReason: user.rejectionReason,
            isFirstApprovalLogin: user.isFirstApprovalLogin,
            onboarded: !!user.onboarded_at,
            shopDetail,
            gstNumber: gstDoc?.name || null
        };
    }
}
