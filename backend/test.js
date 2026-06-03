const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
  const s = await prisma.voucherSettlement.findMany({
    orderBy: { id: 'desc' },
    take: 5
  });
  console.dir(s, { depth: null });
}
main().finally(() => prisma.$disconnect());
