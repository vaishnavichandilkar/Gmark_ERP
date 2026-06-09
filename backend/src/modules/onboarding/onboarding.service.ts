import { Injectable, BadRequestException, UnauthorizedException, ConflictException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { Step1LanguageDto, Step2MobileDto, Step3VerifyDto, Step4DetailsDto, Step5BusinessDto, Step6ShopDto } from './dto/onboarding.dto';

import { SmsService } from '../otp/sms.service';

@Injectable()
export class OnboardingService {
    constructor(
        private prisma: PrismaService,
        private jwtService: JwtService,
        private configService: ConfigService,
        private smsService: SmsService,
    ) { }

    async getPincodeInfo(pincode: string) {
        // Step 1: Check Local DB first
        const localData = await this.prisma.pincode.findUnique({
            where: { pincode },
            select: { pincode: true, state: true, district: true, areas: true, country: true, isActive: true }
        });

        if (localData) {
            return localData;
        }

        // Step 2: If NOT found, fetch from API
        try {
            const response = await fetch(`https://api.postalpincode.in/pincode/${pincode}`);
            const data = await response.json();

            if (data && data[0] && data[0].Status === 'Success' && data[0].PostOffice && data[0].PostOffice.length > 0) {
                const first = data[0].PostOffice[0];
                // Extract Name from each object and collect into a unique list
                const allAreas: string[] = [...new Set(data[0].PostOffice.map((po: any) => String(po.Name)))] as string[];

                // Step 3: Save to DB for next time
                const saved = await this.prisma.pincode.upsert({
                    where: { pincode },
                    update: {
                        state: first.State,
                        district: first.District,
                        country: first.Country || 'India',
                        areas: allAreas,
                        isActive: true
                    },
                    create: {
                        pincode,
                        state: first.State,
                        district: first.District,
                        country: first.Country || 'India',
                        areas: allAreas,
                        isActive: true
                    }
                });

                return saved;
            }
        } catch (error) {
            console.error('Pincode fetch error:', error);
        }

        return null;
    }

    async getLanguages() {
        return this.prisma.language.findMany({
            where: { isActive: true },
            select: { id: true, name: true, code: true }
        });
    }

    async saveLanguage(dto: Step1LanguageDto) {
        const language = await this.prisma.language.findFirst({
            where: { name: dto.language, isActive: true }
        });

        if (!language) {
            throw new BadRequestException('Invalid or inactive language selected');
        }

        // Step 1: Create a temporary user record to store the selection
        // This acts as a session for the onboarding flow
        let user;
        if (dto.userId) {
            user = await this.prisma.user.update({
                where: { id: dto.userId },
                data: { selected_language: dto.language }
            });
        } else {
            user = await this.prisma.user.create({
                data: {
                    selected_language: dto.language,
                    role: 'seller', // Default to seller for onboarding
                    verified: false
                }
            });
        }

        return {
            message: `Language '${dto.language}' selected`,
            userId: user.id,
            selectedLanguage: dto.language
        };
    }

    async registerMobile(dto: Step2MobileDto) {
        let targetUserId: number;
        let currentLanguage = dto.selectedLanguage || 'Hindi';

        // 1. If userId is provided, sync with the temporary session
        if (dto.userId) {
            const tempUser = await this.prisma.user.findUnique({
                where: { id: dto.userId }
            });
            if (tempUser) {
                currentLanguage = tempUser.selected_language || currentLanguage;
            }
        }

        // 2. Check if phone exists in user table
        const existingUser = await this.prisma.user.findUnique({
            where: { phone: dto.phone }
        });

        if (existingUser) {
            // Requirement 2: If phone exists
            if (existingUser.verified && existingUser.onboarded_at) {
                throw new ConflictException('Phone number already registered and account is active');
            } else {
                // Update existing user with language
                await this.prisma.user.update({
                    where: { id: existingUser.id },
                    data: { selected_language: currentLanguage }
                });

                // Cleanup temporary session if different
                if (dto.userId && dto.userId !== existingUser.id) {
                    try {
                        await this.prisma.user.delete({ where: { id: dto.userId } });
                    } catch (e) {
                        // Ignore if already deleted
                    }
                }
                targetUserId = existingUser.id;
            }
        } else {
            // Requirement 3: If phone does not exist
            if (dto.userId) {
                // Update existing session user
                await this.prisma.user.update({
                    where: { id: dto.userId },
                    data: {
                        phone: dto.phone,
                        selected_language: currentLanguage,
                        verified: false
                    }
                });
                targetUserId = dto.userId;
            } else {
                // Create new user for the first time
                const newUser = await this.prisma.user.create({
                    data: {
                        phone: dto.phone,
                        selected_language: currentLanguage,
                        verified: false,
                        role: 'seller'
                    }
                });
                targetUserId = newUser.id;
            }
        }

        // 3. Send OTP
        await this.smsService.sendOtp(dto.phone);

        return {
            message: 'OTP sent successfully',
            phone: dto.phone,
            userId: targetUserId
        };
    }

    async verifyOtp(dto: Step3VerifyDto) {
        // 1. Verify OTP using SmsService
        const isValid = await this.smsService.verifyOtp(dto.phone, dto.otp);
        if (!isValid) {
            throw new BadRequestException('Invalid or expired OTP');
        }

        // 2. Find the user by phone (should exist now as we saved it in registerMobile)
        const user = await this.prisma.user.findUnique({
            where: { phone: dto.phone }
        });

        if (!user) {
            throw new BadRequestException('User record not found');
        }

        // 3. Update the same row: verified = true
        const updatedUser = await this.prisma.user.update({
            where: { id: user.id },
            data: { verified: true }
        });

        // 4. Cleanup the verified OTP record
        await this.smsService.deleteOtp(dto.phone);

        // 5. Check if user is already an approved seller
        const existingProfile = await this.prisma.sellerProfile.findUnique({
            where: { userId: user.id }
        });

        if (existingProfile && existingProfile.status === 'APPROVED') {
            return {
                message: 'Seller already registered. Please login.',
                isApproved: true,
                status: 'APPROVED'
            };
        }

        let sessionId: number;
        let currentStep: number;

        if (existingProfile) {
            sessionId = existingProfile.sessionId;
            currentStep = existingProfile.currentStep;
        } else {
            // Create a new SellerProfile
            const newProfile = await this.prisma.sellerProfile.create({
                data: {
                    userId: user.id,
                    currentStep: 3, // Current step is 3 (OTP verified). Next is 4.
                    status: 'IN_PROGRESS',
                    sessionId: Math.floor(Math.random() * 2000000000) // Explicitly generate ID to bypass constraint violation
                }
            });
            sessionId = newProfile.sessionId;
            currentStep = newProfile.currentStep;
        }

        // 6. Generate temporary token for the flow
        const tokens = await this.generateOnboardingTokens(updatedUser);

        return {
            message: 'OTP verified successfully.',
            ...tokens,
            sessionId,
            currentStep
        };
    }

    private async validateAndAdvanceStep(userId: number, currentStepNumber: number, nextStepNumber: number, stepData: any) {
        const profile = await this.prisma.sellerProfile.findUnique({ where: { userId } });
        if (!profile) throw new BadRequestException('Seller profile not found');

        // Prevent skipping steps
        if (profile.currentStep < (currentStepNumber - 1)) {
            throw new BadRequestException(`Cannot skip steps. Complete step ${profile.currentStep + 1} first.`);
        }

        // Only advance currentStep if they are doing their max pending step
        const advanceTo = Math.max(profile.currentStep, nextStepNumber);

        await this.prisma.sellerProfile.update({
            where: { id: profile.id },
            data: { currentStep: advanceTo }
        });

        const stepReview = await this.prisma.sellerStepReview.findUnique({
            where: {
                sellerProfileId_step: {
                    sellerProfileId: profile.id,
                    step: currentStepNumber
                }
            }
        });

        if (stepReview) {
            await this.prisma.sellerStepReview.update({
                where: { id: stepReview.id },
                data: {
                    status: 'COMPLETED',
                    data: stepData || {}
                }
            });
        } else {
            await this.prisma.sellerStepReview.create({
                data: {
                    sellerProfileId: profile.id,
                    step: currentStepNumber,
                    status: 'COMPLETED',
                    data: stepData || {}
                }
            });
        }

        return advanceTo;
    }

    async updatePersonalDetails(userId: number, dto: Step4DetailsDto) {
        const email = dto.email.trim();

        // Check for email uniqueness before updating
        const existingWithEmail = await this.prisma.user.findFirst({
            where: {
                email: email,
                id: { not: userId }
            }
        });

        if (existingWithEmail) {
            throw new BadRequestException(`Email '${email}' is already in use by another account.`);
        }

        await this.validateAndAdvanceStep(userId, 4, 4, { ...dto, email });

        return this.prisma.user.update({
            where: { id: userId },
            data: {
                first_name: dto.first_name,
                last_name: dto.last_name,
                email: email,
            }
        });
    }

    async saveBusinessDetails(userId: number, dto: Step5BusinessDto, files: any) {
        // Save Udyog Aadhar Number as document entry
        if (dto.udyogAadharNumber) {
            await this.saveDocument(userId, 'OTHER', `${dto.udyogAadharNumber}`, 'UDYOG_AADHAR');
        }

        // Save Udyog Aadhar Certificate
        if (files?.udyogAadharCertificate?.[0]) {
            await this.saveFile(userId, 'OTHER', files.udyogAadharCertificate[0], 'UDYOG_AADHAR_CERT');
        }

        // Save GST Number
        if (dto.gstNumber) {
            await this.saveDocument(userId, 'GST', `${dto.gstNumber}`, 'GST_NUMBER');
        }

        // Save GST Certificate
        if (files?.gstCertificate?.[0]) {
            await this.saveFile(userId, 'GST', files.gstCertificate[0], 'GST_CERTIFICATE');
        }

        // Save Proof of Business (Optional)
        if (files?.businessProof?.[0]) {
            await this.saveFile(userId, 'OTHER', files.businessProof[0], 'BUSINESS_PROOF');
        }

        // Save regType on User model
        if (dto.regType) {
            await this.prisma.user.update({
                where: { id: userId },
                data: { regType: dto.regType }
            });
        }

        await this.validateAndAdvanceStep(userId, 6, 6, dto);

        return { message: 'Business details saved successfully' };
    }

    async saveShopDetails(userId: number, dto: Step6ShopDto, files: any) {
        // Validate Pincode and get State and District
        // Automatically save/update the pincode in our local database
        const pincodeRecord = await this.prisma.pincode.upsert({
            where: { pincode: dto.pinCode },
            update: {
                state: dto.state,
                district: dto.district,
                isActive: true
            },
            create: {
                pincode: dto.pinCode,
                state: dto.state,
                district: dto.district,
                isActive: true
            }
        });

        const state = dto.state;
        const district = dto.district;

        if (!state || !district) {
            throw new BadRequestException('Invalid pincode. State and District not found.');
        }

        if (pincodeRecord && !pincodeRecord.isActive) {
            throw new BadRequestException('Service is not active for this pincode yet.');
        }

        // Use the new ShopDetail model
        const shopDetail = await this.prisma.shopDetail.upsert({
            where: { userId },
            update: {
                shopName: dto.shopName,
                address: dto.address,
                village: dto.village,
                pinCode: dto.pinCode,
                state: dto.state || state,
                district: dto.district || district,
            },
            create: {
                userId,
                shopName: dto.shopName,
                address: dto.address,
                village: dto.village,
                pinCode: dto.pinCode,
                state: dto.state || state,
                district: dto.district || district,
            }
        });

        // Save Shop Act License
        if (files?.shopActLicense?.[0]) {
            await this.saveFile(userId, 'OTHER', files.shopActLicense[0], 'SHOP_ACT_LICENSE');
        }

        await this.prisma.sellerProfile.update({
            where: { userId },
            data: { addressId: shopDetail.id }
        });

        await this.validateAndAdvanceStep(userId, 5, 5, dto);

        return { message: 'Shop details saved successfully' };
    }
    async getCurrentData(userId: number) {
        const user = await this.prisma.user.findUnique({
            where: { id: userId },
            include: {
                shopDetail: true,
                sellerDocuments: true
            }
        });

        if (!user) throw new NotFoundException('User not found');

        const udyogAadharDoc = user.sellerDocuments.find(d => d.category === 'UDYOG_AADHAR');
        const gstNumberDoc = user.sellerDocuments.find(d => d.type === 'GST' && d.url === 'N/A');

        const udyogAadharCert = user.sellerDocuments.find(d => d.category === 'UDYOG_AADHAR_CERT');
        const gstCert = user.sellerDocuments.find(d => d.type === 'GST' && d.url !== 'N/A');
        const shopActLicense = user.sellerDocuments.find(d => d.category === 'SHOP_ACT_LICENSE');
        const businessProof = user.sellerDocuments.find(d => d.category === 'BUSINESS_PROOF');

        return {
            firstName: user.first_name || '',
            lastName: user.last_name || '',
            email: user.email || '',
            phone: user.phone || '',
            shopName: user.shopDetail?.shopName || '',
            address: user.shopDetail?.address || '',
            village: user.shopDetail?.village || '',
            pinCode: user.shopDetail?.pinCode || '',
            district: user.shopDetail?.district || '',
            state: user.shopDetail?.state || '',
            udyogAadhar: udyogAadharDoc?.name || '',
            gstNumber: gstNumberDoc?.name || '',
            udyogAadharFile: udyogAadharCert ? { name: udyogAadharCert.name, url: udyogAadharCert.url } : null,
            gstFile: gstCert ? { name: gstCert.name, url: gstCert.url } : null,
            shopActLicense: shopActLicense ? { name: shopActLicense.name, url: shopActLicense.url } : null,
            businessProof: businessProof ? { name: businessProof.name, url: businessProof.url } : null,
            regType: user.regType || '',
            rejectionReason: user.rejectionReason,
            approvalStatus: user.approvalStatus
        };
    }

    async completeOnboarding(userId: number) {
        await this.prisma.user.update({
            where: { id: userId },
            data: {
                onboarded_at: new Date(),
                approvalStatus: 'PENDING',
                isApproved: false,
                rejectionReason: null
            }
        });

        // Step 7 is completion
        await this.validateAndAdvanceStep(userId, 7, 7, { isCompleted: true });

        await this.prisma.sellerProfile.update({
            where: { userId },
            data: {
                status: 'PENDING_APPROVAL',
                sellerId: userId, // Set sellerId
                rejectionReason: null
            }
        });

        return {
            message: 'Onboarding complete. Your account is pending Superadmin approval.',
            status: 'PENDING_APPROVAL'
        };
    }

    // Helper functions
    private async saveFile(userId: number, type: any, file: any, category?: string) {
        const sellerProfile = await this.prisma.sellerProfile.findUnique({ where: { userId } });
        // Clean up any existing document of this type and category to prevent duplicates
        await this.prisma.sellerDocument.deleteMany({
            where: {
                uploadedByUserId: userId,
                type,
                category: category || null
            }
        });
        return this.prisma.sellerDocument.create({
            data: {
                profileId: sellerProfile?.id || null,
                uploadedByUserId: userId,
                type,
                url: file.path,
                name: file.originalname,
                size: BigInt(file.size),
                category: category || null,
            }
        });
    }

    private async saveDocument(userId: number, type: any, name: string, category?: string) {
        const sellerProfile = await this.prisma.sellerProfile.findUnique({ where: { userId } });
        // Clean up any existing text document of this type and category
        await this.prisma.sellerDocument.deleteMany({
            where: {
                uploadedByUserId: userId,
                type,
                category: category || null,
                url: 'N/A'
            }
        });
        return this.prisma.sellerDocument.create({
            data: {
                profileId: sellerProfile?.id || null,
                uploadedByUserId: userId,
                type,
                url: 'N/A', // Just storing the number/text as a doc entry for now
                name: name !== undefined ? String(name) : undefined,
                size: BigInt(0),
                category: category || null,
            }
        });
    }

    private async generateOnboardingTokens(user: any) {
        const jti = crypto.randomUUID();
        const payload = { sub: user.id, phone: user.phone, role: user.role, jti };

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

        // 2. Store Session
        await this.prisma.session.create({
            data: {
                userId: user.id,
                userType: user.role.toUpperCase(),
                jti: jti,
                refreshTokenHash: await bcrypt.hash(refreshToken, 10),
                expiresAt: expiresAt,
            }
        });

        // 3. Save Refresh Token in User Table
        await this.prisma.user.update({
            where: { id: user.id },
            data: { refresh_token: refreshToken }
        });

        return {
            accessToken,
            refreshToken,
            user: {
                id: user.id,
                phone: user.phone,
                role: user.role,
            }
        };
    }

    async resendOtp(phone: string) {
        return this.smsService.resendOtp(phone);
    }
}
