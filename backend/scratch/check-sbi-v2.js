const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function check() {
  const userId = 2; // From previous output
  
  const levels = [
    { name: 'group', col: 'group_name' },
    { name: 'subGroup', col: 'subgroup_name' },
    { name: 'subSubGroup', col: 'name' },
    { name: 'subSubSubGroup', col: 'name' },
    { name: 'subSubSubSubGroup', col: 'name' }
  ];

  for (const level of levels) {
    const results = await prisma[level.name].findMany({
      where: { [level.col]: { contains: 'sbi', mode: 'insensitive' } }
    });
    console.log(`${level.name} results:`, results);
  }

  const accounts = await prisma.accountMaster.findMany({
    where: { userId }
  });
  console.log('All Accounts for User 2:', accounts.map(a => ({ name: a.accountName, groups: a.groupName })));

  await prisma.$disconnect();
}

check();
