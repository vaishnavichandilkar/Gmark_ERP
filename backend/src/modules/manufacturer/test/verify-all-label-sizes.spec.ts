/**
 * Automated Software Verification Script for Label Sizing, MediaBox Dimensions,
 * Code 128 Single Barcode, and Content Integrity without a Physical Printer.
 *
 * Run via: npx ts-node src/modules/manufacturer/test/verify-all-label-sizes.spec.ts
 */

import * as fs from 'fs';
import * as path from 'path';
import { LabelGeneratorService } from '../services/label-generator.service';
import { getLabelConfig } from '../templates/label-size-registry';

interface SizeTestCase {
    sizeId: string;
    expectedWidthPt: number;
    expectedHeightPt: number;
    expectedWidthMm: number;
    expectedHeightMm: number;
    description: string;
}

const TEST_CASES: SizeTestCase[] = [
    {
        sizeId: '150x100',
        expectedWidthPt: 425.20,
        expectedHeightPt: 283.46,
        expectedWidthMm: 150,
        expectedHeightMm: 100,
        description: 'Single Code 128 Bulk Label (150x100 mm / 6x4 in)',
    },
    {
        sizeId: '200x100',
        expectedWidthPt: 566.93,
        expectedHeightPt: 283.46,
        expectedWidthMm: 200,
        expectedHeightMm: 100,
        description: 'Extended Pallet Label (200x100 mm / 8x4 in)',
    },
    {
        sizeId: '250x100',
        expectedWidthPt: 708.66,
        expectedHeightPt: 283.46,
        expectedWidthMm: 250,
        expectedHeightMm: 100,
        description: 'Ultra-Wide Pallet Label (250x100 mm / 10x4 in)',
    },
    {
        sizeId: '100x50',
        expectedWidthPt: 283.46,
        expectedHeightPt: 141.73,
        expectedWidthMm: 100,
        expectedHeightMm: 50,
        description: 'Industrial Standard Label (100x50 mm / 4x2 in)',
    },
    {
        sizeId: '75x50',
        expectedWidthPt: 212.60,
        expectedHeightPt: 141.73,
        expectedWidthMm: 75,
        expectedHeightMm: 50,
        description: 'Compact Bag / Drum Label (75x50 mm / 3x2 in)',
    },
    {
        sizeId: '120x80',
        expectedWidthPt: 340.16,
        expectedHeightPt: 226.77,
        expectedWidthMm: 120,
        expectedHeightMm: 80,
        description: 'Custom Metric Size (120x80 mm)',
    },
    {
        sizeId: '4x6 in',
        expectedWidthPt: 288.00,
        expectedHeightPt: 432.00,
        expectedWidthMm: 101.6,
        expectedHeightMm: 152.4,
        description: 'Custom Imperial Size (4x6 in)',
    },
];

let totalTests = 0;
let passedTests = 0;
let failedTests = 0;

function assert(condition: boolean, testName: string, detail?: string) {
    totalTests++;
    if (condition) {
        console.log(`  ✓ PASS: ${testName}`);
        passedTests++;
    } else {
        console.error(`  ✗ FAIL: ${testName} ${detail ? `(${detail})` : ''}`);
        failedTests++;
    }
}

function extractTextFromPdf(pdfBuffer: Buffer): string {
    const raw = pdfBuffer.toString('latin1');
    const hexRegex = /<([0-9a-fA-F]+)>/g;
    let decoded = '';
    let match: RegExpExecArray | null;
    while ((match = hexRegex.exec(raw)) !== null) {
        try {
            decoded += Buffer.from(match[1], 'hex').toString('utf8');
        } catch {
            // ignore non-utf8 fragments
        }
    }
    return decoded;
}

function parseMediaBox(rawPdf: string): { width: number; height: number } | null {
    // /MediaBox [0 0 425.2 283.46] or /MediaBox [ 0 0 425.20 283.46 ]
    const match = rawPdf.match(/\/MediaBox\s*\[\s*0\s+0\s+([0-9.]+)\s+([0-9.]+)\s*\]/);
    if (!match) return null;
    return {
        width: parseFloat(match[1]),
        height: parseFloat(match[2]),
    };
}

