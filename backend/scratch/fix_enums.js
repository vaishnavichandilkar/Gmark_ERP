
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('Fixing POStatus enum values...');
  
  // Postgres doesn't allow renaming enum values easily if they are used in tables.
  // We'll use ALTER TYPE ... ADD VALUE if they are missing, but here we want to RENAME.
  // Better approach: Update the table values to the new enum value if we rename.
  
  // 1. Add new values to the enum
  await prisma.$executeRawUnsafe(`ALTER TYPE "POStatus" ADD VALUE IF NOT EXISTS 'GRN_COMPLETED'`);
  await prisma.$executeRawUnsafe(`ALTER TYPE "POStatus" ADD VALUE IF NOT EXISTS 'INVOICE_COMPLETED'`);
  
  // 2. Update existing data if any uses INVOICE_GENERATED
  await prisma.$executeRawUnsafe(`UPDATE purchase_orders SET status = 'INVOICE_COMPLETED' WHERE status::text = 'INVOICE_GENERATED'`);
  
  // Note: We can't easily remove INVOICE_GENERATED from the enum without dropping and recreating it,
  // which is complex if tables depend on it. But having extra values is fine.
  
  console.log('POStatus enum fixed.');

  // Also check SalesOrderStatus
  const soStatus = await prisma.$queryRaw`SELECT enumlabel FROM pg_enum JOIN pg_type ON pg_enum.enumtypid = pg_type.oid WHERE pg_type.typname = 'SalesOrderStatus'`;
  console.log('SalesOrderStatus Enum Values in DB:', soStatus);
  
  await prisma.$executeRawUnsafe(`ALTER TYPE "SalesOrderStatus" ADD VALUE IF NOT EXISTS 'CHALLAN_COMPLETED'`);
  await prisma.$executeRawUnsafe(`ALTER TYPE "SalesOrderStatus" ADD VALUE IF NOT EXISTS 'INVOICE_COMPLETED'`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
