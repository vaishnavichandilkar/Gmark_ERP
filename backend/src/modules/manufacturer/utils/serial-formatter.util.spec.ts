/**
 * Self-running Unit Test Suite for Serial Formatter Utility
 * Run via: npx ts-node src/modules/manufacturer/utils/serial-formatter.util.spec.ts
 */

import {
    formatPackageNumber,
    parsePackageNumber,
    validatePlantCode,
    isSequenceOverflow,
} from './serial-formatter.util';

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

function assertThrows(fn: () => void, testName: string) {
    try {
        fn();
        console.error(`  ✗ FAIL (Expected throw, but succeeded): ${testName}`);
        failed++;
    } catch (e) {
        console.log(`  ✓ PASS (Caught expected error): ${testName}`);
        passed++;
    }
}

console.log('=== Running Serial Formatter Unit Tests ===\n');

// 1. Plant Code Validation
console.log('Group 1: Plant Code Validation');
assert(validatePlantCode('AB'), 'Valid uppercase 2-letter plant code "AB"');
assert(validatePlantCode('P1'), 'Valid alphanumeric plant code "P1"');
assert(!validatePlantCode(''), 'Empty string is invalid');
assert(!validatePlantCode('A'), 'Single character is invalid');
assert(!validatePlantCode('ABC'), '3 characters is invalid');
assert(!validatePlantCode('A!'), 'Special character is invalid');

// 2. Package Number Formatting
console.log('\nGroup 2: Package Number Formatting');
const testDate = new Date(2026, 9, 16); // Oct 16, 2026 (Month is 0-indexed in JS)
const result1 = formatPackageNumber(testDate, 1, 'AB');
assert(result1 === '2610160001-AB', `formatPackageNumber(date, 1, 'AB') === '2610160001-AB' [got: ${result1}]`);

const result42 = formatPackageNumber(testDate, 42, 'AB');
assert(result42 === '2610160042-AB', `formatPackageNumber(date, 42, 'AB') === '2610160042-AB' [got: ${result42}]`);

const result9999 = formatPackageNumber(testDate, 9999, 'AB');
assert(result9999 === '2610169999-AB', `formatPackageNumber(date, 9999, 'AB') === '2610169999-AB' [got: ${result9999}]`);

// 3. Overflow Handling (Over 9999)
console.log('\nGroup 3: Sequence Overflow Handling');
const resultOverflow = formatPackageNumber(testDate, 10000, 'AB');
assert(resultOverflow === '26101610000-AB', `Overflow sequence 10000 expands to 5 digits: "${resultOverflow}"`);
assert(isSequenceOverflow(10000) === true, 'isSequenceOverflow(10000) is true');
assert(isSequenceOverflow(9999) === false, 'isSequenceOverflow(9999) is false');

// 4. Invalid Input Rejections
console.log('\nGroup 4: Error Handling on Invalid Inputs');
assertThrows(() => formatPackageNumber(new Date('invalid'), 1, 'AB'), 'Rejects invalid Date object');
assertThrows(() => formatPackageNumber(testDate, 0, 'AB'), 'Rejects sequence 0');
assertThrows(() => formatPackageNumber(testDate, -5, 'AB'), 'Rejects negative sequence');
assertThrows(() => formatPackageNumber(testDate, 1.5, 'AB'), 'Rejects non-integer sequence');
assertThrows(() => formatPackageNumber(testDate, 1, 'TOOLONG'), 'Rejects plant code with > 2 characters');

// 5. Parsing & Validation
console.log('\nGroup 5: Parsing and Calendar Validation');
const parsed = parsePackageNumber('2610160001-AB');
assert(parsed !== null, 'Parses valid serial string successfully');
if (parsed) {
    assert(parsed.year === 2026, `Parsed year is 2026 [got: ${parsed.year}]`);
    assert(parsed.month === 10, `Parsed month is 10 [got: ${parsed.month}]`);
    assert(parsed.day === 16, `Parsed day is 16 [got: ${parsed.day}]`);
    assert(parsed.sequence === 1, `Parsed sequence is 1 [got: ${parsed.sequence}]`);
    assert(parsed.plantCode === 'AB', `Parsed plantCode is "AB" [got: ${parsed.plantCode}]`);
    assert(parsed.isOverflow === false, 'Standard sequence is not overflow');
}

const parsedOverflow = parsePackageNumber('26101610000-AB');
assert(parsedOverflow !== null && parsedOverflow.isOverflow === true, 'Parsed 5-digit sequence flags overflow');

// Invalid Calendar Dates in Parsing
assert(parsePackageNumber('2602300001-AB') === null, 'Rejects invalid calendar date (Feb 30)');
assert(parsePackageNumber('2613160001-AB') === null, 'Rejects invalid month 13');
assert(parsePackageNumber('not-a-serial') === null, 'Rejects arbitrary string');
assert(parsePackageNumber('') === null, 'Rejects empty string');

console.log(`\n========================================`);
console.log(`Test Results: ${passed} passed, ${failed} failed`);
console.log(`========================================\n`);

if (failed > 0) {
    process.exit(1);
}
