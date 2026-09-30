const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function resetPayment() {
  try {
    const deletedItems = await prisma.paymentVoucherItem.deleteMany({});
    console.log(`Deleted ${deletedItems.count} Payment Voucher Items`);

    const deletedPVs = await prisma.paymentVoucher.deleteMany({});
    console.log(`Deleted ${deletedPVs.count} Payment Vouchers`);

    const deletedSettlements = await prisma.voucherSettlement.deleteMany({
      where: {
        voucher_type: 'PAYMENT'
      }
    });
    console.log(`Deleted ${deletedSettlements.count} Payment Settlements`);

    const deletedTx = await prisma.transaction.deleteMany({
      where: {
        invoiceNumber: {
          startsWith: 'PV-'
        }
      }
    });
    console.log(`Deleted ${deletedTx.count} PV Transactions`);

    console.log("Successfully reset all Payment Voucher data!");
  } catch (error) {
    console.error("Error resetting Payment:", error);
  } finally {
    await prisma.$disconnect();
  }
}

resetPayment();
