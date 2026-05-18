const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function verify() {
  const userId = 2;
  
  // This simulates the logic in GroupMasterRepository.findAllGroups
  const rootGroups = await prisma.group.findMany({
    where: { OR: [{ userId: null, is_header: true }, { userId }] },
    include: { sub_groups: { include: { sub_sub_groups: { include: { sub_sub_sub_groups: true } } } } },
    orderBy: [{ id: 'asc' }]
  });

  const allAccounts = await prisma.accountMaster.findMany({
    where: { userId },
    select: { id: true, accountName: true, status: true, groupName: true }
  });

  const accountData = {};
  allAccounts.forEach(acc => {
    acc.groupName.forEach(g => {
      if (!accountData[g]) accountData[g] = [];
      accountData[g].push(acc.accountName);
    });
  });

  console.log('Account Mapping:', accountData);

  // Find Bank & Cash group
  let bankAndCashNode = null;
  for (const g of rootGroups) {
    for (const sg of g.sub_groups) {
      for (const ssg of sg.sub_sub_groups) {
        if (ssg.name === 'Bank & Cash') {
          bankAndCashNode = ssg;
        }
      }
    }
  }

  if (bankAndCashNode) {
    console.log('Bank & Cash group found. Accounts mapped to it:', accountData['Bank & Cash']);
    console.log('Sub-groups under Bank & Cash:', bankAndCashNode.sub_sub_sub_groups.map(s => s.name));
  } else {
    console.log('Bank & Cash group NOT found in the tree');
  }

  await prisma.$disconnect();
}

verify();
