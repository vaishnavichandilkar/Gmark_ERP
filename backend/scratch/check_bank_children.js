const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function check() {
  const g = await prisma.subSubSubGroup.findMany({ where: { sub_sub_group_id: 13 } });
  console.log('Children of Bank & Cash:', JSON.stringify(g, null, 2));
}

check().catch(console.error).finally(() => prisma.$disconnect());
