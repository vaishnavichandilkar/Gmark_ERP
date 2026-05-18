const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function check() {
  try {
    const allGroups = await prisma.group.findMany();
    
    function buildTree(parentId = null, indent = '') {
        const children = allGroups.filter(g => g.parent_id === parentId);
        for (const child of children) {
            console.log(`${indent}- ${child.group_name} (ID: ${child.id})`);
            buildTree(child.id, indent + '  ');
        }
    }

    console.log('Group Tree:');
    buildTree();

  } catch (e) {
    console.error(e);
  } finally {
    await prisma.$disconnect();
  }
}

check();
