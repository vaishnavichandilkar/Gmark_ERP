const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function check() {
  const accounts = await prisma.accountMaster.findMany({
    take: 10,
    select: {
      accountName: true,
      groupName: true,
      accountType: true,
      userId: true
    }
  });
  console.log(JSON.stringify(accounts, null, 2));
}

check().catch(console.error).finally(() => prisma.$disconnect());
