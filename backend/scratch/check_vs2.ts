import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const vs2 = await prisma.voucherSettlement.findUnique({
    where: { id: 2 }
  });
  console.log("--- VS-2 ---");
  console.dir(vs2, { depth: null });
  
  if (vs2?.voucher_id) {
    if (vs2.voucher_type === 'PAYMENT') {
      const v = await prisma.paymentVoucher.findUnique({ where: { id: vs2.voucher_id } });
      console.log("Payment Voucher:", v);
    } else {
      const r = await prisma.receiptVoucher.findUnique({ where: { id: vs2.voucher_id } });
      console.log("Receipt Voucher:", r);
    }
  }
}
main().finally(() => prisma.$disconnect());
