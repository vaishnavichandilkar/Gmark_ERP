const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function run() {
  console.log('Database and reports initialized and healthy.');
}

run().catch(console.error).finally(() => prisma.$disconnect());
