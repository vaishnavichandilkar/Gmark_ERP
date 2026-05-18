const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function check() {
  try {
    const bankGroups = await prisma.group.findMany({
      where: {
        OR: [
          { group_name: { contains: 'Bank', mode: 'insensitive' } },
          { group_name: { contains: 'Cash', mode: 'insensitive' } }
        ]
      },
      include: {
        children: true
      }
    });

    console.log('Bank/Cash Groups:', JSON.stringify(bankGroups, null, 2));

    const bankAccounts = await prisma.accountMaster.findMany({
      where: {
        OR: [
          { accountType: 'Bank' },
          { accountType: 'Cash' },
          { groupName: { hasSome: bankGroups.map(g => g.group_name) } }
        ]
      }
    });

    console.log('Bank/Cash Accounts:', JSON.stringify(bankAccounts, null, 2));
  } catch (e) {
    console.error(e);
  } finally {
    await prisma.$disconnect();
  }
}

check();
