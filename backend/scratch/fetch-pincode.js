const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function run() {
  const pincode = '590001';
  console.log(`Fetching official areas for ${pincode}...`);
  try {
    const response = await fetch(`https://api.postalpincode.in/pincode/${pincode}`);
    const data = await response.json();
    if (data && data[0] && data[0].Status === 'Success' && data[0].PostOffice) {
      const first = data[0].PostOffice[0];
      const allAreas = [...new Set(data[0].PostOffice.map((po) => String(po.Name)))];
      console.log(`Found ${allAreas.length} official areas:`, allAreas);

      // Update in local DB
      await prisma.pincode.upsert({
        where: { pincode },
        update: {
          state: first.State,
          district: first.District,
          subDistrict: first.Taluk || first.District,
          country: first.Country || 'India',
          areas: allAreas,
          isActive: true
        },
        create: {
          pincode,
          state: first.State,
          district: first.District,
          subDistrict: first.Taluk || first.District,
          country: first.Country || 'India',
          areas: allAreas,
          isActive: true
        }
      });
      console.log('Successfully updated database with complete official areas.');
    } else {
      console.log('No official data found or API error.');
    }
  } catch (err) {
    console.error('Error fetching/updating:', err);
  } finally {
    await prisma.$disconnect();
  }
}

run();
