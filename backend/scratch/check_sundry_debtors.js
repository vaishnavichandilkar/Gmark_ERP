const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const counts = await prisma.accountMaster.groupBy({
    by: ['userId'],
    _count: { id: true }
  });
  console.log('Account counts by User ID:', counts);
  
  const sundryDebtors = await prisma.accountMaster.findMany({
    where: { groupName: { has: 'SUNDRY_DEBTORS' } },
    select: { accountName: true, userId: true }
  });
  console.log('Sundry Debtors:', sundryDebtors);
}

main().catch(console.error).finally(() => prisma.$disconnect());
