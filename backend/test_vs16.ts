import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function main() {
  const s = await prisma.voucherSettlement.findUnique({
    where: { id: 16 }
  });
  console.dir(s, { depth: null });
}
main().finally(() => prisma.$disconnect());
