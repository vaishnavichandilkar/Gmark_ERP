/**
 * Standards-Compliant ISO/IEC 15417 Code 128 Vector Barcode Encoder & PDFKit Renderer
 *
 * Features:
 * - Pure TypeScript implementation with zero external dependencies.
 * - ISO/IEC 15417 standard table of all 107 symbols (106 data/control + stop).
 * - Modulo-103 checksum calculation.
 * - Intelligent Code C / Code B auto-switching (compresses 10-digit timestamp into 5 symbols).
 * - Strict quiet zone enforcement (minimum 10X left and right).
 * - Direct vector rectangle rendering into PDFKit (`doc.rect(x, y, w, h).fill()`).
 * - Exposes normalized module sequences for deterministic automated test verification.
 */

// ISO/IEC 15417 Code 128 Symbol Patterns
// Each data symbol consists of 6 elements (3 bars, 3 spaces) summing to 11 modules.
// The Stop character (index 106) has 7 elements summing to 13 modules.
export const CODE128_PATTERNS: ReadonlyArray<ReadonlyArray<number>> = [
    [2,1,2,2,2,2], [2,2,2,1,2,2], [2,2,2,2,2,1], [1,2,1,2,2,3], [1,2,1,3,2,2], // 0-4
    [1,3,1,2,2,2], [1,2,2,2,1,3], [1,2,2,3,1,2], [1,3,2,2,1,2], [2,2,1,2,1,3], // 5-9
    [2,2,1,3,1,2], [2,3,1,2,1,2], [1,1,2,2,3,2], [1,2,2,1,3,2], [1,2,2,2,3,1], // 10-14
    [1,1,3,2,2,2], [1,2,3,1,2,2], [1,2,3,2,2,1], [2,2,3,2,1,1], [2,2,1,1,3,2], // 15-19
    [2,2,1,2,3,1], [2,1,3,2,1,2], [2,2,3,1,1,2], [3,1,2,1,3,1], [3,1,1,2,2,2], // 20-24
    [3,2,1,1,2,2], [3,2,1,2,2,1], [3,1,2,2,1,2], [3,2,2,1,1,2], [3,2,2,2,1,1], // 25-29
    [2,1,2,1,2,3], [2,1,2,3,2,1], [2,3,2,1,2,1], [1,1,1,3,2,3], [1,3,1,1,2,3], // 30-34
    [1,3,1,3,2,1], [1,1,2,3,1,3], [1,3,2,1,1,3], [1,3,2,3,1,1], [2,1,1,3,1,3], // 35-39
    [2,3,1,1,1,3], [2,3,1,3,1,1], [1,1,2,1,3,3], [1,1,2,3,3,1], [1,3,2,1,3,1], // 40-44
    [1,1,3,1,2,3], [1,1,3,3,2,1], [1,3,3,1,2,1], [3,1,3,1,2,1], [2,1,1,3,3,1], // 45-49
    [2,3,1,1,3,1], [2,1,3,1,1,3], [2,1,3,3,1,1], [2,1,3,1,3,1], [3,1,1,1,2,3], // 50-54
    [3,1,1,3,2,1], [3,3,1,1,2,1], [3,1,2,1,1,3], [3,1,2,3,1,1], [3,3,2,1,1,1], // 55-59
    [3,1,4,1,1,1], [2,2,1,4,1,1], [4,3,1,1,1,1], [1,1,1,2,2,4], [1,1,1,4,2,2], // 60-64
    [1,2,1,1,2,4], [1,2,1,4,2,1], [1,4,1,1,2,2], [1,4,1,2,2,1], [1,1,2,2,1,4], // 65-69
    [1,1,2,4,1,2], [1,2,2,1,1,4], [1,2,2,4,1,1], [1,4,2,1,1,2], [1,4,2,2,1,1], // 70-74
    [2,4,1,2,1,1], [2,2,1,1,1,4], [4,1,3,1,1,1], [2,4,1,1,1,2], [1,3,4,1,1,1], // 75-79
    [1,1,1,2,4,2], [1,2,1,1,4,2], [1,2,1,2,4,1], [1,1,4,2,1,2], [1,2,4,1,1,2], // 80-84
    [1,2,4,2,1,1], [4,1,1,2,1,2], [4,2,1,1,1,2], [4,2,1,2,1,1], [2,1,2,1,4,1], // 85-89
    [2,1,4,1,2,1], [4,1,2,1,2,1], [1,1,1,1,4,3], [1,1,1,3,4,1], [1,3,1,1,4,1], // 90-94
    [1,1,4,1,1,3], [1,1,4,3,1,1], [4,1,1,1,1,3], [4,1,1,3,1,1], [1,1,3,1,4,1], // 95-99
    [1,1,4,1,3,1], [3,1,1,1,4,1], [4,1,1,1,3,1], [2,1,1,4,1,2], [2,1,1,2,1,4], // 100-104
    [2,1,1,2,3,2],                                                               // 105 (START_C)
    [2,3,3,1,1,1,2]                                                              // 106 (STOP)
];

