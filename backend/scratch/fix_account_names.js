const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function fixAccounts() {
  const userId = 2; // Vaishnavi
  
  // 1. Rename the sbi account I created
  const updatedSbi = await prisma.accountMaster.updateMany({
    where: { accountName: 'SBI Current Account', userId },
    data: { accountName: 'sbi bank' }
  });
  console.log('Updated SBI account name:', updatedSbi.count);

  // 2. Create ICICI account if it doesn't exist
  const existingIcici = await prisma.accountMaster.findFirst({
    where: { accountName: 'icici', userId }
  });

  if (!existingIcici) {
    const icici = await prisma.accountMaster.create({
      data: {
        accountName: 'icici',
        groupName: ['BANK', 'icici'],
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
    console.log('Created ICICI account:', icici.accountName);
  } else {
    console.log('ICICI account already exists');
  }
}

fixAccounts().catch(console.error).finally(() => prisma.$disconnect());
