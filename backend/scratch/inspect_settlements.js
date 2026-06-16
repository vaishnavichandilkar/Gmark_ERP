const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const settlements = await prisma.voucherSettlement.findMany({
    where: { ledger_id: 3 }
  });
  console.log('Voucher Settlements:', JSON.stringify(settlements, null, 2));
}

main().catch(console.error).finally(() => prisma.$disconnect());
