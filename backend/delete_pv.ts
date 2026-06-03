import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function main() {
  await prisma.voucherSettlement.deleteMany({
    where: { voucher_id: 18, voucher_type: 'PAYMENT' }
  });
  
  await prisma.paymentVoucherItem.deleteMany({
    where: { voucherId: 18 }
  });

  await prisma.transaction.deleteMany({
    where: { invoiceNumber: 'PV-0018' }
  });

  await prisma.paymentVoucher.delete({
    where: { id: 18 }
  });

  console.log("Deleted PV-0018");
}
main().finally(() => prisma.$disconnect());
