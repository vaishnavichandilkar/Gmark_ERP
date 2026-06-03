import { PrismaClient } from '@prisma/client';
import { LedgerService } from './src/modules/Ledger/ledger.service';

const prisma = new PrismaClient();
const ls = new LedgerService(prisma as any);

async function main() {
  const accountId = 9;
  const userId = 2; // Assuming the user is ID 2 based on previous tests
  
  const res = await ls.getDetailedLedger(accountId, userId, '2026-04-01', '2027-03-31', 'Sundry Creditors', 1, 14);
  const inv = res.items.find(t => t.invoiceNumber === '6767');
  console.dir(inv, { depth: null });
}
main().finally(() => prisma.$disconnect());
