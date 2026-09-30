const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function checkProduct() {
  const p = await prisma.product.findFirst();
  console.log(p);
}
checkProduct().then(() => prisma.$disconnect());
