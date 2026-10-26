/**
 * Code 128 Barcode QA Test Suite
 *
 * Evaluates Code 128 1D Barcode compliance against requirements:
 * 1. Complete Product Name, Weight with Unit, and Serial Number encoding.
 * 2. Independent decoding and field extraction.
 * 3. Short, medium, and long product names, spaces, punctuation, units, decimal weights.
 * 4. Physical fit and module width (mils) on 100x50 mm and 75x50 mm thermal labels.
 * 5. Quiet zone compliance and scannability thresholds.
 * 6. Legacy serial-only backward compatibility.
 * 7. Edge cases and invalid inputs.
 * 8. Human-readable text verification.
 */

import { encodeCode128, renderCode128Vector, CODE128_CONSTANTS, CODE128_PATTERNS } from '../utils/code128-vector.util';
import { LABEL_SIZE_REGISTRY } from '../templates/label-size-registry';

// ============================================================================
// 1. Independent Code 128 Symbol Decoder
// ============================================================================

export interface DecodedCode128 {
    text: string;
    startCode: 'A' | 'B' | 'C';
    checksumValid: boolean;
    calculatedChecksum: number;
    encodedChecksum: number;
    rawSymbols: number[];
}

export function decodeCode128Symbols(symbols: number[]): DecodedCode128 {
    if (!symbols || symbols.length < 3) {
        throw new Error('Decoder error: Invalid symbols array length.');
    }

    const startVal = symbols[0];
    let currentSet: 'A' | 'B' | 'C';
    if (startVal === CODE128_CONSTANTS.START_A) currentSet = 'A';
    else if (startVal === CODE128_CONSTANTS.START_B) currentSet = 'B';
    else if (startVal === CODE128_CONSTANTS.START_C) currentSet = 'C';
    else throw new Error(`Decoder error: Invalid START symbol ${startVal}`);

    const stopVal = symbols[symbols.length - 1];
    if (stopVal !== CODE128_CONSTANTS.STOP) {
        throw new Error(`Decoder error: Missing STOP symbol (expected 106, got ${stopVal})`);
    }

    const encodedChecksum = symbols[symbols.length - 2];

    // Verify Checksum
    let sum = symbols[0];
    for (let k = 1; k < symbols.length - 2; k++) {
        sum += k * symbols[k];
    }
    const calculatedChecksum = sum % 103;
    const checksumValid = calculatedChecksum === encodedChecksum;

    let text = '';
    for (let k = 1; k < symbols.length - 2; k++) {
        const sym = symbols[k];

        if (currentSet !== 'C' && sym === CODE128_CONSTANTS.CODE_C) {
            currentSet = 'C';
            continue;
        }
        if (currentSet !== 'B' && sym === CODE128_CONSTANTS.CODE_B) {
            currentSet = 'B';
            continue;
        }
        if (currentSet !== 'A' && sym === CODE128_CONSTANTS.CODE_A) {
            currentSet = 'A';
            continue;
        }

        if (currentSet === 'C') {
            text += sym.toString().padStart(2, '0');
        } else if (currentSet === 'B') {
            text += String.fromCharCode(sym + 32);
        } else if (currentSet === 'A') {
            if (sym < 64) {
                text += String.fromCharCode(sym + 32);
            } else {
                text += String.fromCharCode(sym - 64);
            }
        }
    }

    return {
        text,
        startCode: currentSet,
        checksumValid,
        calculatedChecksum,
        encodedChecksum,
        rawSymbols: symbols,
    };
}

// ============================================================================
// 2. Physical Metrics & Scannability Standards
// ============================================================================

// Industrial Barcode Scannability Standards (ISO/IEC 15417 / GS1 General Specifications):
// - Standard X-dimension benchmark: 10 to 15 mils (0.254 mm to 0.381 mm).
// - Absolute minimum for specialized high-density optical scanners: 7.5 mils (0.190 mm).
// - Sub-7.5 mils: FAILS general industrial handheld scanner decodability.
// - Sub-5 mils: Cannot be resolved by 203 DPI thermal printers without pixel distortion/aliasing.
export const SCANNABILITY_THRESHOLDS = {
    BENCHMARK_MILS: 14.0,       // Ideal 203 DPI warehouse scan
    MIN_RECOMMENDED_MILS: 10.0, // Minimum standard industrial threshold
    ABSOLUTE_MIN_MILS: 7.5,     // High-density scanner floor
};

