const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const salesInvoice = await prisma.salesInvoice.findFirst({
    where: { id: 1 }
  });
  const purchaseInvoice = await prisma.purchaseInvoice.findFirst({
    where: { id: 1 }
  });
  console.log('Sales Invoice id 1:', JSON.stringify(salesInvoice, null, 2));
  console.log('Purchase Invoice id 1:', JSON.stringify(purchaseInvoice, null, 2));
}

main().catch(console.error).finally(() => prisma.$disconnect());
