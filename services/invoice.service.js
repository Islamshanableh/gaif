/* eslint-disable no-await-in-loop */
const PDFDocument = require('pdfkit');
const moment = require('moment');

// Configuration for invoice
const INVOICE_CONFIG = {
  // Bank details
  jifBank: {
    name: 'Arab Bank/Abdali Branch',
    accountJD: '0119/060725-501',
    ibanJD: '3052 ARAB 1190 0000 0011 9060 7255 01',
    accountUSD: '0119/060725-511',
    ibanUSD: '3073 ARAB 1190 0000 0011 9060 7255 11',
    swift: 'ARAB20AXTI',
  },
  gaifBank: {
    name: 'Arab Bank - Manama Branch',
    location: 'Manama - Kingdom of Bahrain',
    accountNo: '2002 – 104598 – 511 USD',
    swift: 'ARABBHBMAN',
    iban: 'BH 31 ARAB 0200 2104 5985 11',
    accountName: 'General Arab Insurance Federation',
  },

  // Exchange rate
  exchangeRate: 0.708, // USD 1 = JD 0.708

  // Conference details
  conferenceNumber: 35,
  conferenceYear: 2026,
  conferenceLocation: 'Dead Sea/Jordan',
  conferenceDates: '4-7 Oct 2026',
};

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
      registration.deadSeaRoom.roomRate ||
      registration.deadSeaRoom.double ||
      0;
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
 * Generate invoice PDF - Single page compact layout
 * @param {Object} registration - Full registration data with associations
 * @returns {Promise<Buffer>} PDF buffer
 */