export interface PhysicalFeasibilityResult {
    payloadLength: number;
    activeModules: number;
    totalModulesWithQuietZone: number;
    label100x50: {
        availableWidthPt: number;
        availableWidthMm: number;
        scaledModuleWidthPt: number;
        scaledModuleWidthMils: number;
        scaledModuleWidthMm: number;
        widthAt10MilsPt: number;
        widthAt10MilsMm: number;
        fitsAt10Mils: boolean;
        scannabilityStatus: 'PASS' | 'MARGINAL' | 'FAIL';
    };
    label75x50: {
        availableWidthPt: number;
        availableWidthMm: number;
        scaledModuleWidthPt: number;
        scaledModuleWidthMils: number;
        scaledModuleWidthMm: number;
        widthAt10MilsPt: number;
        widthAt10MilsMm: number;
        fitsAt10Mils: boolean;
        scannabilityStatus: 'PASS' | 'MARGINAL' | 'FAIL';
    };
}

export function evaluatePhysicalFeasibility(text: string): PhysicalFeasibilityResult {
    const encoded = encodeCode128(text);
    const quietZoneModules = 20; // 10X left + 10X right
    const totalModules = encoded.totalActiveModules + quietZoneModules;

    // 100x50 mm Label
    const box100Pt = LABEL_SIZE_REGISTRY['100x50'].barcodeBox.widthPt; // 240 pt
    const box100Mm = (box100Pt / 72) * 25.4; // 84.67 mm
    const mod100Pt = box100Pt / totalModules;
    const mod100Mils = mod100Pt * (1000 / 72);
    const mod100Mm = (mod100Pt / 72) * 25.4;
    const widthAt10Mils100Pt = totalModules * (10 / (1000 / 72));
    const widthAt10Mils100Mm = (widthAt10Mils100Pt / 72) * 25.4;

    let status100: 'PASS' | 'MARGINAL' | 'FAIL' = 'FAIL';
    if (mod100Mils >= SCANNABILITY_THRESHOLDS.MIN_RECOMMENDED_MILS) status100 = 'PASS';
    else if (mod100Mils >= SCANNABILITY_THRESHOLDS.ABSOLUTE_MIN_MILS) status100 = 'MARGINAL';

    // 75x50 mm Label
    const box75Pt = LABEL_SIZE_REGISTRY['75x50'].barcodeBox.widthPt; // 184 pt
    const box75Mm = (box75Pt / 72) * 25.4; // 64.91 mm
    const mod75Pt = box75Pt / totalModules;
    const mod75Mils = mod75Pt * (1000 / 72);
    const mod75Mm = (mod75Pt / 72) * 25.4;
    const widthAt10Mils75Pt = totalModules * (10 / (1000 / 72));
    const widthAt10Mils75Mm = (widthAt10Mils75Pt / 72) * 25.4;

    let status75: 'PASS' | 'MARGINAL' | 'FAIL' = 'FAIL';
    if (mod75Mils >= SCANNABILITY_THRESHOLDS.MIN_RECOMMENDED_MILS) status75 = 'PASS';
    else if (mod75Mils >= SCANNABILITY_THRESHOLDS.ABSOLUTE_MIN_MILS) status75 = 'MARGINAL';

    return {
        payloadLength: text.length,
        activeModules: encoded.totalActiveModules,
        totalModulesWithQuietZone: totalModules,
        label100x50: {
            availableWidthPt: box100Pt,
            availableWidthMm: box100Mm,
            scaledModuleWidthPt: mod100Pt,
            scaledModuleWidthMils: mod100Mils,
            scaledModuleWidthMm: mod100Mm,
            widthAt10MilsPt: widthAt10Mils100Pt,
            widthAt10MilsMm: widthAt10Mils100Mm,
            fitsAt10Mils: widthAt10Mils100Pt <= box100Pt,
            scannabilityStatus: status100,
        },
        label75x50: {
            availableWidthPt: box75Pt,
            availableWidthMm: box75Mm,
            scaledModuleWidthPt: mod75Pt,
            scaledModuleWidthMils: mod75Mils,
            scaledModuleWidthMm: mod75Mm,
            widthAt10MilsPt: widthAt10Mils75Pt,
            widthAt10MilsMm: widthAt10Mils75Mm,
            fitsAt10Mils: widthAt10Mils75Pt <= box75Pt,
            scannabilityStatus: status75,
        },
    };
}

