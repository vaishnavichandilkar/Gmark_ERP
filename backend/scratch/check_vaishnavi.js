
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkTransactions() {
  const account = await prisma.accountMaster.findFirst({
    where: { accountName: 'Vaishnavi' }
  });

  if (!account) {
    console.log('Account not found');
    return;
  }

  console.log('Account ID:', account.id);

  const transactions = await prisma.transaction.findMany({
    where: {
      accountId: account.id
    },
    orderBy: { bookingDate: 'asc' }
  });

  console.log('Total Transactions:', transactions.length);
  transactions.forEach((t, i) => {
    console.log(`${i + 1}. Date: ${t.bookingDate.toISOString().split('T')[0]}, Type: ${t.entryType}, Amount: ${t.amount}, Particulars: ${t.transactionType}`);
  });
}

checkTransactions()
  .catch(e => console.error(e))
  .finally(() => prisma.$disconnect());
