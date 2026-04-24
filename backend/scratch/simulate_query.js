
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const userId = 2;
  const supplierIdOrName = "3";
  let accountName = String(supplierIdOrName).trim();
  
  if (/^\d+$/.test(accountName)) {
    const account = await prisma.accountMaster.findUnique({
      where: { id: parseInt(accountName, 10) },
    });
    if (account) {
      accountName = account.accountName;
    }
  }

  console.log(`Searching for POs: Name=${accountName}, User=${userId}`);

  const pos = await prisma.purchaseOrder.findMany({
    where: {
      userId,
      supplierName: { equals: accountName, mode: 'insensitive' },
      status: { notIn: ['DELETED', 'INVOICE_COMPLETED'] },
    },
    include: {
      items: true,
      purchaseInvoices: {
        where: { status: { not: 'DELETED' } },
        include: { items: true }
      }
    }
  });

  console.log(`Found ${pos.length} POs`);
  const filtered = pos.filter(po => {
    const totalPoQty = po.items.reduce((sum, item) => sum + item.quantity, 0);
    const totalInvoicedQty = po.purchaseInvoices.reduce((sum, inv) => {
      return sum + inv.items.reduce((iSum, i) => iSum + i.quantity, 0);
    }, 0);
    console.log(`PO ${po.poNumber}: Qty=${totalPoQty}, Invoiced=${totalInvoicedQty}`);
    return totalInvoicedQty < totalPoQty;
  });

  console.log(`Final filtered count: ${filtered.length}`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
