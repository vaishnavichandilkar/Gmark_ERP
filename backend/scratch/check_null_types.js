
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkNullAccountTypes() {
  const accounts = await prisma.accountMaster.findMany({
    where: { accountType: null }
  });
  console.log('Accounts with null accountType:', accounts.length);
  accounts.forEach(a => {
    console.log(`ID: ${a.id}, Name: ${a.accountName}, Groups: ${JSON.stringify(a.groupName)}`);
  });
}

checkNullAccountTypes()
  .catch(e => console.error(e))
  .finally(() => prisma.$disconnect());
