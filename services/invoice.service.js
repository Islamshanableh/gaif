/* eslint-disable no-await-in-loop */
const PDFDocument = require('pdfkit');
const moment = require('moment');
const path = require('path');

// Configuration for invoice
const INVOICE_CONFIG = {
  // Exchange rate
  exchangeRate: 0.708, // USD 1 = JD 0.708

  // Conference details
  conferenceNumber: 35,
  conferenceYear: 2026,
};

// Template image path
const TEMPLATE_PATH = path.join(
  __dirname,
  '..',
  'templates',
  'invoice-template.jpg',
);

/**
 * Calculate registration fees
 * @param {Object} registration - Registration data with all associations
 * @returns {Object} Fee breakdown
 */
const calculateFees = registration => {
  const fees = {
    participationFees: 0,
    spouseFees: 0,
    tripFees: 0,
    spouseTripFees: 0,
    totalParticipationFees: 0,
    hotelAccommodation: 0,
    totalDiscount: 0,
    totalValueJD: 0,
    totalValueUSD: 0,
  };

  // Participation fees
  if (registration.participation) {
    fees.participationFees = registration.participation.price || 0;
  }

  // Spouse fees (if applicable and participation type allows)
  if (
    registration.hasSpouse &&
    registration.participation &&
    registration.participation.spouse
  ) {
    fees.spouseFees = registration.participation.price || 0;
  }

  // Trip fees
  if (registration.trips && registration.trips.length > 0) {
    registration.trips.forEach(regTrip => {
      if (regTrip.trip) {
        const tripPrice = parseFloat(regTrip.trip.price) || 0;
        if (regTrip.forSpouse) {
          fees.spouseTripFees += tripPrice;
        } else {
          fees.tripFees += tripPrice;
        }
      }
    });
  }

  // Total participation fees
  fees.totalParticipationFees =
    fees.participationFees +
    fees.spouseFees +
    fees.tripFees +
    fees.spouseTripFees;

  // Hotel accommodation (calculate nights * room rate)
  let accommodationTotal = 0;

  // Amman hotel
  if (registration.accommodationInAmman && registration.ammanRoom) {
    const checkIn = moment(registration.ammanCheckIn);
    const checkOut = moment(registration.ammanCheckOut);
    const nights = checkOut.diff(checkIn, 'days') || 1;
    const roomRate =
      registration.ammanRoom.roomRate || registration.ammanRoom.double || 0;
    accommodationTotal += nights * roomRate;
  }

  // Dead Sea hotel
  if (registration.accommodationInDeadSea && registration.deadSeaRoom) {
    const checkIn = moment(registration.deadSeaCheckIn);
    const checkOut = moment(registration.deadSeaCheckOut);
    const nights = checkOut.diff(checkIn, 'days') || 1;
    const roomRate =
      registration.deadSeaRoom.roomRate || registration.deadSeaRoom.double || 0;
    accommodationTotal += nights * roomRate;
  }

  fees.hotelAccommodation = accommodationTotal;

  // Calculate totals
  fees.totalValueJD =
    fees.totalParticipationFees + fees.hotelAccommodation - fees.totalDiscount;
  fees.totalValueUSD =
    Math.round((fees.totalValueJD / INVOICE_CONFIG.exchangeRate) * 100) / 100;

  return fees;
};

/**
 * Format number with 2 decimal places and currency
 * @param {number} value - The value to format
 * @param {string} currency - Currency suffix (JD, USD)
 * @returns {string} Formatted string
 */
const formatCurrency = (value, currency = 'JD') => {
  if (!value || value === 0) return '';
  return `${value.toFixed(2)} ${currency}`;
};

/**
 * Generate invoice PDF using image template
 * @param {Object} registration - Full registration data with associations
 * @returns {Promise<Buffer>} PDF buffer
 */
