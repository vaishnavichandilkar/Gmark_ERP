const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function fix() {
  const userId = 2;

  // 1. Delete "icici" from subSubSubGroup
  const del = await prisma.subSubSubGroup.deleteMany({
    where: { name: 'icici', userId }
  });
  console.log(`Deleted ${del.count} groups named "icici"`);

  // 2. Update accounts to use "Bank & Cash" group
  const bankAccounts = await prisma.accountMaster.findMany({
    where: { 
      userId,
      accountName: { in: ['icici', 'sbi', 'canara'], mode: 'insensitive' }
    }
  });

  for (const acc of bankAccounts) {
    await prisma.accountMaster.update({
      where: { id: acc.id },
      data: { groupName: ['Bank & Cash'] }
    });
    console.log(`Updated account ${acc.accountName} to use "Bank & Cash" group`);
  }

  await prisma.$disconnect();
}

fix();
