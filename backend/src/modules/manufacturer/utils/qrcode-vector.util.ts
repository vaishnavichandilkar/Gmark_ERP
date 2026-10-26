import * as QRCode from 'qrcode';

export interface QrVectorOptions {
    x: number;
    y: number;
    size: number;
    includeText?: boolean;
    text?: string;
    textFontSize?: number;
    textColor?: string;
}

/**
 * Renders a high-precision 2D QR Code directly as vector rectangles into a PDFKit document stream.
 * Encodes complete product name, weight with unit, and serial number without truncation.
 */
export function renderQrCodeVector(doc: any, payload: string, options: QrVectorOptions): void {
    const qr = QRCode.create(payload, {
        errorCorrectionLevel: 'M',
    });

    const moduleCount = qr.modules.size;
    const moduleData = qr.modules.data;

    // Minimum 2 modules quiet zone for industrial scanner readability
    const quietZone = 2;
    const totalModules = moduleCount + quietZone * 2;
    const cellSize = options.size / totalModules;

    const startX = options.x + (options.size - totalModules * cellSize) / 2;
    const startY = options.y;

    doc.save();
    doc.fillColor('#000000');

    for (let r = 0; r < moduleCount; r++) {
        for (let c = 0; c < moduleCount; c++) {
            const isDark = moduleData[r * moduleCount + c];
            if (isDark) {
                doc.rect(
                    startX + (c + quietZone) * cellSize,
                    startY + (r + quietZone) * cellSize,
                    cellSize,
                    cellSize
                ).fill();
            }
        }
    }

    if (options.includeText && options.text) {
        doc.font('Helvetica-Bold')
            .fontSize(options.textFontSize || 7.5)
            .fillColor(options.textColor || '#000000')
            .text(options.text, options.x - 20, startY + options.size + 2, {
                width: options.size + 40,
                align: 'center',
            });
    }

    doc.restore();
}
