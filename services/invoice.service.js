/* eslint-disable no-await-in-loop */
const PDFDocument = require('pdfkit');
const moment = require('moment');
const path = require('path');
const config = require('../config/config');
const { Invoice } = require('./db.service');

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
 * Calculate registration fees with exemption flag logic
 * Flag true = EXEMPT (free/included, don't charge)
 * @param {Object} registration - Registration data with all associations
 * @returns {Object} Fee breakdown matching Invoice model fields
 */
const calculateFees = registration => {
  const participation = registration.participation;
  const company = registration.company;
  const feesTaxPercentage = config.feesTaxPercentage || 0;

  const fees = {
    participationFees: 0,
    spouseFees: 0,
    tripFees: 0,
    spouseTripFees: 0,
    feesTaxPercentage,
    feesTaxAmount: 0,
    totalParticipationFees: 0,
    participationCurrency: null,
    spouseCurrency: null,
    tripCurrency: null,
    spouseTripCurrency: null,
    // Amman accommodation breakdown
    ammanAccommodation: 0,
    ammanTax: 0,
    ammanService: 0,
    ammanTotal: 0,
    ammanCurrency: null,
    // Dead Sea accommodation breakdown
    deadSeaAccommodation: 0,
    deadSeaTax: 0,
    deadSeaService: 0,
    deadSeaTotal: 0,
    deadSeaCurrency: null,
    // Totals
    hotelAccommodationTotal: 0,
    totalDiscount: 0,
    totalValueJD: 0,
    totalValueUSD: 0,
    exchangeRate: INVOICE_CONFIG.exchangeRate,
  };

  if (!participation) return fees;

  // Helper: apply tax to a base amount (e.g. 16%)
  const applyTax = base =>
    Math.round(base * (1 + feesTaxPercentage / 100) * 100) / 100;

  // Participation fees: charge only if fees flag is NOT true (not exempt)
  if (participation.fees !== true) {
    const base = participation.price || 0;
    fees.participationFees = applyTax(base);
    fees.participationCurrency = participation.currency || 'USD';
  }

  // Spouse fees: charge only if spouse flag is NOT true (not exempt)
  if (registration.hasSpouse && participation.spouse !== true) {
    // Jordan company uses specialPrice, otherwise spousePrice
    const isJordan =
      company && company.country && company.country.name === 'Jordan';
    const base = isJordan
      ? participation.specialPrice || 0
      : participation.spousePrice || 0;
    fees.spouseFees = applyTax(base);
    fees.spouseCurrency = participation.currency || 'USD';
  }

  // Trip fees: charge participant trips only if petra flag is NOT true
  if (registration.trips && registration.trips.length > 0) {
    registration.trips.forEach(regTrip => {
      if (regTrip.trip) {
        const tripPrice = parseFloat(regTrip.trip.price) || 0;
        const tripCurrency = regTrip.trip.currency || 'USD';
        if (regTrip.forSpouse) {
          // Spouse trips: charge only if petraSpouse flag is NOT true
          if (participation.petraSpouse !== true) {
            fees.spouseTripFees += applyTax(tripPrice);
            fees.spouseTripCurrency = tripCurrency;
          }
        } else {
          // Participant trips: charge only if petra flag is NOT true
          if (participation.petra !== true) {
            fees.tripFees += applyTax(tripPrice);
            fees.tripCurrency = tripCurrency;
          }
        }
      }
    });
  }

  // Total participation fees = sum of all fees (tax already included in each)
  fees.totalParticipationFees =
    fees.participationFees +
    fees.spouseFees +
    fees.tripFees +
    fees.spouseTripFees;

  // Amman accommodation: charge only if accommodationAmman flag is NOT true
  // Formula: base = nightPrice * nights (checkout day not counted)
  //          service = base * service%
  //          tax = (base + service) * tax%
  //          total = base + service + tax
  if (
    registration.accommodationInAmman &&
    registration.ammanRoom &&
    participation.accommodationAmman !== true
  ) {
    const checkIn = moment(registration.ammanCheckIn);
    const checkOut = moment(registration.ammanCheckOut);
    const nights = checkOut.diff(checkIn, 'days') || 1;
    const roomRate =
      registration.ammanRoom.roomRate || registration.ammanRoom.double || 0;
    const baseAmount = nights * roomRate;

    // Get tax and service percentages from the hotel (Accommodation model)
    const hotel = registration.ammanHotel;
    const taxPercent = hotel ? parseFloat(hotel.hotelTax) || 0 : 0;
    const servicePercent = hotel ? parseFloat(hotel.hotelService) || 0 : 0;

    const serviceAmount =
      Math.round(baseAmount * (servicePercent / 100) * 100) / 100;
    const subtotal = baseAmount + serviceAmount;
    const taxAmount = Math.round(subtotal * (taxPercent / 100) * 100) / 100;

    fees.ammanAccommodation = baseAmount;
    fees.ammanService = serviceAmount;
    fees.ammanTax = taxAmount;
    fees.ammanTotal = subtotal + taxAmount;
    fees.ammanCurrency = registration.ammanRoom.currency || 'USD';
  }

  // Dead Sea accommodation: charge only if accommodationAqaba flag is NOT true
  // (accommodationAqaba maps to Dead Sea)
  // Formula: base = nightPrice * nights (checkout day not counted)
  //          service = base * service%
  //          tax = (base + service) * tax%
  //          total = base + service + tax
  if (
    registration.accommodationInDeadSea &&
    registration.deadSeaRoom &&
    participation.accommodationAqaba !== true
  ) {
    const checkIn = moment(registration.deadSeaCheckIn);
    const checkOut = moment(registration.deadSeaCheckOut);
    const nights = checkOut.diff(checkIn, 'days') || 1;
    const roomRate =
      registration.deadSeaRoom.roomRate || registration.deadSeaRoom.double || 0;
    const baseAmount = nights * roomRate;

    // Get tax and service percentages from the hotel (Accommodation model)
    const hotel = registration.deadSeaHotel;
    const taxPercent = hotel ? parseFloat(hotel.hotelTax) || 0 : 0;
    const servicePercent = hotel ? parseFloat(hotel.hotelService) || 0 : 0;

    const serviceAmount =
      Math.round(baseAmount * (servicePercent / 100) * 100) / 100;
    const subtotal = baseAmount + serviceAmount;
    const taxAmount = Math.round(subtotal * (taxPercent / 100) * 100) / 100;

    fees.deadSeaAccommodation = baseAmount;
    fees.deadSeaService = serviceAmount;
    fees.deadSeaTax = taxAmount;
    fees.deadSeaTotal = subtotal + taxAmount;
    fees.deadSeaCurrency = registration.deadSeaRoom.currency || 'USD';
  }

  fees.hotelAccommodationTotal = fees.ammanTotal + fees.deadSeaTotal;

  // Calculate totals with proper currency conversion
  // Determine the currency of participation fees and accommodation fees
  const partCurrency =
    fees.participationCurrency ||
    fees.spouseCurrency ||
    fees.tripCurrency ||
    fees.spouseTripCurrency ||
    null;
  const accomCurrency = fees.ammanCurrency || fees.deadSeaCurrency || null;

  // Convert participation fees to JD if in USD
  const partFeesInJD =
    partCurrency === 'USD'
      ? Math.round(
          fees.totalParticipationFees * INVOICE_CONFIG.exchangeRate * 100,
        ) / 100
      : fees.totalParticipationFees;

  // Convert accommodation fees to JD if in USD
  const accomFeesInJD =
    accomCurrency === 'USD'
      ? Math.round(
          fees.hotelAccommodationTotal * INVOICE_CONFIG.exchangeRate * 100,
        ) / 100
      : fees.hotelAccommodationTotal;

  fees.totalValueJD =
    Math.round((partFeesInJD + accomFeesInJD - fees.totalDiscount) * 100) / 100;
  fees.totalValueUSD =
    Math.round((fees.totalValueJD / INVOICE_CONFIG.exchangeRate) * 100) / 100;

  return fees;
};

/**
 * Format number with 2 decimal places and currency
 * Always show value including 0.00
 * @param {number} value - The value to format
 * @param {string} currency - Currency suffix (JD, USD)
 * @returns {string} Formatted string
 */
const formatCurrency = (value, currency = 'JD') => {
  const num = parseFloat(value) || 0;
  if (num === 0) return '0.00';
  return `${num.toFixed(2)} ${currency}`;
};

/**
 * Get next serial number in format G26XXXX
 * @returns {Promise<string>} Next serial number
 */
const getNextSerialNumber = async () => {
  const { sequelize } = require('./db.service');
  const [results] = await sequelize.query(
    'SELECT MAX("serialNumber") AS "maxSerial" FROM "Invoices"',
    { raw: true },
  );

  let nextNum = 1;
  if (results && results.length > 0 && results[0].maxSerial) {
    // Parse the numeric part from G26XXXX
    const numericPart = results[0].maxSerial.substring(3);
    nextNum = parseInt(numericPart, 10) + 1;
  }

  return `G26${String(nextNum).padStart(4, '0')}`;
};

/**
 * Create an invoice for a registration
 * @param {Object} registration - Full registration data with associations (plain object)
 * @returns {Promise<Object>} Created or existing invoice
 */
const createInvoice = async registration => {
  // Check if invoice already exists
  const existing = await Invoice.findOne({
    where: { registrationId: registration.id },
  });
  if (existing) return existing;

  const fees = calculateFees(registration);
  const serialNumber = await getNextSerialNumber();

  const invoice = await Invoice.create({
    registrationId: registration.id,
    serialNumber,
    taxNumber: config.taxNumber,
    participationFees: fees.participationFees,
    spouseFees: fees.spouseFees,
    tripFees: fees.tripFees,
    spouseTripFees: fees.spouseTripFees,
    feesTaxPercentage: fees.feesTaxPercentage,
    feesTaxAmount: fees.feesTaxAmount,
    totalParticipationFees: fees.totalParticipationFees,
    participationCurrency: fees.participationCurrency,
    spouseCurrency: fees.spouseCurrency,
    tripCurrency: fees.tripCurrency,
    spouseTripCurrency: fees.spouseTripCurrency,
    ammanAccommodation: fees.ammanAccommodation,
    ammanTax: fees.ammanTax,
    ammanService: fees.ammanService,
    ammanTotal: fees.ammanTotal,
    ammanCurrency: fees.ammanCurrency,
    deadSeaAccommodation: fees.deadSeaAccommodation,
    deadSeaTax: fees.deadSeaTax,
    deadSeaService: fees.deadSeaService,
    deadSeaTotal: fees.deadSeaTotal,
    deadSeaCurrency: fees.deadSeaCurrency,
    hotelAccommodationTotal: fees.hotelAccommodationTotal,
    totalDiscount: fees.totalDiscount,
    totalValueJD: fees.totalValueJD,
    totalValueUSD: fees.totalValueUSD,
    exchangeRate: fees.exchangeRate,
  });

  return invoice;
};

/**
 * Get invoice by registration ID
 * @param {number} registrationId
 * @returns {Promise<Object|null>}
 */
const getInvoiceByRegistrationId = async registrationId => {
  return Invoice.findOne({ where: { registrationId } });
};

/**
 * Generate invoice PDF using image template
 * @param {Object} registration - Full registration data with associations
 * @param {Object} invoice - Invoice record from database
 * @returns {Promise<Buffer>} PDF buffer
 */
const generateInvoicePDF = async (registration, invoice) => {
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

      // Use invoice data if provided, otherwise fallback to calculating fees
      let fees;
      let serialNumber;
      let taxNumber;

      if (invoice) {
        fees = {
          participationFees: parseFloat(invoice.participationFees) || 0,
          spouseFees: parseFloat(invoice.spouseFees) || 0,
          tripFees: parseFloat(invoice.tripFees) || 0,
          spouseTripFees: parseFloat(invoice.spouseTripFees) || 0,
          feesTaxPercentage: parseFloat(invoice.feesTaxPercentage) || 0,
          feesTaxAmount: parseFloat(invoice.feesTaxAmount) || 0,
          totalParticipationFees:
            parseFloat(invoice.totalParticipationFees) || 0,
          participationCurrency: invoice.participationCurrency || 'USD',
          spouseCurrency: invoice.spouseCurrency || 'USD',
          tripCurrency: invoice.tripCurrency || 'USD',
          spouseTripCurrency: invoice.spouseTripCurrency || 'USD',
          ammanAccommodation: parseFloat(invoice.ammanAccommodation) || 0,
          ammanTax: parseFloat(invoice.ammanTax) || 0,
          ammanService: parseFloat(invoice.ammanService) || 0,
          ammanTotal: parseFloat(invoice.ammanTotal) || 0,
          ammanCurrency: invoice.ammanCurrency || 'USD',
          deadSeaAccommodation: parseFloat(invoice.deadSeaAccommodation) || 0,
          deadSeaTax: parseFloat(invoice.deadSeaTax) || 0,
          deadSeaService: parseFloat(invoice.deadSeaService) || 0,
          deadSeaTotal: parseFloat(invoice.deadSeaTotal) || 0,
          deadSeaCurrency: invoice.deadSeaCurrency || 'USD',
          hotelAccommodationTotal:
            parseFloat(invoice.hotelAccommodationTotal) || 0,
          totalDiscount: parseFloat(invoice.totalDiscount) || 0,
          totalValueJD: parseFloat(invoice.totalValueJD) || 0,
          totalValueUSD: parseFloat(invoice.totalValueUSD) || 0,
        };
        serialNumber = invoice.serialNumber;
        taxNumber = invoice.taxNumber;
      } else {
        fees = calculateFees(registration);
        serialNumber = `INV-${registration.id}-${moment().format('YYYYMMDD')}`;
        taxNumber = config.taxNumber;
      }

      const participantName = `${registration.firstName || ''} ${
        registration.middleName || ''
      } ${registration.lastName || ''}`.trim();
      const registrationDate = moment(registration.createdAt).format(
        'DD/MM/YYYY',
      );
      // Use profileId for display if available, otherwise registration id
      const registrationDisplayId = registration.profileId || registration.id;

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

      // TAX NUMBER value
      if (taxNumber) {
        doc.text(`${taxNumber}`, 450, 130, { width: 200 });
      }

      // PARTICIPANT'S NAME value
      doc.text(participantName, 42, 183, { width: 200 });

      // REGISTRATION ID value (center column) — use profileId
      doc.text(registrationDisplayId.toString(), 346, 183, { width: 80 });

      // REGISTRATION DATE value (right column)
      doc.text(registrationDate, 470, 183, { width: 90 });

      // ============================================================
      // REGISTRATION section (left column) - Fee values
      // ============================================================
      const feeValueX = 162;
      const feeWidth = 70;

      doc.fontSize(9).font('Helvetica');

      // Participation fees — always show value
      doc.text(
        formatCurrency(
          fees.participationFees,
          fees.participationCurrency || 'USD',
        ),
        feeValueX,
        300,
        { width: feeWidth, align: 'right' },
      );

      // Spouse fees
      doc.text(
        formatCurrency(fees.spouseFees, fees.spouseCurrency || 'USD'),
        feeValueX,
        330,
        { width: feeWidth, align: 'right' },
      );

      // Trip fees
      doc.text(
        formatCurrency(fees.tripFees, fees.tripCurrency || 'USD'),
        feeValueX,
        360,
        { width: feeWidth, align: 'right' },
      );

      // Spouse – Trip fees
      doc.text(
        formatCurrency(fees.spouseTripFees, fees.spouseTripCurrency || 'USD'),
        feeValueX,
        391,
        { width: feeWidth, align: 'right' },
      );

      // Total Participation fees (tax included in each fee)
      const partCurrency =
        fees.participationCurrency ||
        fees.spouseCurrency ||
        fees.tripCurrency ||
        fees.spouseTripCurrency ||
        'USD';
      doc.font('Helvetica-Bold');
      doc.text(
        formatCurrency(fees.totalParticipationFees, partCurrency),
        feeValueX,
        422,
        {
          width: feeWidth,
          align: 'right',
        },
      );

      // ============================================================
      // ACCOMMODATION section (right column)
      // ============================================================
      doc.fontSize(9).font('Helvetica');

      const accomValueX = 450;
      const accomWidth = 70;
      let accomY = 300;

      const hasAmman = fees.ammanTotal > 0;
      const hasDeadSea = fees.deadSeaTotal > 0;
      const hasBothHotels = hasAmman && hasDeadSea;

      // Only show individual hotel lines when BOTH hotels have values
      // to avoid showing the same value twice (individual + total)
      if (hasBothHotels) {
        // Amman accommodation (inclusive of tax & service)
        doc.text(
          formatCurrency(fees.ammanTotal, fees.ammanCurrency || 'USD'),
          accomValueX,
          accomY,
          { width: accomWidth, align: 'right' },
        );
        accomY += 30;

        // Dead Sea accommodation (inclusive of tax & service)
        doc.text(
          formatCurrency(fees.deadSeaTotal, fees.deadSeaCurrency || 'USD'),
          accomValueX,
          accomY,
          { width: accomWidth, align: 'right' },
        );
        accomY += 30;
      }

      // Hotel accommodation total
      const accomCurrency = fees.ammanCurrency || fees.deadSeaCurrency || 'USD';
      doc.font('Helvetica-Bold');
      doc.text(
        formatCurrency(fees.hotelAccommodationTotal, accomCurrency),
        accomValueX,
        accomY,
        { width: accomWidth, align: 'right' },
      );

      // ============================================================
      // TOTAL box values (inside the beige box on left side)
      // ============================================================
      const totalValueX = 162;
      const totalWidth = 70;

      doc.fontSize(9).font('Helvetica');

      // Total Discount (JD)
      doc.text(formatCurrency(fees.totalDiscount), totalValueX, 525, {
        width: totalWidth,
        align: 'right',
      });

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
  formatCurrency,
  getNextSerialNumber,
  createInvoice,
  getInvoiceByRegistrationId,
  generateInvoicePDF,
};
