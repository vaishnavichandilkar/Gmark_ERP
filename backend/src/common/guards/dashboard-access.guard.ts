import { Injectable, CanActivate, ExecutionContext, ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

@Injectable()
export class DashboardAccessGuard implements CanActivate {
    constructor(private reflector: Reflector) { }

    canActivate(context: ExecutionContext): boolean {
        const req = context.switchToHttp().getRequest();
        const user = req?.user;

        if (!user) {
            throw new UnauthorizedException('Authentication required');
        }

        const role = (user.role || '').toUpperCase();

        // 1. Superadmin has full bypass access
        if (role === 'SUPERADMIN') {
            return true;
        }

        // 2. Reject roles that do not have ERP dashboard access (e.g. BUYER)
        const allowedRoles = ['SELLER', 'ADMINISTRATOR', 'OPERATOR', 'ADMIN'];
        if (!allowedRoles.includes(role)) {
            throw new ForbiddenException(`Role ${role} is not authorized to access dashboard`);
        }

        // 3. Check Account Approval Status
        const isApproved = user.isApproved === true || user.approvalStatus === 'APPROVED';
        if (!isApproved) {
            throw new ForbiddenException('Account pending approval');
        }

        // 4. Check Business Profile Completion (onboarded or shopDetail present)
        const isProfileComplete = user.onboarded === true || !!user.shopDetail;
        if (!isProfileComplete) {
            throw new ForbiddenException('Business profile completion required');
        }

        return true;
    }
}

