const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function check() {
    console.log("=== INVENTORIES/PURCHASE INVOICES IN DB ===");
    const pinvs = await prisma.purchaseInvoice.findMany({
        select: {
            id: true,
            invoiceNumber: true,
            supplierName: true,
            supplierId: true,
            grandTotal: true,
            status: true
        }
    });
    console.log(JSON.stringify(pinvs, null, 2));

    console.log("=== ACCOUNT MASTER SUPPLIERS ===");
    const suppliers = await prisma.accountMaster.findMany({
        where: {
            groupName: {
                has: 'SUNDRY_CREDITORS'
            }
        },
        select: {
            id: true,
            accountName: true,
            supplierCode: true
        }
    });
    console.log(JSON.stringify(suppliers, null, 2));
}

check().finally(() => prisma.$disconnect());
