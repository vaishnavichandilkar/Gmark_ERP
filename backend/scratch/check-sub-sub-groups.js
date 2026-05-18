const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function check() {
  const userId = 2;
  
  const currentAssets = await prisma.subGroup.findFirst({
    where: { subgroup_name: 'Current Assets' },
    include: { sub_sub_groups: { include: { sub_sub_sub_groups: true } } }
  });
  
  if (currentAssets) {
    console.log('SubSubGroups of Current Assets:', currentAssets.sub_sub_groups.map(ssg => ({
      name: ssg.name,
      subSubSubGroups: ssg.sub_sub_sub_groups.map(sssg => sssg.name)
    })));
  } else {
    console.log('Current Assets group not found');
  }

  const allAccounts = await prisma.accountMaster.findMany({ where: { userId } });
  console.log('All Account groupNames:', allAccounts.map(a => ({ name: a.accountName, groups: a.groupName })));

  await prisma.$disconnect();
}

check();
