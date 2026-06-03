import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function main() {
  const settlements = await prisma.voucherSettlement.findMany({
    orderBy: { id: 'desc' },
    take: 10
  });
  console.dir(settlements, { depth: null });
}
main().finally(() => prisma.$disconnect());
