const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function syncAccounts() {
  const userId = 2; // Vaishnavi
  
  // 1. Update SBI
  await prisma.accountMaster.updateMany({
    where: { accountName: 'sbi bank', userId },
    data: { accountName: 'sbi', groupName: ['BANK', 'sbi'] }
  });

  // 2. Create Canara if missing
  const existingCanara = await prisma.accountMaster.findFirst({
    where: { accountName: 'canara', userId }
  });

  if (!existingCanara) {
    await prisma.accountMaster.create({
      data: {
        accountName: 'canara',
        groupName: ['BANK', 'canara'],
        accountType: 'Bank',
        userId,
        status: 'ACTIVE',
        panNo: 'ABCDE1234F', 
        addressLine1: 'Main Branch',
        pincode: '590001',
        state: 'Karnataka',
        prefix: 'Mr',
        contactPersonName: 'Manager',
        mobileNo: '7019387579',
        customerOpeningBalance: 0,
        customerBalanceType: 'Dr'
      }
    });
  }

  console.log('Accounts synced with groups.');
}

syncAccounts().catch(console.error).finally(() => prisma.$disconnect());
