const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const g1 = await prisma.group.findMany({ where: { group_name: { contains: 'cash in hand', mode: 'insensitive' } }});
  const g2 = await prisma.subGroup.findMany({ where: { subgroup_name: { contains: 'cash in hand', mode: 'insensitive' } }});
  const g3 = await prisma.subSubGroup.findMany({ where: { name: { contains: 'cash in hand', mode: 'insensitive' } }});
  const g4 = await prisma.subSubSubGroup.findMany({ where: { name: { contains: 'cash in hand', mode: 'insensitive' } }});

  console.log('Groups:', JSON.stringify(g1, null, 2));
  console.log('SubGroups:', JSON.stringify(g2, null, 2));
  console.log('SubSubGroups:', JSON.stringify(g3, null, 2));
  console.log('SubSubSubGroups:', JSON.stringify(g4, null, 2));

  const accounts = await prisma.accountMaster.findMany({ where: { accountName: { contains: 'cash in hand', mode: 'insensitive' } }});
  console.log('Accounts:', JSON.stringify(accounts, null, 2));
}

main().catch(console.error).finally(() => prisma.$disconnect());