// Special Control Character Values
export const CODE128_CONSTANTS = {
    CODE_C: 99,
    CODE_B: 100,
    CODE_A: 101,
    START_A: 103,
    START_B: 104,
    START_C: 105,
    STOP: 106,
};

export interface Code128Bar {
    xModule: number;       // Offset from start of active barcode (0 to totalActiveModules)
    widthModules: number;  // Width of this black bar (1, 2, 3, or 4 modules)
}

export interface Code128Encoded {
    rawText: string;
    symbols: number[];           // Values of all symbols including Start, Data, Code-Switches, Checksum, Stop
    checksum: number;            // Modulo-103 checksum value
    totalActiveModules: number;  // Sum of widths of all symbols without quiet zones
    bars: Code128Bar[];          // Normalized black bar positions and widths
}

export interface Code128RenderOptions {
    x: number;               // Left boundary of reserved area (pt)
    y: number;               // Top boundary of reserved area (pt)
    maxWidth: number;        // Total available width (pt)
    maxHeight: number;       // Total available height (pt)
    quietZoneModules?: number; // Minimum quiet zone per side (default: 10 modules)
    includeText?: boolean;   // Whether to draw human-readable text below bars (default: true)
    textFontSize?: number;   // Font size for human-readable text (default: 7pt)
    displayText?: string;    // Custom human-readable string below barcode (defaults to encoded text)
}

export interface Code128RenderMetrics {
    x: number;               // Actual left position including quiet zone
    y: number;               // Top position of bars
    barWidth: number;        // Width of active barcode bars (pt)
    totalWidth: number;      // Total width including quiet zones (pt)
    barHeight: number;       // Height of bars (pt)
    moduleWidthPt: number;   // Width of 1 module (X-dimension in pt)
    moduleWidthMils: number; // Width of 1 module in mils (1 mil = 1/1000 in = 0.0254 mm)
    quietZoneWidthPt: number;// Width of 1 quiet zone (pt)
    totalModules: number;    // Total modules including quiet zones
    checksum: number;        // Encoded checksum
    symbols: number[];       // Encoded symbols array
}

/**
 * Encodes an ASCII string into an ISO/IEC 15417 Code 128 symbol sequence.
 * Automatically chooses Code C for consecutive digit pairs to minimize symbol length.
 */
export function encodeCode128(text: string): Code128Encoded {
    if (!text || typeof text !== 'string') {
        throw new Error('Code 128 input error: Barcode text must be a non-empty string.');
    }

    // Normalize common unicode punctuation (em-dash, en-dash, smart quotes, etc.) to safe ASCII
    const normalizedText = text
        .replace(/[\u2014\u2013]/g, '-')
        .replace(/[\u2018\u2019]/g, "'")
        .replace(/[\u201C\u201D]/g, '"')
        .replace(/\u00A0/g, ' ')
        .replace(/[^\x20-\x7E]/g, '');

    const textToEncode = normalizedText.length > 0 ? normalizedText : 'ITEM';

    // Validate ASCII characters (Code 128 supports standard printable ASCII 32 to 126)
    for (let i = 0; i < textToEncode.length; i++) {
        const code = textToEncode.charCodeAt(i);
        if (code < 32 || code > 126) {
            throw new Error(
                `Code 128 input error: Character "${textToEncode[i]}" (ASCII ${code}) is outside supported Code 128 printable range (32-126).`
            );
        }
    }

    const symbols: number[] = [];
    let i = 0;

    // Helper: count consecutive digits from position i
    const countDigits = (startIndex: number): number => {
        let count = 0;
        while (
            startIndex + count < textToEncode.length &&
            textToEncode.charCodeAt(startIndex + count) >= 48 &&
            textToEncode.charCodeAt(startIndex + count) <= 57
        ) {
            count++;
        }
        return count;
    };

    // Determine initial code set:
    // If the text begins with 4 or more digits, start in Code C; otherwise start in Code B.
    let currentSet: 'B' | 'C';
    const initialDigits = countDigits(0);
    if (initialDigits >= 4) {
        currentSet = 'C';
        symbols.push(CODE128_CONSTANTS.START_C);
    } else {
        currentSet = 'B';
        symbols.push(CODE128_CONSTANTS.START_B);
    }

    while (i < textToEncode.length) {
        if (currentSet === 'C') {
            const digitsRemaining = countDigits(i);
            if (digitsRemaining >= 2) {
                // Encode 2 digits as a single Code C value
                const pairStr = textToEncode.slice(i, i + 2);
                symbols.push(parseInt(pairStr, 10));
                i += 2;
            } else {
                // Odd digit or non-digit encountered; switch to Code B
                symbols.push(CODE128_CONSTANTS.CODE_B);
                currentSet = 'B';
                symbols.push(textToEncode.charCodeAt(i) - 32);
                i += 1;
            }
        } else {
            // In Code B: check if 4 or more consecutive digits follow
            const digitsAhead = countDigits(i);
            if (digitsAhead >= 4) {
                // Switch to Code C
                symbols.push(CODE128_CONSTANTS.CODE_C);
                currentSet = 'C';
                const pairStr = textToEncode.slice(i, i + 2);
                symbols.push(parseInt(pairStr, 10));
                i += 2;
            } else {
                // Standard Code B character (ASCII value - 32)
                symbols.push(textToEncode.charCodeAt(i) - 32);
                i += 1;
            }
        }
    }

    // Calculate Modulo-103 Checksum
    // Checksum = (StartValue + Sum(i * SymbolValue_i)) mod 103
    let checksumSum = symbols[0];
    for (let k = 1; k < symbols.length; k++) {
        checksumSum += k * symbols[k];
    }
    const checksum = checksumSum % 103;
    symbols.push(checksum);

    // Append Stop Symbol
    symbols.push(CODE128_CONSTANTS.STOP);

    // Convert symbols into normalized bar positions
    const bars: Code128Bar[] = [];
    let currentModuleOffset = 0;

    for (const sym of symbols) {
        const pattern = CODE128_PATTERNS[sym];
        if (!pattern) {
            throw new Error(`Code 128 internal error: Missing pattern for symbol value ${sym}.`);
        }

        for (let pIdx = 0; pIdx < pattern.length; pIdx++) {
            const width = pattern[pIdx];
            // Even indices (0, 2, 4, [6 for stop]) are black bars
            // Odd indices (1, 3, 5) are spaces
            if (pIdx % 2 === 0) {
                bars.push({
                    xModule: currentModuleOffset,
                    widthModules: width,
                });
            }
            currentModuleOffset += width;
        }
    }

    return {
        rawText: text,
        symbols,
        checksum,
        totalActiveModules: currentModuleOffset,
        bars,
    };
}

