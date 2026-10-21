/**
 * Standalone Runner to Generate the Genuine Deliverable PDF:
 * reports/manufacturer-preview-labels-2026-10-16.pdf
 *
 * Run via: npx ts-node src/modules/manufacturer/test/preview-batch-runner.ts
 */

import * as path from 'path';
import { LabelGeneratorService } from '../services/label-generator.service';
import { SyntheticBatchPreviewDto } from '../dto/label-preview.dto';

async function generateDeliverablePdf() {
    const service = new LabelGeneratorService();
    const reportsDir = path.resolve(__dirname, '../../../../../reports');
    const outputPath = path.join(reportsDir, 'manufacturer-preview-labels-2026-10-16.pdf');

    console.log('Generating Phase 1 synthetic label preview deliverable...');

    // 1. Generate 100x50mm batch (Pages 1, 3, 4, 5, 6, 7)
    // 2. Generate 75x50mm batch (Page 2)
    // To produce a single comprehensive deliverable showing both physical sizes,
    // we generate both batches and can concatenate or present them cleanly.
    // In PDFKit, each page in a document can have its own custom size!
    // Let's create a combined multi-size showcase batch!

    const combinedDto: SyntheticBatchPreviewDto = {
        labelSize: '100x50',
        items: [
            // Page 1: Standard 100x50mm label matching exact user specification
            {
                companyName: 'GMARK MANUFACTURING PVT LTD',
                productName: 'Industrial Grade Polymer 50kg',
                netWeight: 5.09,
                serialNumber: '2610160001-AB-M01',
                dateTimeStr: '2026-10-16 15:45',
            },
            // Page 2: Compact 75x50mm label matching exact user specification
            {
                companyName: 'GMARK MANUFACTURING PVT LTD',
                productName: 'Industrial Grade Polymer 50kg',
                netWeight: 5.09,
                serialNumber: '2610160001-AB-M01',
                dateTimeStr: '2026-10-16 15:45',
                labelSizeOverride: '75x50',
            },
            // Page 3: Edge Case (Long product name, long Machine ID, 5-digit overflow serial)
            {
                companyName: 'GMARK MANUFACTURING PVT LTD',
                productName: 'High-Density Polyethylene Granules Grade-A Industrial Packaging 50kg Sack',
                netWeight: 50.25,
                serialNumber: '26101610000-AB-LINE2-M09',
                dateTimeStr: '2026-10-16 15:46',
            },
            // Pages 4–7: Multi-item batch demonstrating individual measured weights per bag
            {
                companyName: 'GMARK MANUFACTURING PVT LTD',
                productName: 'Industrial Grade Polymer 50kg (Batch A)',
                netWeight: 5.09,
                serialNumber: '2610160002-AB-M01',
                dateTimeStr: '2026-10-16 15:47',
            },
            {
                companyName: 'GMARK MANUFACTURING PVT LTD',
                productName: 'Industrial Grade Polymer 50kg (Batch A)',
                netWeight: 5.14,
                serialNumber: '2610160003-AB-M01',
                dateTimeStr: '2026-10-16 15:47',
            },
            {
                companyName: 'GMARK MANUFACTURING PVT LTD',
                productName: 'Industrial Grade Polymer 50kg (Batch A)',
                netWeight: 5.08,
                serialNumber: '2610160004-AB-M01',
                dateTimeStr: '2026-10-16 15:48',
            },
            {
                companyName: 'GMARK MANUFACTURING PVT LTD',
                productName: 'Industrial Grade Polymer 50kg (Batch A)',
                netWeight: 5.15,
                serialNumber: '2610160005-AB-M01',
                dateTimeStr: '2026-10-16 15:48',
            },
        ],
    };

    // Note: Page 2 is 75x50mm while others are 100x50mm. Let's make sure our generator supports per-page sizing if specified,
    // or generate standard and compact files!
    await service.writeBatchPdfToFile(combinedDto, outputPath);
    console.log(`Deliverable PDF successfully generated at:\n${outputPath}`);
}

generateDeliverablePdf().catch((err) => {
    console.error('Failed to generate deliverable PDF:', err);
    process.exit(1);
});
