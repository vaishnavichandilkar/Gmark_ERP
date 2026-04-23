const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function syncStatuses() {
  const userId = 2; // Focusing on the current user's data

  console.log('Starting sync for userId:', userId);

  // 1. Fix PurchaseInvoice poId links
  const invoices = await prisma.purchaseInvoice.findMany({
    where: { userId, poId: null, poNumber: { not: null } }
  });

  console.log(`Found ${invoices.length} invoices with null poId`);

  for (const inv of invoices) {
    const poIds = inv.poNumber.split(',').map(n => n.trim()).filter(n => !isNaN(Number(n))).map(Number);
    if (poIds.length === 1) {
      console.log(`Linking Invoice ${inv.id} to PO ${poIds[0]}`);
      await prisma.purchaseInvoice.update({
        where: { id: inv.id },
        data: { poId: poIds[0] }
      });
    }
  }

  // 2. Recalculate all PO and GRN statuses for this user
  const pos = await prisma.purchaseOrder.findMany({
    where: { userId, status: { not: 'DELETED' } },
    include: { 
      items: true,
      grn: { where: { status: { not: 'DELETED' } }, include: { items: true } },
      purchaseInvoices: { where: { status: { not: 'DELETED' } }, include: { items: true } }
    }
  });

  for (const po of pos) {
    const totalPoQty = po.items.reduce((s, i) => s + i.quantity, 0);
    const totalReceivedQty = po.grn.reduce((s, g) => s + g.items.reduce((is, it) => is + it.receivedQty, 0), 0);
    const totalInvoicedQty = po.purchaseInvoices.reduce((s, inv) => s + inv.items.reduce((is, it) => is + it.quantity, 0), 0);

    let newStatus = 'PENDING';
    if (totalInvoicedQty >= totalPoQty) {
      newStatus = 'INVOICE_COMPLETED';
    } else if (totalReceivedQty >= totalPoQty) {
      newStatus = 'GRN_COMPLETED';
    }

    if (po.status !== newStatus) {
      console.log(`Updating PO ${po.poNumber} status: ${po.status} -> ${newStatus}`);
      await prisma.purchaseOrder.update({
        where: { id: po.id },
        data: { status: newStatus }
      });
    }

    // Update GRNs for this PO too
    for (const grn of po.grn) {
        const totalGrnQty = grn.items.reduce((s, i) => s + i.receivedQty, 0);
        // Find invoices for this GRN
        const grnInvoicedQty = po.purchaseInvoices.reduce((sum, inv) => {
            if (inv.challanNumber) {
              const challanIds = inv.challanNumber.split(',').map(id => id.trim());
              if (challanIds.includes(grn.id.toString()) || challanIds.includes(grn.challanNumber)) {
                 return sum + inv.items.reduce((iSum, i) => iSum + i.quantity, 0);
              }
            }
            return sum;
        }, 0);

        let grnStatus = 'GENERATED';
        if (grnInvoicedQty >= totalGrnQty) {
            grnStatus = 'COMPLETED';
        }

        if (grn.status !== grnStatus) {
            console.log(`Updating GRN ${grn.id} status: ${grn.status} -> ${grnStatus}`);
            await prisma.grn.update({
                where: { id: grn.id },
                data: { status: grnStatus }
            });
        }
    }
  }

  console.log('Sync completed.');
}

syncStatuses().finally(() => prisma.$disconnect());
