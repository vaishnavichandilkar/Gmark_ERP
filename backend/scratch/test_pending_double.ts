import { PrismaClient } from '@prisma/client';
import { InvoicesController } from '../src/modules/Finance/vouchers/invoices.controller';

const prisma = new PrismaClient();
const controller = new InvoicesController(prisma as any);

async function main() {
  const req = { user: { userId: 2 } };
  
  console.log("--- Querying pending-double for Vaishnavi (Creditor view / payment) ---");
  const resPayment = await controller.getPendingDoubleTransactions(req, 1, 'payment');
  console.log("Debits (unapplied payments):");
  console.dir(resPayment.debitTransactions, { depth: null });
  console.log("Credits (unpaid invoices + unapplied receipts):");
  console.dir(resPayment.creditTransactions, { depth: null });

  console.log("\n--- Querying pending-double for Vaishnavi (Debtor view / receipt) ---");
  const resReceipt = await controller.getPendingDoubleTransactions(req, 1, 'receipt');
  console.log("Debits (unpaid invoices + unapplied payments):");
  console.dir(resReceipt.debitTransactions, { depth: null });
  console.log("Credits (unapplied receipts):");
  console.dir(resReceipt.creditTransactions, { depth: null });
}
main().finally(() => prisma.$disconnect());
