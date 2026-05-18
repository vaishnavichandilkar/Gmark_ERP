const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function check() {
  const userId = 2;
  
  const groups = await prisma.group.findMany({
    where: { OR: [{ userId: null, is_header: true }, { userId }] },
    include: { sub_groups: true }
  });
  console.log('Groups for User 2:', groups.map(g => ({ id: g.id, name: g.group_name, subGroups: g.sub_groups.map(sg => sg.subgroup_name) })));

  const accounts = await prisma.accountMaster.findMany({
    where: { userId }
  });
  console.log('Accounts for User 2:', accounts.map(a => ({ name: a.accountName, groups: a.groupName })));

  await prisma.$disconnect();
}

check();
