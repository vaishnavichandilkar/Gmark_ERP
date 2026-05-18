
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkUser2AccountsCreated() {
  const accounts = await prisma.accountMaster.findMany({
    where: { userId: 2 },
    orderBy: { createdAt: 'desc' }
  });
  console.log('User 2 Accounts (Sorted by CreatedAt Desc):');
  accounts.forEach(a => {
    console.log(`ID: ${a.id}, Name: ${a.accountName}, CreatedAt: ${a.createdAt}`);
  });
}

checkUser2AccountsCreated()
  .catch(e => console.error(e))
  .finally(() => prisma.$disconnect());
