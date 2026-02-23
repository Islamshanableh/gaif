const XLSX = require('xlsx');
const path = require('path');
const db = require('../services/db.service');

async function importParticipationTypes() {
  const filePath =
    process.argv[2] ||
    path.join(__dirname, '../../Downloads/Participation Types.xlsx');

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
    // Map by name (lowercase)
    if (country.name) {
      countryMap.set(country.name.toLowerCase(), country);
    }
  });

  let typesCreated = 0;
  let countriesLinked = 0;

  for (const row of data) {
    try {
      // Create ParticipationType
      const participationType = await db.ParticipationType.create({
        title: row.Title,
        price: row.Price || 0,
        spousePrice: row['Spouse Price'] || 0,
        specialPrice: row['Special Price'] || 0,
        order: row.Order || 0,
        currency: row.Currency || 'USD',
        allowForRegister: row['Allow For Register'] === true,
        allowCreateCompany: row['Allow Create Company'] === true,
        requireConfirmationFromCompany:
          row['Require Confirmation From Company'] === true,
        fees: row.Fees === true,
        spouse: row.Spouse === true,
        petra: row.Petra === true,
        petraSpouse: row['Petra Spouse'] === true,
        accommodationAqaba: row['Accommodation Aqaba'] === true,
        accommodationAmman: row['Accommodation Amman'] === true,
        isActive: true,
      });

      typesCreated += 1;
      console.log(`\nCreated: ${row.Title} (ID: ${participationType.id})`);

      // Determine which countries to link
      const countriesValue = (row.Countries || '').toString().trim();
      const expectedCountriesValue = (row['Expected Countries'] || '')
        .toString()
        .trim();

      let countriesToLink = [];

      if (countriesValue.toUpperCase() === 'ALL') {
        // Start with all countries
        countriesToLink = [...allCountries];

        // Exclude expected countries if specified
        if (
          expectedCountriesValue &&
          expectedCountriesValue.toUpperCase() !== 'ALL' &&
          expectedCountriesValue.toUpperCase() !== 'NONE'
        ) {
          const excludeNames = expectedCountriesValue
            .split(',')
            .map(c => c.trim().toLowerCase());
          countriesToLink = countriesToLink.filter(country => {
            const commonNameLower = country.name.toLowerCase();
            return !excludeNames.some(
              excludeName =>
                commonNameLower.includes(excludeName) ||
                excludeName.includes(commonNameLower),
            );
          });
          console.log(`  Countries: ALL except [${expectedCountriesValue}]`);
        } else {
          console.log(`  Countries: ALL (${countriesToLink.length})`);
        }
      } else {
        // Specific countries only
        const includeNames = countriesValue
          .split(',')
          .map(c => c.trim().toLowerCase());
        countriesToLink = allCountries.filter(country => {
          const commonNameLower = country.name.toLowerCase();
          return includeNames.some(
            includeName =>
              commonNameLower.includes(includeName) ||
              includeName.includes(commonNameLower),
          );
        });
        console.log(
          `  Countries: Only [${countriesValue}] (${countriesToLink.length} found)`,
        );
      }

      // Create ParticipationTypeCountry links
      for (const country of countriesToLink) {
        await db.ParticipationTypeCountry.create({
          participationTypeId: participationType.id,
          countryId: country.id,
        });
        countriesLinked += 1;
      }

      console.log(`  Linked to ${countriesToLink.length} countries`);
    } catch (error) {
      console.error(`Error creating ${row.Title}:`, error.message);
    }
  }

  console.log('\n=== Import Complete ===');
  console.log('Participation Types created:', typesCreated);
  console.log('Country links created:', countriesLinked);

  process.exit(0);
}

importParticipationTypes().catch(err => {
  console.error('Import failed:', err);
  process.exit(1);
});
