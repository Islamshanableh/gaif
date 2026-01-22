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
      // Place dynamic values at specific positions on the template
      // Coordinates based on A4 size (595.28 x 841.89 points)
      // Adjusted based on actual template layout
      // ============================================================

      // SERIAL NUMBER value (below "SERIAL NUMBER" label)
      doc.fontSize(10).font('Helvetica');
      doc.text(serialNumber, 50, 68, { width: 200 });

      // PARTICIPANT'S NAME value
      doc.fontSize(10).font('Helvetica');
      doc.text(participantName, 50, 118, { width: 180 });

      // REGISTRATION ID value
      doc.text(registration.id.toString(), 350, 118, { width: 80 });

      // REGISTRATION DATE value
      doc.text(registrationDate, 480, 118, { width: 100 });

      // ============================================================
      // REGISTRATION section (left column) - Fee values
      // Values should appear at the end of each row's line
      // ============================================================
      const feeValueX = 245; // X position for fee values (end of line area)
      const feeStartY = 268; // Starting Y for first fee row (Participation fees)
      const feeRowHeight = 26; // Height between rows

      doc.fontSize(9).font('Helvetica');

      // Participation fees - row 1
      if (fees.participationFees > 0) {
        doc.text(formatCurrency(fees.participationFees), feeValueX, feeStartY, {
          width: 70,
          align: 'right',
        });
      }

      // Spouse fees - row 2
      if (fees.spouseFees > 0) {
        doc.text(
          formatCurrency(fees.spouseFees),
          feeValueX,
          feeStartY + feeRowHeight,
          { width: 70, align: 'right' },
        );
      }

      // Trip fees - row 3
      if (fees.tripFees > 0) {
        doc.text(
          formatCurrency(fees.tripFees),
          feeValueX,
          feeStartY + feeRowHeight * 2,
          { width: 70, align: 'right' },
        );
      }

      // Spouse - Trip fees - row 4
      if (fees.spouseTripFees > 0) {
        doc.text(
          formatCurrency(fees.spouseTripFees),
          feeValueX,
          feeStartY + feeRowHeight * 3,
          { width: 70, align: 'right' },
        );
      }

      // Total Participation fees - row 5 (with extra spacing)
      doc.font('Helvetica-Bold');
      doc.text(
        formatCurrency(fees.totalParticipationFees),
        feeValueX,
        feeStartY + feeRowHeight * 4 + 8,
        { width: 70, align: 'right' },
      );

      // ============================================================
      // TOTAL box values (beige background box)
      // ============================================================
      const totalValueX = 175; // X position for values inside TOTAL box
      const totalBoxStartY = 498; // Y position for first row inside TOTAL box
      const totalRowHeight = 26; // Height between rows in TOTAL box

      doc.fontSize(9).font('Helvetica');

      // Total Discount (JD) - first row in box
      if (fees.totalDiscount > 0) {
        doc.text(
          formatCurrency(fees.totalDiscount),
          totalValueX,
          totalBoxStartY,
          { width: 70, align: 'right' },
        );
      }

      // Total Value (JD) - second row in box
      doc.font('Helvetica-Bold');
      doc.text(
        formatCurrency(fees.totalValueJD),
        totalValueX,
        totalBoxStartY + totalRowHeight,
        { width: 70, align: 'right' },
      );

      // Total Value (USD) - third row in box
      doc.text(
        formatCurrency(fees.totalValueUSD, 'USD'),
        totalValueX,
        totalBoxStartY + totalRowHeight * 2,
        { width: 70, align: 'right' },
      );

      // ============================================================
      // ACCOMMODATION section (right column)
      // ============================================================
      const accomValueX = 555; // X position for accommodation value
      const accomY = 296; // Y position for Hotel Accommodation value

      doc.fontSize(9).font('Helvetica');
      if (fees.hotelAccommodation > 0) {
        doc.text(formatCurrency(fees.hotelAccommodation), accomValueX, accomY, {
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
