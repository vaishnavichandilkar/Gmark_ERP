const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function createAccount() {
  const userId = 2; // Vaishnavi
  
  const account = await prisma.accountMaster.create({
    data: {
      accountName: 'SBI Current Account',
      groupName: ['BANK', 'sbi bank'],
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

  console.log('Successfully created account:', JSON.stringify(account, null, 2));
}

createAccount().catch(console.error).finally(() => prisma.$disconnect());
