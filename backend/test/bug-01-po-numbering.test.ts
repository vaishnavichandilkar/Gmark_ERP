import { PurchaseOrderService } from '../src/modules/Purchase/purchase-order/purchase-order.service';

/**
 * Automated Test Suite for BUG-01: Purchase Order Numbering & Concurrency Remediation
 * Verifies numeric sequence extraction, boundary crossing (PO-999 -> PO-1000, PO-9999 -> PO-10000),
 * tenant isolation, and atomic creation.
 */
async function runTests() {
  console.log('--- Starting BUG-01 Purchase Order Numbering Tests ---');
  let passedCount = 0;
  let totalCount = 0;

  function assert(condition: boolean, testName: string) {
    totalCount++;
    if (condition) {
      console.log(`[PASS] ${testName}`);
      passedCount++;
    } else {
      console.error(`[FAIL] ${testName}`);
      process.exitCode = 1;
    }
  }

  // TEST 1: Boundary value sequence progression (PO-999 -> PO-1000)
  try {
    const mockPrisma: any = {
      purchaseOrder: {
        findMany: async ({ where }: any) => {
          if (where.userId === 10) {
            return [
              { poNumber: 'PO-0001' },
              { poNumber: 'PO-0500' },
              { poNumber: 'PO-999' }, // Unpadded 3-digit number
            ];
          }
          return [];
        },
      },
      $queryRaw: async () => [{ max_num: 999 }],
    };
    const mockValidator: any = {};
    const service = new PurchaseOrderService(mockPrisma, mockValidator);

    const nextNumber = await service.getNextNumber(10);
    assert(nextNumber === 'PO-1000', `Next number after PO-999 is PO-1000 (actual: ${nextNumber})`);
  } catch (err: any) {
    assert(false, `Test 1 failed: ${err.message}`);
  }

  // TEST 2: 5-digit boundary value sequence progression (PO-9999 -> PO-10000)
  try {
    const mockPrisma: any = {
      purchaseOrder: {
        findMany: async ({ where }: any) => {
          if (where.userId === 10) {
            return [
              { poNumber: 'PO-0001' },
              { poNumber: 'PO-9999' },
            ];
          }
          return [];
        },
      },
      $queryRaw: async () => [{ max_num: 9999 }],
    };
    const mockValidator: any = {};
    const service = new PurchaseOrderService(mockPrisma, mockValidator);

    const nextNumber = await service.getNextNumber(10);
    assert(nextNumber === 'PO-10000', `Next number after PO-9999 is PO-10000 (actual: ${nextNumber})`);
  } catch (err: any) {
    assert(false, `Test 2 failed: ${err.message}`);
  }

  // TEST 3: Beyond 10000 (PO-10000 -> PO-10001) where lexical sorting used to fail
  try {
    const mockPrisma: any = {
      purchaseOrder: {
        findMany: async ({ where }: any) => {
          if (where.userId === 10) {
            return [
              { poNumber: 'PO-9999' },
              { poNumber: 'PO-10000' },
            ];
          }
          return [];
        },
      },
      $queryRaw: async () => [{ max_num: 10000 }],
    };
    const mockValidator: any = {};
    const service = new PurchaseOrderService(mockPrisma, mockValidator);

    const nextNumber = await service.getNextNumber(10);
    assert(nextNumber === 'PO-10001', `Next number after PO-10000 is PO-10001 (actual: ${nextNumber})`);
  } catch (err: any) {
    assert(false, `Test 3 failed: ${err.message}`);
  }

  // TEST 4: Fallback calculation handles disordered and arbitrary length strings
  try {
    const mockPrisma: any = {
      purchaseOrder: {
        findMany: async ({ where }: any) => {
          return [
            { poNumber: 'PO-0042' },
            { poNumber: 'PO-5' },
            { poNumber: 'PO-1200' },
            { poNumber: 'PO-015' },
          ];
        },
      },
      // Force fallback by making $queryRaw throw
      $queryRaw: async () => {
        throw new Error('Raw query not available in fallback mode');
      },
    };
    const mockValidator: any = {};
    const service = new PurchaseOrderService(mockPrisma, mockValidator);

    const nextNumber = await service.getNextNumber(10);
    assert(nextNumber === 'PO-1201', `Fallback numerically finds max 1200 and yields PO-1201 (actual: ${nextNumber})`);
  } catch (err: any) {
    assert(false, `Test 4 failed: ${err.message}`);
  }

  // TEST 5: Tenant isolation: Separate tenants maintain independent sequences
  try {
    const mockPrisma: any = {
      purchaseOrder: {
        findMany: async ({ where }: any) => {
          if (where.userId === 1) return [{ poNumber: 'PO-0050' }];
          if (where.userId === 2) return [{ poNumber: 'PO-0002' }];
          return [];
        },
      },
      $queryRaw: async (query: any, ...params: any[]) => {
        // Mock query raw checking userId
        throw new Error('Fallback to findMany');
      },
    };
    const mockValidator: any = {};
    const service = new PurchaseOrderService(mockPrisma, mockValidator);

    const tenant1Next = await service.getNextNumber(1);
    const tenant2Next = await service.getNextNumber(2);
    const tenant3Next = await service.getNextNumber(3); // Empty tenant

    assert(tenant1Next === 'PO-0051', `Tenant 1 receives PO-0051 (actual: ${tenant1Next})`);
    assert(tenant2Next === 'PO-0003', `Tenant 2 receives PO-0003 (actual: ${tenant2Next})`);
    assert(tenant3Next === 'PO-0001', `New Tenant 3 starts at PO-0001 (actual: ${tenant3Next})`);
  } catch (err: any) {
    assert(false, `Test 5 failed: ${err.message}`);
  }

  // TEST 6: Atomic transaction with advisory lock and P2002 collision protection
  try {
    let advisoryLockAcquired: any = false;
    let createdRecord: any = null;

    const mockPrisma: any = {
      accountMaster: {
        findFirst: async () => ({ id: 10, accountName: 'Steel Corp', gstNo: '27AABCU9603R1ZM' }),
      },
      $transaction: async (cb: any) => {
        const tx: any = {
          $executeRaw: async (q: any) => {
            advisoryLockAcquired = true;
          },
          $queryRaw: async () => [{ max_num: 77 }],
          purchaseOrder: {
            create: async ({ data }: any) => {
              createdRecord = data;
              return { id: 1, ...data };
            },
          },
        };
        return cb(tx);
      },
    };
    const mockValidator: any = {};
    const service = new PurchaseOrderService(mockPrisma, mockValidator);

    const result = await service.create(
      {
        supplierId: 10,
        address: 'Plot 4, Industrial Area',
        items: [],
        creditDays: 30,
        expiryDate: new Date().toISOString(),
      } as any,
      1
    );

    assert(advisoryLockAcquired === true, 'Tenant-scoped transaction advisory lock was acquired');
    assert(result.poNumber === 'PO-0078', `Generated sequence PO-0078 in transaction (actual: ${result.poNumber})`);
  } catch (err: any) {
    assert(false, `Test 6 failed: ${err.message}`);
  }

  console.log(`\nBUG-01 Test Summary: ${passedCount}/${totalCount} tests passed.`);
  if (passedCount !== totalCount) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error('Test execution failed:', err);
  process.exit(1);
});
