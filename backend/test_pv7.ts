import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function main() {
  const p = await prisma.paymentVoucher.findUnique({
    where: { id: 7 }
  });
  console.dir(p, { depth: null });
}
main().finally(() => prisma.$disconnect());
