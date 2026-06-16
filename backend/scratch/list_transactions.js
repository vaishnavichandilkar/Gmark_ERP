const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const transactions = await prisma.transaction.findMany({
    where: { accountId: 3 }
  });
  console.log(JSON.stringify(transactions, null, 2));
}

main().catch(console.error).finally(() => prisma.$disconnect());
