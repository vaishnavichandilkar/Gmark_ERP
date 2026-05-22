const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function run() {
  console.log('Querying AccountMaster for unique pincodes...');
  const accounts = await prisma.accountMaster.findMany({
    select: { pincode: true }
  });

  const pincodesInAccounts = [...new Set(accounts.map(a => a.pincode).filter(p => !!p))];
  console.log('Unique pincodes found in AccountMaster:', pincodesInAccounts);

  // We will also seed common Belgaum and Kolhapur pincodes that the user might test with:
  const commonTestPincodes = [
    '590001', '590002', '590003', '590004', '590005', '590006', '590008', '590009',
    '590010', '590011', '590012', '590014', '590016', '590018', '590019',
    '416001', '416002', '416003', '416004', '416005', '416008', '416012',
    '411001', '411002', '411003', '411004', '411005', '411006', '411007', '411008',
    '411009', '411011', '411013', '411015', '411016', '411018'
  ];

  const allToFetch = [...new Set([...pincodesInAccounts, ...commonTestPincodes])];
  console.log(`Total unique pincodes to fetch and save: ${allToFetch.length}`);

  for (const pincode of allToFetch) {
    // Check if already in DB with areas populated
    const existing = await prisma.pincode.findUnique({
      where: { pincode }
    });

    if (existing && existing.areas && existing.areas.length > 0) {
      console.log(`Pincode ${pincode} already exists in DB with ${existing.areas.length} areas. Ensuring isActive: true...`);
      await prisma.pincode.update({
        where: { pincode },
        data: { isActive: true }
      });
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
      await new Promise(resolve => setTimeout(resolve, 300));
    } catch (err) {
      console.error(`Error fetching ${pincode}:`, err);
    }
  }

  console.log('Successfully completed fetching and saving all relevant pincodes to database!');
  await prisma.$disconnect();
}

run();
