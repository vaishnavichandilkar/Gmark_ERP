
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('Fixing all enums in DB...');
  
  const fixEnum = async (typeName, values) => {
    console.log(`Fixing ${typeName}...`);
    for (const val of values) {
      await prisma.$executeRawUnsafe(`ALTER TYPE "${typeName}" ADD VALUE IF NOT EXISTS '${val}'`);
    }
  };

  await fixEnum('POStatus', ['PENDING', 'GRN_COMPLETED', 'INVOICE_COMPLETED', 'DELETED']);
  await fixEnum('SOStatus', ['PENDING', 'CHALLAN_COMPLETED', 'INVOICE_COMPLETED', 'DELETED']);
  await fixEnum('GrnStatus', ['GENERATED', 'COMPLETED', 'DELETED']);
  await fixEnum('PIStatus', ['GENERATED', 'COMPLETED', 'DELETED']);
  await fixEnum('SalesChallanStatus', ['GENERATED', 'COMPLETED', 'DELETED']);
  await fixEnum('SalesInvoiceStatus', ['GENERATED', 'COMPLETED', 'DELETED']);

  console.log('All enums fixed.');
}

main().catch(console.error).finally(() => prisma.$disconnect());
