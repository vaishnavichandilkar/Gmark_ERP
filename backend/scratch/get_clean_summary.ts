import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const accountId = 3;
  const transactions = await prisma.transaction.findMany({
    where: { accountId }
  });
  console.log("--- TRANSACTIONS ---");
  transactions.forEach(t => {
    console.log(`ID: ${t.id}, Date: ${t.bookingDate.toISOString().split('T')[0]}, Type: ${t.transactionType}, Amt: ${t.amount}, Entry: ${t.entryType}, InvNo: ${t.invoiceNumber}`);
  });

  const salesInvs = await prisma.salesInvoice.findMany({
    where: { customerId: accountId }
  });
  console.log("\n--- SALES INVOICES ---");
  salesInvs.forEach(si => {
    console.log(`ID: ${si.id}, No: ${si.invoiceNumber}, Date: ${si.invoiceDate.toISOString().split('T')[0]}, Total: ${si.grandTotal}, Status: ${si.status}`);
  });

  const purchInvs = await prisma.purchaseInvoice.findMany({
    where: { supplierId: accountId }
  });
  console.log("\n--- PURCHASE INVOICES ---");
  purchInvs.forEach(pi => {
    console.log(`ID: ${pi.id}, No: ${pi.invoiceNumber}, Date: ${pi.invoiceDate.toISOString().split('T')[0]}, Total: ${pi.grandTotal}, Status: ${pi.status}`);
  });

  const settlements = await prisma.voucherSettlement.findMany({
    where: { ledger_id: accountId }
  });
  console.log("\n--- SETTLEMENTS ---");
  settlements.forEach(s => {
    console.log(`ID: ${s.id}, VoucherID: ${s.voucher_id}, VoucherType: ${s.voucher_type}, InvoiceID: ${s.invoice_id}, Type: ${s.settlement_type}, Amt: ${s.settled_amount}`);
  });
}
main().finally(() => prisma.$disconnect());
