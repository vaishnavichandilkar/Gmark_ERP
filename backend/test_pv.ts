import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function main() {
  const v = await prisma.paymentVoucher.findFirst({
    where: { voucherNumber: 'PV-0018' },
    include: { items: true }
  });
  console.dir(v, { depth: null });
  
  if (v) {
    const settlements = await prisma.voucherSettlement.findMany({
      where: { voucher_id: v.id, voucher_type: 'PAYMENT' }
    });
    console.dir(settlements, { depth: null });
  }
}
main().finally(() => prisma.$disconnect());
