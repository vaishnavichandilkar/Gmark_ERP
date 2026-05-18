const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const accounts = await prisma.accountMaster.findMany({ where: { accountName: { in: ['icici', 'sbi', 'canara'], mode: 'insensitive' } }});
  console.log('Accounts:', JSON.stringify(accounts.map(a => ({ id: a.id, name: a.accountName, type: a.accountType, groups: a.groupName })), null, 2));

  const g1 = await prisma.group.findMany({ where: { group_name: { in: ['icici', 'sbi', 'canara'], mode: 'insensitive' } }});
  const g2 = await prisma.subGroup.findMany({ where: { subgroup_name: { in: ['icici', 'sbi', 'canara'], mode: 'insensitive' } }});
  const g3 = await prisma.subSubGroup.findMany({ where: { name: { in: ['icici', 'sbi', 'canara'], mode: 'insensitive' } }});
  const g4 = await prisma.subSubSubGroup.findMany({ where: { name: { in: ['icici', 'sbi', 'canara'], mode: 'insensitive' } }});

  console.log('Groups containing these names:', JSON.stringify({g1, g2, g3, g4}, null, 2));
}

main().catch(console.error).finally(() => prisma.$disconnect());
