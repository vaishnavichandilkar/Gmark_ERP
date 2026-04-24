
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('Fixing enums...');
  
  const fixEnum = async (typeName, values, renameMap = {}) => {
    console.log(`Fixing ${typeName}...`);
    for (const val of values) {
      await prisma.$executeRawUnsafe(`ALTER TYPE "${typeName}" ADD VALUE IF NOT EXISTS '${val}'`);
    }
    for (const [oldVal, newVal] of Object.entries(renameMap)) {
      // Find if oldVal exists
      const exists = await prisma.$queryRawUnsafe(`SELECT 1 FROM pg_enum JOIN pg_type ON pg_enum.enumtypid = pg_type.oid WHERE pg_type.typname = '${typeName}' AND enumlabel = '${oldVal}'`);
      if (exists.length > 0) {
          // Since we can't easily rename, we'll just update the data in tables that use it.
          // This is a bit complex as we need to know the tables.
          // For now, adding the new values is enough to stop the crashes.
      }
    }
  };

  await fixEnum('POStatus', ['GRN_COMPLETED', 'INVOICE_COMPLETED']);
  await fixEnum('SOStatus', ['CHALLAN_COMPLETED', 'INVOICE_COMPLETED']);
  
  // Update data for POs
  await prisma.$executeRawUnsafe(`UPDATE purchase_orders SET status = 'INVOICE_COMPLETED' WHERE status::text = 'INVOICE_GENERATED'`);
  // Update data for SOs
  await prisma.$executeRawUnsafe(`UPDATE sales_orders SET status = 'INVOICE_COMPLETED' WHERE status::text = 'INVOICE_GENERATED'`);

  console.log('Enums fixed.');
}

main().catch(console.error).finally(() => prisma.$disconnect());
