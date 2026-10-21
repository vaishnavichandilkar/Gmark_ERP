const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function listModels() {
  console.log(Object.keys(prisma));
}
listModels().then(() => prisma.$disconnect());
