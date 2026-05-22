const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const pincodesList = [
  "411001", "411003", "411005", "411006",
  "411008", "411010", "411011", "411013",
  "411015", "411016", "411018", "590001"
];

async function run() {
  for (const pincode of pincodesList) {
    console.log(`Fetching official areas for ${pincode}...`);
    try {
      const response = await fetch(`https://api.postalpincode.in/pincode/${pincode}`);
      const data = await response.json();
      if (data && data[0] && data[0].Status === 'Success' && data[0].PostOffice) {
        const first = data[0].PostOffice[0];
        const allAreas = [...new Set(data[0].PostOffice.map((po) => String(po.Name)))];
        console.log(`Found ${allAreas.length} areas for ${pincode}:`, allAreas);

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
      } else {
        console.log(`No official data found or API error for ${pincode}.`);
      }
      // Add a small delay between requests to avoid rate limits
      await new Promise(resolve => setTimeout(resolve, 500));
    } catch (err) {
      console.error(`Error fetching/updating ${pincode}:`, err);
    }
  }
  console.log('Successfully updated all seeded pincodes with their official postal areas!');
  await prisma.$disconnect();
}

run();
