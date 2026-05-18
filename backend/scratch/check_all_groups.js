const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function check() {
  const groups = await prisma.group.findMany();
  const subGroups = await prisma.subGroup.findMany();
  console.log('Groups:', groups.length);
  console.log('SubGroups:', subGroups.length);
  
  const allNames = [
    ...groups.map(g => g.group_name),
    ...subGroups.map(g => g.subgroup_name)
  ];
  console.log('Names including Bank/Cash:', allNames.filter(n => /bank|cash/i.test(n)));
}

check().catch(console.error).finally(() => prisma.$disconnect());
