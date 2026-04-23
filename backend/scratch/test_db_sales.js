const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    const challans = await prisma.salesChallan.findMany({
        include: { items: true }
    });
    const invoices = await prisma.salesInvoice.findMany({
        include: { items: true }
    });
    
    console.log("CHALLANS:");
    challans.forEach(ch => {
        const qty = ch.items.reduce((s, i) => s + i.challanQty, 0);
        console.log(`- ID: ${ch.id}, Num: ${ch.challanNumber}, SO: ${ch.soNumber}, Qty: ${qty}, Status: ${ch.status}`);
    });
    
    console.log("\nINVOICES:");
    invoices.forEach(inv => {
        const qty = inv.items.reduce((s, i) => s + i.quantity, 0);
        console.log(`- ID: ${inv.id}, Num: ${inv.invoiceNumber}, SO: ${inv.soNumber}, Challans: ${inv.challanNumber}, Qty: ${qty}, Status: ${inv.status}`);
    });
}
main().catch(console.error).finally(() => prisma.$disconnect());
