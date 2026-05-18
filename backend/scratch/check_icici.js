const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function check() {
  const g1 = await prisma.group.findMany({ where: { group_name: { contains: 'icici', mode: 'insensitive' } } });
  const g2 = await prisma.subGroup.findMany({ where: { subgroup_name: { contains: 'icici', mode: 'insensitive' } } });
  const g3 = await prisma.subSubGroup.findMany({ where: { name: { contains: 'icici', mode: 'insensitive' } } });
  const g4 = await prisma.subSubSubGroup.findMany({ where: { name: { contains: 'icici', mode: 'insensitive' } } });
  const g5 = await prisma.subSubSubSubGroup.findMany({ where: { name: { contains: 'icici', mode: 'insensitive' } } });

  console.log('ICICI Groups:', { g1, g2, g3, g4, g5 });
}

check().catch(console.error).finally(() => prisma.$disconnect());
