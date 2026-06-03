import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function main() {
  const invs = await prisma.purchaseInvoice.findMany({
    where: { supplierInvoiceNumber: '6767' }
  });
  console.dir(invs.map(i => ({ id: i.id, total: i.grandTotal.toString() })), { depth: null });
}
main().finally(() => prisma.$disconnect());
