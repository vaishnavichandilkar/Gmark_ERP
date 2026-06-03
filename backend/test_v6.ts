import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function main() {
  const v = await prisma.paymentVoucher.findUnique({
    where: { id: 6 }
  });
  console.log("Voucher 6 exists:", !!v);
}
main().finally(() => prisma.$disconnect());
