import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';

const REJECTION_REASONS = {
    firstName: [
        "First name does not match the submitted identity proof.",
        "First name contains invalid or suspicious characters.",
        "The provided first name appears incomplete or incorrect.",
        "The name format does not match official records.",
        "Please update the first name as per your valid documents."
    ],
    lastName: [
        "Last name does not match the submitted identity proof.",
        "Last name contains invalid or suspicious characters.",
        "The provided last name appears incomplete or incorrect.",
        "The name format does not match official records.",
        "Please update the last name as per your valid documents."
    ],
    email: [
        "The email address could not be verified.",
        "The email provided belongs to another registered account.",
        "The email address does not match the submitted verification details.",
        "The provided email appears invalid or incorrect.",
        "Please provide a valid business email address."
    ],
    phone: [
        "The phone number could not be verified.",
        "The phone number belongs to another registered account.",
        "Please provide a valid and active mobile number."
    ],
    shopName: [
        "Business name does not match the uploaded documents.",
        "Business registration details do not match the provided name.",
        "The business name contains incorrect information.",
        "The provided business details could not be verified.",
        "Please update the business name as per official records."
    ],
    address: [
        "Address does not match the submitted business documents.",
        "Address details are incomplete or inconsistent.",
        "The provided address could not be verified.",
        "The address contains incorrect location information.",
        "Please provide an accurate registered business address."
    ],
    pinCode: [
        "Pincode does not match the provided address.",
        "Pincode does not correspond to the selected city, district, or state.",
        "The provided pincode could not be verified.",
        "The pincode information is incorrect.",
        "Please provide a valid business location pincode."
    ],
    village: [
        "The selected village/city does not match the pincode.",
        "Village/city information does not match the business address.",
        "The provided location details could not be verified.",
        "Incorrect village/city information has been submitted.",
        "Please select the correct business location."
    ],
    district: [
        "District does not match the provided pincode.",
        "District information does not match the submitted address.",
        "The district details could not be verified.",
        "Incorrect district information has been submitted.",
        "Please provide the correct district details."
    ],
    state: [
        "State does not match the provided pincode.",
        "State information does not match the business address.",
        "The provided state details could not be verified.",
        "Incorrect state information has been submitted.",
        "Please select the correct business state."
    ],
    udyogAadharNumber: [
        "Udyog Aadhaar number does not match the business details.",
        "The provided Udyog Aadhaar could not be verified.",
        "Udyog Aadhaar belongs to a different business entity.",
        "Udyog Aadhaar details are inconsistent with submitted documents.",
        "Please provide a valid Udyog Aadhaar linked to your business."
    ],
    regType: [
        "Registration type does not match the Udyog Aadhaar records.",
        "The selected business category is incorrect.",
        "Registration type details are inconsistent with submitted documents.",
        "Registration details could not be verified.",
        "Please select the correct registration type."
    ],
    gstNumber: [
        "GST details do not match the registered business information.",
        "The GST number could not be verified from official records.",
        "GST registration belongs to a different business entity.",
        "GST registration status is inactive or invalid.",
        "Please provide a valid GST registration linked to your business."
    ],
    udyogAadharCert: [
        "The uploaded document is unclear or unreadable.",
        "The document details do not match the entered Udyog Aadhaar information.",
        "The uploaded document is incomplete or missing important details.",
        "The document appears altered or tampered with.",
        "Please upload a clear and valid Udyog Aadhaar document."
    ],
    gstCert: [
        "The uploaded GST certificate is unclear or unreadable.",
        "The document details do not match the entered GST number.",
        "The uploaded GST document is incomplete.",
        "The document appears modified or invalid.",
        "Please upload a valid and clear GST certificate."
    ],
    businessProof: [
        "The uploaded document is unclear or unreadable.",
        "The document does not support the submitted business details.",
        "The document is incomplete or missing required information.",
        "The document appears altered or invalid.",
        "Please upload appropriate supporting documents."
    ],
    shopActLicense: [
        "The uploaded document is unclear or unreadable.",
        "The document does not support the submitted business details.",
        "The document is incomplete or missing required information.",
        "The document appears altered or invalid.",
        "Please upload appropriate supporting documents."
    ],
    panNumber: [
        "PAN details do not match the registered business/owner information.",
        "The PAN number could not be verified from official records.",
        "PAN registration belongs to a different entity.",
        "PAN status is invalid.",
        "Please provide a valid PAN linked to your business."
    ]
};

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
                approvedAt: new Date(),
                rejectionReason: null
            }
        });

        return { message: 'Seller approved successfully' };
    }

    private validateRejectionReason(rejectionReason: string) {
        if (!rejectionReason) {
            throw new BadRequestException('Rejection reason is required');
        }

        let parsed: any;
        try {
            parsed = JSON.parse(rejectionReason);
        } catch (e) {
            // Allow basic string reasons, but if it looks like JSON (starts with '{'), enforce JSON validation
            if (rejectionReason.trim().startsWith('{')) {
                throw new BadRequestException('Invalid JSON format for rejectionReason');
            }
            if (!rejectionReason.trim()) {
                throw new BadRequestException('Rejection reason cannot be empty');
            }
            return;
        }

        // Validate structured JSON
        if (typeof parsed !== 'object' || parsed === null) {
            throw new BadRequestException('Rejection reason must be a valid JSON object');
        }

        if (parsed.generalRemark && typeof parsed.generalRemark !== 'string') {
            throw new BadRequestException('generalRemark must be a string');
        }

        if (!Array.isArray(parsed.rejectedFields)) {
            throw new BadRequestException('rejectedFields must be an array');
        }

        if (parsed.rejectedFields.length === 0) {
            throw new BadRequestException('At least one field must be rejected');
        }

        const validKeys = Object.keys(REJECTION_REASONS);

        for (const item of parsed.rejectedFields) {
            if (typeof item !== 'object' || item === null) {
                throw new BadRequestException('Each rejected field item must be an object');
            }
            const { field, fieldName, reason } = item;

            if (typeof field !== 'string' || !field.trim()) {
                throw new BadRequestException('Each rejected field item must have a valid field identifier');
            }

            if (!validKeys.includes(field)) {
                throw new BadRequestException(`Invalid field key: "${field}"`);
            }

            if (typeof reason !== 'string' || !reason.trim()) {
                throw new BadRequestException(`Rejection reason for field "${fieldName || field}" cannot be empty`);
            }
        }
    }

    async rejectSeller(sellerId: number, rejectionReason?: string) {
        const user = await this.prisma.user.findUnique({ where: { id: sellerId } });
        if (!user) throw new BadRequestException('User not found');
        if (user.role !== 'seller') throw new BadRequestException('Not a Seller user');

        if (rejectionReason) {
            this.validateRejectionReason(rejectionReason);
        }

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
