import * as fs from 'fs';
import * as path from 'path';
// PDFKit is installed in backend dependencies
// eslint-disable-next-line @typescript-eslint/no-var-requires
const PDFDocument = require('pdfkit');

import { getLabelConfig, LabelDimensionConfig } from '../templates/label-size-registry';
import { SyntheticBatchPreviewDto, SyntheticLabelItem, formatKolkataTimestamp } from '../dto/label-preview.dto';
import { renderCode128Vector } from '../utils/code128-vector.util';

export class LabelGeneratorService {
    /**
     * Generates a multi-page PDF document containing physical thermal label layouts
     * strictly formatted to the requested dimensions.
     */
    public async generateBatchPdf(dto: SyntheticBatchPreviewDto): Promise<Buffer> {
        return new Promise((resolve, reject) => {
            if (!dto.items || dto.items.length === 0) {
                return reject(new Error('Batch must contain at least one label item.'));
            }

            const config = getLabelConfig(dto.labelSize);

            // Initialize PDFKit with exact physical page bounds for the first page
            const doc = new PDFDocument({
                size: [config.widthPt, config.heightPt],
                margin: 0,
                autoFirstPage: false,
                compress: false, // Ensures raw stream is programmatically auditable
                info: {
                    Title: 'Manufacturer Module — Synthetic Label Preview',
                    Author: 'Gmark ERP',
                    Subject: `Synthetic Label Preview (${config.name})`,
                    CreationDate: new Date(),
                },
            });

            const chunks: Buffer[] = [];
            doc.on('data', (chunk: Buffer) => chunks.push(chunk));
            doc.on('end', () => resolve(Buffer.concat(chunks)));
            doc.on('error', (err: Error) => reject(err));

            // Render each label in the batch onto its own physical page
            dto.items.forEach((item, index) => {
                const itemConfig = getLabelConfig(item.labelSizeOverride || dto.labelSize);
                doc.addPage({
                    size: [itemConfig.widthPt, itemConfig.heightPt],
                    margin: 0,
                });
                this.renderSingleLabel(doc, item, itemConfig, index + 1, dto.items.length);
            });

            doc.end();
        });
    }

