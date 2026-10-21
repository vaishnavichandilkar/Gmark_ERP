/**
 * Automated Unit Test Suite for Label Generator Service
 * Run via: npx ts-node src/modules/manufacturer/test/label-generator.spec.ts
 */

import { LabelGeneratorService } from '../services/label-generator.service';
import { SyntheticBatchPreviewDto, formatKolkataTimestamp } from '../dto/label-preview.dto';
import { getLabelConfig } from '../templates/label-size-registry';

let passed = 0;
let failed = 0;

function assert(condition: boolean, testName: string) {
    if (condition) {
        console.log(`  ✓ PASS: ${testName}`);
        passed++;
    } else {
        console.error(`  ✗ FAIL: ${testName}`);
        failed++;
    }
}

/**
 * Extracts visible text content from uncompressed PDFKit streams by decoding hex tokens.
 */
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

async function runTests() {
    console.log('=== Running Manufacturer Label Generator Tests ===\n');
    const service = new LabelGeneratorService();

    // -------------------------------------------------------------
    // Test Group 1: Configuration & MediaBox Math
    // -------------------------------------------------------------
    console.log('Group 1: Label Sizing & Physical MediaBox Configuration');
    const cfg100 = getLabelConfig('100x50');
    assert(Math.abs(cfg100.widthPt - 283.46) < 0.01, '100x50mm width converts to 283.46 pt');
    assert(Math.abs(cfg100.heightPt - 141.73) < 0.01, '100x50mm height converts to 141.73 pt');

    const cfg75 = getLabelConfig('75x50');
    assert(Math.abs(cfg75.widthPt - 212.60) < 0.01, '75x50mm width converts to 212.60 pt');
    assert(Math.abs(cfg75.heightPt - 141.73) < 0.01, '75x50mm height converts to 141.73 pt');

    // -------------------------------------------------------------
    // Test Group 2: Single Label Generation (100x50mm)
    // -------------------------------------------------------------
    console.log('\nGroup 2: Standard Label Generation (100x50mm)');
    const singleBatch: SyntheticBatchPreviewDto = {
        labelSize: '100x50',
        items: [
            {
                companyName: 'GMARK MANUFACTURING PVT LTD',
                productName: 'Industrial Grade Polymer 50kg',
                netWeight: 5.09,
                serialNumber: '2610160001-AB-M01',
                dateTimeStr: '2026-10-16 15:45',
            },
        ],
    };

    const pdfBuffer100 = await service.generateBatchPdf(singleBatch);
    const rawPdf100 = pdfBuffer100.toString('latin1');
    const extractedText100 = extractTextFromPdf(pdfBuffer100);

    assert(pdfBuffer100.length > 1000, `Generated PDF buffer is valid binary (size: ${pdfBuffer100.length} bytes)`);
    assert(rawPdf100.includes('/MediaBox [0 0 283.46 141.73]'), 'PDF contains exact physical MediaBox [0 0 283.46 141.73]');
    assert(extractedText100.includes('GMARK MANUFACTURING PVT LTD'), 'PDF contains centered company header');
    assert(extractedText100.includes('Industrial Grade Polymer 50kg'), 'PDF contains product name');
    assert(extractedText100.includes('NET WEIGHT: 5.09 kg'), 'PDF contains prominent net weight string (5.09 kg)');
    assert(extractedText100.includes('2610160001-AB-M01'), 'PDF contains complete serial number with Machine ID M01');
    // Verify Genuine Code 128 Vector Barcode in uncompressed stream
    const vectorBarCount = (rawPdf100.match(/\b\d+(\.\d+)?\s+\d+(\.\d+)?\s+\d+(\.\d+)?\s+\d+(\.\d+)?\s+re\b/g) || []).length;
    assert(vectorBarCount >= 45, `PDF contains genuine Code 128 vector bars (found ${vectorBarCount} vector rectangle operators)`);
    assert(extractedText100.includes('SYNTHETIC TEST LABEL - NOT REGISTERED IN PRODUCTION'), 'PDF contains synthetic notice footer');

    // -------------------------------------------------------------
    // Test Group 3: Compact Label Generation (75x50mm)
    // -------------------------------------------------------------
    console.log('\nGroup 3: Compact Label Generation (75x50mm)');
    const compactBatch: SyntheticBatchPreviewDto = {
        labelSize: '75x50',
        items: [
            {
                companyName: 'GMARK MANUFACTURING PVT LTD',
                productName: 'High-Density Polymer 25kg',
                netWeight: '25.00 kg',
                serialNumber: '2610160002-AB-M02',
                dateTimeStr: '2026-10-16 15:46',
            },
        ],
    };

    const pdfBuffer75 = await service.generateBatchPdf(compactBatch);
    const rawPdf75 = pdfBuffer75.toString('latin1');
    const extractedText75 = extractTextFromPdf(pdfBuffer75);

    assert(rawPdf75.includes('/MediaBox [0 0 212.6 141.73]'), 'PDF contains compact physical MediaBox [0 0 212.6 141.73]');
    assert(extractedText75.includes('NET WEIGHT: 25.00 kg'), 'PDF contains compact prominent net weight');
    assert(extractedText75.includes('2610160002-AB-M02'), 'PDF contains serial with Machine ID M02');

    // -------------------------------------------------------------
    // Test Group 4: Multi-Item Batch with Individual Weights
    // -------------------------------------------------------------
    console.log('\nGroup 4: Multi-Item Batch with Individual Weights');
    const multiBatch: SyntheticBatchPreviewDto = {
        labelSize: '100x50',
        items: [
            { productName: 'Bag Batch #1', netWeight: 5.09, serialNumber: '2610160001-AB-M01' },
            { productName: 'Bag Batch #2', netWeight: 5.14, serialNumber: '2610160002-AB-M01' },
            { productName: 'Bag Batch #3', netWeight: 5.08, serialNumber: '2610160003-AB-M01' },
            { productName: 'Bag Batch #4', netWeight: 5.15, serialNumber: '2610160004-AB-M01' },
        ],
    };

    const multiPdf = await service.generateBatchPdf(multiBatch);
    const multiRaw = multiPdf.toString('latin1');
    const multiExtracted = extractTextFromPdf(multiPdf);

    // Count pages by counting /Type /Page
    const pageMatches = multiRaw.match(/\/Type\s*\/Page\b/g);
    assert(pageMatches !== null && pageMatches.length === 4, `Multi-item batch generated exactly 4 physical pages (got: ${pageMatches?.length})`);

    assert(multiExtracted.includes('NET WEIGHT: 5.09 kg'), 'Page 1 has distinct individual weight 5.09 kg');
    assert(multiExtracted.includes('NET WEIGHT: 5.14 kg'), 'Page 2 has distinct individual weight 5.14 kg');
    assert(multiExtracted.includes('NET WEIGHT: 5.08 kg'), 'Page 3 has distinct individual weight 5.08 kg');
    assert(multiExtracted.includes('NET WEIGHT: 5.15 kg'), 'Page 4 has distinct individual weight 5.15 kg');

    // -------------------------------------------------------------
    // Test Group 5: Edge Cases & Typography Robustness
    // -------------------------------------------------------------
    console.log('\nGroup 5: Edge Cases & Typography Robustness');
    const longNameBatch: SyntheticBatchPreviewDto = {
        labelSize: '100x50',
        items: [
            {
                productName: 'Ultra High Density Polyethylene Composite Granules Specialized Extra Heavy Grade Sack',
                netWeight: 50.25,
                serialNumber: '26101610000-AB-LONGID99',
            },
        ],
    };

    const edgePdf = await service.generateBatchPdf(longNameBatch);
    const edgeExtracted = extractTextFromPdf(edgePdf);
    assert(edgePdf.length > 1000, 'Generates valid PDF for 80+ character product name and long Machine ID');
    assert(edgeExtracted.includes('26101610000-AB-LONGID99'), 'Preserves 5-digit overflow serial with extended Machine ID');

    // -------------------------------------------------------------
    // Test Group 6: Timezone Formatter Verification
    // -------------------------------------------------------------
    console.log('\nGroup 6: Asia/Kolkata Timestamp Formatter');
    const fixedDate = new Date('2026-10-16T10:15:00.000Z'); // 10:15 UTC = 15:45 IST
    const kolkataStr = formatKolkataTimestamp(fixedDate);
    assert(kolkataStr === '2026-10-16 15:45', `UTC 10:15 converts to Asia/Kolkata 15:45 [got: "${kolkataStr}"]`);

    // -------------------------------------------------------------
    // Summary
    // -------------------------------------------------------------
    console.log('\n========================================');
    console.log(`Test Results: ${passed} passed, ${failed} failed`);
    console.log('========================================\n');

    if (failed > 0) {
        process.exit(1);
    }
}

runTests().catch((err) => {
    console.error('Test execution error:', err);
    process.exit(1);
});
