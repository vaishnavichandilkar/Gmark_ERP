const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkDates() {
  const pvs = await prisma.purchaseInvoice.findMany({ select: { id: true, invoiceNumber: true, bookingDate: true } });
  console.log(`Purchase Invoices:`, pvs);
  const svs = await prisma.salesInvoice.findMany({ select: { id: true, invoiceNumber: true, bookingDate: true }, take: 10 });
  console.log(`Sales Invoices (first 10):`, svs);
}

checkDates().then(() => prisma.$disconnect());
