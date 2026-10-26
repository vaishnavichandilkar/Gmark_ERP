import { encodeCode128 } from '../utils/code128-vector.util';

const cases = [
    { name: '1. DB Product: "watch" (5 chars)', text: 'watch | 50.25 KG | 2610230001-AB-M01' },
    { name: '2. Short Chemical: "Urea" (4 chars)', text: 'Urea | 50.00 KG | 2610230001-AB-M01' },
    { name: '3. Medium: "Industrial Polymer" (18 chars)', text: 'Industrial Polymer | 50.25 KG | 2610230001-AB-M01' },
    { name: '4. Standard: "Industrial Grade Polymer 50kg" (29 chars)', text: 'Industrial Grade Polymer 50kg | 50.25 KG | 2610230001-AB-M01' },
    { name: '5. Long: "Polyethylene Terephthalate Resin" (32 chars)', text: 'Polyethylene Terephthalate Resin | 50.25 KG | 2610230001-AB-M01' },
    { name: '6. Extra Long: "High Density Polyethylene Granules Grade-A" (42 chars)', text: 'High Density Polyethylene Granules Grade-A | 50.25 KG | 2610230001-AB-M01' },
    { name: '7. Max Chemical: "Polyethylene Terephthalate High Viscosity Resin" (47 chars)', text: 'Polyethylene Terephthalate High Viscosity Resin | 50.25 KG | 2610230001-AB-M01' },
];

console.log('================================================================================');
console.log('       CODE 128 SINGLE-BARCODE LABEL SIZE & WIDTH FEASIBILITY ANALYSIS          ');
console.log('================================================================================\n');

for (const c of cases) {
    const enc = encodeCode128(c.text);
    const totalModules = enc.totalActiveModules + 20; // 10X left + 10X right
    const widthAt10MilMm = totalModules * 0.254;
    const widthAt12MilMm = totalModules * 0.3048;
    const widthAt14MilMm = totalModules * 0.3556;

    // 150x100 mm (usable 134 mm with 8mm margins, or 130 mm with 10mm margins)
    const modMilOn150mm_134 = (134 / 25.4 * 1000) / totalModules;
    const modMilOn150mm_130 = (130 / 25.4 * 1000) / totalModules;

    // 200x100 mm (usable 184 mm with 8mm margins, or 180 mm with 10mm margins)
    const modMilOn200mm_180 = (180 / 25.4 * 1000) / totalModules;

    console.log(`Payload: "${c.text}"`);
    console.log(`  Length: ${c.text.length} chars | Total Modules (incl 20X quiet): ${totalModules}`);
    console.log(`  Required width at 10.0 mils (0.254 mm): ${widthAt10MilMm.toFixed(1)} mm`);
    console.log(`  Required width at 12.0 mils (0.305 mm): ${widthAt12MilMm.toFixed(1)} mm`);
    console.log(`  Required width at 14.0 mils (0.356 mm): ${widthAt14MilMm.toFixed(1)} mm`);
    console.log(`  [150x100 mm Label] (Usable 134mm): Module = ${modMilOn150mm_134.toFixed(2)} mils -> ${widthAt10MilMm <= 134 ? '✓ FITS at >= 10 mils' : '✗ OVERFLOWS at 10 mils'}`);
    console.log(`  [200x100 mm Label] (Usable 180mm): Module = ${modMilOn200mm_180.toFixed(2)} mils -> ${widthAt10MilMm <= 180 ? '✓ FITS at >= 10 mils' : '✗ OVERFLOWS at 10 mils'}\n`);
}
