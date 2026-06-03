import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    const grns = await prisma.grn.findMany({
        orderBy: { id: 'desc' },
        take: 3
    });
    console.log(grns);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
