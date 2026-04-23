const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const ChallanService = require('./src/modules/Sales/sales-invoice/Challan/challan.service').ChallanService;

async function test() {
  const service = new ChallanService({ prisma });
  // customerName = "vaishu", userId = 2, soNumber = "SO-00001"
  const challans = await service.getCustomerChallans("vaishu", 2, "SO-00001");
  console.log("Returned challans:");
  challans.forEach(ch => console.log(ch.challanNumber));
}
test().catch(console.error).finally(() => prisma.$disconnect());
