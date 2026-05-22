const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function run() {
  const pincodes = await prisma.pincode.findMany();
  console.log('Total pincodes in DB:', pincodes.length);
  console.log('Pincodes:', pincodes.map(p => ({ pincode: p.pincode, isActive: p.isActive, state: p.state, district: p.district, areas: p.areas.length })));
  await prisma.$disconnect();
}

run();
