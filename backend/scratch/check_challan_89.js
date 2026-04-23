const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    const challan = await prisma.salesChallan.findFirst({
        where: { challanNumber: "89" },
        include: { items: true }
    });
    console.log("Challan 89:", challan ? `ID: ${challan.id}, Status: ${challan.status}` : "Not found");

    const invoices = await prisma.salesInvoice.findMany({
        where: { challanNumber: { contains: challan?.id?.toString() || "89" } },
        include: { items: true }
    });
    console.log("Invoices linked to Challan 89:", invoices.map(inv => ({
        id: inv.id, 
        invNum: inv.invoiceNumber,
        challans: inv.challanNumber,
        status: inv.status,
        qty: inv.items.reduce((s,i) => s + i.quantity, 0)
    })));
}

main().catch(console.error).finally(() => prisma.$disconnect());
