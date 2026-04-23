const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function test() {
    const customerName = "vaishu";
    const userId = 2;
    const soNumber = "SO-00001";
    
    const challans = await prisma.salesChallan.findMany({
      where: {
        userId,
        customerName: { equals: customerName, mode: 'insensitive' },
        status: { not: 'DELETED' },
        ...(soNumber && soNumber.trim() !== '' ? { soNumber: { equals: soNumber.trim(), mode: 'insensitive' } } : {})
      },
      include: {
        items: true,
      },
      orderBy: { createdAt: 'desc' }
    });

    const invoices = await prisma.salesInvoice.findMany({
      where: { 
        userId, 
        status: { not: 'DELETED' },
      },
      include: { items: true }
    });

    const filteredChallans = challans.filter(ch => {
      const totalChallanQty = ch.items.reduce((sum, item) => sum + item.challanQty, 0);
      
      const totalInvoicedQty = invoices.reduce((sum, inv) => {
        if (inv.challanNumber) {
          const challanIds = inv.challanNumber.split(',').map(id => id.trim());
          if (challanIds.includes(ch.id.toString()) || challanIds.includes(ch.challanNumber)) {
            return sum + inv.items.reduce((iSum, i) => iSum + i.quantity, 0);
          }
        }
        return sum;
      }, 0);

      console.log(`Challan ${ch.challanNumber} (ID: ${ch.id}): totalQty=${totalChallanQty}, invoicedQty=${totalInvoicedQty}`);
      return totalInvoicedQty < totalChallanQty;
    });

    console.log("Filtered Challans:");
    filteredChallans.forEach(ch => console.log(ch.challanNumber));
}
test().catch(console.error).finally(() => prisma.$disconnect());
