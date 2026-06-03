import { PrismaClient } from '@prisma/client';
import { ForbiddenException, NotFoundException } from '@nestjs/common';

const prisma = new PrismaClient();

async function testUpdate(id: number, userId: number) {
    const existing = await prisma.grn.findUnique({ 
      where: { id },
    });
    if (!existing) throw new NotFoundException(`GRN ID ${id} not found`);

    const invoices = await prisma.purchaseInvoice.findMany({
      where: { userId, status: { not: 'DELETED' } },
      select: { challanNumber: true }
    });
    console.log("Invoices:", invoices);

    const isLinked = invoices.some(inv => {
      if (!inv.challanNumber) return false;
      const challanIds = inv.challanNumber.split(',').map(idx => idx.trim());
      console.log(`Checking invoice challanNumber=${inv.challanNumber}, challanIds=`, challanIds, ` against id=${id}, existing.challanNumber=${existing.challanNumber}`);
      return challanIds.includes(id.toString()) || challanIds.includes(existing.challanNumber);
    });
    
    console.log("IsLinked?", isLinked);
}

testUpdate(6, 2)
  .catch(console.error)
  .finally(() => prisma.$disconnect());
