import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const pInv = await prisma.purchaseInvoice.findUnique({
    where: { id: 1 }
  });
  console.log("Purchase Invoice ID 1:", pInv);

  const sInv = await prisma.salesInvoice.findUnique({
    where: { id: 1 }
  });
  console.log("Sales Invoice ID 1:", sInv);
}
main().finally(() => prisma.$disconnect());
