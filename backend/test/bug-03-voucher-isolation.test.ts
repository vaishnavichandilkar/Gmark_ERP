import { PaymentVoucherService } from '../src/modules/Finance/vouchers/payment-voucher/payment-voucher.service';
import { ReceiptVoucherService } from '../src/modules/Finance/vouchers/receipt-voucher/receipt-voucher.service';
import { JournalVoucherService } from '../src/modules/Finance/vouchers/journal-voucher/journal-voucher.service';
import { ContraVoucherService } from '../src/modules/Finance/vouchers/contra-voucher/contra-voucher.service';

/**
 * Automated Regression Test Suite for BUG-03: Voucher Numbering & Multi-Tenant Isolation
 * Verifies that:
 * 1. Payment, Receipt, Journal, and Contra vouchers maintain independent sequences per tenant.
 * 2. Tenant A and Tenant B can concurrently allocate vouchers starting from PV-0001 / RV-0001.
 * 3. Sequences increment numerically within a tenant without skipping.
 */
async function runTests() {
  console.log('--- Starting BUG-03 Voucher Numbering & Tenant Isolation Tests ---');
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

  // Simulated Database Stores
  const paymentVouchersDB: Array<{ voucherNumber: string; createdBy: number }> = [];
  const receiptVouchersDB: Array<{ voucherNumber: string; createdBy: number }> = [];
  const journalVouchersDB: Array<{ voucherNumber: string; createdBy: number }> = [];
  const contraVouchersDB: Array<{ voucherNumber: string; createdBy: number }> = [];

  const mockPrisma: any = {
    paymentVoucher: {
      findMany: async ({ where }: any) => {
        return paymentVouchersDB.filter((v) => v.createdBy === where.createdBy);
      },
    },
    receiptVoucher: {
      findMany: async ({ where }: any) => {
        return receiptVouchersDB.filter((v) => v.createdBy === where.createdBy);
      },
    },
    journalVoucher: {
      findMany: async ({ where }: any) => {
        return journalVouchersDB.filter((v) => v.createdBy === where.createdBy);
      },
    },
    contraVoucher: {
      findMany: async ({ where }: any) => {
        return contraVouchersDB.filter((v) => v.createdBy === where.createdBy);
      },
    },
    $queryRaw: async () => {
      throw new Error('Test fallback mode');
    },
  };

  const pvService = new PaymentVoucherService(mockPrisma, {} as any);
  const rvService = new ReceiptVoucherService(mockPrisma, {} as any);
  const jvService = new JournalVoucherService(mockPrisma, {} as any);
  const cvService = new ContraVoucherService(mockPrisma, {} as any);

  // TEST 1: Tenant A and Tenant B both get PV-0001 initially
  const tenantA_PV1 = await pvService.generateVoucherNumber(101);
  const tenantB_PV1 = await pvService.generateVoucherNumber(202);
  assert(tenantA_PV1 === 'PV-0001', `Tenant A generates PV-0001 (actual: ${tenantA_PV1})`);
  assert(tenantB_PV1 === 'PV-0001', `Tenant B generates independent PV-0001 (actual: ${tenantB_PV1})`);

  // Simulate Tenant A creating PV-0001 and PV-0002
  paymentVouchersDB.push({ voucherNumber: 'PV-0001', createdBy: 101 });
  paymentVouchersDB.push({ voucherNumber: 'PV-0002', createdBy: 101 });

  // TEST 2: Tenant A moves to PV-0003 while Tenant B is still at PV-0001
  const tenantA_PV3 = await pvService.generateVoucherNumber(101);
  const tenantB_PV_still1 = await pvService.generateVoucherNumber(202);
  assert(tenantA_PV3 === 'PV-0003', `Tenant A advances to PV-0003 (actual: ${tenantA_PV3})`);
  assert(tenantB_PV_still1 === 'PV-0001', `Tenant B remains un-polluted at PV-0001 (actual: ${tenantB_PV_still1})`);

  // TEST 3: Receipt vouchers tenant isolation
  receiptVouchersDB.push({ voucherNumber: 'RV-0010', createdBy: 101 });
  const tenantA_RV11 = await rvService.generateVoucherNumber(101);
  const tenantB_RV1 = await rvService.generateVoucherNumber(202);
  assert(tenantA_RV11 === 'RV-0011', `Tenant A generates RV-0011 (actual: ${tenantA_RV11})`);
  assert(tenantB_RV1 === 'RV-0001', `Tenant B starts at RV-0001 (actual: ${tenantB_RV1})`);

  // TEST 4: Journal vouchers tenant isolation
  journalVouchersDB.push({ voucherNumber: 'JV-0042', createdBy: 101 });
  const tenantA_JV43 = await jvService.generateVoucherNumber(101);
  const tenantB_JV1 = await jvService.generateVoucherNumber(202);
  assert(tenantA_JV43 === 'JV-0043', `Tenant A generates JV-0043 (actual: ${tenantA_JV43})`);
  assert(tenantB_JV1 === 'JV-0001', `Tenant B starts at JV-0001 (actual: ${tenantB_JV1})`);

  // TEST 5: Contra vouchers tenant isolation
  contraVouchersDB.push({ voucherNumber: 'CV-0005', createdBy: 202 });
  const tenantA_CV1 = await cvService.generateVoucherNumber(101);
  const tenantB_CV6 = await cvService.generateVoucherNumber(202);
  assert(tenantA_CV1 === 'CV-0001', `Tenant A starts at CV-0001 (actual: ${tenantA_CV1})`);
  assert(tenantB_CV6 === 'CV-0006', `Tenant B advances to CV-0006 (actual: ${tenantB_CV6})`);

  console.log(`\nBUG-03 Test Summary: ${passedCount}/${totalCount} tests passed.`);
  if (passedCount !== totalCount) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error('Test execution failed:', err);
  process.exit(1);
});
