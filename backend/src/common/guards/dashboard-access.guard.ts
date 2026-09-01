import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

@Injectable()
export class DashboardAccessGuard implements CanActivate {
    constructor(private reflector: Reflector) { }

    canActivate(context: ExecutionContext): boolean {
        const { user } = context.switchToHttp().getRequest();

        if (!user) {
            return false;
        }

        // Only enforce for ADMIN (Business/System)
        // System Admin bypasses because seed sets true.
        // Business Admin starts false.

        if (user.role === 'ADMIN' || user.role === 'SELLER') {
            if (user.approvalStatus !== 'APPROVED') {
                throw new ForbiddenException('Account pending or not approved by Super Admin');
            }
            if (user.status === 'INACTIVE') {
                throw new ForbiddenException('Account is inactive');
            }
        }

        return true;
    }
}