    /**
     * Renders a single thermal label matching the visual hierarchy specified in the plan.
     */
    private renderSingleLabel(
        doc: any,
        item: SyntheticLabelItem,
        config: LabelDimensionConfig,
        pageNum: number,
        totalPages: number
    ): void {
        const left = config.margins.left;
        const right = config.widthPt - config.margins.right;
        const usableWidth = right - left;

        const company = (item.companyName || 'GMARK MANUFACTURING PVT LTD').trim();
        const product = (item.productName || 'Industrial Grade Polymer 50kg').trim();
        const serial = (item.serialNumber || '2610160001-AB-M01').trim();
        const dateStr = item.dateTimeStr || formatKolkataTimestamp();

        // Format weight string
        let weightStr = typeof item.netWeight === 'number'
            ? `${item.netWeight.toFixed(2)} kg`
            : String(item.netWeight).trim();
        if (!weightStr.toLowerCase().endsWith('kg')) {
            weightStr = `${weightStr} kg`;
        }

        const isLarge = config.id === '150x100' || config.id === '200x100' || config.id === '250x100';
        const isStandard = config.id === '100x50';

        // -------------------------------------------------------------
        // 1. Company Name (Centered, Bold at top)
        // -------------------------------------------------------------
        let currentY = config.margins.top;
        doc.font('Helvetica-Bold')
            .fontSize(config.typography.companyHeader)
            .fillColor('#000000')
            .text(company, left, currentY, {
                width: usableWidth,
                align: 'center',
            });

        currentY += isLarge ? 20 : (isStandard ? 12 : 11);

        // -------------------------------------------------------------
        // 2. Product Name
        // -------------------------------------------------------------
        doc.font('Helvetica-Bold')
            .fontSize(config.typography.productName)
            .fillColor('#000000')
            .text('Product: ', left, currentY, { continued: true })
            .font('Helvetica')
            .text(product, {
                width: usableWidth,
                lineGap: 0,
            });

        currentY = Math.max(doc.y + 2, currentY + (isLarge ? 20 : (isStandard ? 11 : 10)));

        // -------------------------------------------------------------
        // 3. Net Weight (Prominent, Bold, Substantially Larger)
        // -------------------------------------------------------------
        doc.font('Helvetica-Bold')
            .fontSize(config.typography.netWeight)
            .fillColor('#000000')
            .text(`NET WEIGHT: ${weightStr}`, left, currentY, {
                width: usableWidth,
                align: 'left',
            });

        currentY = Math.max(doc.y + 3, currentY + (isLarge ? 34 : (isStandard ? 16 : 14)));

        // -------------------------------------------------------------
        // 4. Complete Serial Number (including Machine ID)
        // -------------------------------------------------------------
        doc.font('Helvetica-Bold')
            .fontSize(config.typography.serialNumber)
            .fillColor('#000000')
            .text('Serial: ', left, currentY, { continued: true })
            .font('Helvetica')
            .text(serial, {
                width: usableWidth,
            });

        currentY = Math.max(doc.y + 2, currentY + (isLarge ? 18 : (isStandard ? 10 : 9)));

        // -------------------------------------------------------------
        // 5. Date & Time (Asia/Kolkata)
        // -------------------------------------------------------------
        doc.font('Helvetica-Bold')
            .fontSize(config.typography.timestamp)
            .fillColor('#000000')
            .text('Date:   ', left, currentY, { continued: true })
            .font('Helvetica')
            .text(dateStr, {
                width: usableWidth,
            });

        currentY = Math.max(doc.y + 2, currentY + (isLarge ? 18 : (isStandard ? 10 : 9)));

        // -------------------------------------------------------------
        // 6. Horizontal Separator
        // -------------------------------------------------------------
        doc.lineWidth(0.75)
            .strokeColor('#000000')
            .moveTo(left, currentY)
            .lineTo(right, currentY)
            .stroke();

        currentY += isLarge ? 8 : 2;

        // -------------------------------------------------------------
        // 7. Standards-Compliant Single 1D Code 128 Barcode (ISO/IEC 15417)
        //    Encodes: Full Product Name | Actual Weight with Unit | Serial Number
        // -------------------------------------------------------------
        const numWeight = typeof item.netWeight === 'number'
            ? Number(item.netWeight.toFixed(2))
            : parseFloat(String(item.netWeight)) || 0;

        const safeProduct = product.replace(/\|/g, '\\|');
        const unitFormatted = (weightStr.split(' ')[1] || 'kg').toLowerCase();

        const singleBarcodePayload = item.barcodePayload || `${safeProduct} | ${numWeight.toFixed(2)} ${unitFormatted} | ${serial}`;

        const barcodeBox = config.barcodeBox;
        const barcodeX = left + (usableWidth - barcodeBox.widthPt) / 2;
        const barcodeY = currentY;

        renderCode128Vector(doc, singleBarcodePayload, {
            x: barcodeX,
            y: barcodeY,
            maxWidth: barcodeBox.widthPt,
            maxHeight: barcodeBox.heightPt,
            includeText: true,
            displayText: serial, // Displays ONLY the Serial Number under the barcode lines (omits weight)
            textFontSize: isLarge ? 9.5 : (isStandard ? 6.5 : 5.5),
            quietZoneModules: 10,
        });

        // -------------------------------------------------------------
        // 8. Watermark Notice (Omitted for official production labels)
        // -------------------------------------------------------------
        if (!item.isProduction) {
            const watermarkY = config.heightPt - (isLarge ? 12 : 8);
            doc.font('Helvetica')
                .fontSize(isLarge ? 7 : 5.5)
                .fillColor('#777777')
                .text('SYNTHETIC TEST LABEL - NOT REGISTERED IN PRODUCTION', left, watermarkY, {
                    width: usableWidth,
                    align: 'center',
                });
        }
    }

    /**
     * Utility to generate and write batch PDF directly to a filesystem target.
     */
    public async writeBatchPdfToFile(dto: SyntheticBatchPreviewDto, targetPath: string): Promise<string> {
        const buffer = await this.generateBatchPdf(dto);
        const dir = path.dirname(targetPath);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
        fs.writeFileSync(targetPath, buffer);
        return targetPath;
    }
}
