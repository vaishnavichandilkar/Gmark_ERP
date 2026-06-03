import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function main() {
  const inv = await prisma.purchaseInvoice.findFirst({
    where: { supplierInvoiceNumber: '6767' }
  });
  console.log("Invoice ID:", inv?.id);
  if (inv) {
    const settlements = await prisma.voucherSettlement.findMany({
      where: { invoice_id: inv.id }
    });
    console.dir(settlements.map(s => ({ id: s.id, amount: s.settled_amount.toString(), voucher_id: s.voucher_id })), { depth: null });
  }
}
main().finally(() => prisma.$disconnect());
