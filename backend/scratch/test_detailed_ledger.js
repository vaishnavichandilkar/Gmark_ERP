const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const { LedgerService } = require('../dist/modules/Ledger/ledger.service');

async function test() {
  try {
    const service = new LedgerService(prisma);
    const ledger = await service.getDetailedLedger(4, 2, '2026-04-01', '2027-03-31');
    console.log('--- Detailed Ledger Output ---');
    console.log('Account Name:', ledger.accountName);
    console.log('Opening Balance:', ledger.openingBalance);
    console.log('Total Transactions:', ledger.total);
    console.log('First 3 items:');
    console.log(JSON.stringify(ledger.items.slice(0, 3), null, 2));
  } catch (e) {
    console.error(e);
  } finally {
    await prisma.$disconnect();
  }
}

test();
