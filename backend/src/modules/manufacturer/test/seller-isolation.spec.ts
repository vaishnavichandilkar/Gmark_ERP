import { PrismaClient } from '@prisma/client';
import { LabelGeneratorService } from '../services/label-generator.service';
import { PackageService } from '../services/package.service';
import { WeighingDeviceService } from '../services/weighing-device.service';
import { ForbiddenException, NotFoundException } from '@nestjs/common';

const prisma = new PrismaClient();
const labelGenerator = new LabelGeneratorService();
const packageService = new PackageService(prisma as any, labelGenerator);
const deviceService = new WeighingDeviceService(prisma as any);

let passed = 0;
let failed = 0;

function assert(condition: boolean, testName: string, detail?: string) {
    if (condition) {
        console.log(`  ✓ PASS: ${testName}`);
        passed++;
    } else {
        console.error(`  ✗ FAIL: ${testName}${detail ? ' -> ' + detail : ''}`);
        failed++;
    }
}

async function runSellerIsolationSuite() {
    console.log('\n===============================================================');
    console.log('  GMARK ERP — STRICT SELLER-WISE DATA ISOLATION TEST SUITE');
    console.log('===============================================================\n');

    try {
        // Find existing Seller A (User 1)
        const sellerA = await prisma.user.findFirst({
            where: { id: 1 },
        });

        if (!sellerA) {
            throw new Error('Seller A (User ID 1) not found in database');
        }

        // Find or create Seller B for test
        let sellerB = await prisma.user.findFirst({
            where: { id: { not: sellerA.id } },
        });

        if (!sellerB) {
            sellerB = await prisma.user.create({
                data: {
                    phone: '9999999999',
                    role: 'seller',
                },
            });
            console.log(`Created temporary Seller B with ID ${sellerB.id}`);
        }

        console.log(`Seller A ID: ${sellerA.id} (${sellerA.phone})`);
        console.log(`Seller B ID: ${sellerB.id} (${sellerB.phone})\n`);

        // Get an active product belonging to Seller A
        const productA = await prisma.product.findFirst({
            where: { created_by: sellerA.id, is_deleted: false },
        });

        if (!productA) {
            throw new Error(`Seller A has no active products in database`);
        }
        console.log(`Product A ID: ${productA.id} ("${productA.product_name}") owned by Seller A (${productA.created_by})\n`);

        // Fetch packages belonging to Seller A
        const packagesA = await packageService.getPackages(sellerA.id, { limit: 10 });
        assert(
            packagesA.data.length > 0,
            'Seller A can view their own package history',
            `Found ${packagesA.data.length} packages`
        );
        const samplePkgA = packagesA.data[0];

        // ==============================================================
        // TEST 1: Seller B cannot view Seller A's packages in getPackages
        // ==============================================================
        console.log('\n--- 1. Dashboard Table & History Isolation ---');
        const packagesB = await packageService.getPackages(sellerB.id, { limit: 10 });
        const leakedAInB = packagesB.data.some((p) => p.product_id === productA.id);
        assert(
            !leakedAInB,
            'Seller B does NOT see any of Seller A\'s packages in package history table',
            `Seller B total packages: ${packagesB.pagination.total}`
        );
        assert(
            packagesB.summary.totalPackages === packagesB.data.length,
            'Seller B summary totals strictly reflect only Seller B\'s own packages'
        );

        // ==============================================================
        // TEST 2: Seller B searching for Seller A's serial or barcode
        // ==============================================================
        console.log('\n--- 2. Search & Scanned Barcode Isolation ---');
        const searchResultBySerial = await packageService.getPackages(sellerB.id, {
            search: samplePkgA.serial_number,
        });
        assert(
            searchResultBySerial.data.length === 0,
            'Seller B searching by Seller A\'s exact serial number returns 0 records',
            `Found ${searchResultBySerial.data.length} records`
        );

        if (samplePkgA.barcode_data) {
            const searchResultByBarcode = await packageService.getPackages(sellerB.id, {
                search: samplePkgA.barcode_data,
            });
            assert(
                searchResultByBarcode.data.length === 0,
                'Seller B searching by Seller A\'s full scanned barcode returns 0 records',
                `Found ${searchResultByBarcode.data.length} records`
            );
        }

        // ==============================================================
        // TEST 3: Seller B cannot retrieve Seller A's package by ID (URL spoofing)
        // ==============================================================
        console.log('\n--- 3. Direct Package Lookup By ID Protection ---');
        let pkgByIdBlocked = false;
        try {
            await packageService.getPackageById(sellerB.id, samplePkgA.id);
        } catch (err: any) {
            if (err instanceof ForbiddenException || err.status === 403) {
                pkgByIdBlocked = true;
            }
        }
        assert(
            pkgByIdBlocked,
            'Seller B attempting GET /packages/:id on Seller A\'s package is rejected with 403 Forbidden'
        );

        // Verify Seller A CAN retrieve their own package
        const sellerAOwnPkg = await packageService.getPackageById(sellerA.id, samplePkgA.id);
        assert(
            sellerAOwnPkg.id === samplePkgA.id,
            'Seller A can successfully retrieve their own package by ID'
        );

        // ==============================================================
        // TEST 4: Seller B cannot register a package using Seller A's Product ID
        // ==============================================================
        console.log('\n--- 4. Package Registration Ownership Enforcement ---');
        let crossRegisterBlocked = false;
        try {
            await packageService.createPackage(sellerB.id, {
                productId: productA.id,
                netWeight: 15.5,
                plantCode: 'AB',
                machineId: 'M01',
            });
        } catch (err: any) {
            if (err instanceof ForbiddenException || err.status === 403) {
                crossRegisterBlocked = true;
            }
        }
        assert(
            crossRegisterBlocked,
            'Seller B registering package with Seller A\'s Product ID is rejected with 403 Forbidden'
        );

        // ==============================================================
        // TEST 5: Seller B cannot reprint Seller A's package label
        // ==============================================================
        console.log('\n--- 5. Thermal Label Reprint Authorization ---');
        let reprintBlocked = false;
        try {
            await packageService.reprintPackage(sellerB.id, samplePkgA.id, 'Test unauthorized reprint');
        } catch (err: any) {
            if (err instanceof ForbiddenException || err.status === 403) {
                reprintBlocked = true;
            }
        }
        assert(
            reprintBlocked,
            'Seller B reprinting Seller A\'s package label is rejected with 403 Forbidden'
        );

        // ==============================================================
        // TEST 6: getProductDetail helper validates ownership
        // ==============================================================
        console.log('\n--- 6. Product Detail Lookup & Preview Ownership ---');
        let productLookupBlocked = false;
        try {
            await packageService.getProductDetail(productA.id, sellerB.id);
        } catch (err: any) {
            if (err instanceof ForbiddenException || err.status === 403) {
                productLookupBlocked = true;
            }
        }
        assert(
            productLookupBlocked,
            'getProductDetail validates ownership and throws 403 Forbidden for non-owner'
        );

        const authorizedProduct = await packageService.getProductDetail(productA.id, sellerA.id);
        assert(
            authorizedProduct !== null && authorizedProduct.id === productA.id,
            'getProductDetail succeeds for legitimate product owner'
        );

        // ==============================================================
        // TEST 7: Weighing Machine Configuration Ownership Check
        // ==============================================================
        console.log('\n--- 7. Weighing Machine Management Isolation ---');
        const sellerADevice = await deviceService.createDevice(sellerA.id, {
            deviceName: 'Seller A Private Scale',
            stationId: 'M99',
            plantCode: 'AB',
            serialPort: 'COM99',
        });

        let deviceUpdateBlocked = false;
        try {
            await deviceService.updateDevice(sellerB.id, sellerADevice.id, {
                deviceName: 'Hijacked Scale Name',
            });
        } catch (err: any) {
            if (err instanceof ForbiddenException || err.status === 403) {
                deviceUpdateBlocked = true;
            }
        }
        assert(
            deviceUpdateBlocked,
            'Seller B attempting to update Seller A\'s scale device is rejected with 403 Forbidden'
        );

        let deviceDeleteBlocked = false;
        try {
            await deviceService.deleteDevice(sellerB.id, sellerADevice.id);
        } catch (err: any) {
            if (err instanceof ForbiddenException || err.status === 403) {
                deviceDeleteBlocked = true;
            }
        }
        assert(
            deviceDeleteBlocked,
            'Seller B attempting to delete Seller A\'s scale device is rejected with 403 Forbidden'
        );

        // Clean up test scale device
        await deviceService.deleteDevice(sellerA.id, sellerADevice.id);

        console.log('\n===============================================================');
        console.log(`  TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
        console.log('===============================================================\n');

        if (failed > 0) {
            process.exit(1);
        }
    } catch (e) {
        console.error('Fatal error during test suite:', e);
        process.exit(1);
    } finally {
        await prisma.$disconnect();
    }
}

runSellerIsolationSuite();