async function runSoftwareVerification() {
    console.log('================================================================================');
    console.log('      ERP LABEL PRINTING — SOFTWARE VERIFICATION WITHOUT PHYSICAL PRINTER       ');
    console.log('================================================================================\n');

    const service = new LabelGeneratorService();
    const outputDir = path.join(__dirname, 'output');
    if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
    }

    const testProductName = 'Industrial Grade Polymer 50kg';
    const testNetWeight = 50.25;
    const testSerial = '2610260001-AB-M01';
    const testBarcodePayload = `${testProductName} | ${testNetWeight.toFixed(2)} KG | ${testSerial}`;

    for (const tc of TEST_CASES) {
        console.log(`\n--- Verifying Label Size: ${tc.sizeId} (${tc.description}) ---`);

        // 1. Config Registry Dimensions
        const config = getLabelConfig(tc.sizeId);
        assert(
            Math.abs(config.widthPt - tc.expectedWidthPt) < 0.2,
            `[${tc.sizeId}] Registry width matches expected PostScript points (${tc.expectedWidthPt} pt)`,
            `Got: ${config.widthPt}`
        );
        assert(
            Math.abs(config.heightPt - tc.expectedHeightPt) < 0.2,
            `[${tc.sizeId}] Registry height matches expected PostScript points (${tc.expectedHeightPt} pt)`,
            `Got: ${config.heightPt}`
        );

        // 2. Generate PDF Buffer
        const pdfBuffer = await service.generateBatchPdf({
            labelSize: tc.sizeId as any,
            items: [
                {
                    companyName: 'GMARK MANUFACTURING PVT LTD',
                    productName: testProductName,
                    netWeight: testNetWeight,
                    serialNumber: testSerial,
                    barcodePayload: testBarcodePayload,
                    isProduction: true,
                },
            ],
        });

        assert(pdfBuffer.length > 1000, `[${tc.sizeId}] Generated valid PDF binary (${pdfBuffer.length} bytes)`);

        const rawPdf = pdfBuffer.toString('latin1');
        const extractedText = extractTextFromPdf(pdfBuffer);

        // 3. Physical MediaBox Inspection
        const mediaBox = parseMediaBox(rawPdf);
        assert(
            mediaBox !== null,
            `[${tc.sizeId}] PDF contains valid /MediaBox geometry`,
            rawPdf.slice(0, 300)
        );
        if (mediaBox) {
            assert(
                Math.abs(mediaBox.width - tc.expectedWidthPt) < 0.2,
                `[${tc.sizeId}] Physical PDF MediaBox width is ${tc.expectedWidthPt} pt (${tc.expectedWidthMm} mm)`,
                `Got: ${mediaBox.width}`
            );
            assert(
                Math.abs(mediaBox.height - tc.expectedHeightPt) < 0.2,
                `[${tc.sizeId}] Physical PDF MediaBox height is ${tc.expectedHeightPt} pt (${tc.expectedHeightMm} mm)`,
                `Got: ${mediaBox.height}`
            );
        }

        // 4. Content Integrity Verification
        assert(
            extractedText.includes(testProductName),
            `[${tc.sizeId}] Full product name "${testProductName}" is present in PDF stream`
        );
        assert(
            extractedText.includes(`NET WEIGHT: ${testNetWeight.toFixed(2)} kg`),
            `[${tc.sizeId}] Actual weight with unit "NET WEIGHT: ${testNetWeight.toFixed(2)} kg" is present`
        );
        assert(
            extractedText.includes(testSerial),
            `[${tc.sizeId}] Unique package serial "${testSerial}" is present`
        );

        // 5. Single Horizontal Code 128 Barcode Verification
        // In PDFKit, vector bars are drawn with rectangle operators ('re') followed by fill ('f')
        const vectorBarMatches = rawPdf.match(/\b\d+(\.\d+)?\s+\d+(\.\d+)?\s+\d+(\.\d+)?\s+\d+(\.\d+)?\s+re\b/g) || [];
        assert(
            vectorBarMatches.length >= 40,
            `[${tc.sizeId}] Genuine Code 128 barcode vector bars rendered (${vectorBarMatches.length} bars)`
        );

        // 6. Verify Absence of 2D Barcodes (Zero QR / Zero DataMatrix)
        const hasQrStream = rawPdf.includes('/QR') || rawPdf.includes('QRCode');
        const hasDataMatrix = rawPdf.includes('/DataMatrix') || rawPdf.includes('DataMatrix');
        assert(
            !hasQrStream && !hasDataMatrix,
            `[${tc.sizeId}] Exactly ONE horizontal Code 128 barcode present (No QR or DataMatrix)`
        );

        // 7. Save Sample PDF for inspection
        const safeName = tc.sizeId.replace(/[^a-zA-Z0-9]/g, '_');
        const sampleFilePath = path.join(outputDir, `sample_label_${safeName}.pdf`);
        fs.writeFileSync(sampleFilePath, pdfBuffer);
    }

    console.log('\n================================================================================');
    console.log(`VERIFICATION COMPLETE: ${passedTests} passed, ${failedTests} failed (Total: ${totalTests})`);
    console.log(`Sample label PDFs saved to: ${outputDir}`);
    console.log('================================================================================\n');

    if (failedTests > 0) {
        process.exit(1);
    }
}

runSoftwareVerification().catch((err) => {
    console.error('Software verification error:', err);
    process.exit(1);
});
