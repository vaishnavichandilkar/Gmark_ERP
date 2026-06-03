import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function main() {
  const v = await prisma.paymentVoucher.findUnique({
    where: { id: 6 }
  });
  console.dir(v, { depth: null });
}
main().finally(() => prisma.$disconnect());
