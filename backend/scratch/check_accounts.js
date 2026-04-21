const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const counts = await prisma.accountMaster.groupBy({
    by: ['userId'],
    _count: {
      _all: true
    }
  });
  console.log('AccountMaster records per userId:', JSON.stringify(counts, null, 2));
  
  const allUsers = await prisma.user.findMany({ select: { id: true, phone: true } });
  console.log('All Users:', JSON.stringify(allUsers, null, 2));
}

main()
  .catch(e => console.error(e))
  .finally(async () => await prisma.$disconnect());
