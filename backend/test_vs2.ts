import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function main() {
  const s = await prisma.voucherSettlement.findMany({
    where: { voucher_id: 7, voucher_type: 'PAYMENT' }
  });
  console.dir(s, { depth: null });
}
main().finally(() => prisma.$disconnect());
