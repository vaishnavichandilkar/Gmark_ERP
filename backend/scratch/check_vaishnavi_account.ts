import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const account = await prisma.accountMaster.findFirst({
    where: { accountName: { contains: 'Vaishnavi', mode: 'insensitive' } }
  });
  console.dir(account, { depth: null });
}
main().finally(() => prisma.$disconnect());
