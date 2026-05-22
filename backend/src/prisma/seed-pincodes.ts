import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();

interface RawPincodeRecord {
  Name: string;
  Description: string | null;
  BranchType: string;
  DeliveryStatus: string;
  Circle: string;
  District: string;
  Division: string;
  Region: string;
  Block: string;
  State: string;
  Country: string;
  Pincode: number | string;
}

async function main() {
  console.log('Starting Pincode seeding process...');
  // Located in backend root directory: D:\USERS\vaishnavi\Desktop\weighting_scale\backend\India_pincodes.json
  const filePath = path.join(__dirname, '../../India_pincodes.json');
  
  if (!fs.existsSync(filePath)) {
    console.error(`Error: India_pincodes.json not found at ${filePath}`);
    process.exit(1);
  }

  console.log('Reading India_pincodes.json file...');
  const fileContent = fs.readFileSync(filePath, 'utf8');
  console.log('Parsing JSON...');
  const rawRecords: RawPincodeRecord[] = JSON.parse(fileContent);
  console.log(`Total raw records found: ${rawRecords.length}`);

  console.log('Grouping areas by pincode...');
  // Group by pincode string to maintain uniqueness and aggregate sub-areas
  const grouped = new Map<string, {
    state: string;
    district: string;
    subDistrict: string | null;
    country: string;
    areas: Set<string>;
  }>();

  for (const record of rawRecords) {
    if (!record.Pincode) continue;
    const pincodeStr = String(record.Pincode).trim();
    if (!pincodeStr) continue;

    const areaName = record.Name ? record.Name.trim() : '';
    if (!areaName) continue;

    const existing = grouped.get(pincodeStr);
    if (existing) {
      existing.areas.add(areaName);
    } else {
      grouped.set(pincodeStr, {
        state: record.State || 'India',
        district: record.District || '',
        subDistrict: record.Block || null,
        country: record.Country || 'India',
        areas: new Set([areaName]),
      });
    }
  }

  const uniquePincodesCount = grouped.size;
  console.log(`Total unique pincodes to seed: ${uniquePincodesCount}`);

  // Convert map to array of database-friendly objects matching Prisma Pincode model
  const recordsToInsert = Array.from(grouped.entries()).map(([pincode, data]) => ({
    pincode,
    state: data.state,
    district: data.district,
    subDistrict: data.subDistrict,
    country: data.country,
    areas: Array.from(data.areas),
    isActive: true,
  }));

  console.log('Starting batch database insertion...');
  const BATCH_SIZE = 1000;
  let successCount = 0;

  for (let i = 0; i < recordsToInsert.length; i += BATCH_SIZE) {
    const batch = recordsToInsert.slice(i, i + BATCH_SIZE);
    
    try {
      // Postgres createMany supports skipDuplicates perfectly
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

  console.log(`\nSeeding completed successfully! Total pincodes inserted: ${successCount}`);
}

main()
  .catch((e) => {
    console.error('Seeding process failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
