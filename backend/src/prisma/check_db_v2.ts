import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkGroups() {
    const groups = await prisma.group.findMany({ 
        orderBy: { id: 'asc' },
        select: { id: true, group_name: true } 
    });

    console.log('--- Level 1 Groups (Total: ' + groups.length + ') ---');
    groups.forEach(g => console.log(`${g.id}: ${g.group_name}`));
    console.log('------------------------------------');
}

checkGroups()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
