/* eslint-disable no-console */
/**
 * Data fix: Send approved emails to CONFIRMED registrations that never received one.
 *
 * Logic:
 *  1. Find all CONFIRMED + active registrations
 *  2. Filter out those that already have a VIEW_REGISTRATION token (meaning email was already sent)
 *  3. For each remaining registration, call handleCompanyConfirm (creates invoice + sends approved email)
 *
 * Run with: NODE_ENV=production node scripts/fixSendEmailsToConfirmedRegistrations.js
 */
const {
  sequelize,
  Sequelize,
  Registration,
  RegistrationToken,
  Company,
  Country,
  ParticipationType,
  Spouse,
  Accommodation,
  HotelRoom,
  HotelImages,
  File,
  RegistrationTrip,
  Trip,
} = require('../models');

const { Op } = Sequelize;
const registrationNotificationService = require('../services/registrationNotification.service');

const isDryRun = process.argv.includes('--dry-run');

async function main() {
  console.log(
    isDryRun
      ? '[DRY RUN] Checking confirmed registrations without tokens (no emails will be sent)...'
      : 'Starting data fix: send approved emails to confirmed registrations without tokens...',
  );

  try {
    await sequelize.authenticate();
    console.log('Database connection established.\n');

    // Step 1: Find all registration IDs that already have a VIEW_REGISTRATION token
    const existingTokens = await RegistrationToken.findAll({
      where: { tokenType: 'VIEW_REGISTRATION', isActive: true },
      attributes: ['registrationId'],
    });
    const tokenizedIds = existingTokens.map(t => t.registrationId);
    console.log(
      `Found ${tokenizedIds.length} registration(s) that already have a VIEW_REGISTRATION token.\n`,
    );

    // Step 2: Find CONFIRMED registrations that are NOT in that list
    const whereClause = {
      registrationStatus: 'CONFIRMED',
      isActive: true,
    };
    if (tokenizedIds.length > 0) {
      whereClause.id = { [Op.notIn]: tokenizedIds };
    }

    const registrations = await Registration.findAll({
      where: whereClause,
      attributes: ['id', 'firstName', 'lastName', 'email', 'profileId'],
    });

    if (registrations.length === 0) {
      console.log(
        'No CONFIRMED registrations without VIEW_REGISTRATION token found. Nothing to do.',
      );
      return;
    }

    console.log(`Found ${registrations.length} registration(s) to process:\n`);
    registrations.forEach(r =>
      console.log(
        `  - ID ${r.id} (profileId: ${r.profileId}): ${r.firstName} ${r.lastName} <${r.email}>`,
      ),
    );
    console.log('');

    if (isDryRun) {
      console.log(
        `[DRY RUN] Would send emails to ${registrations.length} registration(s). No emails sent.`,
      );
      return;
    }

    // Step 3: Load full registration data and send approved email for each
    let successCount = 0;
    let failCount = 0;

    for (const reg of registrations) {
      try {
        console.log(`Processing registration ID ${reg.id}...`);

        const fullRegistration = await Registration.findByPk(reg.id, {
          include: [
            {
              model: Company,
              as: 'company',
              include: [
                { model: Country, as: 'country' },
                {
                  model: File,
                  as: 'logo',
                  attributes: [
                    'id',
                    'fileKey',
                    'fileName',
                    'fileType',
                    'fileSize',
                  ],
                },
              ],
            },
            { model: ParticipationType, as: 'participation' },
            { model: Country, as: 'nationality' },
            {
              model: Spouse,
              as: 'spouse',
              include: [{ model: Country, as: 'nationality' }],
            },
            {
              model: RegistrationTrip,
              as: 'trips',
              include: [{ model: Trip, as: 'trip' }],
            },
            {
              model: Accommodation,
              as: 'ammanHotel',
              include: [
                { model: HotelRoom, as: 'hotelRooms' },
                { model: HotelImages, as: 'hotelImages' },
              ],
            },
            { model: HotelRoom, as: 'ammanRoom' },
            {
              model: Accommodation,
              as: 'deadSeaHotel',
              include: [
                { model: HotelRoom, as: 'hotelRooms' },
                { model: HotelImages, as: 'hotelImages' },
              ],
            },
            { model: HotelRoom, as: 'deadSeaRoom' },
          ],
        });

        await registrationNotificationService.handleCompanyConfirm(
          fullRegistration.toJSON(),
        );

        console.log(
          `  ✓ Email sent to ${reg.email} for registration ${reg.id}`,
        );
        successCount++;
      } catch (err) {
        console.error(`  ✗ Failed for registration ${reg.id}: ${err.message}`);
        failCount++;
      }
    }

    console.log(
      `\nDone. Success: ${successCount}, Failed: ${failCount} out of ${registrations.length} registrations.`,
    );
  } catch (error) {
    console.error('Error during data fix:', error.message);
    process.exit(1);
  } finally {
    await sequelize.close();
  }
}

main();
