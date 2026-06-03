import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function main() {
  const p = await prisma.paymentVoucher.findMany({
    where: { voucherNumber: { in: ['PV-0007', 'PV-0008'] } },
    select: { voucherNumber: true, narration: true }
  });
  console.dir(p, { depth: null });
}
main().finally(() => prisma.$disconnect());
