import { PrismaClient, AccountType, TransactionType, BalanceType, ContactPrefix } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
    const userId = 1; // Default test user

    console.log('Seeding Ledger Data...');

    // 1. Create Creditors (Suppliers)
    const creditors = [
        { name: 'TechCorp Industries', opening: 5000, type: AccountType.Creditor },
        { name: 'Global Logistics', opening: 1500, type: AccountType.Creditor },
        { name: 'Prime Suppliers', opening: 10000, type: AccountType.Creditor },
    ];

    for (const c of creditors) {
        const account = await prisma.accountMaster.create({
            data: {
                accountName: c.name,
                accountType: c.type,
                supplierOpeningBalance: c.opening,
                userId,
                groupName: ['Suppliers'],
                status: 'ACTIVE',
                panNo: 'ABCDE1234F',
                addressLine1: 'Main Street',
                pincode: '411001',
                state: 'Maharashtra',
                prefix: ContactPrefix.Mr,
                contactPersonName: 'John Doe',
                mobileNo: '9876543210'
            }
        });

        await prisma.transaction.create({
            data: {
                accountId: account.id,
                userId,
                transactionType: TransactionType.Purchase,
                entryType: BalanceType.Cr,
                amount: 2000,
                bookingDate: new Date('2024-05-01'),
                invoiceNumber: 'PUR-001',
            }
        });

        await prisma.transaction.create({
            data: {
                accountId: account.id,
                userId,
                transactionType: TransactionType.Payment,
                entryType: BalanceType.Dr,
                amount: 1000,
                bookingDate: new Date('2024-05-05'),
                invoiceNumber: 'PAY-001',
            }
        });
    }

    // 2. Create Debtors (Customers)
    const debtors = [
        { name: 'Retail Stores Inc', opening: 1200, type: AccountType.Debtor },
        { name: 'Mega Market', opening: 4500, type: AccountType.Debtor },
    ];

    for (const d of debtors) {
        const account = await prisma.accountMaster.create({
            data: {
                accountName: d.name,
                accountType: d.type,
                customerOpeningBalance: d.opening,
                userId,
                groupName: ['Customers'],
                status: 'ACTIVE',
                panNo: 'FGHIJ5678K',
                addressLine1: 'Second Avenue',
                pincode: '411002',
                state: 'Maharashtra',
                prefix: ContactPrefix.Ms,
                contactPersonName: 'Jane Smith',
                mobileNo: '9123456789'
            }
        });

        await prisma.transaction.create({
            data: {
                accountId: account.id,
                userId,
                transactionType: TransactionType.Sales,
                entryType: BalanceType.Dr,
                amount: 3000,
                bookingDate: new Date('2024-05-02'),
                invoiceNumber: 'SAL-001',
            }
        });

        await prisma.transaction.create({
            data: {
                accountId: account.id,
                userId,
                transactionType: TransactionType.Receipt,
                entryType: BalanceType.Cr,
                amount: 1500,
                bookingDate: new Date('2024-05-06'),
                invoiceNumber: 'REC-001',
            }
        });
    }

    // 3. Create Bank & Cash
    const bankCash = [
        { name: 'HDFC Current Account', opening: 150000, type: AccountType.Bank, group: 'BANK' },
        { name: 'Main Cash Vault', opening: 50000, type: AccountType.Cash, group: 'CASH' },
    ];

    for (const bc of bankCash) {
        const account = await prisma.accountMaster.create({
            data: {
                accountName: bc.name,
                accountType: bc.type,
                customerOpeningBalance: bc.opening,
                userId,
                groupName: [bc.group],
                status: 'ACTIVE',
                panNo: 'LMNOP9012Q',
                addressLine1: 'Financial District',
                pincode: '411003',
                state: 'Maharashtra',
                prefix: ContactPrefix.Mr,
                contactPersonName: 'Bank Manager',
                mobileNo: '8888888888'
            }
        });

        await prisma.transaction.create({
            data: {
                accountId: account.id,
                userId,
                transactionType: TransactionType.Receipt,
                entryType: BalanceType.Dr,
                amount: 10000,
                bookingDate: new Date('2024-05-10'),
                invoiceNumber: 'TRF-001',
            }
        });
    }

    console.log('Ledger Data seeded successfully.');
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
