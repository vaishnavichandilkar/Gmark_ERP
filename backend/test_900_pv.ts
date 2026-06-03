import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function main() {
  const vs = await prisma.paymentVoucher.findMany({
    where: { totalAmount: 900 }
  });
  console.dir(vs, { depth: null });
  
  for (const v of vs) {
     const s = await prisma.voucherSettlement.findMany({ where: { voucher_id: v.id } });
     console.dir(s.map(x => ({ id: x.id, amt: x.settled_amount.toString(), inv: x.invoice_id })), { depth: null });
  }
}
main().finally(() => prisma.$disconnect());
