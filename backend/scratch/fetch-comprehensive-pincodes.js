const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const pincodeRanges = [];

// 1. 416501 to 416515 (Kolhapur/Sindhudurg border series, including Nesari/Chandgad)
for (let i = 416501; i <= 416515; i++) {
  pincodeRanges.push(String(i));
}

// 2. 416001 to 416015 (Kolhapur main series)
for (let i = 416001; i <= 416015; i++) {
  pincodeRanges.push(String(i));
}

// 3. 590001 to 590020 (Belgaum main series)
for (let i = 590001; i <= 590020; i++) {
  pincodeRanges.push(String(i));
}

// 4. 411001 to 411045 (Pune main series)
for (let i = 411001; i <= 411045; i++) {
  pincodeRanges.push(String(i));
}

async function run() {
  const allToFetch = [...new Set(pincodeRanges)];
  console.log(`Total pincodes to comprehensively fetch and seed: ${allToFetch.length}`);

  for (const pincode of allToFetch) {
    // Check if already in DB with areas
    const existing = await prisma.pincode.findUnique({
      where: { pincode }
    });

    if (existing && existing.areas && existing.areas.length > 0) {
      console.log(`Pincode ${pincode} already seeded.`);
      continue;
    }

    console.log(`Fetching official areas for ${pincode} from postal API...`);
    try {
      const response = await fetch(`https://api.postalpincode.in/pincode/${pincode}`);
      const data = await response.json();
      if (data && data[0] && data[0].Status === 'Success' && data[0].PostOffice) {
        const first = data[0].PostOffice[0];
        const allAreas = [...new Set(data[0].PostOffice.map((po) => String(po.Name)))];
        console.log(`Found ${allAreas.length} areas for ${pincode}:`, allAreas);

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
      // Delay to avoid hitting rate limits
      await new Promise(resolve => setTimeout(resolve, 250));
    } catch (err) {
      console.error(`Error fetching ${pincode}:`, err);
    }
  }

  console.log('Successfully completed comprehensive pincode seeding!');
  await prisma.$disconnect();
}

run();
