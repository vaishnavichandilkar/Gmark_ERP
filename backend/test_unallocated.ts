import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function main() {
  const p = await prisma.voucherSettlement.findMany({
    where: { voucher_type: 'PAYMENT', invoice_id: null }
  });
  console.dir(p.map(x => ({ id: x.id, amt: x.settled_amount.toString() })), { depth: null });
}
main().finally(() => prisma.$disconnect());
