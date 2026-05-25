import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';

@Injectable()
export class SuperAdminService {
    constructor(private prisma: PrismaService) { }

    private mapUserFields(user: any) {
        if (!user) return null;
        return {
            ...user,
            firstName: user.first_name,
            lastName: user.last_name,
            createdAt: user.created_at,
            updatedAt: user.updated_at
        };
    }

    async getPendingSellers() {
        const users = await this.prisma.user.findMany({
            where: {
                role: 'seller',
                isApproved: false,
                onboarded_at: { not: null } // Only those who finished documentation
            },
            include: {
                shopDetail: true,
                sellerDocuments: true
            },
            orderBy: {
                created_at: 'desc'
            }
        });
        return users.map(user => this.mapUserFields(user));
    }

    async getApprovedSellers() {
        const users = await this.prisma.user.findMany({
            where: {
                role: 'seller',
                isApproved: true,
                approvalStatus: 'APPROVED'
            },
            include: {
                shopDetail: true,
                sellerDocuments: true
            },
            orderBy: {
                updated_at: 'desc'
            }
        });
        return users.map(user => this.mapUserFields(user));
    }

    async getRejectedSellers() {
        const users = await this.prisma.user.findMany({
            where: {
                role: 'seller',
                approvalStatus: 'REJECTED'
            },
            include: {
                shopDetail: true,
                sellerDocuments: true
            },
            orderBy: {
                updated_at: 'desc'
            }
        });
        return users.map(user => this.mapUserFields(user));
    }


    async approveSeller(sellerId: number) {
        const user = await this.prisma.user.findUnique({ where: { id: sellerId } });
        if (!user) throw new BadRequestException('User not found');
        if (user.role !== 'seller') throw new BadRequestException('Not a Seller user');
        if (user.isApproved) throw new BadRequestException('User is already approved');

        await this.prisma.user.update({
            where: { id: sellerId },
            data: {
                isApproved: true,
                approvalStatus: 'APPROVED',
                isFirstApprovalLogin: true,
                rejectionReason: null
            }
        });

        // Also update the SellerProfile
        await this.prisma.sellerProfile.updateMany({
            where: { userId: sellerId },
            data: {
                status: 'APPROVED',
                approvedAt: new Date()
            }
        });

        return { message: 'Seller approved successfully' };
    }

    async rejectSeller(sellerId: number, rejectionReason?: string) {
        const user = await this.prisma.user.findUnique({ where: { id: sellerId } });
        if (!user) throw new BadRequestException('User not found');
        if (user.role !== 'seller') throw new BadRequestException('Not a Seller user');

        await this.prisma.user.update({
            where: { id: sellerId },
            data: {
                isApproved: false,
                approvalStatus: 'REJECTED',
                rejectionReason: rejectionReason || 'Invalid documents or information provided'
            }
        });

        // Also update the SellerProfile
        await this.prisma.sellerProfile.updateMany({
            where: { userId: sellerId },
            data: {
                status: 'REJECTED',
                rejectionReason: rejectionReason || 'Invalid documents or information provided'
            }
        });

        return { message: 'Seller application rejected' };
    }
}
