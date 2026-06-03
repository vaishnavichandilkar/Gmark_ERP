const { PrismaClient } = require('@prisma/client'); 
const prisma = new PrismaClient(); 
async function main() {
  const trans = await prisma.transaction.findMany({ where: { narration: { contains: 'Debit' } }});
  console.log('Transactions:', trans.length);
  if(trans.length) console.log(trans[0].narration);
  
  const pv = await prisma.paymentVoucher.findMany({ where: { narration: { contains: 'Debit' } }});
  console.log('PaymentVouchers:', pv.length);
  if(pv.length) console.log(pv[0].narration);
}
main().catch(console.error).finally(()=>prisma.$disconnect());
