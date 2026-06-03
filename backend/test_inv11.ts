import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function main() {
  const s = await prisma.voucherSettlement.findMany({
    where: { invoice_id: 11 }
  });
  console.dir(s, { depth: null });
}
main().finally(() => prisma.$disconnect());
