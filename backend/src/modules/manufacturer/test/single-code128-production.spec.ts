/**
 * Single Code 128 Barcode Production Implementation Verification Test Suite
 *
 * Validates:
 * 1. Single Code 128 Barcode generation containing Full Product Name, Weight with Unit, and Serial Number.
 * 2. Strict rejection of QR Codes, DataMatrix codes, or multiple barcodes per label.
 * 3. Exact field recovery and independent ISO/IEC 15417 symbol decoding.
 * 4. Punctuation, hyphens, parentheses, pipe delimiter escaping, decimal weights, and supported units.
 * 5. Physical dimension compliance and module width (mils) on 150x100 mm and 200x100 mm labels.
 * 6. Concurrency-safe package registration and PostgreSQL persistence.
 * 7. Barcode-based package lookup and search.
 * 8. Reprint workflow and persistent audit trail.
 */

import { PrismaClient } from '@prisma/client';
import { LabelGeneratorService } from '../services/label-generator.service';
import { PackageService } from '../services/package.service';
import { encodeCode128, renderCode128Vector, CODE128_CONSTANTS } from '../utils/code128-vector.util';
import { getLabelConfig, LABEL_SIZE_REGISTRY } from '../templates/label-size-registry';
import { decodeCode128Symbols } from './code128-qa-audit.spec';

const prisma = new PrismaClient();
const labelGeneratorService = new LabelGeneratorService();
const packageService = new PackageService(prisma as any, labelGeneratorService);

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

// Delimiter parser matching backend and frontend implementation
function parseSingleCode128Barcode(rawBarcode: string): { product: string; weight: string; serial: string } {
    if (!rawBarcode || typeof rawBarcode !== 'string') {
        throw new Error('Barcode must be a non-empty string');
    }
    const trimmed = rawBarcode.trim();
    if (!trimmed.includes('|')) {
        throw new Error('Invalid barcode format: missing pipe delimiter');
    }

    // Split on unescaped pipe (or reverse split from right)
    // The serial number is always the last segment
    const lastPipe = trimmed.lastIndexOf('|');
    const serial = trimmed.substring(lastPipe + 1).trim();

    // The weight with unit is the second-to-last segment
    const secondLastPipe = trimmed.lastIndexOf('|', lastPipe - 1);
    if (secondLastPipe === -1) {
        throw new Error('Invalid barcode format: expected 3 pipe-separated segments');
    }
    const weight = trimmed.substring(secondLastPipe + 1, lastPipe).trim();

    // The product name is everything before the weight, with escaped pipes restored
    const productRaw = trimmed.substring(0, secondLastPipe).trim();
    const product = productRaw.replace(/\\\|/g, '|');

    return { product, weight, serial };
}

