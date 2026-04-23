const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function fixInvoice2() {
  await prisma.salesInvoice.update({
    where: { id: 2 },
    data: { challanNumber: "3" }
  });
  
  await prisma.salesChallan.update({
    where: { id: 3 },
    data: { status: 'COMPLETED' }
  });
  
  console.log("Fixed Invoice 2 and Challan 8!");
}

fixInvoice2().catch(console.error).finally(() => prisma.$disconnect());
