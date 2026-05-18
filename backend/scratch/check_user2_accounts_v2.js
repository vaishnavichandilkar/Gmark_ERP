
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkUser2Accounts() {
  const accounts = await prisma.accountMaster.findMany({
    where: { userId: 2 }
  });
  console.log('User 2 Accounts:', accounts.length);
  accounts.forEach(a => {
    console.log(`ID: ${a.id}, Name: ${a.accountName}, Group: ${JSON.stringify(a.groupName)}`);
  });
}

checkUser2Accounts()
  .catch(e => console.error(e))
  .finally(() => prisma.$disconnect());
