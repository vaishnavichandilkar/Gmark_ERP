import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function main() {
  const i = await prisma.purchaseInvoice.findMany({
    where: { invoiceNumber: { in: ['PV-0007', 'PV-0008'] } }
  });
  console.dir(i, { depth: null });
}
main().finally(() => prisma.$disconnect());
