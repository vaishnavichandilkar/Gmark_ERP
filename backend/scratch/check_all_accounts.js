
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkAllAccounts() {
  const accounts = await prisma.accountMaster.findMany();
  console.log('Total Accounts:', accounts.length);
  accounts.forEach(a => {
    console.log(`ID: ${a.id}, Name: ${a.accountName}, UserID: ${a.userId}, Status: ${a.status}`);
  });
}

checkAllAccounts()
  .catch(e => console.error(e))
  .finally(() => prisma.$disconnect());
