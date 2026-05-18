
const { PrismaClient, AccountType } = require('@prisma/client');
const prisma = new PrismaClient();

async function fixVaishnavi() {
  const result = await prisma.accountMaster.update({
    where: { id: 8 },
    data: { accountType: 'Creditor' }
  });
  console.log('Fixed Vaishnavi accountType:', result.accountType);
}

fixVaishnavi()
  .catch(e => console.error(e))
  .finally(() => prisma.$disconnect());
