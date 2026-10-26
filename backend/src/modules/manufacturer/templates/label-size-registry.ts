/**
 * Physical Label Dimensions and Layout Configuration Registry
 *
 * Standard PostScript Conversion: 1 inch = 25.4 mm = 72 points
 */

export type SupportedLabelSize = '100x50' | '75x50' | '150x100' | '200x100' | '250x100';

export interface LabelDimensionConfig {
    id: SupportedLabelSize;
    name: string;
    widthMm: number;
    heightMm: number;
    widthPt: number;
    heightPt: number;
    margins: {
        top: number;
        bottom: number;
        left: number;
        right: number;
    };
    typography: {
        companyHeader: number;
        productName: number;
        netWeight: number;
        serialNumber: number;
        timestamp: number;
        syntheticNotice: number;
    };
    barcodeBox: {
        widthPt: number;
        heightPt: number;
    };
}

export const LABEL_SIZE_REGISTRY: Record<SupportedLabelSize, LabelDimensionConfig> = {
    '100x50': {
        id: '100x50',
        name: 'Standard Bulk Bag (100 x 50 mm / 4 x 2 in)',
        widthMm: 100,
        heightMm: 50,
        // (100 / 25.4) * 72 = 283.4645...
        widthPt: 283.46,
        // (50 / 25.4) * 72 = 141.7322...
        heightPt: 141.73,
        margins: {
            top: 7,
            bottom: 5,
            left: 10,
            right: 10,
        },
        typography: {
            companyHeader: 10.5,
            productName: 9,
            netWeight: 19,
            serialNumber: 9,
            timestamp: 8,
            syntheticNotice: 6.5,
        },
        barcodeBox: {
            widthPt: 260,
            heightPt: 48,
        },
    },
    '75x50': {
        id: '75x50',
        name: 'Compact Bag / Drum (75 x 50 mm / 3 x 2 in)',
        widthMm: 75,
        heightMm: 50,
        // (75 / 25.4) * 72 = 212.5984...
        widthPt: 212.60,
        // (50 / 25.4) * 72 = 141.7322...
        heightPt: 141.73,
        margins: {
            top: 6,
            bottom: 5,
            left: 8,
            right: 8,
        },
        typography: {
            companyHeader: 9,
            productName: 8,
            netWeight: 16,
            serialNumber: 8,
            timestamp: 7.5,
            syntheticNotice: 6,
        },
        barcodeBox: {
            widthPt: 184,
            heightPt: 32,
        },
    },
    '150x100': {
        id: '150x100',
        name: 'Single Code 128 Bulk Label (150 x 100 mm / 6 x 4 in)',
        widthMm: 150,
        heightMm: 100,
        // (150 / 25.4) * 72 = 425.1968...
        widthPt: 425.20,
        // (100 / 25.4) * 72 = 283.4645...
        heightPt: 283.46,
        margins: {
            top: 12,
            bottom: 10,
            left: 16,
            right: 16,
        },
        typography: {
            companyHeader: 15,
            productName: 13,
            netWeight: 30,
            serialNumber: 12.5,
            timestamp: 11,
            syntheticNotice: 6.5,
        },
        barcodeBox: {
            widthPt: 390,
            heightPt: 105,
        },
    },
    '200x100': {
        id: '200x100',
        name: 'Single Code 128 Extended Pallet Label (200 x 100 mm / 8 x 4 in)',
        widthMm: 200,
        heightMm: 100,
        // (200 / 25.4) * 72 = 566.9291...
        widthPt: 566.93,
        // (100 / 25.4) * 72 = 283.4645...
        heightPt: 283.46,
        margins: {
            top: 12,
            bottom: 10,
            left: 16,
            right: 16,
        },
        typography: {
            companyHeader: 17,
            productName: 14,
            netWeight: 34,
            serialNumber: 13.5,
            timestamp: 11.5,
            syntheticNotice: 7,
        },
        barcodeBox: {
            widthPt: 532,
            heightPt: 110,
        },
    },
    '250x100': {
        id: '250x100',
        name: 'Single Code 128 Ultra-Wide Pallet Label (250 x 100 mm / 10 x 4 in)',
        widthMm: 250,
        heightMm: 100,
        // (250 / 25.4) * 72 = 708.6614...
        widthPt: 708.66,
        // (100 / 25.4) * 72 = 283.4645...
        heightPt: 283.46,
        margins: {
            top: 12,
            bottom: 10,
            left: 18,
            right: 18,
        },
        typography: {
            companyHeader: 18,
            productName: 15,
            netWeight: 36,
            serialNumber: 14,
            timestamp: 12,
            syntheticNotice: 7,
        },
        barcodeBox: {
            widthPt: 670,
            heightPt: 110,
        },
    },
};

export function getLabelConfig(sizeId: SupportedLabelSize | string): LabelDimensionConfig {
    if (LABEL_SIZE_REGISTRY[sizeId as SupportedLabelSize]) {
        return LABEL_SIZE_REGISTRY[sizeId as SupportedLabelSize];
    }

    // Dynamic parsing for custom label sizes (e.g., "120x80", "100x75 mm", "4x6 in")
    if (typeof sizeId === 'string') {
        const clean = sizeId.trim().toLowerCase();
        const match = clean.match(/(\d+(?:\.\d+)?)\s*(?:x|\*|×)\s*(\d+(?:\.\d+)?)/);
        if (match) {
            let wMm = parseFloat(match[1]);
            let hMm = parseFloat(match[2]);
            if (clean.includes('in') || clean.includes('inch')) {
                wMm *= 25.4;
                hMm *= 25.4;
            }
            if (wMm > 0 && hMm > 0) {
                const widthPt = Number(((wMm / 25.4) * 72).toFixed(2));
                const heightPt = Number(((hMm / 25.4) * 72).toFixed(2));
                const scale = Math.min(widthPt / 425.2, heightPt / 283.46);
                const isLarge = widthPt >= 350 && heightPt >= 220;

                return {
                    id: sizeId as any,
                    name: `Custom Label (${wMm.toFixed(0)} × ${hMm.toFixed(0)} mm)`,
                    widthMm: wMm,
                    heightMm: hMm,
                    widthPt,
                    heightPt,
                    margins: {
                        top: Math.round(isLarge ? 12 : 7),
                        bottom: Math.round(isLarge ? 10 : 5),
                        left: Math.round(isLarge ? 14 : 10),
                        right: Math.round(isLarge ? 14 : 10),
                    },
                    typography: {
                        companyHeader: Math.max(8, Math.round(15 * Math.max(0.6, scale))),
                        productName: Math.max(7, Math.round(13 * Math.max(0.6, scale))),
                        netWeight: Math.max(12, Math.round(28 * Math.max(0.6, scale))),
                        serialNumber: Math.max(7, Math.round(12 * Math.max(0.6, scale))),
                        timestamp: Math.max(6.5, Math.round(11 * Math.max(0.6, scale))),
                        syntheticNotice: 6.5,
                    },
                    barcodeBox: {
                        widthPt: Math.max(150, Math.round(widthPt - 32)),
                        heightPt: Math.max(30, Math.round(isLarge ? 100 : 50)),
                    },
                };
            }
        }
    }

    // Default fallback to 150x100
    return LABEL_SIZE_REGISTRY['150x100'];
}
