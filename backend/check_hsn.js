const { PrismaClient } = require('@prisma/client'); 
const prisma = new PrismaClient(); 
prisma.hsn.findUnique({ where: { hsnCode: '01011020' } })
  .then(console.log)
  .catch(console.error)
  .finally(()=>prisma.$disconnect());
