const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const grns = await prisma.grn.findMany({
    select: { supplierName: true, challanNumber: true, status: true, userId: true }
  });
  console.log(JSON.stringify(grns, null, 2));
}

main()
  .catch(e => console.error(e))
  .finally(async () => await prisma.$disconnect());
