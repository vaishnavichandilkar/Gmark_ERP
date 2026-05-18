const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const l1 = await prisma.group.findMany();
  const l2 = await prisma.subGroup.findMany();
  const l3 = await prisma.subSubGroup.findMany();
  const l4 = await prisma.subSubSubGroup.findMany();
  
  console.log('L1:', l1.map(g => ({ name: g.group_name, userId: g.userId })));
  console.log('L2:', l2.map(g => ({ name: g.subgroup_name, userId: g.userId })));
  console.log('L3:', l3.map(g => ({ name: g.name, userId: g.userId })));
  console.log('L4:', l4.map(g => ({ name: g.name, userId: g.userId })));
}

main().catch(console.error).finally(() => prisma.$disconnect());
