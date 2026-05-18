import { PrismaClient, TransactionType, BalanceType } from '@prisma/client';
const prisma = new PrismaClient();

async function test() {
    try {
        const res = await prisma.$transaction(async (tx) => {
            const inv = await tx.salesInvoice.create({
                data: {
                    invoiceNumber: 'TEST-INV-1',
                    customerInvoiceNumber: 'TEST-CUST-1',
                    customerInvoiceDate: new Date(),
                    bookingDate: new Date(),
                    customerId: 8,
                    customerName: 'Vaishnavi Chandilkar',
                    address: 'Belgaum',
                    creditDays: 30,
                    taxableAmount: 1000,
                    grandTotal: 1050,
                    userId: 2,
                    items: {
                        create: [{
                            productId: 2,
                            productCode: 'PD00001',
                            productName: 'mango',
                            quantity: 10,
                            rate: 100,
                            uom: 'kg',
                            taxPercent: 5,
                            taxAmount: 50,
                            beforeTaxAmount: 1000,
                            totalAmount: 1050
                        }]
                    }
                }
            });

            await tx.transaction.create({
                data: {
                    accountId: 8,
                    userId: 2,
                    bookingDate: inv.bookingDate,
                    invoiceNumber: inv.customerInvoiceNumber,
                    transactionType: TransactionType.Sales,
                    amount: 1050,
                    entryType: BalanceType.Dr
                }
            });

            return inv;
        });
        console.log('SUCCESS:', res.id);
    } catch (e: any) {
        console.error('FAILED:', e.message);
    } finally {
        await prisma.$disconnect();
    }
}

test();
