
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('Dropping unique index purchase_invoices_poId_key...');
  const result = await prisma.$executeRawUnsafe('DROP INDEX IF EXISTS "purchase_invoices_poId_key"');
  console.log('Result:', result);
}

main().catch(console.error).finally(() => prisma.$disconnect());
