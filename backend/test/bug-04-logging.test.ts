import { SalesOrderService } from '../src/modules/Sales/sales-order/sales-order.service';
import { SalesInvoiceService } from '../src/modules/Sales/sales-invoice/invoice/invoice.service';

/**
 * Comprehensive Regression Test Suite for BUG-04: Host-Dependent Error Logging Remediation
 * Verifies that services use NestJS Logger and do not crash on missing desktop paths.
 */
async function runTests() {
  console.log('--- Starting BUG-04 Logging Remediation Tests ---');
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

  // TEST 1: SalesOrderService handles DB failure gracefully without throwing file I/O error
  try {
    const mockPrisma: any = {
      user: {
        findUnique: async () => ({ id: 1, sellerDocuments: [] }),
      },
      accountMaster: {
        findFirst: async () => ({
          id: 1,
          accountName: 'Test Customer',
          customerStatus: 'ACTIVE',
          status: 'ACTIVE',
          customerType: 'retailer',
          addressLine1: 'Address 1',
        }),
        findUnique: async () => ({
          id: 1,
          accountName: 'Test Customer',
          customerStatus: 'ACTIVE',
          status: 'ACTIVE',
          customerType: 'retailer',
          addressLine1: 'Address 1',
        }),
      },
      sellerDocument: {
        findFirst: async () => null,
      },
      auditLog: {
        create: async () => ({}),
      },
      salesOrder: {
        findFirst: async () => null,
      },
      $transaction: async (cb: any) => {
        throw new Error('Database transaction connection aborted');
      },
    };
    const mockValidator: any = {};
    const service = new SalesOrderService(mockPrisma, mockValidator);

    let loggedErrorMessage = '';
    (service as any).logger = {
      error: (msg: string) => {
        loggedErrorMessage = msg;
      },
    };

    let caughtError: any = null;
    try {
      await service.create(
        {
          customerId: 1,
          customerName: 'Test Customer',
          address: 'Test Address',
          items: [],
          advanceAmount: 0,
          transportCharges: 0,
          otherCharges: 0,
          creditDays: 30,
          expiryDate: new Date().toISOString(),
        } as any,
        1
      );
    } catch (err) {
      caughtError = err;
    }

    assert(
      caughtError !== null && caughtError.message === 'Database transaction connection aborted',
      'SalesOrderService rethrows original application exception instead of masking it'
    );
    assert(
      loggedErrorMessage.includes('Failed to create sales order: Database transaction connection aborted'),
      'SalesOrderService logs error via NestJS Logger without attempting desktop file write'
    );
  } catch (err: any) {
    assert(false, `Test 1 threw unexpected error: ${err.message}`);
  }

  // TEST 2: SalesInvoiceService handles DB failure gracefully without throwing file I/O error
  try {
    const mockPrisma: any = {
      user: {
        findUnique: async () => ({ id: 1, state: 'MH', sellerDocuments: [] }),
      },
      accountMaster: {
        findFirst: async () => ({
          id: 1,
          accountName: 'Test Customer',
          customerStatus: 'ACTIVE',
          status: 'ACTIVE',
          customerType: 'retailer',
          addressLine1: 'Address 1',
          state: 'MH',
        }),
        findUnique: async () => ({
          id: 1,
          accountName: 'Test Customer',
          customerStatus: 'ACTIVE',
          status: 'ACTIVE',
          customerType: 'retailer',
          addressLine1: 'Address 1',
          state: 'MH',
        }),
      },
      sellerDocument: {
        findFirst: async () => null,
      },
      auditLog: {
        create: async () => ({}),
      },
      salesInvoice: {
        findFirst: async () => null,
        findMany: async () => [],
      },
      shopDetail: {
        findUnique: async () => ({ id: 1, state: 'MH' }),
      },
      $transaction: async (cb: any) => {
        throw new Error('Sales Invoice creation aborted due to constraint');
      },
    };
    const mockSoService: any = {};
    const mockTransactionService: any = {};
    const mockValidator: any = {};
    const invoiceService = new SalesInvoiceService(mockPrisma, mockSoService, mockTransactionService, mockValidator);

    let loggedErrorMessage = '';
    (invoiceService as any).logger = {
      error: (msg: string) => {
        loggedErrorMessage = msg;
      },
    };

    let caughtError: any = null;
    try {
      await invoiceService.create(
        {
          customerId: 1,
          customerName: 'Test Customer',
          items: [],
          invoiceDate: new Date().toISOString(),
        } as any,
        1
      );
    } catch (err) {
      caughtError = err;
    }

    assert(
      caughtError !== null && caughtError.message === 'Sales Invoice creation aborted due to constraint',
      'SalesInvoiceService rethrows original exception cleanly'
    );
    assert(
      loggedErrorMessage.includes('Failed to create sales invoice: Sales Invoice creation aborted due to constraint'),
      'SalesInvoiceService logs error cleanly via NestJS Logger'
    );
  } catch (err: any) {
    assert(false, `Test 2 threw unexpected error: ${err.message}`);
  }

  // TEST 3: SalesInvoiceService duplicate invoice number error handling
  try {
    const mockPrisma: any = {
      user: {
        findUnique: async () => ({ id: 1, state: 'MH', sellerDocuments: [] }),
      },
      accountMaster: {
        findFirst: async () => ({
          id: 1,
          accountName: 'Test Customer',
          customerStatus: 'ACTIVE',
          status: 'ACTIVE',
          customerType: 'retailer',
          addressLine1: 'Address 1',
          state: 'MH',
        }),
        findUnique: async () => ({
          id: 1,
          accountName: 'Test Customer',
          customerStatus: 'ACTIVE',
          status: 'ACTIVE',
          customerType: 'retailer',
          addressLine1: 'Address 1',
          state: 'MH',
        }),
      },
      sellerDocument: {
        findFirst: async () => null,
      },
      auditLog: {
        create: async () => ({}),
      },
      salesInvoice: {
        findFirst: async () => null,
        findMany: async () => [],
      },
      shopDetail: {
        findUnique: async () => ({ id: 1, state: 'MH' }),
      },
      $transaction: async (cb: any) => {
        const p2002Err: any = new Error('Unique constraint failed');
        p2002Err.code = 'P2002';
        p2002Err.meta = { target: ['invoiceNumber'] };
        throw p2002Err;
      },
    };
    const mockSoService: any = {};
    const mockTransactionService: any = {};
    const mockValidator: any = {};
    const invoiceService = new SalesInvoiceService(mockPrisma, mockSoService, mockTransactionService, mockValidator);

    let caughtError: any = null;
    try {
      await invoiceService.create(
        {
          customerId: 1,
          customerName: 'Test Customer',
          items: [],
          invoiceDate: new Date().toISOString(),
        } as any,
        1
      );
    } catch (err) {
      caughtError = err;
    }

    assert(
      caughtError !== null && caughtError.message === 'Invoice number already exists. Please generate a new invoice number.',
      'SalesInvoiceService converts P2002 invoiceNumber collision to clear BadRequestException'
    );
  } catch (err: any) {
    assert(false, `Test 3 threw unexpected error: ${err.message}`);
  }

  console.log(`\nBUG-04 Test Summary: ${passedCount}/${totalCount} tests passed.`);
  if (passedCount !== totalCount) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error('Test execution failed:', err);
  process.exit(1);
});
