import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function main() {
  const settlements = await prisma.voucherSettlement.findMany({
    where: { invoice_id: 2 }
  });
  console.dir(settlements, { depth: null });
}
main().finally(() => prisma.$disconnect());
