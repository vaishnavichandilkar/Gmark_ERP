const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function run() {
  const subSubGroups = await prisma.subSubGroup.findMany({
    include: { sub_group: true }
  });
  console.log('SubSubGroups:', subSubGroups.map(ssg => ({
    id: ssg.id,
    name: ssg.name,
    parentSubGroup: ssg.sub_group?.subgroup_name
  })));
}

run().catch(console.error).finally(() => prisma.$disconnect());
