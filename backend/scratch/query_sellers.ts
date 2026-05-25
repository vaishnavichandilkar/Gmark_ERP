import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
    const sellers = await prisma.user.findMany({
        where: { role: 'seller' },
        include: {
            shopDetail: true,
            sellerDocuments: true
        }
    });
    console.log(JSON.stringify(sellers, (key, value) => {
        return typeof value === 'bigint' ? value.toString() : value;
    }, 2));
}

main().catch(console.error).finally(() => prisma.$disconnect());
