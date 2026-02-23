const XLSX = require('xlsx');
const path = require('path');

// Import database models
const db = require('../services/db.service');

async function importHotels() {
  // Read the Excel file
  const filePath =
    process.argv[2] || path.join(__dirname, '../../Downloads/Gaif Hotels.xlsx');

  console.log('Reading file:', filePath);

  const workbook = XLSX.readFile(filePath);
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];

  // Convert to JSON
  const data = XLSX.utils.sheet_to_json(sheet);

  console.log('Total rows:', data.length);

  // Group rows by hotel ID
  const hotelsMap = new Map();

  for (const row of data) {
    const hotelId = row['ID'];

    if (!hotelsMap.has(hotelId)) {
      // First row with this ID - contains hotel info
      hotelsMap.set(hotelId, {
        hotelInfo: {
          hotelName: row['Hotel Name'],
          location: row['Location'],
          stars: row['Stars'],
          hotelTax: row['Hotel Tax (%)']?.toString() || '0',
          hotelService: row['Hotel Service (%)']?.toString() || '0',
          hotelOrder: row['Hotel Order'] || null,
          distance: row['Distance'] || null,
          time: row['Time'] || null,
          isActive: row['Status'] === 'Active',
        },
        rooms: [],
      });
    }

    // Add room data (every row has room data)
    if (row['Room Category']) {
      hotelsMap.get(hotelId).rooms.push({
        roomCategory: row['Room Category']?.trim(),
        numberOfRooms: row['Number of Rooms'] || 0,
        single: row['Single Price'] || 0,
        double: row['Double Price'] || 0,
        available: row['Available Rooms'] || row['Number of Rooms'] || 0,
        currency: row['Currency'] || 'JD',
        isActive: true,
      });
    }
  }

  console.log('Unique hotels found:', hotelsMap.size);

  // Import to database
  let hotelsCreated = 0;
  let roomsCreated = 0;

  for (const [excelId, hotelData] of hotelsMap) {
    try {
      // Create Accommodation
      const accommodation = await db.Accommodation.create(hotelData.hotelInfo);
      hotelsCreated++;
      console.log(
        `Created hotel: ${hotelData.hotelInfo.hotelName} (ID: ${accommodation.id})`,
      );

      // Create HotelRooms
      for (const roomData of hotelData.rooms) {
        await db.HotelRoom.create({
          ...roomData,
          accommodationId: accommodation.id,
        });
        roomsCreated++;
        console.log(`  - Room: ${roomData.roomCategory}`);
      }
    } catch (error) {
      console.error(`Error creating hotel ${excelId}:`, error.message);
    }
  }

  console.log('\n=== Import Complete ===');
  console.log('Hotels created:', hotelsCreated);
  console.log('Rooms created:', roomsCreated);

  process.exit(0);
}

importHotels().catch(err => {
  console.error('Import failed:', err);
  process.exit(1);
});
