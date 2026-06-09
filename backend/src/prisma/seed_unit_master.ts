import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding Unit Master for all users...');
  
  const users = await prisma.user.findMany();
  if (users.length === 0) {
    console.log('No users found to seed units for.');
    return;
  }

  // Fetch all system units from SystemUomLibrary
  const systemUnits = await prisma.systemUomLibrary.findMany();
  if (systemUnits.length === 0) {
    console.log('System UOM Library is empty. Please seed system UOMs first.');
    return;
  }

  let addedCount = 0;

  for (const user of users) {
    for (const uom of systemUnits) {
      // Check if it already exists
      const existing = await prisma.unitMaster.findUnique({
        where: {
          user_id_gst_uom: {
            user_id: user.id,
            gst_uom: uom.uom_code
          }
        }
      });

      if (!existing) {
        await prisma.unitMaster.create({
          data: {
            user_id: user.id,
            unit_name: uom.unit_name,
            gst_uom: uom.uom_code,
            full_name_of_measurement: uom.full_name_of_measurement,
            source: 'SYSTEM',
            status: 'ACTIVE'
          }
        });
        addedCount++;
      }
    }
  }

  console.log(`Successfully seeded ${addedCount} default units across ${users.length} users.`);
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
