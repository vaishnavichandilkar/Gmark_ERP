const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const { syncBankCashAccounts } = require('../dist/utils/sync-bank-cash');

async function main() {
  try {
    // Note: Use dist since ts-node is not needed if we compiled, or we can use the trigger on prisma service.
    // Actually, let's just trigger syncBankCashAccounts directly.
    console.log('Running syncBankCashAccounts for userId: 2...');
    await syncBankCashAccounts(prisma, 2);
    console.log('Sync complete!');

    const account = await prisma.accountMaster.findFirst({
      where: {
        accountName: { contains: 'sbi', mode: 'insensitive' }
      }
    });
    console.log('--- Updated AccountMaster sbi ---');
    console.log(JSON.stringify(account, null, 2));
  } catch (e) {
    console.error(e);
  } finally {
    await prisma.$disconnect();
  }
}

main();
