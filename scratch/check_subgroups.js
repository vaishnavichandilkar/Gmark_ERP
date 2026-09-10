const { PrismaClient } = require('./backend/node_modules/@prisma/client');
const prisma = new PrismaClient();

async function test() {
  const accounts = await prisma.account.findMany({
    take: 20,
    include: {
      group: true,
      subGroup: true,
      subSubGroup: true,
    }
  });
  console.log('Sample Accounts:', JSON.stringify(accounts.map(a => ({
    id: a.id,
    name: a.accountName,
    group: a.group?.group_name,
    subGroup: a.subGroup?.subgroup_name,
    subSubGroup: a.subSubGroup?.name,
    groupNameField: a.groupName
  })), null, 2));
}

test()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
