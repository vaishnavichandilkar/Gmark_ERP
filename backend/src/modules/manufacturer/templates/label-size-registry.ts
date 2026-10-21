/**
 * Physical Label Dimensions and Layout Configuration Registry
 *
 * Standard PostScript Conversion: 1 inch = 25.4 mm = 72 points
 */

export interface LabelDimensionConfig {
    id: '100x50' | '75x50';
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

export const LABEL_SIZE_REGISTRY: Record<'100x50' | '75x50', LabelDimensionConfig> = {
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
            widthPt: 240,
            heightPt: 36,
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
};

export function getLabelConfig(sizeId: '100x50' | '75x50'): LabelDimensionConfig {
    const config = LABEL_SIZE_REGISTRY[sizeId];
    if (!config) {
        throw new Error(`Unsupported label size: "${sizeId}". Supported sizes: 100x50, 75x50.`);
    }
    return config;
}
