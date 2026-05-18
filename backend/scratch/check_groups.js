const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function check() {
  const groups = await prisma.group.findMany({
    where: { group_name: { contains: 'Bank', mode: 'insensitive' } }
  });
  console.log(JSON.stringify(groups, null, 2));
}

check().catch(console.error).finally(() => prisma.$disconnect());
