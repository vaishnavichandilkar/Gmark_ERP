import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function main() {
  const txs = await prisma.transaction.findMany({
    where: { accountId: 9 }
  });
  console.dir(txs, { depth: null });
}
main().finally(() => prisma.$disconnect());
