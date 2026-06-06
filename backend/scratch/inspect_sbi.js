const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function check() {
  try {
    const account = await prisma.accountMaster.findFirst({
      where: {
        accountName: { contains: 'sbi', mode: 'insensitive' }
      }
    });
    console.log('--- AccountMaster sbi ---');
    console.log(JSON.stringify(account, null, 2));

    if (account) {
      const groupName = account.accountName;
      const subGroup = await prisma.subSubSubGroup.findFirst({
        where: {
          name: { equals: groupName, mode: 'insensitive' }
        }
      });
      console.log('--- SubSubSubGroup for sbi ---');
      console.log(JSON.stringify(subGroup, null, 2));
    }
  } catch (e) {
    console.error(e);
  } finally {
    await prisma.$disconnect();
  }
}

check();
