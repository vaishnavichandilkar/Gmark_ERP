const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function debugPOs() {
  const supplierName = 'vaishnavi';
  const userId = 1; // Assuming userId 1 for now, we should check

  const pos = await prisma.purchaseOrder.findMany({
    where: {
      userId,
      supplierName: { equals: supplierName, mode: 'insensitive' },
      status: { notIn: ['DELETED', 'GRN_COMPLETED', 'INVOICE_COMPLETED'] },
    },
    include: {
      items: true,
      grn: {
        where: { status: { not: 'DELETED' } },
        include: { items: true }
      }
    },
    orderBy: { poNumber: 'desc' },
  });

  console.log('Found POs:', pos.length);
  pos.forEach(po => {
    const totalPoQty = po.items.reduce((sum, item) => sum + item.quantity, 0);
    const totalReceivedQty = po.grn.reduce((sum, grn) => {
      return sum + grn.items.reduce((iSum, i) => iSum + i.receivedQty, 0);
    }, 0);
    
    console.log(`PO: ${po.poNumber}, Status: ${po.status}, TotalPoQty: ${totalPoQty}, TotalReceivedQty: ${totalReceivedQty}, Show: ${totalReceivedQty < totalPoQty}`);
  });
}

debugPOs().finally(() => prisma.$disconnect());
