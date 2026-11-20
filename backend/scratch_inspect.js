const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function run() {
  console.log('--- Inspector Ready ---');
}

run().catch(console.error).finally(() => prisma.$disconnect());
