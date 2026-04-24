
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function simulate() {
  try {
    const res = await prisma.salesOrder.create({
        data: {
            soNumber: 'SO-99999',
            customerName: 'Test Customer',
            customerType: 'wholesaler',
            address: '123 Test St',
            creditDays: 30,
            soCreationDate: new Date(),
            soBookingDate: new Date(),
            expiryDate: new Date('2026-12-31'),
            gstNumber: '',
            panNumber: '',
            totalAmount: 900.10,
            taxAmount: 162.02,
            grandTotal: 1062.12,
            userId: 2,
            status: 'PENDING',
            items: {
                create: [
                    {
                        productCode: 'PD00001',
                        productName: 'Mango',
                        hsnCode: '8517',
                        quantity: 10,
                        rate: 100,
                        uom: 'HTR',
                        discountPercent: 10,
                        discountAmount: 100,
                        taxPercent: 18,
                        taxAmount: 162.02,
                        totalAmount: 1062.12,
                        printDescription: ''
                    }
                ]
            }
        }
    });
    console.log('SUCCESS:', res.id);
    await prisma.salesOrder.delete({ where: { id: res.id } });
  } catch (e) {
    console.error('ERROR:', e);
  } finally {
    await prisma.$disconnect();
  }
}
simulate();