const generateInvoicePDF = async registration => {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({
        size: 'A4',
        margin: 0,
        bufferPages: true,
        info: {
          Title: `GAIF Invoice - ${registration.id}`,
          Author: 'GAIF 2026',
        },
      });

      const buffers = [];
      doc.on('data', buffers.push.bind(buffers));
      doc.on('end', () => {
        const pdfBuffer = Buffer.concat(buffers);
        resolve(pdfBuffer);
      });

      const fees = calculateFees(registration);
      const participantName = `${registration.firstName || ''} ${
        registration.middleName || ''
      } ${registration.lastName || ''}`.trim();
      const registrationDate = moment(registration.createdAt).format(
        'DD/MM/YYYY',
      );
      const serialNumber = `INV-${registration.id}-${moment().format(
        'YYYYMMDD',
      )}`;

      // Add the template image as background (full page)
      doc.image(TEMPLATE_PATH, 0, 0, {
        width: 595.28, // A4 width in points
        height: 841.89, // A4 height in points
      });

      // Set font color for all text (dark gray)
      const textColor = '#333333';
      doc.fillColor(textColor);

      // ============================================================
      // HEADER SECTION - Positions converted from Figma
      // ============================================================
      doc.fontSize(10).font('Helvetica');

      // SERIAL NUMBER value
      doc.text(serialNumber, 40, 130, { width: 200 });

      // PARTICIPANT'S NAME value
      doc.text(participantName, 42, 183, { width: 200 });

      // REGISTRATION ID value (center column)
      doc.text(registration.id.toString(), 346, 183, { width: 80 });

      // REGISTRATION DATE value (right column)
      doc.text(registrationDate, 470, 183, { width: 90 });

      // ============================================================
      // REGISTRATION section (left column) - Fee values
      // Positions converted from Figma
      // ============================================================
      const feeValueX = 162;
      const feeWidth = 70;

      doc.fontSize(9).font('Helvetica');

      // Participation fees
      if (fees.participationFees > 0) {
        doc.text(formatCurrency(fees.participationFees), feeValueX, 300, {
          width: feeWidth,
          align: 'right',
        });
      }

      // Spouse fees
      if (fees.spouseFees > 0) {
        doc.text(formatCurrency(fees.spouseFees), feeValueX, 330, {
          width: feeWidth,
          align: 'right',
        });
      }

      // Trip
      if (fees.tripFees > 0) {
        doc.text(formatCurrency(fees.tripFees), feeValueX, 360, {
          width: feeWidth,
          align: 'right',
        });
      }

      // Spouse – Trip fees
      if (fees.spouseTripFees > 0) {
        doc.text(formatCurrency(fees.spouseTripFees), feeValueX, 391, {
          width: feeWidth,
          align: 'right',
        });
      }

      // Total Participation fees
      doc.font('Helvetica-Bold');
      doc.text(formatCurrency(fees.totalParticipationFees), feeValueX, 422, {
        width: feeWidth,
        align: 'right',
      });

      // ============================================================
      // TOTAL box values (inside the beige box on left side)
      // Positions converted from Figma
      // ============================================================
      const totalValueX = 162;
      const totalWidth = 70;

      doc.fontSize(9).font('Helvetica');

      // Total Discount (JD)
      if (fees.totalDiscount > 0) {
        doc.text(formatCurrency(fees.totalDiscount), totalValueX, 571, {
          width: totalWidth,
          align: 'right',
        });
      }

      // Total Value (JD)
      doc.font('Helvetica-Bold');
      doc.text(formatCurrency(fees.totalValueJD), totalValueX, 555, {
        width: totalWidth,
        align: 'right',
      });

      // Total Value (USD)
      doc.text(formatCurrency(fees.totalValueUSD, 'USD'), totalValueX, 585, {
        width: totalWidth,
        align: 'right',
      });

      // ============================================================
      // ACCOMMODATION section (right column)
      // Positions converted from Figma
      // ============================================================
      doc.fontSize(9).font('Helvetica');
      if (fees.hotelAccommodation > 0) {
        doc.text(formatCurrency(fees.hotelAccommodation), 450, 305, {
          width: 70,
          align: 'right',
        });
      }

      // Finalize the PDF
      doc.end();
    } catch (error) {
      reject(error);
    }
  });
};

module.exports = {
  INVOICE_CONFIG,
  calculateFees,
  generateInvoicePDF,
};
