/* eslint-disable no-console */
/**
 * One-off: Send approved email to specific profile IDs.
 * No invoice creation, no status changes — email only.
 *
 * Run with: NODE_ENV=production node scripts/sendApprovedEmailsToIds.js
 */
const {
  sequelize,
  Registration,
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

const registrationNotificationService = require('../services/registrationNotification.service');

const TARGET_PROFILE_IDS = [183];

async function main() {
  console.log(
    `Sending approved emails to ${TARGET_PROFILE_IDS.length} registrations...\n`,
  );

  try {
    await sequelize.authenticate();
    console.log('Database connection established.\n');

    let successCount = 0;
    let failCount = 0;

    for (const profileId of TARGET_PROFILE_IDS) {
      try {
        const registration = await Registration.findOne({
          where: { profileId },
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

        if (!registration) {
          console.log(`  - Profile ID ${profileId}: NOT FOUND — skipped`);
          failCount += 1;
          continue;
        }

        await registrationNotificationService.sendRegistrationApprovedEmail(
          registration.toJSON(),
        );

        console.log(
          `  ✓ Profile ID ${profileId} — email sent to ${registration.email}`,
        );
        successCount += 1;
      } catch (err) {
        console.error(`  ✗ Profile ID ${profileId} — failed: ${err.message}`);
        failCount += 1;
      }
    }

    console.log(
      `\nDone. Success: ${successCount}, Failed: ${failCount} out of ${TARGET_PROFILE_IDS.length}.`,
    );
  } catch (error) {
    console.error('Fatal error:', error.message);
    process.exit(1);
  } finally {
    await sequelize.close();
  }
}

main();
