const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function check() {
  try {
    const accs = await prisma.accountMaster.findMany({
      where: {
        groupName: { has: 'sbi bank' }
      }
    });
    console.log('Accounts under sbi bank:', accs.length);

    const allBankAccs = await prisma.accountMaster.findMany({
        where: {
            OR: [
                { accountType: 'Bank' },
                { groupName: { hasSome: ['BANK', 'Bank', 'Bank & Cash'] } }
            ]
        }
    });
    console.log('Total Bank Accounts:', allBankAccs.length);
    console.log('Bank Accounts Names:', allBankAccs.map(a => a.accountName));

  } catch (e) {
    console.error(e);
  } finally {
    await prisma.$disconnect();
  }
}

check();
