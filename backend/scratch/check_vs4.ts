import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const vs4 = await prisma.voucherSettlement.findUnique({
    where: { id: 4 }
  });
  console.log("--- VS-4 ---");
  console.dir(vs4, { depth: null });

  if (vs4?.voucher_id) {
    if (vs4.voucher_type === 'RECEIPT') {
      const v = await prisma.receiptVoucher.findUnique({ where: { id: vs4.voucher_id } });
      console.log("Receipt Voucher:", v);
    } else {
      const v = await prisma.paymentVoucher.findUnique({ where: { id: vs4.voucher_id } });
      console.log("Payment Voucher:", v);
    }
  }
}
main().finally(() => prisma.$disconnect());
