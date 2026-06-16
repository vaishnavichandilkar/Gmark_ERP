const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const pos = await prisma.purchaseOrder.findMany({
    include: { items: true }
  });
  console.log(JSON.stringify(pos, null, 2));
}

main().finally(() => prisma.$disconnect());

