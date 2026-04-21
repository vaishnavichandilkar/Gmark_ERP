const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const accounts = await prisma.accountMaster.findMany({
    select: { accountName: true, userId: true }
  });
  console.log('All Account Names and UserIds:', JSON.stringify(accounts, null, 2));
}

main()
  .catch(e => console.error(e))
  .finally(async () => await prisma.$disconnect());
