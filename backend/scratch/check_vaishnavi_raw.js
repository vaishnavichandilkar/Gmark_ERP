
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkVaishnaviRaw() {
  const account = await prisma.accountMaster.findUnique({
    where: { id: 8 }
  });
  console.log('Vaishnavi Raw Data:', JSON.stringify(account, null, 2));
}

checkVaishnaviRaw()
  .catch(e => console.error(e))
  .finally(() => prisma.$disconnect());
