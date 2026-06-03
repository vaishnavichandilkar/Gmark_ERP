import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function main() {
  const s = await prisma.voucherSettlement.findMany({
    select: { id: true, voucher_id: true }
  });
  console.dir(s, { maxArrayLength: null });
}
main().finally(() => prisma.$disconnect());
