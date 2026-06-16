const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const accounts = await prisma.accountMaster.findMany({
    select: {
      id: true,
      accountName: true,
      accountType: true,
      groupName: true
    }
  });
  console.log(JSON.stringify(accounts, null, 2));
}

main().catch(console.error).finally(() => prisma.$disconnect());
