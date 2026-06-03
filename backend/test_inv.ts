import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function main() {
  const inv = await prisma.purchaseInvoice.findUnique({ where: { id: 11 } });
  console.dir(inv, { depth: null });
}
main().finally(() => prisma.$disconnect());
