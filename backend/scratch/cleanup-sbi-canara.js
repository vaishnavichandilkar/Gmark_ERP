const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function cleanup() {
  const userId = 2; // As found before

  // 1. Remove "sbi" and "canara" from account groups
  const accountsToFix = await prisma.accountMaster.findMany({
    where: { 
      userId,
      OR: [
        { accountName: 'sbi' },
        { accountName: 'canara' }
      ]
    }
  });

  for (const acc of accountsToFix) {
    const newGroups = acc.groupName.filter(g => g === 'BANK'); // Keep only BANK
    await prisma.accountMaster.update({
      where: { id: acc.id },
      data: { groupName: newGroups }
    });
    console.log(`Updated account ${acc.accountName}: ${acc.groupName.join(',')} -> ${newGroups.join(',')}`);
  }

  // 2. Delete the group named "sbi" from subSubSubGroup
  const deletedSubSubSub = await prisma.subSubSubGroup.deleteMany({
    where: { name: 'sbi', userId }
  });
  console.log(`Deleted ${deletedSubSubSub.count} subSubSubGroups named "sbi"`);

  // 3. Check for "canara" as a group too
  const deletedSubSubSubCanara = await prisma.subSubSubGroup.deleteMany({
    where: { name: 'canara', userId }
  });
  console.log(`Deleted ${deletedSubSubSubCanara.count} subSubSubGroups named "canara"`);

  await prisma.$disconnect();
}

cleanup();
