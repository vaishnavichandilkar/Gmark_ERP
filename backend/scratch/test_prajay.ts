import { PrismaClient } from '@prisma/client';
import { LedgerService } from '../src/modules/Ledger/ledger.service';

const prisma = new PrismaClient();
const ls = new LedgerService(prisma as any);

async function main() {
  const account = await prisma.accountMaster.findFirst({
    where: { accountName: { contains: 'prajay', mode: 'insensitive' } }
  });
  if (!account) {
    console.log("prajay account not found!");
    return;
  }
  console.log("Found account ID:", account.id);

  console.log("--- Sundry Debtors ---");
  const resDebtors = await ls.getDetailedLedger(account.id, account.userId, '2026-04-01', '2027-03-31', 'Sundry Debtors', 1, 14);
  console.dir(resDebtors.items.map(i => ({ 
    date: i.date, 
    particulars: i.particulars, 
    voucherNo: i.voucherNo, 
    debit: i.debit, 
    credit: i.credit, 
    allocations: i.allocations 
  })), { depth: null });

  console.log("--- Sundry Creditors ---");
  const resCreditors = await ls.getDetailedLedger(account.id, account.userId, '2026-04-01', '2027-03-31', 'Sundry Creditors', 1, 14);
  console.dir(resCreditors.items.map(i => ({ 
    date: i.date, 
    particulars: i.particulars, 
    voucherNo: i.voucherNo, 
    debit: i.debit, 
    credit: i.credit, 
    allocations: i.allocations 
  })), { depth: null });
}
main().finally(() => prisma.$disconnect());
