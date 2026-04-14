const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function check() {
    const inv = await prisma.purchaseInvoice.findUnique({
        where: { id: 6 },
        include: { items: true, expenses: true }
    });
    console.log("Invoice 6:", inv);
}

check().finally(() => prisma.$disconnect());
