import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function main() {
  const pv = await prisma.paymentVoucher.findUnique({
    where: { voucherNumber: 'PV-0001' }
  });
  if (!pv) {
    console.log("PV-0001 not found");
    return;
  }
  const id = pv.id;

  // Find any linked JVs
  const jvs = await prisma.journalVoucher.findMany({
    where: { narration: { contains: `[Parent PV ID: ${id}]` } }
  });
  const jvIds = jvs.map(j => j.id);
  const jvNumbers = jvs.map(j => j.voucherNumber);

  // Delete settlements
  await prisma.voucherSettlement.deleteMany({
    where: {
      OR: [
        { voucher_id: id, voucher_type: 'PAYMENT' },
        { voucher_id: { in: jvIds }, voucher_type: 'JOURNAL' }
      ]
    }
  });

  // Delete transactions
  await prisma.transaction.deleteMany({
    where: {
      invoiceNumber: { in: ['PV-0001', ...jvNumbers] }
    }
  });

  // Delete child JVs
  if (jvIds.length > 0) {
    await prisma.journalVoucher.deleteMany({
      where: { id: { in: jvIds } }
    });
  }

  // Delete parent PV items
  await prisma.paymentVoucherItem.deleteMany({
    where: { voucherId: id }
  });

  // Delete parent PV
  await prisma.paymentVoucher.delete({
    where: { id }
  });

  console.log("Cleaned up PV-0001 and all its child JVs, transactions, and settlements successfully.");
}
main().finally(() => prisma.$disconnect());
