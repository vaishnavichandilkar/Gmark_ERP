
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const result = await prisma.$queryRaw`SELECT typname FROM pg_type WHERE typtype = 'e'`;
  console.log('Enums in DB:', result);
}

main().catch(console.error).finally(() => prisma.$disconnect());
