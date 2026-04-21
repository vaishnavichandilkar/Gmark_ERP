const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const all = await prisma.accountMaster.findMany({
    select: { id: true, accountName: true, userId: true }
  });
  console.log('All Accounts:', all);
  
  const userId2 = await prisma.accountMaster.findMany({
    where: { userId: 2 },
    select: { id: true, accountName: true, userId: true }
  });
  console.log('User 2 Accounts:', userId2);
}

main().catch(console.error).finally(() => prisma.$disconnect());
