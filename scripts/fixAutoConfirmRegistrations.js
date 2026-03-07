/* eslint-disable no-console */
/**
 * Data fix: Auto-confirm registrations where the participation type does not require confirmation.
 *
 * Logic:
 *  1. Find all participation types where requireConfirmationFromCompany = false
 *  2. Find SUBMITTED registrations with those participation types
 *  3. Update them to CONFIRMED
 *
 * Run with: NODE_ENV=development node scripts/fixAutoConfirmRegistrations.js
 */
const {
  sequelize,
  Sequelize,
  Registration,
  ParticipationType,
} = require('../models');

const { Op } = Sequelize;

async function main() {
  console.log('Starting data fix: auto-confirm registrations...');

  try {
    await sequelize.authenticate();
    console.log('Database connection established.\n');

    // Step 1: Find participation types that do NOT require confirmation
    const participationTypes = await ParticipationType.findAll({
      where: { requireConfirmationFromCompany: false },
      attributes: ['id', 'title'],
    });

    if (participationTypes.length === 0) {
      console.log(
        'No participation types with requireConfirmationFromCompany = false. Nothing to do.',
      );
      return;
    }

    const participationIds = participationTypes.map(p => p.id);
    console.log(
      `Found ${participationTypes.length} participation type(s) that do not require confirmation:`,
    );
    participationTypes.forEach(p => console.log(`  - [${p.id}] ${p.title}`));

    // Step 2: Find SUBMITTED registrations for those participation types
    const registrations = await Registration.findAll({
      where: {
        participationId: { [Op.in]: participationIds },
        registrationStatus: 'SUBMITTED',
        isActive: true,
      },
      attributes: ['id', 'firstName', 'lastName', 'participationId'],
    });

    if (registrations.length === 0) {
      console.log(
        '\nNo SUBMITTED registrations found for those participation types. Nothing to update.',
      );
      return;
    }

    console.log(
      `\nFound ${registrations.length} registration(s) to update to CONFIRMED:`,
    );
    registrations.forEach(r =>
      console.log(
        `  - ID ${r.id}: ${r.firstName} ${r.lastName} (participationId: ${r.participationId})`,
      ),
    );

    // Step 3: Update them all to CONFIRMED
    const registrationIds = registrations.map(r => r.id);
    const [updatedCount] = await Registration.update(
      { registrationStatus: 'CONFIRMED' },
      { where: { id: { [Op.in]: registrationIds } } },
    );

    console.log(
      `\nDone. Updated ${updatedCount} registration(s) to CONFIRMED.`,
    );
  } catch (error) {
    console.error('Error during data fix:', error.message);
    process.exit(1);
  } finally {
    await sequelize.close();
  }
}

main();
