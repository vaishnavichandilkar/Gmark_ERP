import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';
import * as readline from 'readline';

const prisma = new PrismaClient();

async function main() {
  console.log('Starting Pincode seeding process from CSV...');
  const filePath = path.join(__dirname, '../common/pincode.csv');

  if (!fs.existsSync(filePath)) {
    console.error(`Error: pincode.csv not found at ${filePath}`);
    process.exit(1);
  }

  console.log('Clearing existing Pincodes from database...');
  await prisma.pincode.deleteMany();
  console.log('Database cleared.');

  console.log('Reading and parsing pincode.csv file...');
  const fileStream = fs.createReadStream(filePath, 'utf8');
  const rl = readline.createInterface({
    input: fileStream,
    crlfDelay: Infinity,
  });

  const grouped = new Map<string, {
    state: string;
    district: string;
    subDistrict: string | null;
    country: string;
    areas: Set<string>;
    officeVillages: Map<string, Set<string>>;
  }>();

  let isHeader = true;
  let lineCount = 0;

  for await (const line of rl) {
    lineCount++;
    if (isHeader) {
      isHeader = false;
      continue;
    }

    if (!line.trim()) continue;

    // Zero-dependency CSV line parser to handle quotes/commas correctly
    const record = parseCSVLine(line);
    if (record.length < 6) continue;

    const village = record[0].trim();
    const officeName = record[1].trim();
    const pincode = record[2].trim();
    const subDistrict = record[3].trim();
    const district = record[4].trim();
    const state = record[5].trim();

    if (!pincode || !/^\d{6}$/.test(pincode)) continue;

    let existing = grouped.get(pincode);
    if (!existing) {
      existing = {
        state: state || 'India',
        district: district || '',
        subDistrict: subDistrict || null,
        country: 'India',
        areas: new Set<string>(),
        officeVillages: new Map<string, Set<string>>(),
      };
      grouped.set(pincode, existing);
    }

    if (village) {
      existing.areas.add(village);
      if (officeName) {
        let officeSet = existing.officeVillages.get(officeName);
        if (!officeSet) {
          officeSet = new Set<string>();
          existing.officeVillages.set(officeName, officeSet);
        }
        officeSet.add(village);
      }
    }
  }

  console.log(`Finished parsing. Total CSV lines read: ${lineCount}`);
  console.log(`Total unique pincodes to seed: ${grouped.size}`);

  // Convert map to array of database-friendly objects matching Prisma Pincode model
  const recordsToInsert = Array.from(grouped.entries()).map(([pincode, data]) => {
    const officeVillagesObj: Record<string, string[]> = {};
    for (const [office, villages] of data.officeVillages.entries()) {
      officeVillagesObj[office] = Array.from(villages).sort();
    }

    return {
      pincode,
      state: data.state,
      district: data.district,
      subDistrict: data.subDistrict,
      country: data.country,
      areas: Array.from(data.areas).sort(),
      officeVillages: officeVillagesObj,
      isActive: true,
    };
  });

  console.log('Starting batch database insertion...');
  const BATCH_SIZE = 1000;
  let successCount = 0;

  for (let i = 0; i < recordsToInsert.length; i += BATCH_SIZE) {
    const batch = recordsToInsert.slice(i, i + BATCH_SIZE);
    
    try {
      const result = await prisma.pincode.createMany({
        data: batch,
        skipDuplicates: true,
      });
      successCount += result.count;
      
      const progress = Math.min(i + BATCH_SIZE, recordsToInsert.length);
      console.log(`Progress: [${progress}/${recordsToInsert.length}] - Inserted ${result.count} records this batch.`);
    } catch (error) {
      console.error(`Error seeding batch starting at index ${i}:`, error);
    }
  }

  console.log(`\nSeeding completed successfully! Total unique pincodes inserted: ${successCount}`);
}

function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current.trim());
  return result;
}

main()
  .catch((e) => {
    console.error('Seeding process failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
