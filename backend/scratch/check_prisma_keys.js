const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function check() {
  console.log(Object.keys(prisma).filter(k => k.toLowerCase().includes('group')));
}

check().catch(console.error).finally(() => prisma.$disconnect());
