const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function resetJV() {
  try {
    const deletedItems = await prisma.journalVoucherItem.deleteMany({});
    console.log(`Deleted ${deletedItems.count} Journal Voucher Items`);
    
    const deletedJVs = await prisma.journalVoucher.deleteMany({});
    console.log(`Deleted ${deletedJVs.count} Journal Vouchers`);
    
    // Also, if there are transactions related to JV, they might have been created? 
    // Yes, but let's see if the user meant to just delete the JV records or the whole transactions as well.
    // If we delete JVs, what about the ledgers/transactions?
    // Let's delete the transactions where the source is 'Journal' or 'JV'.
    const deletedTx = await prisma.transaction.deleteMany({
      where: {
        source: {
          in: ['JournalVoucher', 'Journal', 'JV']
        }
      }
    });
    console.log(`Deleted ${deletedTx.count} JV Transactions`);
    
  } catch (error) {
    console.error('Error resetting JV:', error);
  } finally {
    await prisma.$disconnect();
  }
}

resetJV();
