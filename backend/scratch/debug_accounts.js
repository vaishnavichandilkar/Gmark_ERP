
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const accounts = await prisma.accountMaster.findMany({
    where: { groupName: { has: 'SUNDRY_CREDITORS' } }
  });
  console.log('Accounts:', JSON.stringify(accounts, null, 2));
}

main().catch(console.error).finally(() => prisma.$disconnect());
