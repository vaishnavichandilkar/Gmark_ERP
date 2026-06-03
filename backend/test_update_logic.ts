import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function findOne(id: number, userId: number) {
    const grn = await prisma.grn.findFirst({
      where: { id, userId },
      include: { items: true, expenses: true },
    });
    if (!grn) throw new Error(`GRN ID ${id} not found or access denied`);

    const invoices = await prisma.purchaseInvoice.findMany({
      where: { userId, status: { not: 'DELETED' } },
      select: { challanNumber: true }
    });
    const isLinked = invoices.some(inv => {
      if (!inv.challanNumber) return false;
      const challanIds = inv.challanNumber.split(',').map(idx => idx.trim());
      return challanIds.includes(id.toString()) || challanIds.includes(grn.challanNumber);
    });

    return { ...grn, isInvoiced: isLinked };
}

async function testUpdate(id: number, userId: number) {
    const existing = await findOne(id, userId);

    const invoices = await prisma.purchaseInvoice.findMany({
      where: { userId, status: { not: 'DELETED' } },
      select: { challanNumber: true }
    });
    const isLinked = invoices.some(inv => {
      if (!inv.challanNumber) return false;
      const challanIds = inv.challanNumber.split(',').map(idx => idx.trim());
      console.log(`inv.challanNumber=${inv.challanNumber}, existing.challanNumber=${existing.challanNumber}`);
      return challanIds.includes(id.toString()) || challanIds.includes(existing.challanNumber);
    });
    console.log("update.isLinked:", isLinked);
}

testUpdate(6, 2)
  .catch(console.error)
  .finally(() => prisma.$disconnect());
