const { PrismaClient, AccountType, ContactPrefix } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const cashInHandGroups = await prisma.subSubSubGroup.findMany({
    where: { name: { contains: 'cash in hand', mode: 'insensitive' } }
  });

  if (cashInHandGroups.length === 0) {
    console.log('No cash in hand group found');
    return;
  }

  for (const group of cashInHandGroups) {
    await prisma.accountMaster.create({
      data: {
        accountName: group.name,
        accountType: AccountType.Cash,
        groupName: ['Bank & Cash'],
        userId: group.userId || 1,
        status: 'ACTIVE',
        panNo: 'ABCDE1234F',
        addressLine1: 'Default Address',
        pincode: '000000',
        state: 'Unknown',
        mobileNo: '0000000000',
        prefix: 'Mr',
        contactPersonName: 'Admin'
      }
    });

    await prisma.subSubSubGroup.delete({
      where: { id: group.id }
    });
    console.log('Converted ' + group.name + ' to Account!');
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
