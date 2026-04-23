const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function syncSalesStatuses() {
  const userId = 2; // Focusing on the current user's data

  console.log('Starting Sales sync for userId:', userId);

  // 1. Fix SalesInvoice soId links
  const invoices = await prisma.salesInvoice.findMany({
    where: { userId, soId: null, soNumber: { not: null } }
  });

  console.log(`Found ${invoices.length} sales invoices with null soId`);

  for (const inv of invoices) {
    const soIds = inv.soNumber.split(',').map(n => n.trim()).filter(n => !isNaN(Number(n))).map(Number);
    if (soIds.length === 1) {
      console.log(`Linking Sales Invoice ${inv.id} to SO ${soIds[0]}`);
      await prisma.salesInvoice.update({
        where: { id: inv.id },
        data: { soId: soIds[0] }
      });
    }
  }

  // 2. Recalculate all SO and SalesChallan statuses for this user
  const sos = await prisma.salesOrder.findMany({
    where: { userId, status: { not: 'DELETED' } },
    include: { 
      items: true,
      salesChallans: { where: { status: { not: 'DELETED' } }, include: { items: true } },
      salesInvoices: { where: { status: { not: 'DELETED' } }, include: { items: true } }
    }
  });

  for (const so of sos) {
    const totalSoQty = so.items.reduce((s, i) => s + i.quantity, 0);
    const totalDeliveredQty = so.salesChallans.reduce((s, ch) => s + ch.items.reduce((is, it) => is + it.challanQty, 0), 0);
    const totalInvoicedQty = so.salesInvoices.reduce((s, inv) => s + inv.items.reduce((is, it) => is + it.quantity, 0), 0);

    let newStatus = 'PENDING';
    if (totalInvoicedQty >= totalSoQty) {
      newStatus = 'INVOICE_COMPLETED';
    } else if (totalDeliveredQty >= totalSoQty) {
      newStatus = 'CHALLAN_COMPLETED';
    }

    if (so.status !== newStatus) {
      console.log(`Updating SO ${so.soNumber} status: ${so.status} -> ${newStatus}`);
      await prisma.salesOrder.update({
        where: { id: so.id },
        data: { status: newStatus }
      });
    }

    // Update Challans for this SO too
    for (const ch of so.salesChallans) {
        const totalChQty = ch.items.reduce((s, i) => s + i.challanQty, 0);
        // Find invoices for this Challan
        const chInvoicedQty = so.salesInvoices.reduce((sum, inv) => {
            if (inv.challanNumber) {
              const challanIds = inv.challanNumber.split(',').map(id => id.trim());
              if (challanIds.includes(ch.id.toString()) || challanIds.includes(ch.challanNumber)) {
                 return sum + inv.items.reduce((iSum, i) => iSum + i.quantity, 0);
              }
            }
            return sum;
        }, 0);

        let chStatus = 'GENERATED';
        if (chInvoicedQty >= totalChQty) {
            chStatus = 'COMPLETED';
        }

        if (ch.status !== chStatus) {
            console.log(`Updating Sales Challan ${ch.id} status: ${ch.status} -> ${chStatus}`);
            await prisma.salesChallan.update({
                where: { id: ch.id },
                data: { status: chStatus }
            });
        }
    }
  }

  console.log('Sales sync completed.');
}

syncSalesStatuses().finally(() => prisma.$disconnect());
