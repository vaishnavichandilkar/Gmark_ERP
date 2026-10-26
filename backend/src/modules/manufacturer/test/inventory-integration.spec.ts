/**
 * Inventory In/Out Barcode Workflow and Report Integration Test Suite
 */

import { PrismaClient } from '@prisma/client';
import { LabelGeneratorService } from '../services/label-generator.service';
import { PackageService } from '../services/package.service';
import { ReportsService } from '../../Reports/reports.service';

const prisma = new PrismaClient();
const labelGeneratorService = new LabelGeneratorService();
const packageService = new PackageService(prisma as any, labelGeneratorService);
const reportsService = new ReportsService(prisma as any);

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

async function runInventoryIntegrationSuite() {
    console.log('================================================================');
    console.log('Gmark ERP — Inventory Barcode Workflow & Report Integration Test');
    console.log('================================================================\n');

    try {
        // 1. Identify primary test seller and product
        const product = await prisma.product.findFirst({
            where: { is_deleted: false },
            include: { creator: true, uom: true },
        });

        if (!product) {
            throw new Error('No active product found in database for testing.');
        }

        const sellerId = product.created_by;
        console.log(`Test Context: Seller ID ${sellerId}, Product: "${product.product_name}" (ID ${product.id}, Code ${product.product_code}, UOM: ${product.uom?.unit_name})\n`);

        // Count existing commercial invoices before test
        const initialPiCount = await prisma.purchaseInvoice.count({ where: { userId: sellerId } });
        const initialSiCount = await prisma.salesInvoice.count({ where: { userId: sellerId } });

        // 2. Fetch baseline inventory report
        console.log('--- Step 1: Initial Baseline Inventory Report ---');
        const initialReport = await reportsService.getInventoryReport(sellerId, { page: 1, limit: 100 });
        const initialProductRow = initialReport.data.find((item) => String(item.productId) === String(product.id));

        const basePurchaseQty = initialProductRow ? initialProductRow.purchaseQty : 0;
        const baseSalesQty = initialProductRow ? initialProductRow.salesQty : 0;
        const baseRemainingQty = initialProductRow ? initialProductRow.remainingQty : 0;
        const baseAvgPrice = initialProductRow ? initialProductRow.avgPurchasingAmount : 0;

        console.log(`Initial Stats -> Inbound Qty: ${basePurchaseQty}, Outbound Qty: ${baseSalesQty}, Remaining: ${baseRemainingQty}, Avg Rate: ₹${baseAvgPrice}`);
        assert(baseRemainingQty === Math.max(0, Number((basePurchaseQty - baseSalesQty).toFixed(2))), 'Baseline remaining qty formula: X - Y');

        // 3. Register a new package (Inventory In)
        console.log('\n--- Step 2: Register New Package (Inventory In) ---');
        const createResult = await packageService.createPackage(sellerId, {
            productId: product.id,
            netWeight: 45.5,
            weightUnit: 'kg',
            machineId: 'M01',
            plantCode: 'AB',
            labelSize: '150x100',
            weightSource: 'HARDWARE_SCALE',
        });

        assert(createResult.success === true, 'Package registered successfully');
        assert(createResult.package.inventory_status === 'IN_STOCK', 'Package initial status is IN_STOCK');
        assert(createResult.package.dispatched_at === undefined, 'Package dispatched_at is initially null');
        assert(Boolean(createResult.package.serial_number), `Serial number generated: ${createResult.package.serial_number}`);

        const pkgSerial = createResult.package.serial_number;
        const code128Payload = `${product.product_name} | 45.50 kg | ${pkgSerial}`;

        // 4. Verify Inventory Report updated for Inventory In
        console.log('\n--- Step 3: Verify Report Reflected Inbound Stock ---');
        const postInReport = await reportsService.getInventoryReport(sellerId, { page: 1, limit: 100 });
        const postInProductRow = postInReport.data.find((item) => String(item.productId) === String(product.id));

        assert(Boolean(postInProductRow), 'Product found in post-in report');
        if (postInProductRow) {
            console.log(`Post-In Stats -> Inbound Qty: ${postInProductRow.purchaseQty}, Outbound Qty: ${postInProductRow.salesQty}, Remaining: ${postInProductRow.remainingQty}`);
            assert(postInProductRow.purchaseQty === basePurchaseQty + 1, `Inbound Qty increased by 1 (${basePurchaseQty} -> ${postInProductRow.purchaseQty})`);
            assert(postInProductRow.salesQty === baseSalesQty, `Outbound Qty unchanged (${baseSalesQty})`);
            assert(postInProductRow.remainingQty === baseRemainingQty + 1, `Remaining Qty increased by 1 (${baseRemainingQty} -> ${postInProductRow.remainingQty})`);
            assert(postInProductRow.avgPurchasingAmount === baseAvgPrice, `Valuation rate preserved at ₹${baseAvgPrice}`);
        }

        // Verify commercial purchase invoices remain uncorrupted
        const postInPiCount = await prisma.purchaseInvoice.count({ where: { userId: sellerId } });
        assert(postInPiCount === initialPiCount, `Zero commercial purchase invoices created (Count remains ${initialPiCount})`);

        // 5. Read-only barcode lookup test (must not alter stock)
        console.log('\n--- Step 4: Barcode Lookup Separation (Read-Only) ---');
        const lookupResult = await packageService.lookupPackage(sellerId, code128Payload);
        assert(lookupResult.serial_number === pkgSerial, 'Lookup successfully resolved package by Code 128 payload');
        assert(lookupResult.inventory_status === 'IN_STOCK', 'Lookup did not alter package status (remains IN_STOCK)');

        const postLookupReport = await reportsService.getInventoryReport(sellerId, { page: 1, limit: 100 });
        const postLookupProductRow = postLookupReport.data.find((item) => String(item.productId) === String(product.id));
        assert(postLookupProductRow?.remainingQty === baseRemainingQty + 1, 'Lookup did not change inventory report quantities');

        // 6. Explicit Inventory Out scanning workflow
        console.log('\n--- Step 5: Explicit Inventory Out Barcode Scan ---');
        const scanOutResult = await packageService.scanOutPackage(sellerId, code128Payload);
        assert(scanOutResult.success === true, 'scanOutPackage returned success');
        assert(scanOutResult.package.inventory_status === 'INVENTORY_OUT', 'Package status updated to INVENTORY_OUT');
        assert(Boolean(scanOutResult.package.dispatched_at), `dispatched_at recorded: ${scanOutResult.package.dispatched_at}`);
        assert(scanOutResult.inventoryMovement.movementType === 'INVENTORY_OUT', 'Inventory movement type is INVENTORY_OUT');
        assert(scanOutResult.inventoryMovement.quantity === 1, 'Inventory movement quantity is 1');

        // 7. Verify Inventory Report updated for Inventory Out
        console.log('\n--- Step 6: Verify Report Reflected Outbound Dispatch ---');
        const postOutReport = await reportsService.getInventoryReport(sellerId, { page: 1, limit: 100 });
        const postOutProductRow = postOutReport.data.find((item) => String(item.productId) === String(product.id));

        assert(Boolean(postOutProductRow), 'Product found in post-out report');
        if (postOutProductRow) {
            console.log(`Post-Out Stats -> Inbound Qty: ${postOutProductRow.purchaseQty}, Outbound Qty: ${postOutProductRow.salesQty}, Remaining: ${postOutProductRow.remainingQty}`);
            assert(postOutProductRow.purchaseQty === basePurchaseQty + 1, 'Inbound Qty stays at post-intake level');
            assert(postOutProductRow.salesQty === baseSalesQty + 1, `Outbound Qty increased by 1 (${baseSalesQty} -> ${postOutProductRow.salesQty})`);
            assert(postOutProductRow.remainingQty === baseRemainingQty, `Remaining Qty decreased back to baseline (${baseRemainingQty})`);
            assert(postOutProductRow.avgPurchasingAmount === baseAvgPrice, `Valuation rate preserved at ₹${baseAvgPrice}`);
        }

        // Verify commercial sales invoices remain uncorrupted
        const postOutSiCount = await prisma.salesInvoice.count({ where: { userId: sellerId } });
        assert(postOutSiCount === initialSiCount, `Zero commercial sales invoices created (Count remains ${initialSiCount})`);

        // 8. Prevent duplicate scan and double stock deduction
        console.log('\n--- Step 7: Duplicate Scan Prevention ---');
        let duplicateBlocked = false;
        try {
            await packageService.scanOutPackage(sellerId, code128Payload);
        } catch (err: any) {
            duplicateBlocked = true;
            assert(err.status === 400 || err.message.includes('ALREADY marked as INVENTORY OUT'), `Duplicate scan correctly rejected with error: "${err.message}"`);
        }
        assert(duplicateBlocked, 'Duplicate scan exception was thrown');

        // Verify stock was not deducted twice
        const postDuplicateReport = await reportsService.getInventoryReport(sellerId, { page: 1, limit: 100 });
        const postDupRow = postDuplicateReport.data.find((item) => String(item.productId) === String(product.id));
        assert(postDupRow?.salesQty === baseSalesQty + 1, 'Sales/Outbound qty was NOT double deducted');
        assert(postDupRow?.remainingQty === baseRemainingQty, 'Remaining qty was NOT reduced further');

        // 9. Seller Data Isolation Verification
        console.log('\n--- Step 8: Strict Seller Isolation on Scan-Out ---');
        const otherSeller = await prisma.user.findFirst({
            where: { id: { not: sellerId } },
        });

        if (otherSeller) {
            let isolationBlocked = false;
            try {
                await packageService.scanOutPackage(otherSeller.id, code128Payload);
            } catch (err: any) {
                isolationBlocked = true;
                assert(err.status === 403 || err.message.includes('another seller'), `Cross-seller scan correctly rejected: "${err.message}"`);
            }
            assert(isolationBlocked, 'Cross-seller scan was rejected with ForbiddenException');
        } else {
            console.log('  ⚠ Only one seller user in DB, skipping cross-seller test.');
        }

        // Summary
        console.log('\n================================================================');
        console.log(`TEST SUMMARY: ${passed} PASSED, ${failed} FAILED`);
        console.log('================================================================');

        await prisma.$disconnect();
        if (failed > 0) {
            process.exit(1);
        } else {
            process.exit(0);
        }
    } catch (e) {
        console.error('Test execution error:', e);
        await prisma.$disconnect();
        process.exit(1);
    }
}

runInventoryIntegrationSuite();