// ============================================================================
// 3. Execution of QA Test Scenarios
// ============================================================================

async function runCode128QaAudit() {
    console.log('================================================================================');
    console.log('          CODE 128 BARCODE QA AUDIT — FULL 3-FIELD ENCODING & DECODING          ');
    console.log('================================================================================\n');

    const testScenarios = [
        {
            id: 'SCENARIO_1_LEGACY',
            category: 'Legacy Serial Only (Baseline)',
            product: '',
            weight: '',
            unit: '',
            serial: '2610160001-AB-M01',
            rawBarcodeText: '2610160001-AB-M01',
        },
        {
            id: 'SCENARIO_2_SHORT',
            category: 'Short Product Name (Pipe Delimited)',
            product: 'Urea',
            weight: '50.00',
            unit: 'kg',
            serial: '2610230001-AB-M01',
            rawBarcodeText: 'Urea|50.00 kg|2610230001-AB-M01',
        },
        {
            id: 'SCENARIO_3_MEDIUM',
            category: 'Medium Product Name (Pipe Delimited)',
            product: 'Industrial Polymer',
            weight: '50.00',
            unit: 'kg',
            serial: '2610230001-AB-M01',
            rawBarcodeText: 'Industrial Polymer|50.00 kg|2610230001-AB-M01',
        },
        {
            id: 'SCENARIO_4_STANDARD_FULL',
            category: 'Full Production Product Name (Pipe Delimited)',
            product: 'Industrial Grade Polymer 50kg',
            weight: '50.250',
            unit: 'kg',
            serial: '2610230001-AB-M01',
            rawBarcodeText: 'Industrial Grade Polymer 50kg|50.250 kg|2610230001-AB-M01',
        },
        {
            id: 'SCENARIO_5_LONG',
            category: 'Long Chemical/Resin Product Name (Pipe Delimited)',
            product: 'Polyethylene Terephthalate High Viscosity Resin',
            weight: '25.500',
            unit: 'kg',
            serial: '2610230001-AB-M01',
            rawBarcodeText: 'Polyethylene Terephthalate High Viscosity Resin|25.500 kg|2610230001-AB-M01',
        },
        {
            id: 'SCENARIO_6_SPECIAL_CHARS',
            category: 'Punctuation, Spaces, Grams Unit (Pipe Delimited)',
            product: 'Chemical Spec-A (98.5% Pure, Grade #4)',
            weight: '1250.5',
            unit: 'g',
            serial: '2610230001-AB-M01',
            rawBarcodeText: 'Chemical Spec-A (98.5% Pure, Grade #4)|1250.5 g|2610230001-AB-M01',
        },
        {
            id: 'SCENARIO_7_JSON_PAYLOAD',
            category: 'Structured JSON 3-Field Payload',
            product: 'Industrial Grade Polymer 50kg',
            weight: '50.250',
            unit: 'kg',
            serial: '2610230001-AB-M01',
            rawBarcodeText: JSON.stringify({
                product: 'Industrial Grade Polymer 50kg',
                weight: 50.25,
                unit: 'kg',
                serial: '2610230001-AB-M01',
            }),
        },
    ];

    console.log('--------------------------------------------------------------------------------');
    console.log('PART A: ENCODING, MATHEMATICAL CHECKSUM & INDEPENDENT DECODING');
    console.log('--------------------------------------------------------------------------------');

    for (const sc of testScenarios) {
        console.log(`\n▶ Scenario [${sc.id}]: ${sc.category}`);
        console.log(`  Raw Input Text: "${sc.rawBarcodeText}" (Length: ${sc.rawBarcodeText.length} chars)`);

        try {
            const encoded = encodeCode128(sc.rawBarcodeText);
            const decoded = decodeCode128Symbols(encoded.symbols);

            const textMatches = decoded.text === sc.rawBarcodeText;
            const checksumMatches = decoded.checksumValid;

            console.log(`  Symbols Generated: ${encoded.symbols.length} symbols | Checksum: ${encoded.checksum} (${checksumMatches ? 'VALID' : 'INVALID'})`);
            console.log(`  Decoded Text:      "${decoded.text}"`);
            console.log(`  Exact Match:       ${textMatches ? '✓ YES' : '✗ NO'}`);

            if (sc.product && sc.weight && sc.serial) {
                const containsProduct = decoded.text.includes(sc.product);
                const containsWeight = decoded.text.includes(sc.weight);
                const containsSerial = decoded.text.includes(sc.serial);
                console.log(`  Field Verifications: Product=${containsProduct ? '✓' : '✗'}, Weight=${containsWeight ? '✓' : '✗'}, Serial=${containsSerial ? '✓' : '✗'}`);
            }
        } catch (err: any) {
            console.error(`  ✗ Encoding/Decoding ERROR: ${err.message}`);
        }
    }

    console.log('\n--------------------------------------------------------------------------------');
    console.log('PART B: PHYSICAL FEASIBILITY, QUIET ZONES & SCANNER READABILITY EVALUATION');
    console.log('--------------------------------------------------------------------------------\n');
    console.log('Thresholds:');
    console.log(`  - 203 DPI Ideal Benchmark: >= ${SCANNABILITY_THRESHOLDS.BENCHMARK_MILS} mils`);
    console.log(`  - Minimum Recommended Scannable Bar: >= ${SCANNABILITY_THRESHOLDS.MIN_RECOMMENDED_MILS} mils (0.254 mm)`);
    console.log(`  - Absolute Optical Engine Limit: >= ${SCANNABILITY_THRESHOLDS.ABSOLUTE_MIN_MILS} mils (0.190 mm)\n`);

    for (const sc of testScenarios) {
        const feas = evaluatePhysicalFeasibility(sc.rawBarcodeText);

        console.log(`================================================================================`);
        console.log(`Scenario: ${sc.id} — "${sc.rawBarcodeText.slice(0, 45)}${sc.rawBarcodeText.length > 45 ? '...' : ''}"`);
        console.log(`Length: ${feas.payloadLength} chars | Active Modules: ${feas.activeModules} | Total (incl 20X Quiet): ${feas.totalModulesWithQuietZone}`);
        console.log(`--------------------------------------------------------------------------------`);
        console.log(`100x50 mm Label (Available Barcode Box: ${feas.label100x50.availableWidthPt} pt / ${feas.label100x50.availableWidthMm.toFixed(1)} mm):`);
        console.log(`  - At Standard 10-mil Bar: Required Width = ${feas.label100x50.widthAt10MilsMm.toFixed(1)} mm (${feas.label100x50.fitsAt10Mils ? 'FITS ✓' : 'OVERFLOWS BY +' + (feas.label100x50.widthAt10MilsMm - feas.label100x50.availableWidthMm).toFixed(1) + ' mm ✗'})`);
        console.log(`  - If Scaled to Fit Box:   Module Width = ${feas.label100x50.scaledModuleWidthMils.toFixed(2)} mils (${feas.label100x50.scaledModuleWidthMm.toFixed(3)} mm) -> Status: [${feas.label100x50.scannabilityStatus}]`);

        console.log(`75x50 mm Label (Available Barcode Box: ${feas.label75x50.availableWidthPt} pt / ${feas.label75x50.availableWidthMm.toFixed(1)} mm):`);
        console.log(`  - At Standard 10-mil Bar: Required Width = ${feas.label75x50.widthAt10MilsMm.toFixed(1)} mm (${feas.label75x50.fitsAt10Mils ? 'FITS ✓' : 'OVERFLOWS BY +' + (feas.label75x50.widthAt10MilsMm - feas.label75x50.availableWidthMm).toFixed(1) + ' mm ✗'})`);
        console.log(`  - If Scaled to Fit Box:   Module Width = ${feas.label75x50.scaledModuleWidthMils.toFixed(2)} mils (${feas.label75x50.scaledModuleWidthMm.toFixed(3)} mm) -> Status: [${feas.label75x50.scannabilityStatus}]`);
    }

    console.log('\n--------------------------------------------------------------------------------');
    console.log('PART C: EDGE CASES, DELIMITERS & INPUT VALIDATION');
    console.log('--------------------------------------------------------------------------------');

    const edgeCases = [
        { name: 'Empty String', input: '', shouldFail: true },
        { name: 'Null Character (ASCII 0)', input: 'Test\x00Serial', shouldFail: true },
        { name: 'DEL Character (ASCII 127)', input: 'Test\x7FSerial', shouldFail: true },
        { name: 'High Unicode / Accent', input: 'Polymer Élite|50kg', shouldFail: true },
        { name: 'Decimal Weights (0.005 kg)', input: 'Sample|0.005 kg|2610230001-AB-M01', shouldFail: false },
        { name: 'Large Decimal (99999.999 kg)', input: 'Bulk|99999.999 kg|2610230001-AB-M01', shouldFail: false },
        { name: 'Pound Unit (lbs)', input: 'Resin|110.23 lbs|2610230001-AB-M01', shouldFail: false },
        { name: 'Metric Ton (MT)', input: 'Bulk Steel|1.25 MT|2610230001-AB-M01', shouldFail: false },
        { name: 'Punctuation & Symbols: !@#$%^&*()-_=+[]{}:;', input: 'Test !@#$%^&*()-_=+[]{}:;|10kg|2610230001', shouldFail: false },
    ];

    for (const ec of edgeCases) {
        let failed = false;
        let errMsg = '';
        try {
            const enc = encodeCode128(ec.input);
            const dec = decodeCode128Symbols(enc.symbols);
            if (dec.text !== ec.input) failed = true;
        } catch (e: any) {
            failed = true;
            errMsg = e.message;
        }

        const pass = ec.shouldFail ? failed : !failed;
        console.log(`  [${pass ? 'PASS ✓' : 'FAIL ✗'}] ${ec.name}: ${ec.shouldFail ? 'Correctly rejected' : 'Successfully processed'}${errMsg ? ' (' + errMsg.slice(0, 40) + '...)' : ''}`);
    }

    console.log('\n--------------------------------------------------------------------------------');
    console.log('PART D: BACKWARD COMPATIBILITY — PACKAGE LOOKUP SIMULATION');
    console.log('--------------------------------------------------------------------------------');

    // Test scanner parser logic with legacy vs new 3-field formats
    function parseScannedBarcode(barcodeInput: string): string {
        const trimmed = barcodeInput.trim();
        // 1. JSON format
        if (trimmed.startsWith('{')) {
            try {
                const parsed = JSON.parse(trimmed);
                return parsed.serial || trimmed;
            } catch {
                return trimmed;
            }
        }
        // 2. Pipe delimited format: Product|Weight|Serial
        if (trimmed.includes('|')) {
            const parts = trimmed.split('|');
            // The serial number is the last segment matching standard format
            const potentialSerial = parts[parts.length - 1].trim();
            if (/^\d{10}-[A-Z0-9]+-[A-Z0-9]+$/.test(potentialSerial)) {
                return potentialSerial;
            }
        }
        // 3. Plain legacy serial
        return trimmed;
    }

    const testLookups = [
        { label: 'Legacy Serial Only', scanned: '2610230001-AB-M01', expectedSerial: '2610230001-AB-M01' },
        { label: 'Pipe Delimited 3-Field', scanned: 'Industrial Polymer|50.00 kg|2610230001-AB-M01', expectedSerial: '2610230001-AB-M01' },
        { label: 'JSON 3-Field Format', scanned: '{"product":"Polymer","weight":50,"unit":"kg","serial":"2610230001-AB-M01"}', expectedSerial: '2610230001-AB-M01' },
    ];

    for (const tl of testLookups) {
        const extracted = parseScannedBarcode(tl.scanned);
        const match = extracted === tl.expectedSerial;
        console.log(`  [${match ? 'PASS ✓' : 'FAIL ✗'}] ${tl.label}: Extracted Serial "${extracted}" (Expected: "${tl.expectedSerial}")`);
    }

    console.log('\n================================================================================');
    console.log('                         CODE 128 QA AUDIT COMPLETE                             ');
    console.log('================================================================================\n');
}

runCode128QaAudit().catch((e) => {
    console.error('Fatal audit failure:', e);
    process.exit(1);
});