const generateInvoicePDF = async registration => {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({
        size: 'A4',
        margin: 30,
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

      // Colors
      const primaryColor = '#1a5276';
      const accentColor = '#f39c12';
      const textColor = '#333333';
      const lightGray = '#f8f8f8';

      // Page dimensions
      const pageWidth = doc.page.width;
      const leftMargin = 30;
      const rightMargin = 30;
      const contentWidth = pageWidth - leftMargin - rightMargin;
      const leftColX = leftMargin;
      const rightColX = pageWidth / 2 + 10;
      const colWidth = contentWidth / 2 - 10;

      // ========== HEADER ==========
      doc.rect(0, 0, pageWidth, 50).fill(primaryColor);
      doc
        .fontSize(14)
        .fillColor('#ffffff')
        .font('Helvetica-Bold')
        .text('GAIF', 40, 18)
        .text('Federation', pageWidth / 2 - 30, 18)
        .text('JIF', pageWidth - 70, 18);

      // ========== SERIAL & TAX NUMBER ==========
      let y = 60;
      doc
        .fontSize(8)
        .fillColor(primaryColor)
        .font('Helvetica-Bold')
        .text('SERIAL NUMBER', leftColX, y)
        .text('TAX NUMBER', pageWidth - rightMargin - 80, y, {
          width: 80,
          align: 'right',
        });

      y += 12;
      doc
        .fontSize(9)
        .fillColor(textColor)
        .font('Helvetica')
        .text(
          `INV-${registration.id}-${moment().format('YYYYMMDD')}`,
          leftColX,
          y,
        );

      // ========== PARTICIPANT INFO ==========
      y += 20;
      doc
        .fontSize(8)
        .fillColor(primaryColor)
        .font('Helvetica-Bold')
        .text("PARTICIPANT'S NAME", leftColX, y)
        .text('REGISTRATION ID', leftColX + 180, y)
        .text('REGISTRATION DATE', leftColX + 320, y);

      y += 12;
      doc
        .fontSize(9)
        .fillColor(textColor)
        .font('Helvetica')
        .text(participantName, leftColX, y)
        .text(registration.id.toString(), leftColX + 180, y)
        .text(registrationDate, leftColX + 320, y);

      // ========== HORIZONTAL LINE ==========
      y += 20;
      doc
        .moveTo(leftColX, y)
        .lineTo(pageWidth - rightMargin, y)
        .stroke(primaryColor);

      // ========== REFERENCE TEXT ==========
      y += 10;
      doc
        .fontSize(8)
        .fillColor(textColor)
        .font('Helvetica')
        .text(
          `Reference to your registration in GAIF ${INVOICE_CONFIG.conferenceNumber} conference, at ${INVOICE_CONFIG.conferenceLocation} dated from ${INVOICE_CONFIG.conferenceDates}, you are kindly requested to arrange payments for the following:`,
          leftColX,
          y,
          { width: contentWidth, lineGap: 2 },
        );

      // ========== TWO COLUMN LAYOUT ==========
      y += 35;
      const columnsStartY = y;

      // ----- LEFT COLUMN: REGISTRATION -----
      doc
        .fontSize(10)
        .fillColor(primaryColor)
        .font('Helvetica-Bold')
        .text('REGISTRATION', leftColX, y);

      y += 18;

      // Fee items function
      const drawFeeRow = (label, value, xPos) => {
        doc.fontSize(8).fillColor(textColor).font('Helvetica').text(label, xPos, y);
        doc.text(value ? `${value.toFixed(2)} JD` : '—', xPos + colWidth - 60, y, {
          width: 60,
          align: 'right',
        });
        y += 14;
      };

      drawFeeRow('Participation fees', fees.participationFees, leftColX);
      drawFeeRow('Spouse fees', fees.spouseFees, leftColX);
      drawFeeRow('Trip', fees.tripFees, leftColX);
      drawFeeRow('Spouse – Trip fees', fees.spouseTripFees, leftColX);

      y += 5;
      doc
        .moveTo(leftColX, y)
        .lineTo(leftColX + colWidth - 20, y)
        .stroke('#ddd');
      y += 8;

      doc.fontSize(8).fillColor(primaryColor).font('Helvetica-Bold');
      doc.text('Total Participation fees', leftColX, y);
      doc.text(`${fees.totalParticipationFees.toFixed(2)} JD`, leftColX + colWidth - 60, y, {
        width: 60,
        align: 'right',
      });

      // ----- TOTAL BOX -----
      y += 25;
      const totalBoxY = y;
      doc.rect(leftColX, totalBoxY, colWidth - 20, 70).fill(lightGray);

      y = totalBoxY + 8;
      doc.fontSize(10).fillColor(primaryColor).font('Helvetica-Bold').text('TOTAL', leftColX + 10, y);

      y += 16;
      doc.fontSize(8).fillColor(textColor).font('Helvetica');
      doc.text('Total Discount (JD)', leftColX + 10, y);
      doc.text(`${fees.totalDiscount.toFixed(2)} JD`, leftColX + colWidth - 70, y, {
        width: 60,
        align: 'right',
      });

      y += 14;
      doc.text('Total Value (JD)', leftColX + 10, y);
      doc.fillColor(primaryColor).font('Helvetica-Bold');
      doc.text(`${fees.totalValueJD.toFixed(2)} JD`, leftColX + colWidth - 70, y, {
        width: 60,
        align: 'right',
      });

      y += 14;
      doc.fillColor(textColor).font('Helvetica');
      doc.text('Total Value (USD)', leftColX + 10, y);
      doc.fillColor(primaryColor).font('Helvetica-Bold');
      doc.text(`${fees.totalValueUSD.toFixed(2)} USD`, leftColX + colWidth - 70, y, {
        width: 60,
        align: 'right',
      });

      // ----- RIGHT COLUMN: ACCOMMODATION & NOTES -----
      y = columnsStartY;
      doc
        .fontSize(10)
        .fillColor(primaryColor)
        .font('Helvetica-Bold')
        .text('ACCOMMODATION', rightColX, y);
      doc.fontSize(6).font('Helvetica').text('(Inclusive of Tax & Service)', rightColX + 95, y + 2);

      y += 18;
      doc.fontSize(8).fillColor(textColor).font('Helvetica');
      doc.text('Hotel Accommodation', rightColX, y);
      doc.text(
        fees.hotelAccommodation ? `${fees.hotelAccommodation.toFixed(2)} JD` : '—',
        rightColX + colWidth - 60,
        y,
        { width: 60, align: 'right' },
      );

      // NOTES section
      y += 25;
      doc.fontSize(10).fillColor(primaryColor).font('Helvetica-Bold').text('NOTES', rightColX, y);

      y += 14;
      doc.fontSize(7).fillColor(textColor).font('Helvetica');

      const notesLines = [
        'Registration & Hotel accommodation fees can be paid by:',
        '',
        'A. Credit card (VISA, MASTER).',
        '   Through the link on received email',
        '',
        'B. Bank Transfer',
        '',
        'Jordan Insurance Federation Account:',
        `Bank Name: ${INVOICE_CONFIG.jifBank.name}`,
        `Account#(JD): ${INVOICE_CONFIG.jifBank.accountJD}`,
        `IBAN (JD): ${INVOICE_CONFIG.jifBank.ibanJD}`,
        `Account (USD): ${INVOICE_CONFIG.jifBank.accountUSD}`,
        `IBAN (USD): ${INVOICE_CONFIG.jifBank.ibanUSD}`,
        `SWIFT: ${INVOICE_CONFIG.jifBank.swift}`,
        '',
        'GAIF Account:',
        `${INVOICE_CONFIG.gaifBank.name}`,
        `${INVOICE_CONFIG.gaifBank.location}`,
        `Account: ${INVOICE_CONFIG.gaifBank.accountNo}`,
        `SWIFT: ${INVOICE_CONFIG.gaifBank.swift}`,
        `IBAN: ${INVOICE_CONFIG.gaifBank.iban}`,
        '',
        'C. Local bank cheque to JIF',
      ];

      notesLines.forEach(line => {
        if (line) {
          doc.text(line, rightColX, y, { width: colWidth - 10 });
        }
        y += 9;
      });

      // ========== BOTTOM SECTION: POLICIES ==========
      const bottomY = 480;

      // Important Notes - Left
      y = bottomY;
      doc.fontSize(9).fillColor(primaryColor).font('Helvetica-Bold').text('Important Notes', leftColX, y);
      y += 12;

      const importantNotes = [
        'Registration fees guaranteed once full payment received.',
        'Payment deadline: 4th Sept. 2026',
        'Extra hotel expenses paid directly to hotel.',
        'Prices include breakfast, service & taxes.',
      ];

      doc.fontSize(6).fillColor(textColor).font('Helvetica');
      importantNotes.forEach(note => {
        doc.text(`• ${note}`, leftColX, y, { width: colWidth - 10 });
        y += 12;
      });

      // Refund Policy - Right top
      y = bottomY;
      doc.fontSize(9).fillColor(primaryColor).font('Helvetica-Bold').text('Refund Policy', rightColX, y);
      y += 12;

      doc.fontSize(6).fillColor(textColor).font('Helvetica');
      doc.text(
        '• Refunds within 10 working days from cancellation request to registration@GAIF2026.com',
        rightColX,
        y,
        { width: colWidth - 10 },
      );
      y += 18;
      doc.text(
        '• Force Majeure: Full refund within 10 working days.',
        rightColX,
        y,
        { width: colWidth - 10 },
      );

      // Cancellation Policy - Right bottom
      y += 20;
      doc.fontSize(9).fillColor(primaryColor).font('Helvetica-Bold').text('Cancellation Policy', rightColX, y);
      y += 12;

      doc.fontSize(6).fillColor(textColor).font('Helvetica');
      doc.text('• Free cancellation if conference cancelled by GAIF35.', rightColX, y, {
        width: colWidth - 10,
      });
      y += 12;
      doc.text('• Free cancellation before 11:59 PM, Sept 4, 2026.', rightColX, y, {
        width: colWidth - 10,
      });
      y += 12;
      doc.text('• No refund after 11:59 PM, Sept 4, 2026.', rightColX, y, {
        width: colWidth - 10,
      });

      // ========== EXCHANGE RATE FOOTER ==========
      y = doc.page.height - 50;
      doc.fontSize(8).fillColor(accentColor).font('Helvetica-Bold');
      doc.text('Exchange Rate Is Approximately', leftColX, y);
      doc.text(`USD 1 = JD ${INVOICE_CONFIG.exchangeRate}`, leftColX, y + 12);

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
