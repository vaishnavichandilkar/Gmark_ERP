
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const pos = await prisma.purchaseOrder.findMany({
    include: { items: true, purchaseInvoices: { include: { items: true } } }
  });
  console.log('All POs:', JSON.stringify(pos, null, 2));
}

main().catch(console.error).finally(() => prisma.$disconnect());
