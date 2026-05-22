const { PrismaClient } = require('@prisma/client');
const { GroupMasterRepository } = require('../dist/modules/Master/group-master/repositories/group.repository');
const { PrismaService } = require('../dist/infrastructure/prisma/prisma.service');

async function test() {
  const prisma = new PrismaClient();
  const prismaService = new PrismaService();
  // Assign the client directly for the test
  prismaService.prisma = prisma;
  Object.assign(prismaService, prisma);

  const repository = new GroupMasterRepository(prismaService);
  const userId = 8; // Vaishnavi's userId is 8 in check_all_accounts.js

  console.log('Fetching all groups for User 2...');
  const tree = await repository.findAllGroups(userId);

  function printTree(nodes, indent = '') {
    for (const node of nodes) {
      const isAccount = node.isAccount ? '[ACCOUNT]' : '[GROUP]';
      console.log(`${indent}- ${node.group_name} ${isAccount} (level: ${node.level}, children count: ${node.children ? node.children.length : 0})`);
      if (node.children && node.children.length > 0) {
        printTree(node.children, indent + '  ');
      }
    }
  }

  // Find and print specifically the Assets -> Current Assets -> Customers branch
  // and Liabilities -> Current Liabilities -> Suppliers branch
  const assetsGroup = tree.find(g => g.group_name === 'Assets');
  if (assetsGroup) {
    console.log('\n--- Assets Branch ---');
    printTree([assetsGroup]);
  }

  const liabilitiesGroup = tree.find(g => g.group_name === 'Liabilities');
  if (liabilitiesGroup) {
    console.log('\n--- Liabilities Branch ---');
    printTree([liabilitiesGroup]);
  }

  await prisma.$disconnect();
}

test().catch(console.error);
