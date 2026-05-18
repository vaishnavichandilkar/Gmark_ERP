const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function check() {
  const userId = 1; // Assuming userId 1 for now, or I'll try to find a valid userId
  
  const accounts = await prisma.accountMaster.findMany({
    where: { accountName: { contains: 'sbi', mode: 'insensitive' } }
  });
  console.log('Accounts with "sbi":', accounts.map(a => ({ id: a.id, name: a.accountName, groups: a.groupName, userId: a.userId })));

  const groups = await prisma.group.findMany({
    where: { group_name: { contains: 'sbi', mode: 'insensitive' } }
  });
  console.log('Groups (Level 1) with "sbi":', groups);

  const subGroups = await prisma.subGroup.findMany({
    where: { subgroup_name: { contains: 'sbi', mode: 'insensitive' } }
  });
  console.log('SubGroups (Level 2) with "sbi":', subGroups);

  const subSubGroups = await prisma.subSubGroup.findMany({
    where: { name: { contains: 'sbi', mode: 'insensitive' } }
  });
  console.log('SubSubGroups (Level 3) with "sbi":', subSubGroups);

  await prisma.$disconnect();
}

check();
