const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function testCreate() {
  try {
    await prisma.salesOrder.create({
      data: {
        soNumber: 'SO-TEST-1',
        customerName: 'Test Customer',
        customerType: 'retailer',
        address: 'Test Address',
        creditDays: 30,
        soCreationDate: new Date(),
        expiryDate: new Date(),
        gstNumber: '29AAACH7409R1ZX',
        panNumber: '',
        totalAmount: 1000,
        taxAmount: 100,
        grandTotal: 1100,
        userId: 2,
        status: 'PENDING',
        items: {
          create: [{
            productCode: 'PD00001',
            productName: 'mango',
            hsnCode: '8517',
            quantity: 10,
            rate: 100,
            uom: 'Weight',
            discountPercent: 10,
            discountAmount: 100,
            taxPercent: 0,
            taxAmount: 0,
            totalAmount: 900,
            printDescription: '',
          }]
        }
      }
    });
    console.log("Success");
  } catch (e) {
    console.log("Error:", e);
  } finally {
    prisma.$disconnect();
  }
}

testCreate();
