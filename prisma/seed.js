/* eslint-disable no-await-in-loop */
/* eslint-disable no-restricted-syntax */
const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');

const prisma = new PrismaClient();

async function main() {
  console.log('Starting to seed countries (with upsert)...');

  // Read the JSON file
  const jsonPath = path.join(__dirname, 'country.json');
  const countriesData = JSON.parse(fs.readFileSync(jsonPath, 'utf-8'));

  // Counter for tracking progress
  let createdCount = 0;
  let updatedCount = 0;
  let errorCount = 0;

  // Upsert each country (create if doesn't exist, update if exists)
  for (const country of countriesData) {
    try {
      await prisma.country.upsert({
        where: { cca3: country.alpha3 },
        update: {
          cca2: country.alpha2,
          ccn3: country.numeric,
          currencyCode: country.currency,
          name: country.name,
          phone: country.phone,
        },
        create: {
          cca3: country.alpha3,
          cca2: country.alpha2,
          ccn3: country.numeric,
          currencyCode: country.currency,
          name: country.name,
          phone: country.phone,
        },
      });

      // Check if it was created or updated (this is a simplified check)
      const existingCountry = await prisma.country.findUnique({
        where: { cca3: country.alpha3 },
      });

      if (existingCountry) {
        updatedCount++;
        console.log(`↻ Updated: ${country.name}`);
      } else {
        createdCount++;
        console.log(`✓ Created: ${country.name}`);
      }
    } catch (error) {
      errorCount++;
      console.error(`✗ Failed to upsert ${country.name}:`, error.message);
    }
  }

  console.log('\n=================================');
  console.log(`Seeding completed!`);
  console.log(`Created: ${createdCount} countries`);
  console.log(`Updated: ${updatedCount} countries`);
  console.log(`Failed: ${errorCount} countries`);
  console.log('=================================');
}

main()
  .catch(e => {
    console.error('Error during seeding:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
