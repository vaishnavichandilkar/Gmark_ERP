const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
  const inv = await prisma.purchaseInvoice.findUnique({
    where: { id: 2 }
  });
  console.dir(inv, { depth: null });
}
main().finally(() => prisma.$disconnect());
