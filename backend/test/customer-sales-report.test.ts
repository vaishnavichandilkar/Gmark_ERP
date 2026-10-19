import { ReportsService } from '../src/modules/Reports/reports.service';

/**
 * Comprehensive Unit Test Suite for Advanced Sales Report & Customer-Wise Sales Analytics
 * Verifies key accounting and aggregation rules specified in Master Prompt.
 */
async function runTests() {
  console.log('--- Starting Customer Sales Report & Analytics Tests ---');
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

  // Mock Invoices
  const mockInvoices = [
    {
      id: 1,
      invoiceNumber: 'INV-001',
      soNumber: 'SO-100',
      customerId: 10,
      customerName: 'Zeta Technologies',
      subTotal: 10000,
      discountAmount: 500,
      taxAmount: 1800,
      grandTotal: 11300,
      customerInvoiceDate: new Date('2026-04-10T10:00:00Z'),
      status: 'FINAL',
      customer: {
        id: 10,
        customerName: 'Zeta Technologies',
        customerCode: 'CUST-010',
        customerType: 'Wholesale Customer',
      },
      items: [
        { productId: 101, productName: 'Industrial Pump', quantity: 2, totalAmount: 6000 },
        { productId: 102, productName: 'Valve Pipe', quantity: 4, totalAmount: 4000 },
      ],
    },
    {
      id: 2,
      invoiceNumber: 'INV-002',
      soNumber: 'SO-100', // same order SO-100, second dispatch
      customerId: 10,
      customerName: 'Zeta Technologies',
      subTotal: 5000,
      discountAmount: 200,
      taxAmount: 900,
      grandTotal: 5700,
      customerInvoiceDate: new Date('2026-05-15T11:00:00Z'),
      status: 'FINAL',
      customer: {
        id: 10,
        customerName: 'Zeta Technologies',
        customerCode: 'CUST-010',
        customerType: 'Wholesale Customer',
      },
      items: [
        { productId: 101, productName: 'Industrial Pump', quantity: 1, totalAmount: 5000 },
      ],
    },
    {
      id: 3,
      invoiceNumber: 'INV-003',
      soNumber: 'SO-200',
      customerId: 20,
      customerName: 'Alpha Retailers',
      subTotal: 8000,
      discountAmount: 800,
      taxAmount: 1440,
      grandTotal: 8640,
      customerInvoiceDate: new Date('2026-04-20T14:00:00Z'),
      status: 'FINAL',
      customer: {
        id: 20,
        customerName: 'Alpha Retailers',
        customerCode: 'CUST-020',
        customerType: 'Retail Customer',
      },
      items: [
        { productId: 103, productName: 'Water Filter', quantity: 5, totalAmount: 8000 },
      ],
    },
    {
      id: 4,
      invoiceNumber: 'INV-004',
      soNumber: 'SO-300',
      customerId: 30,
      customerName: 'Beta Enterprises',
      subTotal: 15000,
      discountAmount: 0,
      taxAmount: 2700,
      grandTotal: 17700,
      customerInvoiceDate: new Date('2026-06-05T09:30:00Z'),
      status: 'FINAL',
      customer: {
        id: 30,
        customerName: 'Beta Enterprises',
        customerCode: 'CUST-030',
        customerType: 'Distributor',
      },
      items: [
        { productId: 101, productName: 'Industrial Pump', quantity: 3, totalAmount: 15000 },
      ],
    },
    {
      id: 5,
      invoiceNumber: 'INV-005',
      soNumber: 'SO-400',
      customerId: 40,
      customerName: 'Alpha Sub-Dealer',
      subTotal: 3000,
      discountAmount: 100,
      taxAmount: 540,
      grandTotal: 3440,
      customerInvoiceDate: new Date('2026-05-18T16:00:00Z'),
      status: 'DELETED', // DELETED transaction must be excluded
      customer: {
        id: 40,
        customerName: 'Alpha Sub-Dealer',
        customerCode: 'CUST-040',
        customerType: 'Retail Customer',
      },
      items: [
        { productId: 103, productName: 'Water Filter', quantity: 2, totalAmount: 3000 },
      ],
    },
  ];

  const mockAccounts = [
    { id: 10, accountName: 'Zeta Technologies', customerCode: 'CUST-010', customerType: 'Wholesale Customer' },
    { id: 20, accountName: 'Alpha Retailers', customerCode: 'CUST-020', customerType: 'Retail Customer' },
    { id: 30, accountName: 'Beta Enterprises', customerCode: 'CUST-030', customerType: 'Distributor' },
  ];

  const mockPrisma: any = {
    salesInvoice: {
      groupBy: async () => [
        { customerId: 10, _min: { customerInvoiceDate: new Date('2026-04-10T10:00:00Z') } },
        { customerId: 20, _min: { customerInvoiceDate: new Date('2026-04-20T14:00:00Z') } },
        { customerId: 30, _min: { customerInvoiceDate: new Date('2026-06-05T09:30:00Z') } },
      ],
      findMany: async (args: any) => {
        let results = [...mockInvoices];
        if (args?.where?.status?.not) {
          results = results.filter(i => i.status !== args.where.status.not);
        }
        if (args?.where?.customerId) {
          results = results.filter(i => i.customerId === args.where.customerId);
        }
        if (args?.where?.OR) {
          results = results.filter(i => {
            return args.where.OR.some((cond: any) => {
              if (cond.customerId && i.customerId === cond.customerId) return true;
              if (cond.customerName && i.customerName?.toLowerCase() === cond.customerName?.equals?.toLowerCase()) return true;
              return false;
            });
          });
        }
        const dateFilter = args?.where?.customerInvoiceDate;
        if (dateFilter?.gte) {
          results = results.filter(i => i.customerInvoiceDate >= dateFilter.gte);
        }
        if (dateFilter?.lte) {
          results = results.filter(i => i.customerInvoiceDate <= dateFilter.lte);
        }
        return results;
      },
    },
    accountMaster: {
      findMany: async () => mockAccounts,
      findFirst: async (args: any) => {
        if (args?.where?.id) {
          return mockAccounts.find(a => a.id === args.where.id) || null;
        }
        return null;
      },
    },
    customer: {
      findMany: async () => [
        { id: 10, customerName: 'Zeta Technologies', customerCode: 'CUST-010', customerType: 'Wholesale Customer' },
        { id: 20, customerName: 'Alpha Retailers', customerCode: 'CUST-020', customerType: 'Retail Customer' },
        { id: 30, customerName: 'Beta Enterprises', customerCode: 'CUST-030', customerType: 'Distributor' },
      ],
    },
    product: {
      findMany: async () => [
        { id: 101, productName: 'Industrial Pump', categoryId: 1 },
        { id: 102, productName: 'Valve Pipe', categoryId: 1 },
        { id: 103, productName: 'Water Filter', categoryId: 2 },
      ],
    },
    category: {
      findMany: async () => [
        { id: 1, name: 'Industrial Equipment' },
        { id: 2, name: 'Domestic Filters' },
      ],
    },
  };

  const mockAudit: any = {
    logAction: async () => {},
  };

  const service = new ReportsService(mockPrisma, mockAudit);

  // Test 1: Customer Type Grouping and Alphabetical Order
  console.log('\nTesting Customer Type Grouping & Alphabetical Sorting...');
  const groupsRes = await service.getCustomerSalesGroups(1, {
    dateFrom: '2026-04-01',
    dateTo: '2026-06-30',
  });
  const groupLabels = groupsRes.groups.map(g => g.customerTypeLabel);
  assert(
    groupLabels.length === 3 &&
    groupLabels[0] === 'Distributor' &&
    groupLabels[1] === 'Retail Customer' &&
    groupLabels[2] === 'Wholesale Customer',
    'Customer types are grouped dynamically and sorted alphabetically: Distributor -> Retail Customer -> Wholesale Customer',
  );

  // Test 2: Customers within groups are sorted alphabetically (case-insensitive)
  const retailGroup = groupsRes.groups.find(g => g.customerTypeLabel === 'Retail Customer');
  assert(
    retailGroup !== undefined &&
    retailGroup.customers.length === 1 &&
    retailGroup.customers[0].customerName === 'Alpha Retailers',
    'Customers within Retail Customer group are sorted alphabetically and correctly matched',
  );

  // Test 3: Multiple orders and non-inflated order counting
  const wholesaleGroup = groupsRes.groups.find(g => g.customerTypeLabel === 'Wholesale Customer');
  assert(
    wholesaleGroup !== undefined &&
    wholesaleGroup.customers.length === 1 &&
    wholesaleGroup.customers[0].customerName === 'Zeta Technologies' &&
    wholesaleGroup.customers[0].totalOrders === 1, // Both invoices had soNumber 'SO-100', so distinct order count is 1
    'Multiple invoices/lines sharing the same Sales Order do not inflate order frequency (totalOrders = 1)',
  );

  // Test 4: Financial accuracy (Gross, Net, Tax, Discount)
  // Zeta Technologies:
  // Gross: 10000 + 5000 = 15000
  // Discounts: 500 + 200 = 700
  // Tax: 1800 + 900 = 2700
  // Net: 11300 + 5700 = 17000
  const zeta = wholesaleGroup?.customers[0];
  assert(
    zeta?.grossSales === 15000 &&
    zeta?.discounts === 700 &&
    zeta?.taxAmount === 2700 &&
    zeta?.netSales === 17000,
    'Financial calculations adhere to accounting conventions (Gross: 15,000, Discount: 700, Tax: 2,700, Net: 17,000)',
  );

  // Test 5: DELETED invoices exclusion
  const deletedMatches = groupsRes.groups.flatMap(g => g.customers).filter(c => c.customerName === 'Alpha Sub-Dealer');
  assert(
    deletedMatches.length === 0,
    'Deleted invoices are strictly excluded from customer groups and sales totals',
  );

  // Test 6: Summary Metrics Reconciliation
  // Total Net Sales = 17000 (Zeta) + 8640 (Alpha) + 17700 (Beta) = 43340
  // Total Orders = 1 (SO-100) + 1 (SO-200) + 1 (SO-300) = 3
  // Total Customers with sales = 3
  assert(
    groupsRes.summary.totalCustomers === 3 &&
    groupsRes.summary.totalSales === 43340 &&
    groupsRes.summary.totalOrders === 3,
    'Summary totals reconcile with the underlying customer groups and invoice totals',
  );

  // Test 7: Product-Level Filter Precision
  console.log('\nTesting Product Filter...');
  const productFilterRes = await service.getCustomerSalesGroups(1, {
    dateFrom: '2026-04-01',
    dateTo: '2026-06-30',
    productIds: '103', // Water Filter only
  });
  const filteredCustomers = productFilterRes.groups.flatMap(g => g.customers);
  assert(
    filteredCustomers.length === 1 &&
    filteredCustomers[0].customerName === 'Alpha Retailers' &&
    productFilterRes.summary.totalSales === 8000,
    'Product filtering accurately identifies qualifying customer lines without data leakage (Line sales: 8,000)',
  );

  // Test 8: Monthly Sales Breakdown (Amount & Frequency, Zero-Month Padding)
  console.log('\nTesting Monthly Sales Breakdown...');
  const monthlyRes = await service.getCustomerMonthlySales(1, 10, {
    dateFrom: '2026-04-01',
    dateTo: '2026-06-30',
  });
  // Months: Apr 2026, May 2026, Jun 2026
  assert(
    monthlyRes.months.length === 3 &&
    monthlyRes.months[0].monthLabel === 'Apr 2026' &&
    monthlyRes.months[0].salesAmount === 11300 &&
    monthlyRes.months[0].orderFrequency === 1 &&
    monthlyRes.months[1].monthLabel === 'May 2026' &&
    monthlyRes.months[1].salesAmount === 5700 &&
    monthlyRes.months[2].monthLabel === 'Jun 2026' &&
    monthlyRes.months[2].salesAmount === 0 &&
    monthlyRes.months[2].orderFrequency === 0,
    'Monthly Sales breakdown pads inactive months with 0 and calculates Amount & Frequency accurately',
  );

  console.log(`\n========================================`);
  console.log(`TEST RESULTS: ${passedCount} of ${totalCount} PASSED`);
  console.log(`========================================\n`);

  if (passedCount !== totalCount) {
    process.exit(1);
  }
}

runTests().catch(err => {
  console.error('Test execution failed:', err);
  process.exit(1);
});
