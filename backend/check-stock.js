const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkData() {
  const pCount = await prisma.purchaseInvoiceItem.count();
  const sCount = await prisma.salesInvoiceItem.count();
  console.log(`Purchase Items: ${pCount}, Sales Items: ${sCount}`);
  
  const pvs = await prisma.purchaseInvoice.findMany({ select: { id: true, invoiceNumber: true, taxableAmount: true } });
  console.log(`Purchase Invoices: ${pvs.length}`);
  
  const groups = await prisma.accountMaster.findMany({ 
    where: { OR: [{ groupName: { has: 'Closing Stock' } }, { groupName: { has: 'Opening Stock' } }] },
    select: { id: true, accountName: true, groupName: true, customerOpeningBalance: true, supplierOpeningBalance: true }
  });
  console.log(`Stock Ledgers:`, groups);
}

checkData().then(() => prisma.$disconnect());