/**
 * Calculates rendering metrics and draws crisp vector Code 128 bars with quiet zones in PDFKit.
 */
export function renderCode128Vector(doc: any, text: string, options: Code128RenderOptions): Code128RenderMetrics {
    const encoded = encodeCode128(text);
    const quietZoneModules = Math.max(10, options.quietZoneModules || 10);
    const totalModules = encoded.totalActiveModules + (2 * quietZoneModules);

    // Calculate maximum allowable module width (X-dimension in points) to fit within maxWidth
    const moduleWidthPt = options.maxWidth / totalModules;
    // 1 pt = 1/72 inch; 1 mil = 1/1000 inch => 1 pt = (1000/72) mils = ~13.888 mils
    const moduleWidthMils = moduleWidthPt * (1000 / 72);

    const quietZoneWidthPt = quietZoneModules * moduleWidthPt;
    const activeBarWidthPt = encoded.totalActiveModules * moduleWidthPt;
    const totalBarcodeWidthPt = totalModules * moduleWidthPt;

    // Center the entire symbol (including quiet zones) within options.maxWidth
    const horizontalMargin = (options.maxWidth - totalBarcodeWidthPt) / 2;
    const activeStartX = options.x + horizontalMargin + quietZoneWidthPt;

    // Reserve vertical space for human-readable text if enabled
    const includeText = options.includeText !== false;
    const fontSize = options.textFontSize || 7;
    const textGap = 2;
    const textHeight = includeText ? (fontSize + textGap) : 0;
    const barHeight = Math.max(12, options.maxHeight - textHeight);

    // -------------------------------------------------------------
    // Draw Vector Bars
    // -------------------------------------------------------------
    doc.save();
    doc.fillColor('#000000');

    for (const bar of encoded.bars) {
        const barX = activeStartX + (bar.xModule * moduleWidthPt);
        const barW = bar.widthModules * moduleWidthPt;
        doc.rect(barX, options.y, barW, barHeight).fill();
    }

    doc.restore();

    // -------------------------------------------------------------
    // Draw Human-Readable Text (Centered under barcode)
    // -------------------------------------------------------------
    if (includeText) {
        const textY = options.y + barHeight + textGap;
        const labelText = options.displayText || text;
        doc.font('Helvetica')
            .fontSize(fontSize)
            .fillColor('#000000')
            .text(labelText, options.x, textY, {
                width: options.maxWidth,
                align: 'center',
            });
    }

    return {
        x: activeStartX - quietZoneWidthPt,
        y: options.y,
        barWidth: activeBarWidthPt,
        totalWidth: totalBarcodeWidthPt,
        barHeight,
        moduleWidthPt,
        moduleWidthMils,
        quietZoneWidthPt,
        totalModules,
        checksum: encoded.checksum,
        symbols: encoded.symbols,
    };
}
