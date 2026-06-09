const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const c = await prisma.accountMaster.findFirst({
    where: { accountName: 'vaishnavi pvt ltd' }
  });
  console.log(c);
}

main().finally(() => prisma.$disconnect());
