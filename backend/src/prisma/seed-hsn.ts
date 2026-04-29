import { NestFactory } from '@nestjs/core';
import * as fs from 'fs';
import * as path from 'path';
import { AppModule } from '../app.module';
import { PrismaService } from '../infrastructure/prisma/prisma.service';

async function seed() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const prisma = app.get(PrismaService);

  const jsonPath = path.join(__dirname, '../../hsn_data.json');
  
  console.log('--- Starting HSN Seeding Process ---');

  // 1. One-time check (BEFORE the loop)
  const existingCount = await prisma.hsn.count();
  if (existingCount > 0) {
    console.log(`HSN table already has ${existingCount} records. Skipping seeding to prevent duplicates.`);
    await app.close();
    process.exit(0);
  }

  // 2. Read JSON
  if (!fs.existsSync(jsonPath)) {
    console.error(`Error: JSON file not found at ${jsonPath}`);
    await app.close();
    process.exit(1);
  }

  console.log('Reading HSN data from JSON...');
  const rawData = fs.readFileSync(jsonPath, 'utf8');
  const hsnData = JSON.parse(rawData);
  const totalRecords = hsnData.length;
  console.log(`Total records found in JSON: ${totalRecords}`);

  const batchSize = 5000;
  let totalInserted = 0;

  // 3. Proper batching loop
  for (let i = 0; i < totalRecords; i += batchSize) {
    const batchNumber = Math.floor(i / batchSize) + 1;
    const currentBatch = hsnData.slice(i, i + batchSize);
    
    console.log(`\n[Batch ${batchNumber}] Processing ${currentBatch.length} records (Index ${i} to ${i + currentBatch.length})...`);

    // Prepare HSN records
    const hsnRecords = currentBatch.map((item: any) => ({
      hsnCode: item.hsnCode,
      type: item.type || 'HSN',
      description: item.description || null,
      effectiveDate: item.effectiveDate || null,
      rate: item.rate ? parseFloat(item.rate) : null,
      active: item.active !== undefined ? item.active : true,
      chapterName: item.chapterName || null,
      chapterNumber: item.chapterNumber || null,
      slug: item.slug || null,
      metaTitle: item.metaTitle || null,
      metaDescription: item.metaDescription || null,
      createdAt: item.createdAt ? new Date(item.createdAt) : new Date(),
      updatedAt: item.updatedAt ? new Date(item.updatedAt) : new Date(),
    }));

    try {
      await prisma.$transaction(async (tx) => {
        // Step A: Insert HSNs in bulk
        await tx.hsn.createMany({
          data: hsnRecords,
          skipDuplicates: true,
        });

        // Step B: Fetch IDs of the inserted HSNs to link TaxDetails
        const hsnCodesInBatch = currentBatch.map((item: any) => item.hsnCode);
        const dbHsns = await tx.hsn.findMany({
          where: { hsnCode: { in: hsnCodesInBatch } },
          select: { id: true, hsnCode: true },
        });

        const hsnIdMap = new Map(dbHsns.map(h => [h.hsnCode, h.id]));

        // Step C: Prepare TaxDetail records
        const taxDetailRecords: any[] = [];
        currentBatch.forEach((item: any) => {
          const hsnId = hsnIdMap.get(item.hsnCode);
          if (hsnId && item.taxDetails && Array.isArray(item.taxDetails)) {
            item.taxDetails.forEach((tax: any) => {
              taxDetailRecords.push({
                rateOfTax: tax.rateOfTax ? String(tax.rateOfTax) : null,
                effectiveDate: tax.effectiveDate || null,
                description: tax.description || null,
                hsnId: hsnId,
              });
            });
          }
        });

        // Step D: Insert TaxDetails in bulk
        if (taxDetailRecords.length > 0) {
          await tx.taxDetail.createMany({
            data: taxDetailRecords,
            skipDuplicates: true,
          });
        }
      }, {
        timeout: 120000 // 2 minutes timeout per batch for safety
      });

      totalInserted += currentBatch.length;
      console.log(`[Batch ${batchNumber}] Success. Total processed so far: ${totalInserted} / ${totalRecords}`);
    } catch (error) {
      console.error(`[Batch ${batchNumber}] Failed at index ${i}:`, error.message);
      // We stop on failure to avoid partial/corrupt data
      await app.close();
      process.exit(1);
    }
  }

  console.log('\n--- ALL HSN RECORDS SEEDED SUCCESSFULLY ---');
  console.log(`Total Records: ${totalInserted}`);
  
  await app.close();
  process.exit(0);
}

seed().catch((err) => {
  console.error('Fatal error in seeder:', err);
  process.exit(1);
});
