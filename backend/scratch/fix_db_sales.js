const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    await prisma.salesInvoice.updateMany({
        where: { id: 1 },
        data: { challanNumber: "1" }
    });
    
    // Also trigger the status update function if needed, or just update the challan
    await prisma.salesChallan.update({
        where: { id: 1 },
        data: { status: 'COMPLETED' }
    });
    
    console.log("Updated database to fix missing challan relations.");
}

main().catch(console.error).finally(() => prisma.$disconnect());