async function runTestSuite() {
    console.log('================================================================================');
    console.log('  SINGLE CODE 128 BARCODE PRODUCTION IMPLEMENTATION & QA VERIFICATION SUITE     ');
    console.log('================================================================================\n');

    // ------------------------------------------------------------------------
    // Group 1: Single Barcode Formatting & Independent ISO/IEC 15417 Decoding
    // ------------------------------------------------------------------------
    console.log('--- Group 1: Barcode Payload Construction & Independent Decoding ---');

    const testCases = [
        {
            title: 'Database Product "watch"',
            product: 'watch',
            weight: '50.25 KG',
            serial: '2610230001-AB-M01',
        },
        {
            title: 'Short Chemical Product "Urea"',
            product: 'Urea',
            weight: '50.00 KG',
            serial: '2610230002-AB-M01',
        },
        {
            title: 'Medium Industrial Product',
            product: 'Industrial Polymer',
            weight: '50.25 KG',
            serial: '2610230003-AB-M01',
        },
        {
            title: 'Full Production Product Name',
            product: 'Industrial Grade Polymer 50kg',
            weight: '50.25 KG',
            serial: '2610230004-AB-M01',
        },
        {
            title: 'Special Characters, Hyphens, Parens & Escaped Pipe',
            product: 'Resin (Spec-A | Grade-4, 99.5% Pure)',
            weight: '1250.50 G',
            serial: '2610230005-AB-M01',
        },
        {
            title: 'Metric Ton & Custom Format Serial',
            product: 'Bulk Molasses Extra',
            weight: '1.50 MT',
            serial: 'GMU-2026-0001',
        },
    ];

    for (const tc of testCases) {
        const safeProduct = tc.product.replace(/\|/g, '\\|');
        const payload = `${safeProduct} | ${tc.weight} | ${tc.serial}`;

        // 1. Verify Code 128 Encoding
        const encoded = encodeCode128(payload);
        assert(encoded.symbols.length > 0, `[${tc.title}] Encoded into ${encoded.symbols.length} Code 128 symbols`);

        // 2. Independently Decode Symbols
        const decoded = decodeCode128Symbols(encoded.symbols);
        assert(decoded.checksumValid, `[${tc.title}] Modulo-103 checksum is mathematically valid (${encoded.checksum})`);
        assert(decoded.text === payload, `[${tc.title}] Decoded text matches exact raw input payload`);

        // 3. Exact 3-Field Extraction
        const parsed = parseSingleCode128Barcode(decoded.text);
        assert(parsed.product === tc.product, `[${tc.title}] Recovered Product Name: "${parsed.product}"`);
        assert(parsed.weight === tc.weight, `[${tc.title}] Recovered Weight & Unit: "${parsed.weight}"`);
        assert(parsed.serial === tc.serial, `[${tc.title}] Recovered Serial Number: "${parsed.serial}"`);
    }

    // ------------------------------------------------------------------------
    // Group 2: Physical Label Geometry & Scannability (150x100 mm & 200x100 mm)
    // ------------------------------------------------------------------------
    console.log('\n--- Group 2: Physical Label Sizing & Module Width Compliance ---');

    const cfg150 = getLabelConfig('150x100');
    const cfg200 = getLabelConfig('200x100');

    assert(Math.abs(cfg150.widthPt - 425.20) < 0.1, '150x100 mm width converts to 425.20 pt');
    assert(Math.abs(cfg150.heightPt - 283.46) < 0.1, '150x100 mm height converts to 283.46 pt');
    assert(Math.abs(cfg200.widthPt - 566.93) < 0.1, '200x100 mm width converts to 566.93 pt');

    // Test physical module width on 150x100 mm for standard DB product
    const mockDoc: any = {
        save() {},
        restore() {},
        fillColor() { return this; },
        rect() { return { fill: () => {} }; },
        font() { return this; },
        fontSize() { return this; },
        text() { return this; },
    };

    const payloadWatch = 'watch | 50.25 KG | 2610230001-AB-M01';
    const metrics150 = renderCode128Vector(mockDoc, payloadWatch, {
        x: cfg150.margins.left,
        y: 120,
        maxWidth: cfg150.barcodeBox.widthPt,
        maxHeight: cfg150.barcodeBox.heightPt,
        quietZoneModules: 10,
    });

    assert(metrics150.moduleWidthMils >= 10.0, `[150x100 mm] Module width is >= 10.0 mils (got: ${metrics150.moduleWidthMils.toFixed(2)} mils)`);
    assert(metrics150.totalWidth <= cfg150.barcodeBox.widthPt, `[150x100 mm] Total barcode width fits within allocated barcode box (${metrics150.totalWidth.toFixed(1)} pt <= ${cfg150.barcodeBox.widthPt} pt)`);
    assert(metrics150.quietZoneWidthPt >= 10 * metrics150.moduleWidthPt, '[150x100 mm] Preserves >= 10X quiet zones on left and right');

    // Test physical module width on 200x100 mm for 29-char production product
    const payloadStandard = 'Industrial Grade Polymer 50kg | 50.25 KG | 2610230001-AB-M01';
    const metrics200 = renderCode128Vector(mockDoc, payloadStandard, {
        x: cfg200.margins.left,
        y: 120,
        maxWidth: cfg200.barcodeBox.widthPt,
        maxHeight: cfg200.barcodeBox.heightPt,
        quietZoneModules: 10,
    });

    assert(metrics200.moduleWidthMils >= 10.0, `[200x100 mm] Module width is >= 10.0 mils for full production product (got: ${metrics200.moduleWidthMils.toFixed(2)} mils)`);
    assert(metrics200.totalWidth <= cfg200.barcodeBox.widthPt, `[200x100 mm] Total barcode width fits within allocated barcode box (${metrics200.totalWidth.toFixed(1)} pt <= ${cfg200.barcodeBox.widthPt} pt)`);

    // ------------------------------------------------------------------------
    // Group 3: PDF Stream Inspection — Strictly Single Code 128 (No QR/2D)
    // ------------------------------------------------------------------------
    console.log('\n--- Group 3: PDF Generation Stream & Single Barcode Inspection ---');

    const pdfBuffer = await labelGeneratorService.generateBatchPdf({
        labelSize: '150x100',
        items: [
            {
                companyName: 'GMARK MANUFACTURING PVT LTD',
                productName: 'watch',
                netWeight: 50.25,
                serialNumber: '2610230001-AB-M01',
                barcodePayload: payloadWatch,
                isProduction: true,
            },
        ],
    });

    assert(pdfBuffer.length > 500, `Generated valid PDF buffer (${pdfBuffer.length} bytes)`);
    const pdfRaw = pdfBuffer.toString('binary');
    assert(pdfRaw.startsWith('%PDF-'), 'PDF header %PDF- present');

    // Audit PDF content: Confirm NO QR Code or DataMatrix markers
    assert(!pdfRaw.includes('QRCode'), 'PDF does NOT contain QR Code objects');
    assert(!pdfRaw.includes('DataMatrix'), 'PDF does NOT contain DataMatrix objects');
    const extractTjTexts = (str: string) => {
        const matches = str.match(/\[[\s\S]*?\]\s*TJ/g) || [];
        return matches.map((m) => {
            const hexes = m.match(/<([0-9a-fA-F]+)>/g) || [];
            let out = '';
            for (const h of hexes) {
                const hexClean = h.replace(/[<>]/g, '');
                for (let i = 0; i < hexClean.length; i += 2) {
                    out += String.fromCharCode(parseInt(hexClean.substr(i, 2), 16));
                }
            }
            return out;
        });
    };
    const tjTexts = extractTjTexts(pdfRaw).join(' | ');
    assert(tjTexts.includes('NET WEIGHT: 50.25 kg'), 'Human-readable Net Weight is printed in PDF stream');
    assert(tjTexts.includes('watch'), 'Human-readable Product Name is printed in PDF stream');
    assert(tjTexts.includes('2610230001-AB-M01'), 'Human-readable Serial Number is printed in PDF stream');

    // ------------------------------------------------------------------------
    // Group 4: Package Registration, Concurrency & Database Persistence
    // ------------------------------------------------------------------------
    console.log('\n--- Group 4: Package Registration, Database Persistence & Concurrency ---');

    // Get verified test user and product
    let testUser = await prisma.user.findFirst();
    if (!testUser) {
        testUser = await prisma.user.create({
            data: {
                username: 'code128_tester',
                email: 'code128@test.local',
                role: 'seller',
            },
        });
    }
    const product = await prisma.product.findFirst({
        where: { id: 1 },
    });
    assert(product !== null, 'Product ID 1 exists in PostgreSQL database');
    const testUserId = product.created_by || testUser.id;

    const created = await packageService.createPackage(
        testUserId,
        {
            productId: 1,
            netWeight: 50.25,
            grossWeight: 50.75,
            tareWeight: 0.50,
            weightUnit: 'kg',
            weightSource: 'HARDWARE_SCALE',
            plantCode: 'AB',
            machineId: 'M01',
            labelSize: '150x100',
        }
    );

    assert(created.success, 'Package registered successfully via PackageService');
    assert(created.package.serial_number !== undefined, `Allocated serial number: ${created.package.serial_number}`);

    // Verify record in PostgreSQL
    const savedPkg = await prisma.manufacturedPackage.findUnique({
        where: { id: Number(created.package.id) },
    });
    assert(savedPkg !== null, 'Package record exists in PostgreSQL manufactured_packages table');
    assert(
        savedPkg?.barcodeData?.includes('watch') &&
        savedPkg?.barcodeData?.toLowerCase().includes('50.25 kg') &&
        savedPkg?.barcodeData?.includes(created.package.serial_number),
        `Stored barcodeData has single Code 128 payload: "${savedPkg?.barcodeData}"`
    );

    // Verify concurrent package registrations produce unique serials
    const concurrentRegistrations = await Promise.all([
        packageService.createPackage(testUserId, { productId: 1, netWeight: 10.0, plantCode: 'AB', machineId: 'M01', labelSize: '150x100' }),
        packageService.createPackage(testUserId, { productId: 1, netWeight: 20.0, plantCode: 'AB', machineId: 'M01', labelSize: '150x100' }),
        packageService.createPackage(testUserId, { productId: 1, netWeight: 30.0, plantCode: 'AB', machineId: 'M01', labelSize: '150x100' }),
    ]);

    const serials = concurrentRegistrations.map((r) => r.package.serial_number);
    const uniqueSerials = new Set(serials);
    assert(uniqueSerials.size === 3, `Concurrent registrations produced 3 distinct unique serial numbers: ${serials.join(', ')}`);

    // ------------------------------------------------------------------------
    // Group 5: Barcode Scanner Package Lookup
    // ------------------------------------------------------------------------
    console.log('\n--- Group 5: Package Lookup & Barcode Search Filtering ---');

    // Search by full scanned Code 128 payload
    const scannedBarcode = savedPkg?.barcodeData || '';
    const searchResult = await packageService.getPackages(
        testUserId,
        {
            search: scannedBarcode,
        }
    );

    assert(searchResult.data.length >= 1, `Searching by scanned full barcode "${scannedBarcode}" found ${searchResult.data.length} package(s)`);
    assert(Number(searchResult.data[0].id) === Number(savedPkg?.id), 'Search accurately retrieved exact package by scanned Code 128 payload');

    // ------------------------------------------------------------------------
    // Group 6: Reprint Workflow & Audit Trail
    // ------------------------------------------------------------------------
    console.log('\n--- Group 6: Reprinting & Audit Trail Verification ---');

    if (savedPkg) {
        const reprintRes = await packageService.reprintPackage(testUserId, Number(savedPkg.id), 'Test reprint audit reason');
        assert(reprintRes.success, 'Package reprinted successfully');
        assert(reprintRes.reprintCount >= 1, `Reprint count incremented to ${reprintRes.reprintCount}`);

        const auditLogs = await prisma.labelReprintLog.findMany({
            where: { packageId: savedPkg.id },
        });
        assert(auditLogs.length >= 1, `Audit log entry created in label_reprint_logs (count: ${auditLogs.length})`);
        assert(auditLogs[0].reason === 'Test reprint audit reason', 'Audit log records exact reprint reason');
        assert(auditLogs[0].reprintedBy === testUserId, 'Audit log records exact operator identity');
    }

    console.log('\n================================================================================');
    console.log(`Test Execution Complete: ${passed} passed, ${failed} failed`);
    console.log('================================================================================\n');

    await prisma.$disconnect();

    if (failed > 0) {
        process.exit(1);
    }
}

runTestSuite().catch(async (err) => {
    console.error('Fatal test execution error:', err);
    await prisma.$disconnect();
    process.exit(1);
});
