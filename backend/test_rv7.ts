import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function main() {
  const r = await prisma.receiptVoucher.findUnique({
    where: { id: 7 }
  });
  console.dir(r, { depth: null });
}
main().finally(() => prisma.$disconnect());
