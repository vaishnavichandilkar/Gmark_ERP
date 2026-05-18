const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function check() {
  console.log('--- Checking AccountMaster ---');
  const accounts = await prisma.accountMaster.findMany({
    where: { userId: 2 }
  });
  console.log('User 2 Accounts:', JSON.stringify(accounts, null, 2));

  console.log('\n--- Checking Groups ---');
  const l1 = await prisma.group.findMany({ where: { group_name: { contains: 'Bank', mode: 'insensitive' } } });
  const l2 = await prisma.subGroup.findMany({ where: { subgroup_name: { contains: 'Bank', mode: 'insensitive' } } });
  const l3 = await prisma.subSubGroup.findMany({ where: { name: { contains: 'Bank', mode: 'insensitive' } } });
  const l4 = await prisma.subSubSubGroup.findMany({ where: { name: { contains: 'Bank', mode: 'insensitive' } } });

  console.log('L1 Groups:', l1.map(g => g.group_name));
  console.log('L2 SubGroups:', l2.map(g => g.subgroup_name));
  console.log('L3 SubSubGroups:', l3.map(g => g.name));
  console.log('L4 SubSubSubGroups:', l4.map(g => g.name));

  console.log('\n--- Checking for "sbi bank" in any group level ---');
  const g1 = await prisma.group.findMany({ where: { group_name: { contains: 'sbi', mode: 'insensitive' } } });
  const g2 = await prisma.subGroup.findMany({ where: { subgroup_name: { contains: 'sbi', mode: 'insensitive' } } });
  const g3 = await prisma.subSubGroup.findMany({ where: { name: { contains: 'sbi', mode: 'insensitive' } } });
  const g4 = await prisma.subSubSubGroup.findMany({ where: { name: { contains: 'sbi', mode: 'insensitive' } } });
  const g5 = await prisma.subSubSubSubGroup.findMany({ where: { name: { contains: 'sbi', mode: 'insensitive' } } });

  console.log('Group L1 matching "sbi":', g1);
  console.log('Group L2 matching "sbi":', g2);
  console.log('Group L3 matching "sbi":', g3);
  console.log('Group L4 matching "sbi":', g4);
  console.log('Group L5 matching "sbi":', g5);
}

check().catch(console.error).finally(() => prisma.$disconnect());
