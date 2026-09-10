const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function run() {
  console.log('--- Payment Vouchers ---');
  const pvs = await prisma.paymentVoucher.findMany({
    include: { items: true },
    take: 20
  });
  console.log(JSON.stringify(pvs, null, 2));

  console.log('--- Voucher Settlements ---');
  const settlements = await prisma.voucherSettlement.findMany({
    take: 50
  });
  console.log(JSON.stringify(settlements, null, 2));

  console.log('--- Payment Voucher Items ---');
  const pvItems = await prisma.paymentVoucherItem.findMany({
    take: 50
  });
  console.log(JSON.stringify(pvItems, null, 2));
}

run().catch(console.error).finally(() => prisma.$disconnect());
