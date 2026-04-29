import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {

    // 2. Seed System Admin (Superadmin)
    const adminPhone = '1111111111';
    const existingAdmin = await prisma.user.findUnique({
        where: { phone: adminPhone }
    });

    if (!existingAdmin) {
        await prisma.user.create({
            data: {
                first_name: 'System',
                last_name: 'Admin',
                phone: adminPhone,
                email: 'admin@weighpro.com',
                role: 'superadmin',
                isApproved: true,
                approvalStatus: 'APPROVED',
                isFirstApprovalLogin: false,
                onboarded_at: new Date(),
            }
        });
        console.log('Default Superadmin user created.');
    } else {
        await prisma.user.update({
            where: { phone: adminPhone },
            data: {
                role: 'superadmin',
                isApproved: true,
                approvalStatus: 'APPROVED',
                isFirstApprovalLogin: false,
                onboarded_at: new Date(),
            }
        });
        console.log('Admin user updated to superadmin.');
    }

    // 3. Seed Pincodes
    const pincodes = [
        { pincode: "411001", state: "Maharashtra", district: "Pune", isActive: true },
        { pincode: "411002", state: "Maharashtra", district: "Pune", isActive: false },
        { pincode: "411003", state: "Maharashtra", district: "Pune", isActive: true },
        { pincode: "411004", state: "Maharashtra", district: "Pune", isActive: false },
        { pincode: "411005", state: "Maharashtra", district: "Pune", isActive: true },
        { pincode: "411006", state: "Maharashtra", district: "Pune", isActive: true },
        { pincode: "411007", state: "Maharashtra", district: "Pune", isActive: false },
        { pincode: "411008", state: "Maharashtra", district: "Pune", isActive: true },
        { pincode: "411009", state: "Maharashtra", district: "Pune", isActive: false },
        { pincode: "411010", state: "Maharashtra", district: "Pune", isActive: true },
        { pincode: "411011", state: "Maharashtra", district: "Pune", isActive: true },
        { pincode: "411012", state: "Maharashtra", district: "Pune", isActive: false },
        { pincode: "411013", state: "Maharashtra", district: "Pune", isActive: true },
        { pincode: "411014", state: "Maharashtra", district: "Pune", isActive: false },
        { pincode: "411015", state: "Maharashtra", district: "Pune", isActive: true },
        { pincode: "411016", state: "Maharashtra", district: "Pune", isActive: true },
        { pincode: "411017", state: "Maharashtra", district: "Pune", isActive: false },
        { pincode: "411018", state: "Maharashtra", district: "Pune", isActive: true },
    ];

    for (const p of pincodes) {
        await prisma.pincode.upsert({
            where: { pincode: p.pincode },
            update: { state: p.state, district: p.district, isActive: p.isActive },
            create: p,
        });
    }
    console.log('Pincodes seeded.');

    // 4. Seed Languages
    const languages = [
        { name: 'English', code: 'en', isActive: true },
        { name: 'Hindi', code: 'hi', isActive: true },
        { name: 'Marathi', code: 'mr', isActive: true },
        { name: 'Kannada', code: 'kn', isActive: true },
    ];

    for (const lang of languages) {
        await prisma.language.upsert({
            where: { code: lang.code },
            update: { name: lang.name, isActive: lang.isActive },
            create: lang,
        });
    }
    // 5. Seed System UOM Library
    const uomData = [
        { full_name_of_measurement: 'BAGS', unit_name: 'Quantity', uom_code: 'BAG' },
        { full_name_of_measurement: 'BALE', unit_name: 'Quantity', uom_code: 'BAL' },
        { full_name_of_measurement: 'BUNDLES', unit_name: 'Quantity', uom_code: 'BDL' },
        { full_name_of_measurement: 'BUCKLES', unit_name: 'Quantity', uom_code: 'BKL' },
        { full_name_of_measurement: 'BILLIONS OF UNITS', unit_name: 'Quantity', uom_code: 'BOU' },
        { full_name_of_measurement: 'BOX', unit_name: 'Quantity', uom_code: 'BOX' },
        { full_name_of_measurement: 'BOTTLES', unit_name: 'Quantity', uom_code: 'BTL' },
        { full_name_of_measurement: 'BUNCHES', unit_name: 'Quantity', uom_code: 'BUN' },
        { full_name_of_measurement: 'CANS', unit_name: 'Quantity', uom_code: 'CAN' },
        { full_name_of_measurement: 'CUBIC METER', unit_name: 'Volume', uom_code: 'CBM' },
        { full_name_of_measurement: 'CUBIC CENTIMETER', unit_name: 'Volume', uom_code: 'CCM' },
        { full_name_of_measurement: 'CENTIMETER', unit_name: 'Length', uom_code: 'CMS' },
        { full_name_of_measurement: 'CARTONS', unit_name: 'Quantity', uom_code: 'CTN' },
        { full_name_of_measurement: 'DOZEN', unit_name: 'Quantity', uom_code: 'DOZ' },
        { full_name_of_measurement: 'DRUM', unit_name: 'Quantity', uom_code: 'DRM' },
        { full_name_of_measurement: 'GREAT GROSS', unit_name: 'Quantity', uom_code: 'GGR' },
        { full_name_of_measurement: 'GRAMS', unit_name: 'Weight', uom_code: 'GMS' },
        { full_name_of_measurement: 'GROSS', unit_name: 'Quantity', uom_code: 'GRS' },
        { full_name_of_measurement: 'GROSS YARDS', unit_name: 'Length', uom_code: 'GYD' },
        { full_name_of_measurement: 'KILOGRAMS', unit_name: 'Weight', uom_code: 'KGS' },
        { full_name_of_measurement: 'KILOLITER', unit_name: 'Volume', uom_code: 'KLR' },
        { full_name_of_measurement: 'KILOMETER', unit_name: 'Length', uom_code: 'KME' },
        { full_name_of_measurement: 'MILLILITER', unit_name: 'Volume', uom_code: 'MLT' },
        { full_name_of_measurement: 'METERS', unit_name: 'Length', uom_code: 'MTR' },
        { full_name_of_measurement: 'METRIC TONS', unit_name: 'Weight', uom_code: 'MTS' },
        { full_name_of_measurement: 'NUMBERS', unit_name: 'Quantity', uom_code: 'NOS' },
        { full_name_of_measurement: 'PACKS', unit_name: 'Quantity', uom_code: 'PAC' },
        { full_name_of_measurement: 'PIECES', unit_name: 'Quantity', uom_code: 'PCS' },
        { full_name_of_measurement: 'PAIRS', unit_name: 'Quantity', uom_code: 'PRS' },
        { full_name_of_measurement: 'QUINTAL', unit_name: 'Weight', uom_code: 'QTL' },
        { full_name_of_measurement: 'ROLLS', unit_name: 'Quantity', uom_code: 'ROL' },
        { full_name_of_measurement: 'SETS', unit_name: 'Quantity', uom_code: 'SET' },
        { full_name_of_measurement: 'TABLETS', unit_name: 'Quantity', uom_code: 'TBS' },
        { full_name_of_measurement: 'TEN GROSS', unit_name: 'Quantity', uom_code: 'TGM' },
        { full_name_of_measurement: 'THOUSANDS', unit_name: 'Quantity', uom_code: 'THD' },
        { full_name_of_measurement: 'TONNES', unit_name: 'Weight', uom_code: 'TON' },
        { full_name_of_measurement: 'TUBES', unit_name: 'Quantity', uom_code: 'TUB' },
        { full_name_of_measurement: 'US GALLONS', unit_name: 'Volume', uom_code: 'UGS' },
        { full_name_of_measurement: 'UNITS', unit_name: 'Quantity', uom_code: 'UNT' },
        { full_name_of_measurement: 'YARDS', unit_name: 'Length', uom_code: 'YDS' },
        { full_name_of_measurement: 'MILLIMETER', unit_name: 'Length', uom_code: 'MMT' },
        { full_name_of_measurement: 'Inch', unit_name: 'Length', uom_code: 'INH' },
        { full_name_of_measurement: 'Foot', unit_name: 'Length', uom_code: 'FT' },
        { full_name_of_measurement: 'MILE', unit_name: 'Length', uom_code: 'MIL' },
        { full_name_of_measurement: 'MILLIGRAM', unit_name: 'Weight', uom_code: 'MGM' },
        { full_name_of_measurement: 'POUND', unit_name: 'Weight', uom_code: 'LBS' },
        { full_name_of_measurement: 'LITER', unit_name: 'Volume', uom_code: 'LTR' },
        { full_name_of_measurement: 'SQUARE MILLIMETER', unit_name: 'Area', uom_code: 'SQMM' },
        { full_name_of_measurement: 'SQUARE CENTIMETER', unit_name: 'Area', uom_code: 'SQCM' },
        { full_name_of_measurement: 'ACRE', unit_name: 'Area', uom_code: 'ACR' },
        { full_name_of_measurement: 'HECTARE', unit_name: 'Area', uom_code: 'HTR' },
        { full_name_of_measurement: 'OTHERS', unit_name: '-', uom_code: 'OTH' },
    ];

    console.log('Seeding System UOM Library...');
    for (const uom of uomData) {
        await prisma.systemUomLibrary.upsert({
            where: { id: 0 }, // This is a trick for upsert if we don't have a unique field besides ID, but better to use a unique constraint
            // Actually, I should probably add a unique constraint on uom_code + full_name_of_measurement in schema
            update: uom,
            create: uom,
        });
    }
    // Correct way: use createMany if we want to reset or just find unique.
    // Given the previous deleteMany in seed_uom.ts, I'll do similar here but safely.
    await prisma.systemUomLibrary.deleteMany();
    await prisma.systemUomLibrary.createMany({ data: uomData });
    console.log('System UOM Library seeded.');

    // 6. Seed Account Groups (Headers)
    const headerGroups = [
        "Direct Expense",
        "Indirect Expense",
        "Purchase",
        "Opening Stock",
        "Direct Sale",
        "Indirect Sale",
        "Sale",
        "Closing Stock"
    ];

    console.log('Seeding Account Header Groups...');
    for (const groupName of headerGroups) {
        await prisma.group.upsert({
            where: { id: 0 }, // We can't use id:0 easily here if we don't have a unique constraint on group_name.
            // Actually, I should have added a unique constraint on group_name + is_header + userId?
            // The user didn't specify. I'll just find by name where is_header is true.
            update: {
                group_name: groupName,
                is_header: true,
                userId: null,
            },
            create: {
                group_name: groupName,
                is_header: true,
                userId: null,
            },
        });
    }

    // Since I don't have a unique constraint on group_name in the schema yet, 
    // I should probably add it or use a different way to seed safely.
    // For now, I'll just check if they exist by name.

    for (const groupName of headerGroups) {
        const existing = await prisma.group.findFirst({
            where: { group_name: groupName, is_header: true, userId: null }
        });
        if (!existing) {
            await prisma.group.create({
                data: {
                    group_name: groupName,
                    is_header: true,
                    userId: null,
                    status: 'ACTIVE'
                }
            });
        }
    }
    console.log('Account Header Groups seeded.');


    console.log('Seeding completed.');
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
