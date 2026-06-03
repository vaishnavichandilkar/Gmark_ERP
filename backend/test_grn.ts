import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const grn = await prisma.grn.findFirst({
    where: { challanNumber: '7878' },
    include: { items: true }
  });
  console.log('GRN:', grn);
  
  if (grn) {
    const invoices = await prisma.purchaseInvoice.findMany({
      where: {
        challanNumber: { contains: '7878' }
      }
    });
    console.log('Linked Invoices by challanNumber 7878:', invoices);

    const invoicesById = await prisma.purchaseInvoice.findMany({
      where: {
        challanNumber: { contains: grn.id.toString() }
      }
    });
    console.log('Linked Invoices by GRN ID:', invoicesById);
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
