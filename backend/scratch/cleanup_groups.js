const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function cleanup() {
  const userId = 2; // Vaishnavi
  
  console.log('--- Cleaning up Groups ---');
  // Delete the groups named 'sbi bank' and 'icici' so they don't conflict with accounts
  const d4 = await prisma.subSubSubGroup.deleteMany({
    where: { name: { in: ['sbi bank', 'icici'] }, userId }
  });
  console.log('Deleted L4 groups:', d4.count);

  const d3 = await prisma.subSubGroup.deleteMany({
    where: { name: { in: ['sbi bank', 'icici'] }, userId }
  });
  console.log('Deleted L3 groups:', d3.count);

  console.log('--- Updating Accounts ---');
  // Ensure the accounts have the correct groupName to be found by the voucher dropdown
  const up = await prisma.accountMaster.updateMany({
    where: { accountName: { in: ['sbi bank', 'icici'] }, userId },
    data: { 
      groupName: ['BANK'],
      accountType: 'Bank'
    }
  });
  console.log('Updated accounts:', up.count);
}

cleanup().catch(console.error).finally(() => prisma.$disconnect());
