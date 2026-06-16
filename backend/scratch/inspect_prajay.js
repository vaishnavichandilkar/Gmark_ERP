const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function inspect() {
  try {
    const accounts = await prisma.accountMaster.findMany({
      where: {
        accountName: {
          contains: 'prajay',
          mode: 'insensitive'
        }
      }
    });
    console.log('Found accounts:', JSON.stringify(accounts, null, 2));
  } catch (e) {
    console.error(e);
  } finally {
    await prisma.$disconnect();
  }
}

inspect();
