const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function check() {
  try {
    const accountCount = await prisma.accountMaster.count();
    const transactionCount = await prisma.transaction.count();
    const creditors = await prisma.accountMaster.count({ where: { accountType: 'Creditor' } });
    const debtors = await prisma.accountMaster.count({ where: { accountType: 'Debtor' } });
    
    console.log({
      accountCount,
      transactionCount,
      creditors,
      debtors
    });
  } catch (e) {
    console.error(e);
  } finally {
    await prisma.$disconnect();
  }
}

check();
