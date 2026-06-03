import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function main() {
  const pvs = await prisma.paymentVoucher.findMany({
    orderBy: { createdAt: 'desc' },
    take: 5,
    include: { items: true }
  });
  console.dir(pvs, { depth: null });
}
main().finally(() => prisma.$disconnect());
