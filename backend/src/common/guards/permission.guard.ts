import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { REQUIRE_PERMISSION_KEY } from '../decorators/require-permission.decorator';

@Injectable()
export class PermissionGuard implements CanActivate {
    constructor(private reflector: Reflector) { }

    canActivate(context: ExecutionContext): boolean {
        const requiredPermission = this.reflector.getAllAndOverride<string>(REQUIRE_PERMISSION_KEY, [
            context.getHandler(),
            context.getClass(),
        ]);

        if (!requiredPermission) {
            return true;
        }

        const { user } = context.switchToHttp().getRequest();

        if (!user) {
            console.log('PermissionGuard: No user found in request');
            return false;
        }

        if (user.role === 'SUPERADMIN' || user.role === 'ADMIN' || user.role === 'SELLER' || user.rawRole === 'SELLER' || user.rawRole === 'SUPERADMIN' || user.rawRole === 'ADMIN') {
            return true;
        }

        // 2. Map Legacy Keys to Module + Action
        const { moduleName, action } = this.mapLegacyPermission(requiredPermission);

        if (!moduleName || !action) {
            console.log(`PermissionGuard: Could not map permission ${requiredPermission}`);
            return false;
        }

        // 3. Check Permissions Map (Case-Insensitive module match)
        if (user.permissions && typeof user.permissions === 'object') {
            const key = Object.keys(user.permissions).find(k => k.toLowerCase() === moduleName.toLowerCase());
            if (key && user.permissions[key] && user.permissions[key][action]) {
                return true;
            }
        }

        throw new ForbiddenException(`You do not have permission: ${requiredPermission} -> ${moduleName}.${action}`);
    }

    private mapLegacyPermission(perm: string): { moduleName: string, action: string } {
        // Pattern: [module]_[action] (e.g., reports_view)
        const parts = perm.split('_');
        if (parts.length < 2) return { moduleName: '', action: '' };

        const legacyModule = parts[0].toLowerCase();
        const legacyAction = parts[1].toLowerCase();

        let moduleName = '';
        if (legacyModule === 'dashboard') moduleName = 'Dashboard';
        else if (legacyModule === 'reports') moduleName = 'Reports';
        else if (legacyModule === 'masters') moduleName = 'Masters';
        else if (legacyModule === 'purchase') moduleName = 'Purchase';
        else if (legacyModule === 'sales') moduleName = 'Sales';
        else if (legacyModule === 'settings') moduleName = 'Settings';
        else return { moduleName: '', action: '' };

        let action = '';
        if (legacyAction === 'add' || legacyAction === 'create') action = 'canCreate';
        else if (legacyAction === 'view' || legacyAction === 'list') action = 'canView';
        else if (legacyAction === 'edit' || legacyAction === 'update') action = 'canUpdate';
        else if (legacyAction === 'delete') action = 'canDelete';
        else action = 'canView'; // Default fallback

        return { moduleName, action };
    }
}

