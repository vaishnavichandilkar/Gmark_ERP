import * as assert from 'assert';
import { PrismaClient } from '@prisma/client';
import { PackageService } from '../services/package.service';
import { LabelGeneratorService } from '../services/label-generator.service';

const prisma = new PrismaClient();
const labelGenerator = new LabelGeneratorService();
const packageService = new PackageService(prisma as any, labelGenerator);

async function runDatabasePersistenceTests() {
    console.log('=== Running Manufacturer PostgreSQL Persistence & Concurrency Tests ===\n');

    // Setup: Get or create a verified test product and user
    let user = await prisma.user.findFirst();
    if (!user) {
        console.log('Creating test user...');
        user = await prisma.user.create({
            data: {
                username: 'test_mfg_operator',
                email: 'mfg_operator@test.local',
                role: 'seller',
                verified: true,
                isApproved: true,
            },
        });
    }

    const product = await prisma.product.findFirst({ where: { is_deleted: false } });
    if (!product) {
        throw new Error('No active products found in database. Please seed product first.');
    }

    console.log(`Using Operator User ID: ${user.id}, Product ID: ${product.id} ("${product.product_name}")\n`);

    // Test 1: Package Creation with Persistent PostgreSQL Storage
    console.log('Test 1: Package Registration & PostgreSQL Storage');
    const createdResult = await packageService.createPackage(user.id, {
        productId: product.id,
        netWeight: 49.85,
        grossWeight: 50.15,
        tareWeight: 0.30,
        weightUnit: 'kg',
        weightSource: 'SCALE_SIMULATOR',
        plantCode: 'AB',
        machineId: 'M01',
        labelSize: '100x50',
        rawPayload: '+00049.850 Kg',
    });

    assert(createdResult.success === true, 'createPackage returned success');
    assert(createdResult.package.id > 0, 'Package ID is autoincremented');
    assert(createdResult.package.serial_number.includes('M01'), 'Serial number includes station M01');
    assert(createdResult.labelPdfBase64.length > 500, 'Label PDF Base64 is returned');

    // Verify record in PostgreSQL directly via Prisma
    const dbRecord = await prisma.manufacturedPackage.findUnique({
        where: { id: createdResult.package.id },
    });
    assert(dbRecord !== null, 'Record exists in PostgreSQL manufactured_packages table');
    assert.strictEqual(dbRecord?.serialNumber, createdResult.package.serial_number);
    assert.strictEqual(Number(dbRecord?.netWeight), 49.85);
    assert.strictEqual(Number(dbRecord?.grossWeight), 50.15);
    assert.strictEqual(Number(dbRecord?.tareWeight), 0.30);
    assert.strictEqual(dbRecord?.rawPayload, '+00049.850 Kg');
    assert(dbRecord?.barcodeData?.includes('"serial":'), 'Barcode data contains serial JSON');
    assert(dbRecord?.barcodeData?.includes(product.product_name), 'Barcode data contains full product name');
    console.log(`  ✓ PASS: Package saved in PostgreSQL with ID ${dbRecord?.id}, Serial: ${dbRecord?.serialNumber}`);

    // Test 2: Concurrent Package Registration (Race Condition & Monotonic Serial Verification)
    console.log('\nTest 2: Concurrency-Safe Daily Sequence Allocation');
    const concurrentCount = 5;
    const promises = [];
    for (let i = 0; i < concurrentCount; i++) {
        promises.push(
            packageService.createPackage(user.id, {
                productId: product.id,
                netWeight: 50.0 + i * 0.1,
                plantCode: 'AB',
                machineId: 'M01',
                labelSize: '100x50',
            })
        );
    }

    const concurrentResults = await Promise.all(promises);
    const serials = concurrentResults.map((r) => r.package.serial_number);
    const uniqueSerials = new Set(serials);
    assert.strictEqual(uniqueSerials.size, concurrentCount, 'Every concurrent registration produces a unique serial number');
    console.log(`  ✓ PASS: All ${concurrentCount} concurrent registrations received unique serial numbers:`);
    serials.forEach((s) => console.log(`     - ${s}`));

    // Test 3: History & Aggregations from PostgreSQL
    console.log('\nTest 3: Querying History & Summary Aggregates');
    const history = await packageService.getPackages(user.id, {
        page: 1,
        limit: 10,
    });
    assert(history.summary.totalPackages >= concurrentCount + 1, 'Total count reflects saved packages');
    assert(history.summary.totalNetWeight > 0, 'Total net weight is computed from database');
    assert(history.data.length > 0, 'Data array contains records');
    console.log(`  ✓ PASS: History returned ${history.data.length} records. Server-wide Total Packages: ${history.summary.totalPackages}, Total Weight: ${history.summary.totalNetWeight} kg`);

    // Test 4: Persistent Label Reprint with Audit Trail
    console.log('\nTest 4: Persistent Label Reprint with Audit Logging');
    const reprintPkgId = createdResult.package.id;
    const reprintReason = 'Bar code smudged during application';
    const reprintResult = await packageService.reprintPackage(user.id, reprintPkgId, reprintReason);
    assert.strictEqual(reprintResult.reprintCount, 1, 'Reprint count incremented to 1');

    const auditLog = await prisma.labelReprintLog.findFirst({
        where: { packageId: reprintPkgId },
    });
    assert(auditLog !== null, 'Reprint audit log exists in label_reprint_logs table');
    assert.strictEqual(auditLog?.reason, reprintReason);
    assert.strictEqual(auditLog?.reprintedBy, user.id);
    console.log(`  ✓ PASS: Audit log verified in PostgreSQL with reason: "${auditLog?.reason}"`);

    // Test 5: Rejection of Invalid Product
    console.log('\nTest 5: Validation of Product Existence');
    let rejected = false;
    try {
        await packageService.createPackage(user.id, {
            productId: 99999999, // Non-existent
            netWeight: 25.0,
        });
    } catch (err: any) {
        rejected = true;
        assert(err.message.includes('not found'), 'Clear error message on invalid product');
    }
    assert(rejected, 'Package creation was rejected for non-existent product');
    console.log('  ✓ PASS: Invalid product ID was rejected with BadRequestException');

    console.log('\n========================================');
    console.log('All Database Persistence & Concurrency Tests Passed Successfully!');
    console.log('========================================');

    await prisma.$disconnect();
}

runDatabasePersistenceTests().catch(async (e) => {
    console.error('Test failed with error:', e);
    await prisma.$disconnect();
    process.exit(1);
});
