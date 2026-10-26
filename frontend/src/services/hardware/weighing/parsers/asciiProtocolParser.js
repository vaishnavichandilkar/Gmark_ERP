/**
 * Universal ASCII Protocol Parser for Weighing Scales
 * Supports Generic Continuous ASCII (Essae, CAS, Yaohua, Contech),
 * Mettler Toledo SICS, and Simple Decimal streams.
 */

import { WeightStability } from '../WeighingDeviceTypes';

export class AsciiProtocolParser {
    constructor() {
        this.lastRawValues = [];
        this.lastParsedTimestamp = Date.now();
    }

    /**
     * Parse an incoming serial line into a normalized reading object.
     * @param {string} rawLine - The raw line received from serial or connector
     * @returns {object|null} - Normalized reading or null if unparseable
     */
    parse(rawLine) {
        if (!rawLine || typeof rawLine !== 'string') return null;
        const clean = rawLine.trim();
        if (!clean) return null;

        // 1. Try Generic Industrial Format (e.g., ST,GS,+  12.500kg or US,NT,+  12.350kg)
        // Format: [ST|US|OL],[GS|NT|TR],[+/-][weight][unit]
        const genericMatch = clean.match(/^(ST|US|OL|UL)\s*,\s*(GS|NT|TR|GR)?\s*,\s*([+-]?\s*[\d\.]+)\s*(kg|g|t|lb)?/i);
        if (genericMatch) {
            const rawStatus = genericMatch[1].toUpperCase();
            const mode = (genericMatch[2] || 'GS').toUpperCase();
            const weightVal = parseFloat(genericMatch[3].replace(/\s+/g, ''));
            const unit = (genericMatch[4] || 'kg').toLowerCase();

            const isStable = rawStatus === 'ST';
            const isOverload = rawStatus === 'OL';
            const isZero = !isNaN(weightVal) && Math.abs(weightVal) < 0.0001;

            return {
                grossWeight: mode === 'GS' || mode === 'GR' ? weightVal : null,
                netWeight: mode === 'NT' ? weightVal : weightVal,
                tareWeight: mode === 'TR' ? weightVal : 0,
                unit,
                isStable,
                isZero,
                isOverload,
                stability: isOverload ? WeightStability.OVERLOAD : (isStable ? WeightStability.STABLE : WeightStability.UNSTABLE),
                rawPayload: clean,
                timestamp: new Date(),
            };
        }

        // 2. Try Mettler Toledo SICS Standard (e.g., S S      12.500 kg or S D      12.500 kg)
        // 'S S' = Stable, 'S D' = Dynamic/Unstable, 'S I' = Invalid, 'S +' = Overload
        const sicsMatch = clean.match(/^S\s+([SDI\+\-])\s+([+-]?\s*[\d\.]+)\s*(kg|g|t|lb)?/i);
        if (sicsMatch) {
            const code = sicsMatch[1].toUpperCase();
            const weightVal = parseFloat(sicsMatch[2].replace(/\s+/g, ''));
            const unit = (sicsMatch[3] || 'kg').toLowerCase();

            const isStable = code === 'S';
            const isOverload = code === '+';
            const isZero = !isNaN(weightVal) && Math.abs(weightVal) < 0.0001;

            return {
                grossWeight: weightVal,
                netWeight: weightVal,
                tareWeight: 0,
                unit,
                isStable,
                isZero,
                isOverload,
                stability: isOverload ? WeightStability.OVERLOAD : (isStable ? WeightStability.STABLE : WeightStability.UNSTABLE),
                rawPayload: clean,
                timestamp: new Date(),
            };
        }

        // 3. Try Simple Decimal / Continuous Number (e.g., =0012.500 or +0012.500kg or 12.500)
        const simpleMatch = clean.match(/^[=\+\-]?\s*([+-]?\s*\d+\.\d+)\s*(kg|g|t)?/i);
        if (simpleMatch) {
            const weightVal = parseFloat(simpleMatch[1].replace(/\s+/g, ''));
            const unit = (simpleMatch[2] || 'kg').toLowerCase();
            const isZero = !isNaN(weightVal) && Math.abs(weightVal) < 0.0001;

            // Compute stability heuristic if no explicit ST/US tag:
            // if weight has remained unchanged for 3 consecutive readings, mark stable
            this.lastRawValues.push(weightVal);
            if (this.lastRawValues.length > 5) this.lastRawValues.shift();

            const isStable = this.lastRawValues.length >= 3 &&
                this.lastRawValues.every(v => Math.abs(v - weightVal) < 0.005);

            return {
                grossWeight: weightVal,
                netWeight: weightVal,
                tareWeight: 0,
                unit,
                isStable,
                isZero,
                isOverload: false,
                stability: isStable ? WeightStability.STABLE : WeightStability.UNSTABLE,
                rawPayload: clean,
                timestamp: new Date(),
            };
        }

        return null;
    }
}

export const asciiParser = new AsciiProtocolParser();
