import { ExecutionContext, ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { DashboardAccessGuard } from '../src/common/guards/dashboard-access.guard';

function createMockContext(user: any): ExecutionContext {
    return {
        switchToHttp: () => ({
            getRequest: () => ({ user }),
            getResponse: () => ({}),
            getNext: () => ({}),
        }),
        getHandler: () => ({}),
        getClass: () => ({}),
    } as unknown as ExecutionContext;
}

async function runDashboardGuardTests() {
    console.log('=== TEST SUITE: Finding 7.B - DashboardAccessGuard RBAC Harmonization ===\n');
    const reflector = new Reflector();
    const guard = new DashboardAccessGuard(reflector);

    let passed = 0;
    let failed = 0;

    function assert(condition: boolean, testName: string, detail?: string) {
        if (condition) {
            console.log(`[PASS] ${testName}`);
            passed++;
        } else {
            console.error(`[FAIL] ${testName} - ${detail || ''}`);
            failed++;
        }
    }

    // Test 1: Unauthenticated user throws UnauthorizedException
    try {
        const ctx = createMockContext(null);
        guard.canActivate(ctx);
        assert(false, 'Test 1: Unauthenticated request should throw UnauthorizedException');
    } catch (e: any) {
        assert(e instanceof UnauthorizedException, 'Test 1: Unauthenticated request throws UnauthorizedException', e.message);
    }

    // Test 2: SUPERADMIN bypasses all checks
    try {
        const ctx = createMockContext({
            id: 1,
            role: 'SUPERADMIN',
            isApproved: false,
            onboarded: false,
        });
        const res = guard.canActivate(ctx);
        assert(res === true, 'Test 2: SUPERADMIN bypasses all profile and approval checks');
    } catch (e: any) {
        assert(false, 'Test 2: SUPERADMIN threw unexpected error', e.message);
    }

    // Test 3: SELLER with approved status and onboarded profile is permitted
    try {
        const ctx = createMockContext({
            id: 2,
            role: 'SELLER',
            isApproved: true,
            approvalStatus: 'APPROVED',
            onboarded: true,
        });
        const res = guard.canActivate(ctx);
        assert(res === true, 'Test 3: Approved & onboarded SELLER is permitted access');
    } catch (e: any) {
        assert(false, 'Test 3: SELLER threw unexpected error', e.message);
    }

    // Test 4: SELLER with shopDetail is permitted access even if onboarded flag is unset
    try {
        const ctx = createMockContext({
            id: 3,
            role: 'seller',
            isApproved: true,
            onboarded: false,
            shopDetail: { shopName: 'My Enterprise Store' },
        });
        const res = guard.canActivate(ctx);
        assert(res === true, 'Test 4: Case-insensitive SELLER with shopDetail is permitted access');
    } catch (e: any) {
        assert(false, 'Test 4: SELLER with shopDetail threw unexpected error', e.message);
    }

    // Test 5: SELLER pending approval is denied
    try {
        const ctx = createMockContext({
            id: 4,
            role: 'SELLER',
            isApproved: false,
            approvalStatus: 'PENDING',
            onboarded: true,
        });
        guard.canActivate(ctx);
        assert(false, 'Test 5: Unapproved SELLER should be denied');
    } catch (e: any) {
        assert(e instanceof ForbiddenException && e.message.includes('approval'),
            'Test 5: Unapproved SELLER throws ForbiddenException with approval message', e.message);
    }

    // Test 6: SELLER without business profile completion is denied
    try {
        const ctx = createMockContext({
            id: 5,
            role: 'SELLER',
            isApproved: true,
            approvalStatus: 'APPROVED',
            onboarded: false,
            shopDetail: null,
        });
        guard.canActivate(ctx);
        assert(false, 'Test 6: Incomplete profile SELLER should be denied');
    } catch (e: any) {
        assert(e instanceof ForbiddenException && e.message.includes('profile completion'),
            'Test 6: Incomplete profile SELLER throws ForbiddenException with profile completion message', e.message);
    }

    // Test 7: BUYER role is denied dashboard access
    try {
        const ctx = createMockContext({
            id: 6,
            role: 'BUYER',
            isApproved: true,
            onboarded: true,
        });
        guard.canActivate(ctx);
        assert(false, 'Test 7: BUYER role should be denied dashboard access');
    } catch (e: any) {
        assert(e instanceof ForbiddenException && e.message.includes('not authorized'),
            'Test 7: BUYER role throws ForbiddenException', e.message);
    }

    // Test 8: ADMINISTRATOR and OPERATOR roles are allowed when approved and onboarded
    try {
        const ctxAdmin = createMockContext({
            id: 7,
            role: 'ADMINISTRATOR',
            isApproved: true,
            onboarded: true,
        });
        const ctxOp = createMockContext({
            id: 8,
            role: 'OPERATOR',
            isApproved: true,
            onboarded: true,
        });
        const resAdmin = guard.canActivate(ctxAdmin);
        const resOp = guard.canActivate(ctxOp);
        assert(resAdmin === true && resOp === true, 'Test 8: Approved ADMINISTRATOR and OPERATOR are permitted access');
    } catch (e: any) {
        assert(false, 'Test 8: ADMINISTRATOR/OPERATOR threw error', e.message);
    }

    console.log(`\n========================================`);
    console.log(`RESULTS: ${passed} PASSED, ${failed} FAILED`);
    console.log(`========================================\n`);

    if (failed > 0) {
        process.exit(1);
    }
}

runDashboardGuardTests();
