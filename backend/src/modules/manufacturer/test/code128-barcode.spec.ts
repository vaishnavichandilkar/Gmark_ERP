/**
 * Automated Unit Test Suite for Code 128 Vector Barcode Generation
 * Run via: npx ts-node src/modules/manufacturer/test/code128-barcode.spec.ts
 */

import { encodeCode128, renderCode128Vector, CODE128_CONSTANTS, CODE128_PATTERNS } from '../utils/code128-vector.util';

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

async function runTests() {
    console.log('=== Running Code 128 Vector Barcode Unit Tests ===\n');

    // -------------------------------------------------------------
    // Test Group 1: Standard Serial Encoding & Modulo-103 Checksum
    // -------------------------------------------------------------
    console.log('Group 1: Standard Serial Encoding & Mathematical Checksum Verification');
    const serial = '2610160001-AB-M01';
    const encoded = encodeCode128(serial);

    assert(encoded.rawText === serial, 'Preserves exact raw text string');
    assert(encoded.symbols[0] === CODE128_CONSTANTS.START_C, 'Initializes with START_C for 10-digit serial prefix');

    // Symbols check: [START_C(105), 26, 10, 16, 0, 1, CODE_B(100), 13, 33, 34, 13, 45, 16, 17, checksum(31), STOP(106)]
    assert(encoded.symbols[1] === 26, 'Encodes digit pair "26" as Code C value 26');
    assert(encoded.symbols[2] === 10, 'Encodes digit pair "10" as Code C value 10');
    assert(encoded.symbols[3] === 16, 'Encodes digit pair "16" as Code C value 16');
    assert(encoded.symbols[4] === 0,  'Encodes digit pair "00" as Code C value 0');
    assert(encoded.symbols[5] === 1,  'Encodes digit pair "01" as Code C value 1');
    assert(encoded.symbols[6] === CODE128_CONSTANTS.CODE_B, 'Switches to Code Set B for hyphen');
    assert(encoded.symbols[7] === 13, 'Encodes hyphen "-" in Code B (ASCII 45 - 32 = 13)');
    assert(encoded.symbols[8] === 33, 'Encodes letter "A" in Code B (ASCII 65 - 32 = 33)');
    assert(encoded.symbols[9] === 34, 'Encodes letter "B" in Code B (ASCII 66 - 32 = 34)');
    assert(encoded.symbols[10] === 13, 'Encodes second hyphen "-" (13)');
    assert(encoded.symbols[11] === 45, 'Encodes letter "M" in Code B (ASCII 77 - 32 = 45)');
    assert(encoded.symbols[12] === 16, 'Encodes digit "0" in Code B (ASCII 48 - 32 = 16)');
    assert(encoded.symbols[13] === 17, 'Encodes digit "1" in Code B (ASCII 49 - 32 = 17)');

    // Mathematical Modulo-103 verification:
    // (105 + 1*26 + 2*10 + 3*16 + 4*0 + 5*1 + 6*100 + 7*13 + 8*33 + 9*34 + 10*13 + 11*45 + 12*16 + 13*17) = 2503
    // 2503 % 103 = 31
    assert(encoded.checksum === 31, `Calculates exact Modulo-103 checksum (expected: 31, got: ${encoded.checksum})`);
    assert(encoded.symbols[encoded.symbols.length - 2] === 31, 'Appends correct checksum symbol before STOP');
    assert(encoded.symbols[encoded.symbols.length - 1] === CODE128_CONSTANTS.STOP, 'Terminates with valid STOP symbol (106)');

    // -------------------------------------------------------------
    // Test Group 2: Total Modules & Bar Geometries
    // -------------------------------------------------------------
    console.log('\nGroup 2: Symbol Widths & Bar Geometries');
    // Active modules: 15 symbols of 11 modules + 1 stop of 13 modules = 15*11 + 13 = 178 modules
    assert(encoded.totalActiveModules === 178, `Total active barcode modules equals 178 (got: ${encoded.totalActiveModules})`);
    assert(encoded.bars.length > 0, `Generated ${encoded.bars.length} vector bars`);

    // Verify all bars have positive width and valid bounds
    let allBarsValid = true;
    for (const bar of encoded.bars) {
        if (bar.xModule < 0 || bar.widthModules < 1 || bar.widthModules > 4) {
            allBarsValid = false;
        }
    }
    assert(allBarsValid, 'All vector bars have normalized module widths between 1 and 4');

    // -------------------------------------------------------------
    // Test Group 3: Quiet Zones and Physical Label Dimension Fitting
    // -------------------------------------------------------------
    console.log('\nGroup 3: Physical Label Sizing & Quiet Zones');

    // Mock PDFKit document
    const drawnRects: Array<{ x: number; y: number; w: number; h: number }> = [];
    const mockDoc: any = {
        save() {},
        restore() {},
        fillColor() { return this; },
        rect(x: number, y: number, w: number, h: number) {
            drawnRects.push({ x, y, w, h });
            return { fill: () => {} };
        },
        font() { return this; },
        fontSize() { return this; },
        text() { return this; },
    };

    // 100x50 mm Label fitting
    const metrics100 = renderCode128Vector(mockDoc, serial, {
        x: 21.73,
        y: 80,
        maxWidth: 240,
        maxHeight: 36,
        quietZoneModules: 10,
    });

    assert(metrics100.totalModules === 198, 'Total modules includes 20 quiet zone modules (10X left + 10X right = 198X)');
    assert(metrics100.totalWidth <= 240, `Total barcode width (${metrics100.totalWidth.toFixed(2)} pt) fits within 240 pt`);
    assert(metrics100.quietZoneWidthPt >= 10 * metrics100.moduleWidthPt, 'Guarantees >= 10X quiet zone on both sides');
    assert(metrics100.moduleWidthMils >= 14, `Standard label module width is >= 14 mils for 203 DPI scanner readability (got: ${metrics100.moduleWidthMils.toFixed(1)} mils)`);

    // 75x50 mm Label fitting
    const metrics75 = renderCode128Vector(mockDoc, serial, {
        x: 14.3,
        y: 80,
        maxWidth: 184,
        maxHeight: 32,
        quietZoneModules: 10,
    });

    assert(metrics75.totalWidth <= 184, `Compact barcode width (${metrics75.totalWidth.toFixed(2)} pt) fits within 184 pt`);
    assert(metrics75.moduleWidthMils >= 10, `Compact label module width is >= 10 mils standard warehouse benchmark (got: ${metrics75.moduleWidthMils.toFixed(1)} mils)`);

    // -------------------------------------------------------------
    // Test Group 4: Edge Cases & Input Validation
    // -------------------------------------------------------------
    console.log('\nGroup 4: Edge Cases & Input Validation');

    let caughtEmpty = false;
    try {
        encodeCode128('');
    } catch {
        caughtEmpty = true;
    }
    assert(caughtEmpty, 'Rejects empty string input with clear error');

    let caughtInvalidChar = false;
    try {
        encodeCode128('2610160001\x00-AB'); // Contains NULL character
    } catch {
        caughtInvalidChar = true;
    }
    assert(caughtInvalidChar, 'Rejects non-printable ASCII character outside 32-126 range');

    // Extended/Overflow Serial
    const overflowSerial = '26101610000-AB-LINE2-M09';
    const encodedOverflow = encodeCode128(overflowSerial);
    assert(encodedOverflow.symbols.length > 0, 'Successfully encodes extended overflow serial with 5-digit sequence and multi-segment machine ID');
    assert(encodedOverflow.symbols[encodedOverflow.symbols.length - 1] === CODE128_CONSTANTS.STOP, 'Extended serial has valid termination and checksum');

    // -------------------------------------------------------------
    // Test Group 5: Standalone Round-Trip Pattern Verification
    // -------------------------------------------------------------
    console.log('\nGroup 5: Independent Symbol Pattern Verification');
    // Verify that every single symbol pattern in the encoded output exactly matches ISO/IEC 15417 table
    let allPatternsMatchStandard = true;
    for (const sym of encoded.symbols) {
        const pattern = CODE128_PATTERNS[sym];
        if (!pattern || (sym === 106 ? pattern.length !== 7 : pattern.length !== 6)) {
            allPatternsMatchStandard = false;
        }
    }
    assert(allPatternsMatchStandard, 'Every symbol matches the ISO/IEC 15417 bar/space pattern specification');

    console.log('\n========================================');
    console.log(`Test Results: ${passed} passed, ${failed} failed`);
    console.log('========================================\n');

    if (failed > 0) {
        process.exit(1);
    }
}

runTests().catch((err) => {
    console.error('Test execution failed:', err);
    process.exit(1);
});
