const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function cleanupOrphans() {
  try {
    const txs = await prisma.transaction.deleteMany({
      where: {
        invoiceNumber: {
          startsWith: 'JV-'
        }
      }
    });
    console.log(`Deleted ${txs.count} orphaned JV Transactions by prefix`);

    const settlements = await prisma.voucherSettlement.deleteMany({
      where: {
        voucher_type: 'JOURNAL'
      }
    });
    console.log(`Deleted ${settlements.count} JV Settlements by type`);
  } catch (error) {
    console.error('Error cleaning orphans:', error);
  } finally {
    await prisma.$disconnect();
  }
}

cleanupOrphans();
