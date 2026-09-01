import { ExtractJwt, Strategy } from 'passport-jwt';
import { PassportStrategy } from '@nestjs/passport';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../../infrastructure/prisma/prisma.service';
import { RedisService } from '../../../infrastructure/redis/redis.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
    constructor(
        private configService: ConfigService,
        private prisma: PrismaService,
        private redisService: RedisService,
    ) {
        super({
            jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
            ignoreExpiration: false,
            secretOrKey: configService.get<string>('jwt.secret') || 'secret',
        });
    }

    async validate(payload: any) {
        // 1. Check Redis Session Cache First
        const cachedUser = await this.redisService.getSession(payload.jti);
        if (cachedUser) {
            return cachedUser;
        }

        // 2. Cache Miss: Query Database
        const session = await this.prisma.session.findUnique({
            where: { jti: payload.jti }
        });

        if (!session || session.isRevoked || session.expiresAt < new Date()) {
            throw new UnauthorizedException('Session expired or revoked. Please log in again.');
        }

        // Platform User (Superadmin, Admin/Seller, User)
        const user = await this.prisma.user.findUnique({
            where: { id: payload.sub },
        });

        if (!user || user.isBlocked || user.status === 'INACTIVE') {
            throw new UnauthorizedException('Account blocked, inactive, or not found');
        }

        const roleUpper = user.role.toUpperCase();
        let effectiveAdminId: number | null = null;
        if (roleUpper === 'SUPERADMIN') {
            effectiveAdminId = null;
        } else if (roleUpper === 'ADMIN' || roleUpper === 'SELLER') {
            effectiveAdminId = user.id;
        } else if (roleUpper === 'USER' || roleUpper === 'OPERATOR') {
            effectiveAdminId = user.adminId || user.id;
            // Also check parent admin status if sub-user
            if (user.adminId) {
                const parentAdmin = await this.prisma.user.findUnique({
                    where: { id: user.adminId }
                });
                if (!parentAdmin || parentAdmin.isBlocked || parentAdmin.status === 'INACTIVE' || parentAdmin.approvalStatus !== 'APPROVED') {
                    throw new UnauthorizedException('Parent admin account is inactive or not approved');
                }
            }
        }

        const userProfile = user.phone ? await this.prisma.userProfile.findUnique({
            where: { phone_number: user.phone }
        }) : null;

        const shopDetail = await this.prisma.shopDetail.findUnique({
            where: { userId: effectiveAdminId || user.id }
        });

        const gstDoc = await this.prisma.sellerDocument.findFirst({
            where: { uploadedByUserId: effectiveAdminId || user.id, type: 'GST', url: 'N/A' },
            select: { name: true }
        });

        const tenantId = effectiveAdminId ?? user.id;
        const userObj = {
            id: tenantId,
            userId: tenantId,
            actualUserId: user.id,
            adminId: user.adminId,
            effectiveAdminId: tenantId,
            jti: payload.jti,
            firstName: user.first_name,
            lastName: user.last_name,
            phone: user.phone,
            name: userProfile?.name || `${user.first_name || ''} ${user.last_name || ''}`.trim() || user.phone || user.username,
            email: userProfile?.email || user.email,
            username: user.username || user.phone,
            profileImage: userProfile?.profile_image,
            role: roleUpper === 'SELLER' ? 'ADMIN' : (roleUpper === 'OPERATOR' ? 'USER' : roleUpper),
            rawRole: roleUpper,
            status: user.status,
            isApproved: user.isApproved,
            approvalStatus: user.approvalStatus || 'PENDING',
            rejectionReason: user.rejectionReason,
            isFirstApprovalLogin: user.isFirstApprovalLogin,
            permissions: user.permissions || {},
            onboarded: !!user.onboarded_at,
            shopDetail,
            gstNumber: gstDoc?.name || null
        };

        // Cache in Redis (TTL is remaining session lifespan, capped at 1 hour)
        const ttlSeconds = Math.max(0, Math.floor((session.expiresAt.getTime() - Date.now()) / 1000));
        if (ttlSeconds > 0) {
            await this.redisService.setSession(payload.jti, userObj, Math.min(ttlSeconds, 3600));
        }

        return userObj;
    }
}
