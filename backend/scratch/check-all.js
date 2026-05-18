const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function check() {
  try {
    const l1 = await prisma.group.findMany();
    const l2 = await prisma.subGroup.findMany();
    const l3 = await prisma.subSubGroup.findMany();
    const l4 = await prisma.subSubSubGroup.findMany();
    const l5 = await prisma.subSubSubSubGroup.findMany();

    console.log('L1 (Group):', l1.map(g => g.group_name));
    console.log('L2 (SubGroup):', l2.map(g => g.subgroup_name));
    console.log('L3 (SubSubGroup):', l3.map(g => g.name));
    console.log('L4 (SubSubSubGroup):', l4.map(g => g.name));
    console.log('L5 (SubSubSubSubGroup):', l5.map(g => g.name));

    const accounts = await prisma.accountMaster.findMany();
    console.log('Accounts:', accounts.map(a => `${a.accountName} (${a.groupName})`));

  } catch (e) {
    console.error(e);
  } finally {
    await prisma.$disconnect();
  }
}

check();
