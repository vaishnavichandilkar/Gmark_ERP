const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function check() {
  const userId = 1;
  const groups = await prisma.group.findMany({ 
    where: { 
      userId: { in: [null, userId] } 
    } 
  });
  console.log(groups.length);
}

check().catch(console.error).finally(() => prisma.$disconnect());
