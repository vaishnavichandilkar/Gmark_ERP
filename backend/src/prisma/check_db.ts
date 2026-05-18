import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkGroups() {
    const groupCount = await prisma.group.count();
    const subGroupCount = await prisma.subGroup.count();
    const subSubGroupCount = await prisma.subSubGroup.count();

    const groups = await prisma.group.findMany({ select: { group_name: true } });

    console.log('--- Database Check ---');
    console.log('Group Count (Level 1):', groupCount);
    console.log('SubGroup Count (Level 2):', subGroupCount);
    console.log('SubSubGroup Count (Level 3):', subSubGroupCount);
    console.log('Group Names:', groups.map(g => g.group_name).join(', '));
    console.log('----------------------');
}

checkGroups()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
