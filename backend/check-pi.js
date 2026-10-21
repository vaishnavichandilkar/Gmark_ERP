const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function checkPI() {
  const pvs = await prisma.purchaseInvoice.findMany({ select: { id: true, invoiceNumber: true, invoiceDate: true, supplierInvoiceDate: true, bookingDate: true } });
  console.log(pvs);
}
checkPI().then(() => prisma.$disconnect());
