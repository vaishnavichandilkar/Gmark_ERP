const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkChallan8() {
  const challans = await prisma.salesChallan.findMany({
    where: { challanNumber: "8" },
    include: { items: true }
  });
  console.log("Found Challans with '8':");
  for (const ch of challans) {
    console.log(`- ID: ${ch.id}, Num: ${ch.challanNumber}, Status: ${ch.status}, Qty: ${ch.items.reduce((s,i) => s + i.challanQty, 0)}`);
  }

  const invoices = await prisma.salesInvoice.findMany({
    include: { items: true }
  });
  console.log("\nRecent Invoices:");
  for (const inv of invoices.slice(-3)) {
    console.log(`- ID: ${inv.id}, Num: ${inv.invoiceNumber}, linkedChallans: ${inv.challanNumber}, Qty: ${inv.items.reduce((s,i) => s + i.quantity, 0)}`);
  }
}

checkChallan8().catch(console.error).finally(() => prisma.$disconnect());
