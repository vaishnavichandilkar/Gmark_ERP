import { Injectable, BadRequestException, NotFoundException, ForbiddenException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { CreateUserDto, UpdateUserDto, ResetPasswordDto } from './dto/user-management.dto';
import * as bcrypt from 'bcrypt';

@Injectable()
export class UserManagementService {
    constructor(private prisma: PrismaService) { }

    async createUser(adminId: number, dto: CreateUserDto) {
        // Validate admin account
        const adminUser = await this.prisma.user.findUnique({ where: { id: adminId } });
        if (!adminUser) {
            throw new NotFoundException('Admin user not found');
        }

        // Prevent assigning Super Admin role
        const targetRole = (dto.role || 'USER').toUpperCase();
        if (targetRole === 'SUPERADMIN') {
            throw new ForbiddenException('Cannot assign SUPERADMIN role');
        }

        // Check duplicate email or phone or username
        if (dto.phone) {
            const existingPhone = await this.prisma.user.findUnique({ where: { phone: dto.phone } });
            if (existingPhone) throw new ConflictException('Phone number already registered');
        }
        if (dto.email) {
            const existingEmail = await this.prisma.user.findUnique({ where: { email: dto.email } });
            if (existingEmail) throw new ConflictException('Email address already registered');
        }
        if (dto.username) {
            const existingUser = await this.prisma.user.findUnique({ where: { username: dto.username } });
            if (existingUser) throw new ConflictException('Username already taken');
        }

        const [firstName, ...lastNameParts] = dto.name.split(' ');
        const lastName = lastNameParts.join(' ');
        const passwordHash = dto.password ? await bcrypt.hash(dto.password, 10) : null;

        const newUser = await this.prisma.user.create({
            data: {
                first_name: firstName,
                last_name: lastName,
                email: dto.email || null,
                phone: dto.phone || null,
                username: dto.username || dto.email || dto.phone,
                role: 'operator',
                adminId: adminId,
                status: 'ACTIVE',
                approvalStatus: 'APPROVED',
                isApproved: true,
                passwordHash: passwordHash,
                permissions: dto.permissions || {},
            }
        });

        // Also create UserProfile if phone exists
        if (dto.phone) {
            await this.prisma.userProfile.upsert({
                where: { phone_number: dto.phone },
                update: { name: dto.name, email: dto.email },
                create: { phone_number: dto.phone, name: dto.name, email: dto.email }
            });
        }

        return {
            id: newUser.id,
            name: dto.name,
            email: newUser.email,
            phone: newUser.phone,
            username: newUser.username,
            role: 'USER',
            status: newUser.status,
            createdAt: newUser.created_at,
        };
    }

    async getUsersForAdmin(adminId: number) {
        const users = await this.prisma.user.findMany({
            where: {
                adminId: adminId,
                deleted_at: null,
            },
            orderBy: { created_at: 'desc' },
            select: {
                id: true,
                first_name: true,
                last_name: true,
                email: true,
                phone: true,
                username: true,
                role: true,
                status: true,
                permissions: true,
                created_at: true,
                updated_at: true,
            }
        });

        return users.map(u => ({
            id: u.id,
            name: `${u.first_name || ''} ${u.last_name || ''}`.trim() || u.username || u.phone || 'User',
            email: u.email,
            phone: u.phone,
            username: u.username,
            role: 'USER',
            status: u.status,
            permissions: u.permissions,
            createdAt: u.created_at,
            updatedAt: u.updated_at,
        }));
    }

    async getUserDetails(adminId: number, userId: number) {
        const user = await this.prisma.user.findFirst({
            where: { id: userId, adminId: adminId, deleted_at: null }
        });
        if (!user) throw new NotFoundException('User not found or does not belong to this admin');

        return {
            id: user.id,
            name: `${user.first_name || ''} ${user.last_name || ''}`.trim() || user.username,
            email: user.email,
            phone: user.phone,
            username: user.username,
            role: 'USER',
            status: user.status,
            permissions: user.permissions,
            createdAt: user.created_at,
        };
    }

    async updateUser(adminId: number, userId: number, dto: UpdateUserDto) {
        const user = await this.prisma.user.findFirst({
            where: { id: userId, adminId: adminId, deleted_at: null }
        });
        if (!user) throw new NotFoundException('User not found or unauthorized');

        const [firstName, ...lastNameParts] = (dto.name || `${user.first_name || ''} ${user.last_name || ''}`).split(' ');

        await this.prisma.user.update({
            where: { id: userId },
            data: {
                first_name: firstName,
                last_name: lastNameParts.join(' '),
                email: dto.email !== undefined ? dto.email : user.email,
                phone: dto.phone !== undefined ? dto.phone : user.phone,
                permissions: dto.permissions !== undefined ? dto.permissions : user.permissions,
            }
        });

        return { message: 'User updated successfully' };
    }

    async setStatus(adminId: number, userId: number, status: 'ACTIVE' | 'INACTIVE') {
        const user = await this.prisma.user.findFirst({
            where: { id: userId, adminId: adminId, deleted_at: null }
        });
        if (!user) throw new NotFoundException('User not found or unauthorized');

        await this.prisma.user.update({
            where: { id: userId },
            data: { status: status }
        });

        return { message: `User status changed to ${status}` };
    }

    async resetPassword(adminId: number, userId: number, dto: ResetPasswordDto) {
        const user = await this.prisma.user.findFirst({
            where: { id: userId, adminId: adminId, deleted_at: null }
        });
        if (!user) throw new NotFoundException('User not found or unauthorized');

        const passwordHash = await bcrypt.hash(dto.newPassword, 10);
        await this.prisma.user.update({
            where: { id: userId },
            data: { passwordHash }
        });

        return { message: 'Password reset successfully' };
    }

    async deleteUser(adminId: number, userId: number) {
        const user = await this.prisma.user.findFirst({
            where: { id: userId, adminId: adminId, deleted_at: null }
        });
        if (!user) throw new NotFoundException('User not found or unauthorized');

        await this.prisma.user.update({
            where: { id: userId },
            data: { deleted_at: new Date(), status: 'INACTIVE' }
        });

        return { message: 'User deleted successfully' };
    }
}
