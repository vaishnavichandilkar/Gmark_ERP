
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkAccount() {
  const account = await prisma.accountMaster.findFirst({
    where: { accountName: 'Vaishnavi' }
  });
  console.log(JSON.stringify(account, null, 2));
}

checkAccount()
  .catch(e => console.error(e))
  .finally(() => prisma.$disconnect());
