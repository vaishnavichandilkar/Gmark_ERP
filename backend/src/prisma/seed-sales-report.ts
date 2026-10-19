import { PrismaClient, CustomerType, MasterStatus, SalesInvoiceStatus, ProductType, ContactPrefix } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding realistic Sales and Customer Report data for user 2...');

  const user = await prisma.user.findUnique({ where: { id: 2 } });
  if (!user) {
    console.error('User 2 not found');
    return;
  }

  // 1. Fetch Units for user 2
  const nosUnit = await prisma.unitMaster.findFirst({
    where: { user_id: 2, gst_uom: 'NOS' }
  });
  const pcsUnit = await prisma.unitMaster.findFirst({
    where: { user_id: 2, gst_uom: 'PCS' }
  });

  const uomNosId = nosUnit?.id || 78;
  const uomPcsId = pcsUnit?.id || 80;

  // 2. Categories
  const categoryNames = [
    'Industrial Weighing Solutions',
    'Precision & Analytical Balances',
    'Retail & Commercial Scales'
  ];

  const categories: Record<string, string> = {};
  for (const name of categoryNames) {
    let cat = await prisma.category.findFirst({
      where: { user_id: 2, name }
    });
    if (!cat) {
      cat = await prisma.category.create({
        data: {
          name,
          user_id: 2,
          status: MasterStatus.ACTIVE
        }
      });
    }
    categories[name] = cat.id;
  }

  // 3. Products
  const productsData = [
    {
      product_name: 'Electronic Weighbridge 60T Pitless',
      product_code: 'PROD-WB-60T',
      uom_id: uomNosId,
      product_type: ProductType.GOODS,
      category_id: categories['Industrial Weighing Solutions'],
      hsn_code: '84238900',
      tax_rate: 18,
      rate: 450000,
    },
    {
      product_name: 'Heavy Duty Crane Scale 5T Digital',
      product_code: 'PROD-CS-5T',
      uom_id: uomNosId,
      product_type: ProductType.GOODS,
      category_id: categories['Industrial Weighing Solutions'],
      hsn_code: '84238290',
      tax_rate: 18,
      rate: 42000,
    },
    {
      product_name: 'Analytical Balance 220g 0.1mg Touchscreen',
      product_code: 'PROD-AB-220',
      uom_id: uomPcsId,
      product_type: ProductType.GOODS,
      category_id: categories['Precision & Analytical Balances'],
      hsn_code: '90160010',
      tax_rate: 18,
      rate: 85000,
    },
    {
      product_name: 'Precision Gold Scale 600g High Accuracy',
      product_code: 'PROD-GS-600',
      uom_id: uomPcsId,
      product_type: ProductType.GOODS,
      category_id: categories['Precision & Analytical Balances'],
      hsn_code: '90160010',
      tax_rate: 18,
      rate: 28000,
    },
    {
      product_name: 'Commercial Price Computing Scale 30kg Pole Display',
      product_code: 'PROD-CS-30KG',
      uom_id: uomPcsId,
      product_type: ProductType.GOODS,
      category_id: categories['Retail & Commercial Scales'],
      hsn_code: '84238110',
      tax_rate: 18,
      rate: 9500,
    },
    {
      product_name: 'Platform Heavy Duty Scale 500kg SS Platter',
      product_code: 'PROD-PS-500',
      uom_id: uomPcsId,
      product_type: ProductType.GOODS,
      category_id: categories['Retail & Commercial Scales'],
      hsn_code: '84238210',
      tax_rate: 18,
      rate: 19500,
    },
  ];

  const products: Record<string, any> = {};
  for (const p of productsData) {
    let prod = await prisma.product.findFirst({
      where: { created_by: 2, product_code: p.product_code }
    });
    if (!prod) {
      prod = await prisma.product.create({
        data: {
          product_name: p.product_name,
          product_code: p.product_code,
          uom_id: p.uom_id,
          product_type: p.product_type,
          category_id: p.category_id,
          hsn_code: p.hsn_code,
          tax_rate: p.tax_rate,
          status: MasterStatus.ACTIVE,
          created_by: 2,
        }
      });
    }
    products[p.product_code] = { ...prod, rate: p.rate };
  }

  // 4. Accounts (Customers)
  const customersData = [
    {
      accountName: 'Apex Heavy Industries Pvt Ltd',
      customerCode: 'CUST-IND-001',
      customerType: CustomerType.industrial,
      gstNo: '27AABCA1234F1Z1',
      panNo: 'AABCA1234F',
      addressLine1: 'Plot 42, MIDC Industrial Area, Bhosari',
      district: 'Pune',
      state: 'Maharashtra',
      pincode: '411026',
      contactPersonName: 'Rajesh Sharma',
      mobileNo: '9822012345',
      prefix: ContactPrefix.Mr,
    },
    {
      accountName: 'Bharat Foundry & Steel Works',
      customerCode: 'CUST-IND-002',
      customerType: CustomerType.industrial,
      gstNo: '27AABCB2345L1Z6',
      panNo: 'AABCB2345L',
      addressLine1: 'Gat No 128, Chakan MIDC Phase 2',
      district: 'Pune',
      state: 'Maharashtra',
      pincode: '410501',
      contactPersonName: 'Anil Deshmukh',
      mobileNo: '9822023456',
      prefix: ContactPrefix.Mr,
    },
    {
      accountName: 'TechLabs Precision Bio Solutions',
      customerCode: 'CUST-INST-003',
      customerType: CustomerType.institutional,
      gstNo: '27AABCT5678G1Z2',
      panNo: 'AABCT5678G',
      addressLine1: 'Biotech Park, Phase 1, Hinjewadi',
      district: 'Pune',
      state: 'Maharashtra',
      pincode: '411057',
      contactPersonName: 'Dr. Sunita Kulkarni',
      mobileNo: '9822034567',
      prefix: ContactPrefix.Mrs,
    },
    {
      accountName: 'Mahalaxmi Weighing Instruments',
      customerCode: 'CUST-DLR-004',
      customerType: CustomerType.dealer,
      gstNo: '27AABCM9012H1Z3',
      panNo: 'AABCM9012H',
      addressLine1: 'Shop 14, Commercial Market, Raviwar Peth',
      district: 'Pune',
      state: 'Maharashtra',
      pincode: '411002',
      contactPersonName: 'Vikram Oswal',
      mobileNo: '9822045678',
      prefix: ContactPrefix.Mr,
    },
    {
      accountName: 'Universal Scale & Service Corp',
      customerCode: 'CUST-DLR-005',
      customerType: CustomerType.dealer,
      gstNo: '27AABCU6789M1Z7',
      panNo: 'AABCU6789M',
      addressLine1: '88, Station Road, Opp Central Bank',
      district: 'Thane',
      state: 'Maharashtra',
      pincode: '400601',
      contactPersonName: 'Mahesh Patil',
      mobileNo: '9822056789',
      prefix: ContactPrefix.Mr,
    },
    {
      accountName: 'Metro Super Retail Marts Ltd',
      customerCode: 'CUST-RET-006',
      customerType: CustomerType.retailer,
      gstNo: '27AABCU3456J1Z4',
      panNo: 'AABCU3456J',
      addressLine1: 'Survey 45, Baner Road',
      district: 'Pune',
      state: 'Maharashtra',
      pincode: '411045',
      contactPersonName: 'Neha Mehta',
      mobileNo: '9822067890',
      prefix: ContactPrefix.Ms,
    },
    {
      accountName: 'Western Agro & Spice Wholesalers',
      customerCode: 'CUST-WHL-007',
      customerType: CustomerType.dealer,
      gstNo: '27AABCW7890K1Z5',
      panNo: 'AABCW7890K',
      addressLine1: 'Godown 12, APMC Market Yard',
      district: 'Pune',
      state: 'Maharashtra',
      pincode: '411037',
      contactPersonName: 'Kishore Agarwal',
      mobileNo: '9822078901',
      prefix: ContactPrefix.Mr,
    },
  ];

  const accounts: Record<string, any> = {};
  for (const c of customersData) {
    let acc = await prisma.accountMaster.findFirst({
      where: { userId: 2, customerCode: c.customerCode }
    });
    if (!acc) {
      acc = await prisma.accountMaster.create({
        data: {
          accountName: c.accountName,
          customerCode: c.customerCode,
          customerType: c.customerType,
          gstNo: c.gstNo,
          panNo: c.panNo,
          addressLine1: c.addressLine1,
          district: c.district,
          state: c.state,
          pincode: c.pincode,
          contactPersonName: c.contactPersonName,
          mobileNo: c.mobileNo,
          prefix: c.prefix,
          groupName: ['Sundry Debtors'],
          userId: 2,
          status: MasterStatus.ACTIVE,
          customerStatus: MasterStatus.ACTIVE,
        }
      });
    }
    accounts[c.customerCode] = acc;
  }

  // 5. Create Invoices
  // Helper to create invoice with items
  async function createInvoice(params: {
    invNum: string;
    date: string;
    customerKey: string;
    soNum: string;
    items: { prodCode: string; qty: number }[];
  }) {
    const acc = accounts[params.customerKey];
    const invDate = new Date(params.date);

    // Calculate totals
    let taxableAmount = 0;
    let totalTax = 0;
    let grandTotal = 0;
    let totalQty = 0;

    const itemPayloads = params.items.map(it => {
      const prod = products[it.prodCode];
      const rate = prod.rate;
      const amount = rate * it.qty;
      const taxRate = prod.tax_rate;
      const taxAmt = Math.round((amount * taxRate / 100) * 100) / 100;
      const lineTotal = amount + taxAmt;

      taxableAmount += amount;
      totalTax += taxAmt;
      grandTotal += lineTotal;
      totalQty += it.qty;

      return {
        productId: prod.id,
        productCode: prod.product_code,
        productName: prod.product_name,
        quantity: it.qty,
        rate: rate,
        uom: it.prodCode.includes('WB') || it.prodCode.includes('CS-5T') ? 'NOS' : 'PCS',
        beforeTaxAmount: amount,
        taxPercent: taxRate,
        taxAmount: taxAmt,
        totalAmount: lineTotal,
        hsnCode: prod.hsn_code,
      };
    });

    const cgst = Math.round((totalTax / 2) * 100) / 100;
    const sgst = totalTax - cgst;

    const existing = await prisma.salesInvoice.findUnique({
      where: {
        invoiceNumber_userId: {
          invoiceNumber: params.invNum,
          userId: 2,
        }
      }
    });

    if (existing) {
      return existing;
    }

    return await prisma.salesInvoice.create({
      data: {
        invoiceNumber: params.invNum,
        customerInvoiceNumber: params.invNum,
        customerInvoiceDate: invDate,
        invoiceDate: invDate,
        bookingDate: invDate,
        customerName: acc.accountName,
        customerId: acc.id,
        address: acc.addressLine1,
        soNumber: params.soNum,
        creditDays: 30,
        status: SalesInvoiceStatus.COMPLETED,
        totalQuantity: totalQty,
        taxableAmount: taxableAmount,
        cgstAmount: cgst,
        sgstAmount: sgst,
        grandTotal: grandTotal,
        userId: 2,
        items: {
          create: itemPayloads
        }
      }
    });
  }

  console.log('Generating invoices across FY 2026-27 and previous period...');

  const invoiceList = [
    // Previous period (for comparison analytics)
    { invNum: 'INV-2025-091', date: '2026-01-15', customerKey: 'CUST-IND-001', soNum: 'SO-2025-088', items: [{ prodCode: 'PROD-WB-60T', qty: 1 }] },
    { invNum: 'INV-2025-095', date: '2026-02-10', customerKey: 'CUST-DLR-004', soNum: 'SO-2025-092', items: [{ prodCode: 'PROD-CS-30KG', qty: 5 }, { prodCode: 'PROD-PS-500', qty: 2 }] },
    { invNum: 'INV-2025-099', date: '2026-03-20', customerKey: 'CUST-INST-003', soNum: 'SO-2025-096', items: [{ prodCode: 'PROD-AB-220', qty: 1 }] },

    // FY 2026-27 (Current Period: 01/04/2026 - 31/03/2027)
    // April 2026
    { invNum: 'INV-2026-001', date: '2026-04-08', customerKey: 'CUST-IND-001', soNum: 'SO-2026-001', items: [{ prodCode: 'PROD-WB-60T', qty: 1 }] },
    { invNum: 'INV-2026-002', date: '2026-04-16', customerKey: 'CUST-DLR-004', soNum: 'SO-2026-002', items: [{ prodCode: 'PROD-CS-30KG', qty: 10 }, { prodCode: 'PROD-PS-500', qty: 4 }] },
    { invNum: 'INV-2026-003', date: '2026-04-24', customerKey: 'CUST-RET-006', soNum: 'SO-2026-003', items: [{ prodCode: 'PROD-CS-30KG', qty: 3 }] },

    // May 2026
    { invNum: 'INV-2026-004', date: '2026-05-06', customerKey: 'CUST-INST-003', soNum: 'SO-2026-004', items: [{ prodCode: 'PROD-AB-220', qty: 2 }, { prodCode: 'PROD-GS-600', qty: 1 }] },
    { invNum: 'INV-2026-005', date: '2026-05-18', customerKey: 'CUST-WHL-007', soNum: 'SO-2026-005', items: [{ prodCode: 'PROD-PS-500', qty: 6 }] },
    { invNum: 'INV-2026-006', date: '2026-05-29', customerKey: 'CUST-IND-002', soNum: 'SO-2026-006', items: [{ prodCode: 'PROD-CS-5T', qty: 2 }] },

    // June 2026
    { invNum: 'INV-2026-007', date: '2026-06-11', customerKey: 'CUST-IND-001', soNum: 'SO-2026-007', items: [{ prodCode: 'PROD-CS-5T', qty: 1 }, { prodCode: 'PROD-PS-500', qty: 2 }] },
    { invNum: 'INV-2026-008', date: '2026-06-25', customerKey: 'CUST-DLR-005', soNum: 'SO-2026-008', items: [{ prodCode: 'PROD-CS-30KG', qty: 8 }, { prodCode: 'PROD-GS-600', qty: 3 }] },

    // July 2026
    { invNum: 'INV-2026-009', date: '2026-07-04', customerKey: 'CUST-RET-006', soNum: 'SO-2026-009', items: [{ prodCode: 'PROD-CS-30KG', qty: 4 }] },
    { invNum: 'INV-2026-010', date: '2026-07-17', customerKey: 'CUST-INST-003', soNum: 'SO-2026-010', items: [{ prodCode: 'PROD-AB-220', qty: 1 }] },
    { invNum: 'INV-2026-011', date: '2026-07-28', customerKey: 'CUST-WHL-007', soNum: 'SO-2026-011', items: [{ prodCode: 'PROD-PS-500', qty: 5 }] },

    // August 2026
    { invNum: 'INV-2026-012', date: '2026-08-05', customerKey: 'CUST-IND-002', soNum: 'SO-2026-012', items: [{ prodCode: 'PROD-WB-60T', qty: 1 }] },
    { invNum: 'INV-2026-013', date: '2026-08-19', customerKey: 'CUST-DLR-004', soNum: 'SO-2026-013', items: [{ prodCode: 'PROD-CS-30KG', qty: 15 }] },

    // September 2026
    { invNum: 'INV-2026-014', date: '2026-09-08', customerKey: 'CUST-IND-001', soNum: 'SO-2026-014', items: [{ prodCode: 'PROD-CS-5T', qty: 2 }] },
    { invNum: 'INV-2026-015', date: '2026-09-22', customerKey: 'CUST-DLR-005', soNum: 'SO-2026-015', items: [{ prodCode: 'PROD-PS-500', qty: 4 }, { prodCode: 'PROD-GS-600', qty: 2 }] },

    // October 2026
    { invNum: 'INV-2026-016', date: '2026-10-05', customerKey: 'CUST-INST-003', soNum: 'SO-2026-016', items: [{ prodCode: 'PROD-AB-220', qty: 3 }] },
    { invNum: 'INV-2026-017', date: '2026-10-12', customerKey: 'CUST-RET-006', soNum: 'SO-2026-017', items: [{ prodCode: 'PROD-CS-30KG', qty: 6 }] },
  ];

  let createdCount = 0;
  for (const inv of invoiceList) {
    await createInvoice(inv);
    createdCount++;
  }

  console.log(`Successfully created/verified ${createdCount} realistic sales invoices.`);
  console.log('Seeding completed successfully!');
}

main()
  .catch(e => {
    console.error('Seeding error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
