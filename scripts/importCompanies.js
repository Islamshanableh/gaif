const XLSX = require('xlsx');
const path = require('path');
const db = require('../services/db.service');

async function importCompanies() {
  const filePath =
    process.argv[2] ||
    path.join(__dirname, '../../Downloads/gaif-members.xls');

  console.log('Reading file:', filePath);

  const workbook = XLSX.readFile(filePath);
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const data = XLSX.utils.sheet_to_json(sheet);

  console.log('Total rows:', data.length);

  // Get all countries from database
  const allCountries = await db.Country.findAll();
  console.log('Total countries in DB:', allCountries.length);

  // Create a map of country names (lowercase) to country records
  const countryMap = new Map();
  allCountries.forEach(country => {
    if (country.name) {
      countryMap.set(country.name.toLowerCase().trim(), country);
    }
  });

  // Find "GAIF Member / Non-Local" participation type
  const participationType = await db.ParticipationType.findOne({
    where: { title: 'GAIF Member / Non-Local' },
  });

  if (!participationType) {
    console.error('ERROR: "GAIF Member / Non-Local" participation type not found!');
    process.exit(1);
  }

  console.log(
    `Using Participation Type: ${participationType.title} (ID: ${participationType.id})`,
  );

  let companiesCreated = 0;
  let countriesNotFound = [];

  for (const row of data) {
    try {
      const companyName = row['NAME OF CO'];
      const countryName = row['COUNTRY'];
      const email = row['Email'];

      if (!companyName) {
        console.log('Skipping row - no company name');
        continue;
      }

      // Find country
      let countryId = null;
      if (countryName) {
        const countryKey = countryName.toLowerCase().trim();
        const country = countryMap.get(countryKey);
        if (country) {
          countryId = country.id;
        } else {
          // Try partial match
          for (const [key, c] of countryMap) {
            if (key.includes(countryKey) || countryKey.includes(key)) {
              countryId = c.id;
              break;
            }
          }
          if (!countryId && !countriesNotFound.includes(countryName)) {
            countriesNotFound.push(countryName);
          }
        }
      }

      // Create company
      await db.Company.create({
        name: companyName.trim(),
        email: email ? email.trim() : null,
        countryId: countryId,
        participationId: participationType.id,
        isActive: true,
      });

      companiesCreated += 1;

      if (companiesCreated % 50 === 0) {
        console.log(`Progress: ${companiesCreated} companies created...`);
      }
    } catch (error) {
      console.error(`Error creating company "${row['NAME OF CO']}":`, error.message);
    }
  }

  console.log('\n=== Import Complete ===');
  console.log('Companies created:', companiesCreated);

  if (countriesNotFound.length > 0) {
    console.log('\nCountries not found in DB:');
    countriesNotFound.forEach(c => console.log(`  - ${c}`));
  }

  process.exit(0);
}

importCompanies().catch(err => {
  console.error('Import failed:', err);
  process.exit(1);
});
