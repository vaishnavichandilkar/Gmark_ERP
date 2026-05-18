const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function check() {
  const userId = 2;
  const accounts = await prisma.accountMaster.findMany({
    where: { userId, accountName: { in: ['icici', 'sbi', 'canara'] } },
    select: { accountName: true, accountType: true, groupName: true }
  });
  console.log('Bank Accounts:', accounts);
  await prisma.$disconnect();
}

check();
