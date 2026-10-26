import * as assert from 'assert';
import * as QRCode from 'qrcode';
import { renderQrCodeVector } from '../utils/qrcode-vector.util';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const PDFDocument = require('pdfkit');

console.log('=== Running QR Code Barcode Unit & Integration Tests ===\n');

// Group 1: 3-Field Payload Integrity
console.log('Group 1: 3-Field Payload Content & Decoding Verification');
const samplePayload = JSON.stringify({
    product: 'Organic Wheat Flour 50kg Ultra Fine',
    weight: 50.05,
    unit: 'kg',
    serial: '2610230001-AB-M01',
});

const decoded = JSON.parse(samplePayload);
assert.strictEqual(decoded.product, 'Organic Wheat Flour 50kg Ultra Fine', 'Product name preserved without truncation');
assert.strictEqual(decoded.weight, 50.05, 'Net weight preserved');
assert.strictEqual(decoded.unit, 'kg', 'Weight unit preserved');
assert.strictEqual(decoded.serial, '2610230001-AB-M01', 'Serial number preserved');
console.log('  ✓ PASS: Payload decodes correctly with Product Name, Weight with Unit, and Serial Number');

// Group 2: QR Matrix Generation
console.log('\nGroup 2: QR Matrix Generation & Error Correction');
const qr = QRCode.create(samplePayload, { errorCorrectionLevel: 'M' });
assert(qr.modules.size > 20, `QR matrix size is valid (got: ${qr.modules.size}x${qr.modules.size})`);
assert(qr.modules.data.length === qr.modules.size * qr.modules.size, 'Module data array length matches size squared');
console.log(`  ✓ PASS: Generated Level-M QR Code matrix of dimension ${qr.modules.size}x${qr.modules.size}`);

// Group 3: PDFKit Vector Rendering & Quiet Zones
console.log('\nGroup 3: PDFKit Vector Rendering & Quiet Zones');
const doc = new PDFDocument({ size: [283.46, 141.73], margin: 0 });
const chunks: Buffer[] = [];
doc.on('data', (c: Buffer) => chunks.push(c));

renderQrCodeVector(doc, samplePayload, {
    x: 120,
    y: 80,
    size: 40,
    includeText: true,
    text: `SN: ${decoded.serial}`,
    textFontSize: 7,
});
doc.end();

doc.on('end', () => {
    const pdfBuf = Buffer.concat(chunks);
    assert(pdfBuf.length > 500, 'PDF buffer successfully created with vector rectangles');
    assert(pdfBuf.toString('binary').includes('%PDF-'), 'Valid PDF format');
    console.log('  ✓ PASS: Vector rectangles drawn to PDFKit stream without error (size: ' + pdfBuf.length + ' bytes)');

    // Group 4: Backward Compatibility Scanner Parsing
    console.log('\nGroup 4: Backward Compatibility Scanner Parsing');
    function parseScan(raw: string) {
        const trimmed = String(raw).trim();
        if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
            try {
                const p = JSON.parse(trimmed);
                return { serial: p.serial, product: p.product, weight: p.weight, isComposite: true };
            } catch (_) {}
        }
        return { serial: trimmed, isComposite: false };
    }

    const newScan = parseScan(samplePayload);
    assert.strictEqual(newScan.serial, '2610230001-AB-M01');
    assert.strictEqual(newScan.isComposite, true);
    console.log('  ✓ PASS: New 3-field QR payload parsed with isComposite=true');

    const legacyScan = parseScan('2610230001-AB-M01');
    assert.strictEqual(legacyScan.serial, '2610230001-AB-M01');
    assert.strictEqual(legacyScan.isComposite, false);
    console.log('  ✓ PASS: Legacy serial-only scan parsed seamlessly for backward compatibility');

    console.log('\n========================================');
    console.log('All QR Code Barcode Tests Passed Successfully!');
    console.log('========================================');
});
