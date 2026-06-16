import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const settlements = await prisma.voucherSettlement.findMany({
    where: { voucher_id: 1, voucher_type: 'PAYMENT' }
  });
  console.log("--- Settlements for Voucher 1 ---");
  console.dir(settlements, { depth: null });
}
main().finally(() => prisma.$disconnect());
