import { PrismaClient, HsnMasterType } from '@prisma/client';
const prisma = new PrismaClient();

async function migrate() {
    try {
        console.log("Starting Product HSN Migration...");
        const products = await prisma.product.findMany({
            where: {
                hsnMasterId: null
            }
        });
        
        console.log(`Found ${products.length} products to migrate.`);
        let migratedCount = 0;

        for (const product of products) {
            if (!product.hsn_code) {
                console.log(`Product ID ${product.id} has no HSN code. Skipping.`);
                continue;
            }

            // Find matching HsnMaster record
            let hsnMaster = await prisma.hsnMaster.findUnique({
                where: { code: product.hsn_code }
            });

            if (!hsnMaster) {
                console.log(`HSN Code ${product.hsn_code} not found in HsnMaster. Creating...`);
                
                // Fallback tax and description
                let taxRate = product.tax_rate || 18;
                let description = product.hsn_description || 'Migrated from Seed HSN';
                let type: HsnMasterType = 'HSN';

                // Try to find details in legacy Hsn table
                const legacyHsn = await prisma.hsn.findUnique({
                    where: { hsnCode: product.hsn_code },
                    include: { taxDetails: true }
                });

                if (legacyHsn) {
                    if (legacyHsn.type && (legacyHsn.type === 'SAC' || legacyHsn.type === 'sac')) {
                        type = 'SAC';
                    }
                    if (legacyHsn.taxDetails && legacyHsn.taxDetails.length > 0) {
                        const parsedTax = parseFloat(legacyHsn.taxDetails[0].rateOfTax || '18');
                        if ([0, 5, 12, 18, 28].includes(parsedTax)) {
                            taxRate = parsedTax;
                        }
                    }
                    description = legacyHsn.description || legacyHsn.taxDetails[0]?.description || description;
                }

                hsnMaster = await prisma.hsnMaster.create({
                    data: {
                        type,
                        code: product.hsn_code,
                        taxRate: taxRate,
                        description: description.substring(0, 200),
                        isActive: true
                    }
                });
            }

            // Update product linkage
            await prisma.product.update({
                where: { id: product.id },
                data: {
                    hsnMasterId: hsnMaster.id
                }
            });
            migratedCount++;
        }

        console.log(`Successfully migrated ${migratedCount} products.`);
    } catch (e) {
        console.error("Migration failed:", e);
    } finally {
        await prisma.$disconnect();
    }
}

migrate();
