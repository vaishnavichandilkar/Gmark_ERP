import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function main() {
  const s = await prisma.voucherSettlement.findFirst({
    where: { voucher_id: 7 }
  });
  console.dir(s, { depth: null });
}
main().finally(() => prisma.$disconnect());
