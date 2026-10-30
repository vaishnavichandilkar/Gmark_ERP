import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';

@Injectable()
export class BusinessService {
    constructor(private prisma: PrismaService) { }

    async getBusinessProfile(userId: number) {
        const user = await this.prisma.user.findUnique({
            where: { id: userId },
            include: {
                shopDetail: true,
                sellerDocuments: true
            }
        });

        if (!user) return null;

        // Extract GST Number from documents
        // A valid GST number is 15 characters. We reject placeholder values like 'N/A'.
        const isValidGst = (name: string | null | undefined) =>
            name && 
            name.trim().toUpperCase() !== 'N/A' && 
            name.trim().toUpperCase() !== 'NOT AVAILABLE' && 
            name.trim().toUpperCase() !== '-' && 
            name.trim().length >= 10;

        const gstDoc = user.sellerDocuments.find(
            doc => doc.type === 'GST' && doc.url === 'N/A' && isValidGst(doc.name)
        );
        
        const logoDoc = user.sellerDocuments.find(
            doc => doc.category === 'INVOICE_LOGO'
        );

        let logoSettings = { shape: 'contain', size: 'md', isFixedDefault: true };
        if (logoDoc?.name) {
            try {
                const parsed = JSON.parse(logoDoc.name);
                if (parsed && typeof parsed === 'object') {
                    logoSettings = { ...logoSettings, ...parsed };
                }
            } catch {
                // Keep default if name is not JSON
            }
        }

        return {
            ...user,
            gstNumber: gstDoc ? gstDoc.name : null,
            logoUrl: logoDoc ? logoDoc.url : null,
            logoSettings: logoDoc ? logoSettings : null
        };
    }

    // Compatibility method for AdminBusinessController
    async createBusinessDetails(userId: number, dto: any) {
        const user = await this.prisma.user.findUnique({ 
            where: { id: userId }
        });
        if (!user) throw new BadRequestException('User not found');

        const sellerProfile = await this.prisma.sellerProfile.findUnique({
            where: { userId }
        });

        // Save Shop Details
        await this.prisma.shopDetail.upsert({
            where: { userId },
            update: {
                shopName: dto.businessName || dto.shopName,
                address: dto.addressLine || dto.address,
                pinCode: dto.pincode || dto.pinCode,
                state: dto.state,
                district: dto.city || dto.district,
            },
            create: {
                userId,
                shopName: dto.businessName || dto.shopName,
                address: dto.addressLine || dto.address,
                pinCode: dto.pincode || dto.pinCode,
                state: dto.state,
                district: dto.city || dto.district,
            }
        });

        // Save GST Number if provided
        if (dto.gstNumber) {
            const profileId = sellerProfile?.id || null;
            
            // Check if GST doc already exists
            const existingGst = await this.prisma.sellerDocument.findFirst({
                where: { uploadedByUserId: userId, type: 'GST', url: 'N/A' }
            });

            if (existingGst) {
                await this.prisma.sellerDocument.update({
                    where: { id: existingGst.id },
                    data: { name: String(dto.gstNumber) }
                });
            } else {
                await this.prisma.sellerDocument.create({
                    data: {
                        profileId,
                        uploadedByUserId: userId,
                        type: 'GST',
                        url: 'N/A',
                        name: String(dto.gstNumber),
                        size: BigInt(0)
                    }
                });
            }
        }

        await this.prisma.user.update({
            where: { id: userId },
            data: {
                onboarded_at: new Date(),
                isApproved: false
            }
        });

        return { message: 'Business details saved successfully.' };
    }

    async updateBusinessStatus(userId: number, isApproved: boolean) {
        return this.prisma.user.update({
            where: { id: userId },
            data: {
                isApproved: isApproved
            }
        });
    }

    async updateInvoiceLogo(userId: number, file?: Express.Multer.File, customUrl?: string, settings?: any) {
        const sellerProfile = await this.prisma.sellerProfile.findUnique({ where: { userId } });
        
        let logoUrl = customUrl;
        let originalName = 'Invoice Logo';
        let fileSize = 0;

        if (file) {
            logoUrl = file.path.replace(/\\/g, '/');
            originalName = file.originalname;
            fileSize = file.size;
        }

        if (!logoUrl) {
            throw new BadRequestException('Logo file or URL is required');
        }

        const metadata = JSON.stringify({
            originalName,
            shape: settings?.shape || 'contain',
            size: settings?.size || 'md',
            isFixedDefault: true,
            updatedAt: new Date().toISOString()
        });

        // Delete existing logo document if any
        await this.prisma.sellerDocument.deleteMany({
            where: {
                uploadedByUserId: userId,
                category: 'INVOICE_LOGO'
            }
        });

        // Create new seller document
        const doc = await this.prisma.sellerDocument.create({
            data: {
                profileId: sellerProfile?.id || null,
                uploadedByUserId: userId,
                type: 'OTHER',
                category: 'INVOICE_LOGO',
                url: logoUrl,
                name: metadata,
                size: BigInt(fileSize)
            }
        });

        return {
            message: 'Invoice logo updated and permanently fixed as default',
            logoUrl: doc.url,
            logoSettings: {
                shape: settings?.shape || 'contain',
                size: settings?.size || 'md',
                isFixedDefault: true
            }
        };
    }

    async removeInvoiceLogo(userId: number) {
        await this.prisma.sellerDocument.deleteMany({
            where: {
                uploadedByUserId: userId,
                category: 'INVOICE_LOGO'
            }
        });

        return {
            message: 'Invoice logo removed successfully'
        };
    }
}
