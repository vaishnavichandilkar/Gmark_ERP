import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function main() {
  const pvs = await prisma.paymentVoucher.findMany({
    where: { totalAmount: 900 },
    include: { items: true }
  });
  console.dir(pvs, { depth: null });
  const txs = await prisma.transaction.findMany({
    where: { amount: 900 }
  });
  console.dir(txs.map(t => ({ id: t.id, no: t.invoiceNumber, type: t.transactionType })), { depth: null });
}
main().finally(() => prisma.$disconnect());
