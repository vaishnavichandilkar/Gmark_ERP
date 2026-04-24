
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const userId = 2;
  const supplierIdOrName = "1"; // ID of vaishnavi
  let accountName = "vaishnavi";

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
  pos.forEach(po => console.log(`PO: ${po.poNumber}`));
}

main().catch(console.error).finally(() => prisma.$disconnect());
