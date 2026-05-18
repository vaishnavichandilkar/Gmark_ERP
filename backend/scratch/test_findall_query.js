
const { PrismaClient, AccountType, MasterStatus } = require('@prisma/client');
const prisma = new PrismaClient();

async function testFindAll() {
  const userId = 2;
  const where = { userId };

  // Replicate logic from service
  where.accountType = { notIn: [AccountType.Bank, AccountType.Cash] };
  where.NOT = {
    groupName: { hasSome: ['BANK', 'CASH', 'Bank & Cash'] }
  };

  const accounts = await prisma.accountMaster.findMany({
    where,
    orderBy: { createdAt: 'desc' }
  });

  console.log('Results for general view (User 2):');
  accounts.forEach(a => {
    console.log(`ID: ${a.id}, Name: ${a.accountName}, Type: ${a.accountType}, Status: ${a.status}`);
  });
}

testFindAll()
  .catch(e => console.error(e))
  .finally(() => prisma.$disconnect());
