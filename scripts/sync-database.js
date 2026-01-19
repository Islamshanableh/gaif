/* eslint-disable no-console */
const readline = require('readline');
const { sequelize } = require('../models');

// Parse command line arguments
const args = process.argv.slice(2);
const options = {
  force: args.includes('--force'),
  alter: args.includes('--alter'),
  seed: args.includes('--seed'),
  yes: args.includes('-y') || args.includes('--yes'),
  help: args.includes('--help') || args.includes('-h'),
};

function printHelp() {
  console.log(`
GAIF Database Sync Tool
=======================

Usage: npm run db:sync -- [options]

Options:
  --force     Drop all tables and recreate them (WARNING: Deletes all data!)
  --alter     Alter existing tables to match models (safer, preserves data)
  --seed      Seed the database with initial data after sync
  -y, --yes   Skip confirmation prompts
  -h, --help  Show this help message

Examples:
  npm run db:sync                    # Create tables only if they don't exist
  npm run db:sync -- --alter         # Alter tables to match models
  npm run db:sync -- --force -y      # Force recreate all tables without prompt
  npm run db:sync -- --alter --seed  # Alter tables and seed data

Notes:
  - Without any options, only creates missing tables (safest)
  - Use --alter for development when adding new columns
  - Use --force only for fresh installs or when you need a clean slate
  - The --seed option will run the countries seeder after sync
`);
}

async function promptConfirm(message) {
  if (options.yes) return true;

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise(resolve => {
    rl.question(`${message} (y/N): `, answer => {
      rl.close();
      resolve(answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes');
    });
  });
}

async function runSeeder() {
  console.log('\n--- Running Seeders ---\n');

  const fs = require('fs');
  const path = require('path');
  const { Country } = require('../models');

  try {
    // Check if countries already exist
    const existingCount = await Country.count();
    if (existingCount > 0) {
      console.log(`Countries table already has ${existingCount} records.`);
      const shouldSeed = await promptConfirm('Do you want to skip seeding countries?');
      if (shouldSeed) {
        console.log('Skipping country seeding.');
        return;
      }
    }

    // Read the JSON file
    const jsonPath = path.join(__dirname, '../prisma/country.json');
    if (!fs.existsSync(jsonPath)) {
      console.log('Warning: country.json not found at', jsonPath);
      return;
    }

    const countriesData = JSON.parse(fs.readFileSync(jsonPath, 'utf-8'));

    let createdCount = 0;
    let skippedCount = 0;

    for (const country of countriesData) {
      try {
        const [, created] = await Country.findOrCreate({
          where: { cca2: country.alpha2 },
          defaults: {
            cca3: country.alpha3,
            cca2: country.alpha2,
            ccn3: country.numeric,
            currencyCode: country.currency,
            name: country.name,
            phone: country.phone,
          },
        });

        if (created) {
          createdCount++;
        } else {
          skippedCount++;
        }
      } catch (error) {
        console.error(`Failed to seed country ${country.name}:`, error.message);
      }
    }

    console.log(`Seeding complete: ${createdCount} created, ${skippedCount} skipped`);
  } catch (error) {
    console.error('Error during seeding:', error.message);
  }
}

async function syncDatabase() {
  if (options.help) {
    printHelp();
    process.exit(0);
  }

  console.log('\n========================================');
  console.log('   GAIF Database Synchronization Tool');
  console.log('========================================\n');

  try {
    // Test the connection first
    console.log('Testing database connection...');
    await sequelize.authenticate();
    console.log('Database connection established successfully.\n');

    // Determine sync options
    let syncOptions = {};
    let syncMode = 'safe';

    if (options.force) {
      syncMode = 'force';
      syncOptions = { force: true };

      console.log('!!! WARNING: FORCE MODE !!!');
      console.log('This will DROP ALL TABLES and recreate them.');
      console.log('ALL DATA WILL BE PERMANENTLY DELETED!\n');

      const confirmed = await promptConfirm('Are you sure you want to continue?');
      if (!confirmed) {
        console.log('Operation cancelled.');
        process.exit(0);
      }
    } else if (options.alter) {
      syncMode = 'alter';
      syncOptions = { alter: true };

      console.log('ALTER MODE');
      console.log('Tables will be altered to match the current models.');
      console.log('Existing data will be preserved where possible.\n');

      const confirmed = await promptConfirm('Do you want to continue?');
      if (!confirmed) {
        console.log('Operation cancelled.');
        process.exit(0);
      }
    } else {
      console.log('SAFE MODE');
      console.log('Only missing tables will be created.');
      console.log('Existing tables will NOT be modified.\n');
    }

    console.log('Sync Mode:', syncMode.toUpperCase());
    console.log('Options:', JSON.stringify(syncOptions, null, 2));
    console.log('\nSynchronizing database schema...\n');

    // Perform the sync
    await sequelize.sync(syncOptions);

    console.log('\n========================================');
    console.log('   Database sync completed successfully!');
    console.log('========================================\n');

    // List all tables
    const queryInterface = sequelize.getQueryInterface();
    const tables = await queryInterface.showAllTables();

    console.log('Tables in database:');
    console.log('-------------------');

    // Handle Oracle returning objects or strings
    const tableNames = tables.map(t => {
      if (typeof t === 'string') return t;
      if (t && t.TABLE_NAME) return t.TABLE_NAME;
      if (t && t.tableName) return t.tableName;
      return String(t);
    }).filter(name => {
      // Filter out Oracle system tables
      const systemPrefixes = ['SYS_', 'DR$', 'MLOG$', 'RUPD$'];
      return !systemPrefixes.some(prefix => name.startsWith(prefix));
    });

    tableNames.sort().forEach((table, index) => {
      console.log(`  ${index + 1}. ${table}`);
    });
    console.log(`\nTotal: ${tableNames.length} tables\n`);

    // Run seeder if requested
    if (options.seed) {
      await runSeeder();
    }

  } catch (error) {
    console.error('\n========================================');
    console.error('   ERROR: Database sync failed!');
    console.error('========================================\n');
    console.error('Error details:', error.message);

    if (error.original) {
      console.error('Original error:', error.original.message);
    }

    if (error.sql) {
      console.error('Failed SQL:', error.sql);
    }

    process.exit(1);
  } finally {
    await sequelize.close();
    console.log('Database connection closed.');
  }
}

syncDatabase();
