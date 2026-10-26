import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    const products = await prisma.product.findMany({
        select: {
            id: true,
            product_name: true,
            product_code: true,
        },
        orderBy: {
            id: 'asc',
        },
    });

    console.log(`\n=== Total Products in DB: ${products.length} ===`);
    let maxLen = 0;
    let longestProduct = '';

    for (const p of products) {
        const name = p.product_name || '';
        if (name.length > maxLen) {
            maxLen = name.length;
            longestProduct = name;
        }
        console.log(`  - ID: ${p.id} | Code: ${p.product_code} | Len: ${name.length} | Name: "${name}"`);
    }

    console.log('\n--- Longest Product Summary ---');
    console.log(`Longest Product: "${longestProduct}" (${maxLen} chars)\n`);

    await prisma.$disconnect();
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});
