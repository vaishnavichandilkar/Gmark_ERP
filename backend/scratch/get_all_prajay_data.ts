import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const accountId = 3;
  const transactions = await prisma.transaction.findMany({
    where: { accountId }
  });
  console.log("--- All Transactions ---");
  console.dir(transactions, { depth: null });

  const salesInvoices = await prisma.salesInvoice.findMany({
    where: { customerId: accountId }
  });
  console.log("--- Sales Invoices ---");
  console.dir(salesInvoices, { depth: null });

  const purchaseInvoices = await prisma.purchaseInvoice.findMany({
    where: { supplierId: accountId }
  });
  console.log("--- Purchase Invoices ---");
  console.dir(purchaseInvoices, { depth: null });

  const settlements = await prisma.voucherSettlement.findMany({
    where: { ledger_id: accountId }
  });
  console.log("--- Voucher Settlements ---");
  console.dir(settlements, { depth: null });
}
main().finally(() => prisma.$disconnect());
