const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const subGroups = await prisma.subGroup.findMany({
    select: { id: true, subgroup_name: true, group_id: true }
  });
  const subSubGroups = await prisma.subSubGroup.findMany({
    select: { id: true, name: true, sub_group_id: true }
  });
  console.log('SubGroups:', JSON.stringify(subGroups, null, 2));
  console.log('SubSubGroups:', JSON.stringify(subSubGroups, null, 2));
}

main().catch(console.error).finally(() => prisma.$disconnect());
