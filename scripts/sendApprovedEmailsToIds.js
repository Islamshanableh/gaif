/* eslint-disable no-console */
/**
 * One-off: Send approved email to specific registration IDs.
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

const TARGET_IDS = [
  89, 91, 95, 107, 111, 88, 90, 100, 70, 75, 98, 105, 106, 50, 44, 169, 123,
  127,
];

async function main() {
  console.log(
    `Sending approved emails to ${TARGET_IDS.length} registrations...\n`,
  );

  try {
    await sequelize.authenticate();
    console.log('Database connection established.\n');

    let successCount = 0;
    let failCount = 0;

    for (const id of TARGET_IDS) {
      try {
        const registration = await Registration.findByPk(id, {
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
          console.log(`  - ID ${id}: NOT FOUND — skipped`);
          failCount += 1;
          continue;
        }

        await registrationNotificationService.sendRegistrationApprovedEmail(
          registration.toJSON(),
        );

        console.log(`  ✓ ID ${id} — email sent to ${registration.email}`);
        successCount += 1;
      } catch (err) {
        console.error(`  ✗ ID ${id} — failed: ${err.message}`);
        failCount += 1;
      }
    }

    console.log(
      `\nDone. Success: ${successCount}, Failed: ${failCount} out of ${TARGET_IDS.length}.`,
    );
  } catch (error) {
    console.error('Fatal error:', error.message);
    process.exit(1);
  } finally {
    await sequelize.close();
  }
}

main();
