/* eslint-disable no-await-in-loop */
/* eslint-disable no-restricted-syntax */
const fs = require('fs');
const path = require('path');
const { sequelize, Country } = require('../models');

async function main() {
  console.log('Starting to seed countries...');

  try {
    // Test database connection
    await sequelize.authenticate();
    console.log('Database connection established successfully.');

    // Read the JSON file
    const jsonPath = path.join(__dirname, '../prisma/country.json');
    const countriesData = JSON.parse(fs.readFileSync(jsonPath, 'utf-8'));

    // Counter for tracking progress
    let createdCount = 0;
    let skippedCount = 0;
    let errorCount = 0;

    // Insert each country
    for (const country of countriesData) {
      try {
        // Check if country already exists
        const existing = await Country.findOne({
          where: { cca2: country.alpha2 },
        });

        if (existing) {
          skippedCount++;
          console.log(`- Skipped (exists): ${country.name}`);
          continue;
        }

        await Country.create({
          cca3: country.alpha3,
          cca2: country.alpha2,
          ccn3: country.numeric,
          currencyCode: country.currency,
          name: country.name,
          phone: country.phone,
        });

        createdCount++;
        console.log(`+ Created: ${country.name}`);
      } catch (error) {
        errorCount++;
        console.error(`x Failed to create ${country.name}:`, error.message);
      }
    }

    console.log('\n=================================');
    console.log('Seeding completed!');
    console.log(`Created: ${createdCount} countries`);
    console.log(`Skipped: ${skippedCount} countries`);
    console.log(`Failed: ${errorCount} countries`);
    console.log('=================================');
  } catch (error) {
    console.error('Error during seeding:', error);
    process.exit(1);
  } finally {
    await sequelize.close();
  }
}

main();
