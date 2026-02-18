/* eslint-disable no-await-in-loop */
const PDFDocument = require('pdfkit');
const moment = require('moment');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const QRCode = require('qrcode');
const config = require('../config/config');
const { Op } = require('sequelize');
const {
  Invoice,
  Registration,
  Company,
  Country,
  File,
  Spouse,
  ParticipationType,
  sequelize,
} = require('./db.service');

// Configuration for invoice
const INVOICE_CONFIG = {
  // Exchange rate
  exchangeRate: 0.708, // USD 1 = JD 0.70

  // Conference details
  conferenceNumber: 35,
  conferenceYear: 2026,
};

// Template image paths
const TEMPLATE_PATH = path.join(
  __dirname,
  '..',
  'templates',
  'invoice-template.jpg',
);

const PAYMENT_RECEIPT_TEMPLATE_PATH = path.join(
  __dirname,
  '..',
  'templates',
  'invoicePayment-template.jpg',
);

/**
 * Calculate registration fees with exemption flag logic
 * Flag true = EXEMPT (free/included, don't charge)
 * @param {Object} registration - Registration data with all associations
 * @returns {Object} Fee breakdown matching Invoice model fields
 */
const calculateFees = registration => {
  const participation = registration?.participation;
  const company = registration?.company;
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
    // Use single or double rate based on ammanRoomType
    const roomRate =
      registration.ammanRoomType === 'single'
        ? registration.ammanRoom.single || 0
        : registration.ammanRoom.double || 0;
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
    // Use single or double rate based on deadSeaRoomType
    const roomRate =
      registration.deadSeaRoomType === 'single'
        ? registration.deadSeaRoom.single || 0
        : registration.deadSeaRoom.double || 0;
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

  // Convert any JD/JOD fees to USD so all line items are in USD
  const rate = INVOICE_CONFIG.exchangeRate; // USD 1 = JD 0.70
  const jdToUsd = val => Math.round((val / rate) * 100) / 100;
  // Helper to check if currency is Jordanian Dinar (JD or JOD)
  const isJordanianDinar = currency =>
    currency === 'JD' ||
    currency === 'JOD' ||
    currency === 'jd' ||
    currency === 'jod';

  // Participation-related fees: convert if in JD/JOD
  if (isJordanianDinar(fees.participationCurrency)) {
    fees.participationFees = jdToUsd(fees.participationFees);
    fees.participationCurrency = 'USD';
  }
  if (isJordanianDinar(fees.spouseCurrency)) {
    fees.spouseFees = jdToUsd(fees.spouseFees);
    fees.spouseCurrency = 'USD';
  }
  if (isJordanianDinar(fees.tripCurrency)) {
    fees.tripFees = jdToUsd(fees.tripFees);
    fees.tripCurrency = 'USD';
  }
  if (isJordanianDinar(fees.spouseTripCurrency)) {
    fees.spouseTripFees = jdToUsd(fees.spouseTripFees);
    fees.spouseTripCurrency = 'USD';
  }

  // Recalculate total participation fees after conversion
  fees.totalParticipationFees =
    Math.round(
      (fees.participationFees +
        fees.spouseFees +
        fees.tripFees +
        fees.spouseTripFees) *
        100,
    ) / 100;

  // Accommodation fees: convert if in JD/JOD
  if (isJordanianDinar(fees.ammanCurrency)) {
    fees.ammanAccommodation = jdToUsd(fees.ammanAccommodation);
    fees.ammanService = jdToUsd(fees.ammanService);
    fees.ammanTax = jdToUsd(fees.ammanTax);
    fees.ammanTotal = jdToUsd(fees.ammanTotal);
    fees.ammanCurrency = 'USD';
  }
  if (isJordanianDinar(fees.deadSeaCurrency)) {
    fees.deadSeaAccommodation = jdToUsd(fees.deadSeaAccommodation);
    fees.deadSeaService = jdToUsd(fees.deadSeaService);
    fees.deadSeaTax = jdToUsd(fees.deadSeaTax);
    fees.deadSeaTotal = jdToUsd(fees.deadSeaTotal);
    fees.deadSeaCurrency = 'USD';
  }

  fees.hotelAccommodationTotal =
    Math.round((fees.ammanTotal + fees.deadSeaTotal) * 100) / 100;

  // Calculate grand totals — all fees are now in USD
  const allFeesUSD =
    fees.totalParticipationFees +
    fees.hotelAccommodationTotal -
    fees.totalDiscount;
  fees.totalValueUSD = Math.round(allFeesUSD * 100) / 100;
  fees.totalValueJD = Math.round(allFeesUSD * rate * 100) / 100;

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
 * Create a new versioned invoice for a registration.
 * Keeps old invoices and creates a new one with serial like G260001/2, G260001/3, etc.
 * @param {Object} registration - Full registration data with associations (plain object)
 * @returns {Promise<Object|null>} New versioned invoice, or null if no invoice exists
 */
const createVersionedInvoice = async registration => {
  // Find all invoices for this registration, ordered by creation
  const invoices = await Invoice.findAll({
    where: { registrationId: registration.id },
    order: [['createdAt', 'ASC']],
  });
  if (!invoices || invoices.length === 0) return null;

  // The base serial is from the first invoice (e.g. G260001)
  const baseSerial = invoices[0].serialNumber;
  // Next version number = total invoices + 1
  const nextVersion = invoices.length + 1;
  const newSerial = `${baseSerial}/${nextVersion}`;

  const fees = calculateFees(registration);

  const invoice = await Invoice.create({
    registrationId: registration.id,
    serialNumber: newSerial,
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
 * Get the latest invoice by registration ID
 * @param {number} registrationId
 * @returns {Promise<Object|null>}
 */
const getInvoiceByRegistrationId = async registrationId => {
  return Invoice.findOne({
    where: { registrationId },
    order: [['createdAt', 'DESC']],
  });
};

/**
 * Get all invoices for a registration (all versions)
 * @param {number} registrationId
 * @returns {Promise<Array>}
 */
const getInvoicesByRegistrationId = async registrationId => {
  return Invoice.findAll({
    where: { registrationId },
    order: [['createdAt', 'ASC']],
  });
};

/**
 * Generate invoice PDF using image template
 * @param {Object} registration - Full registration data with associations
 * @param {Object} invoice - Invoice record from database
 * @returns {Promise<Buffer>} PDF buffer
 */
const generateInvoicePDF = async (registration, invoice) => {
  // Generate QR code image buffer
  // Priority: verificationUrl (opens Fawaterkom portal), fallback to qrCode (TLV data)
  let qrImageBuffer = null;
  const qrData = invoice?.verificationUrl || invoice?.qrCode;
  if (qrData) {
    try {
      qrImageBuffer = await QRCode.toBuffer(qrData, {
        type: 'png',
        width: 120,
        margin: 1,
        errorCorrectionLevel: 'M',
      });
    } catch (qrErr) {
      // eslint-disable-next-line no-console
      console.error('Error generating QR code for invoice:', qrErr.message);
    }
  }

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
      doc.text(registrationDate, 450, 183, { width: 90 });

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

      // // Trip fees
      // doc.text(
      //   formatCurrency(fees.tripFees, fees.tripCurrency || 'USD'),
      //   feeValueX,
      //   360,
      //   { width: feeWidth, align: 'right' },
      // );

      // // Spouse – Trip fees
      // doc.text(
      //   formatCurrency(fees.spouseTripFees, fees.spouseTripCurrency || 'USD'),
      //   feeValueX,
      //   391,
      //   { width: feeWidth, align: 'right' },
      // );

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
        355,
        {
          width: feeWidth,
          align: 'right',
        },
      );

      // ============================================================
      // ACCOMMODATION section (right column)
      // ============================================================
      doc.fontSize(9).font('Helvetica');

      const accomValueX = 162;
      const accomWidth = 70;

      // Single line: combined total of Amman + Dead Sea accommodation
      const accomCurrency = fees.ammanCurrency || fees.deadSeaCurrency || 'USD';
      doc.font('Helvetica-Bold');
      doc.text(
        formatCurrency(fees.hotelAccommodationTotal, accomCurrency),
        accomValueX,
        453,
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

      // ============================================================
      // QR Code (if available from Fawaterkom)
      // ============================================================
      if (qrImageBuffer) {
        try {
          // Use pre-generated QR code image buffer
          doc.image(qrImageBuffer, 450, 500, {
            width: 80,
            height: 80,
          });
        } catch (qrError) {
          // Log error but don't fail PDF generation
          console.error(
            'Error adding QR code to invoice PDF:',
            qrError.message,
          );
        }
      }

      // Finalize the PDF
      doc.end();
    } catch (error) {
      reject(error);
    }
  });
};

/**
 * Submit invoice to Jordan Fawaterkom e-invoice system after payment
 * @param {number} invoiceId - Invoice ID
 * @param {number} paidAmount - Amount paid
 * @param {string} paidCurrency - Currency used for payment (JOD or USD)
 * @returns {Promise<Object>} Updated invoice with Fawaterkom response
 */
const submitToFawaterkom = async (invoiceId, paidAmount, paidCurrency) => {
  const {
    sendInvoiceToFawaterkom,
    getFawaterkomConfig,
  } = require('./jordanEinvoise.service');

  // Get invoice with registration data
  const invoice = await Invoice.findByPk(invoiceId, {
    include: [
      {
        model: Registration,
        as: 'registration',
        include: [
          {
            model: Company,
            as: 'company',
            include: [{ model: Country, as: 'country' }],
          },
        ],
      },
    ],
  });

  if (!invoice) {
    throw new Error('Invoice not found');
  }

  const fawaterkomConfig = getFawaterkomConfig();

  // Fawaterkom always uses JOD (Jordan's e-invoice system)
  const currency = 'JOD';
  const total = parseFloat(invoice.totalValueJD) || 0;

  const taxRatePercent = parseFloat(invoice.feesTaxPercentage) || 16;
  const taxRate = taxRatePercent / 100;

  const totalInclTax = parseFloat(total);
  const discountInclTax = parseFloat(invoice.totalDiscount) || 0;

  const round = (value, decimals = 9) =>
    Number(Number(value).toFixed(decimals));

  // Reverse VAT from the final total (what customer pays)
  const totalExcAfterDiscount = round(totalInclTax / (1 + taxRate));

  // Reverse VAT from discount
  const discountExc = round(discountInclTax / (1 + taxRate));

  // Original price BEFORE discount (exclusive) = after discount + discount
  const itemPriceExc = round(totalExcAfterDiscount + discountExc);

  // Tax is calculated on the amount AFTER discount
  const itemTax = round(totalExcAfterDiscount * taxRate);

  // For Fawaterkom: use document-level discount structure
  // Total = amount BEFORE discount (exclusive) - this is what TaxExclusiveAmount represents
  // TotalDiscount = discount (exclusive)
  // The XML builder calculates: TaxInclusive = Total - Discount + Tax
  const fawaterkomTotal = itemPriceExc; // Before discount
  const fawaterkomDiscount = discountExc; // Discount amount
  const fawaterkomTax = itemTax; // Tax on post-discount amount

  // Buyer name (participant name)
  const buyerName =
    `${invoice.registration?.firstName || ''} ${
      invoice.registration?.lastName || ''
    }`.trim() || 'N/A';

  const invoiceData = {
    TransactionNumber: invoice.serialNumber,
    UUID: uuidv4().toUpperCase(),
    TransactionDate: new Date().toISOString().split('T')[0],
    TransactionType: '1',
    PaymentMethod: '022', // 022 = Receivable/Credit (as per client requirement)

    TaxNumber: fawaterkomConfig.taxNumber,
    ActivityNumber: fawaterkomConfig.activityNumber,
    ClientName: fawaterkomConfig.companyName,

    // Buyer information (participant)
    BuyerName: buyerName,

    Currency: currency,

    // Fawaterkom totals - using LINE-LEVEL discount
    // Total = sum of ItemTotal (post line-discount, pre-tax)
    // TotalDiscount = 0 (discount already in line items)
    Total: totalExcAfterDiscount, // Post-discount amount (exclusive)
    TotalDiscount: 0, // No document-level discount (it's in line items)
    TotalTax: fawaterkomTax, // Tax calculated on post-discount amount
    SpecialTax: 0,

    Note: `GAIF 2026 Conference Registration - ${invoice.registration?.firstName} ${invoice.registration?.lastName}`,

    Items: [
      {
        RowNum: 1,
        ItemName: `GAIF 2026 Conference Registration Fees ${invoice.registration?.profileId}`,
        ItemQty: 1.0,

        // Original price BEFORE discount (exclusive)
        ItemSalePriceExc: itemPriceExc,

        // Line-level discount (exclusive)
        ItemDiscExc: fawaterkomDiscount,

        // Price AFTER discount (exclusive) = ItemSalePriceExc - ItemDiscExc
        ItemTotal: totalExcAfterDiscount,

        // Tax on post-discount amount
        ItemTax: fawaterkomTax,
        ItemTaxRate: taxRatePercent,
      },
    ],
  };

  // Send to Fawaterkom
  const result = await sendInvoiceToFawaterkom(invoiceData);

  console.log('result======>', result);

  // Update invoice with payment info and Fawaterkom response
  const updateData = {
    paidAmount,
    paidCurrency,
    paidAt: new Date(),
  };

  if (result.success) {
    const invoiceUUID = result.data?.EINV_INV_UUID || null;
    updateData.fawaterkomInvoiceId = invoiceUUID;
    updateData.fawaterkomStatus = 'SUBMITTED';
    updateData.qrCode = result.data?.EINV_QR || null;
  } else {
    updateData.fawaterkomStatus = 'FAILED';
    // eslint-disable-next-line no-console
    console.error(
      'Fawaterkom submission failed:',
      JSON.stringify(result.error),
    );
  }

  await Invoice.update(updateData, { where: { id: invoiceId } });

  // Return updated invoice
  let updatedInvoice = await Invoice.findByPk(invoiceId);

  // Generate and save payment receipt PDF to Files table
  try {
    // Generate PDF
    const pdfBuffer = await generatePaymentReceiptPDF(
      invoice.registration,
      updatedInvoice,
    );

    // Generate unique file key
    const fileKey = `receipt_${invoice.serialNumber}_${uuidv4()}`;
    const fileName = `GAIF_Payment_Receipt_${invoice.serialNumber}.pdf`;

    // Save PDF to Files table
    const fileRecord = await File.create({
      fileKey,
      fileName,
      fileType: 'application/pdf',
      fileSize: pdfBuffer.length,
      fileContent: pdfBuffer,
      entityType: 'Invoice',
      entityId: invoiceId,
      fieldName: 'paymentReceipt',
      isActive: true,
    });

    // Update invoice with file reference
    await Invoice.update(
      { paymentReceiptFileId: fileRecord.id },
      { where: { id: invoiceId } },
    );

    // Refresh invoice with updated file reference
    updatedInvoice = await Invoice.findByPk(invoiceId);

    // eslint-disable-next-line no-console
    console.log(`Payment receipt PDF saved to Files table: ${fileRecord.id}`);
  } catch (pdfError) {
    // Log error but don't fail - payment was already successful
    // eslint-disable-next-line no-console
    console.error('Error saving payment receipt PDF:', pdfError.message);
  }

  // Send payment receipt email to the registrant
  try {
    const {
      sendPaymentReceiptEmail,
    } = require('./registrationNotification.service');
    await sendPaymentReceiptEmail(invoice.registration, updatedInvoice);
    // eslint-disable-next-line no-console
    console.log(
      `Payment receipt email sent for registration ${invoice.registrationId}`,
    );
  } catch (emailError) {
    // Log error but don't fail - payment was already successful
    // eslint-disable-next-line no-console
    console.error('Error sending payment receipt email:', emailError.message);
  }

  return {
    invoice: updatedInvoice,
    fawaterkomResult: result,
  };
};

/**
 * Generate Payment Receipt PDF with QR code
 * Uses the same template as invoice but includes QR code and payment confirmation
 * @param {Object} registration - Registration data
 * @param {Object} invoice - Invoice data with payment info and QR code
 * @returns {Promise<Buffer>} PDF buffer
 */
const generatePaymentReceiptPDF = async (registration, invoice) => {
  const fees = {
    participationFees: parseFloat(invoice.participationFees) || 0,
    spouseFees: parseFloat(invoice.spouseFees) || 0,
    tripFees: parseFloat(invoice.tripFees) || 0,
    spouseTripFees: parseFloat(invoice.spouseTripFees) || 0,
    totalParticipationFees: parseFloat(invoice.totalParticipationFees) || 0,
    ammanTotal: parseFloat(invoice.ammanTotal) || 0,
    deadSeaTotal: parseFloat(invoice.deadSeaTotal) || 0,
    hotelAccommodationTotal: parseFloat(invoice.hotelAccommodationTotal) || 0,
    totalDiscount: parseFloat(invoice.totalDiscount) || 0,
    totalValueJD: parseFloat(invoice.totalValueJD) || 0,
    totalValueUSD: parseFloat(invoice.totalValueUSD) || 0,
    feesTaxAmount: parseFloat(invoice.feesTaxAmount) || 0,
    participationCurrency: invoice.participationCurrency || 'USD',
    spouseCurrency: invoice.spouseCurrency || 'USD',
    tripCurrency: invoice.tripCurrency || 'USD',
    spouseTripCurrency: invoice.spouseTripCurrency || 'USD',
    ammanCurrency: invoice.ammanCurrency || 'USD',
    deadSeaCurrency: invoice.deadSeaCurrency || 'USD',
  };

  // Generate QR code image buffer
  // Priority: verificationUrl (opens Fawaterkom portal), fallback to qrCode (TLV data)
  let qrImageBuffer = null;
  const qrData = invoice.qrCode;
  if (qrData) {
    try {
      qrImageBuffer = await QRCode.toBuffer(qrData, {
        type: 'png',
        width: 150,
        margin: 1,
        errorCorrectionLevel: 'M',
      });
    } catch (qrErr) {
      // eslint-disable-next-line no-console
      console.error('Error generating QR code:', qrErr.message);
    }
  }

  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({
        size: 'A4',
        margin: 0,
        bufferPages: true,
        info: {
          Title: `GAIF Payment Receipt - ${registration.id}`,
          Author: 'GAIF 2026',
        },
      });

      const chunks = [];
      doc.on('data', chunk => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      // Add template as background (same as invoice but different image)
      doc.image(PAYMENT_RECEIPT_TEMPLATE_PATH, 0, 0, {
        width: 595.28, // A4 width in points
        height: 841.89, // A4 height in points
      });

      // Set font color for all text (dark gray)
      const textColor = '#333333';
      doc.fillColor(textColor);

      // ============================================================
      // HEADER SECTION - Same positions as invoice
      // ============================================================
      doc.fontSize(10).font('Helvetica');

      // SERIAL NUMBER value
      doc.text(invoice.serialNumber || '', 40, 130, { width: 200 });

      // TAX NUMBER value
      const taxNumber = invoice.taxNumber || config.taxNumber;
      if (taxNumber) {
        doc.text(`${taxNumber}`, 450, 130, { width: 200 });
      }

      // PARTICIPANT'S NAME value
      const participantName = `${registration.firstName || ''} ${
        registration.middleName || ''
      } ${registration.lastName || ''}`.trim();
      doc.text(participantName, 42, 183, { width: 200 });

      // REGISTRATION ID value (center column) — use profileId
      const registrationDisplayId = registration.profileId || registration.id;
      doc.text(registrationDisplayId.toString(), 346, 183, { width: 80 });

      // REGISTRATION DATE value (right column)
      const registrationDate = moment(registration.createdAt).format(
        'DD/MM/YYYY',
      );
      doc.text(registrationDate, 450, 183, { width: 90 });

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
      // doc.text(
      //   formatCurrency(fees.tripFees, fees.tripCurrency || 'USD'),
      //   feeValueX,
      //   360,
      //   { width: feeWidth, align: 'right' },
      // );

      // Spouse – Trip fees
      // doc.text(
      //   formatCurrency(fees.spouseTripFees, fees.spouseTripCurrency || 'USD'),
      //   feeValueX,
      //   391,
      //   { width: feeWidth, align: 'right' },
      // );

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
        355,
        {
          width: feeWidth,
          align: 'right',
        },
      );

      // ============================================================
      // ACCOMMODATION section (right column)
      // ============================================================
      doc.fontSize(9).font('Helvetica');

      const accomValueX = 162;
      const accomWidth = 70;

      // Single line: combined total of Amman + Dead Sea accommodation
      const accomCurrency = fees.ammanCurrency || fees.deadSeaCurrency || 'USD';
      doc.font('Helvetica-Bold');
      doc.text(
        formatCurrency(fees.hotelAccommodationTotal, accomCurrency),
        accomValueX,
        453,
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

      // ============================================================
      // QR Code (bottom right area)
      // ============================================================
      if (qrImageBuffer) {
        try {
          // Use pre-generated QR code image buffer
          doc.image(qrImageBuffer, 420, 750, {
            width: 80,
            height: 80,
          });
        } catch (qrError) {
          // eslint-disable-next-line no-console
          console.error('Error adding QR code to PDF:', qrError.message);
        }
      }

      // Finalize the PDF
      doc.end();
    } catch (error) {
      reject(error);
    }
  });
};

/**
 * Get list of invoices with filters for admin
 * Returns only the latest invoice per registration
 * @param {Object} filters - Filter options
 * @returns {Promise<Object>} Paginated invoice list
 */
const getInvoiceList = async (filters = {}) => {
  const {
    profileId,
    companyId,
    firstName,
    middleName,
    lastName,
    dateFrom,
    dateTo,
    balanceFilter, // 'all', 'zero', 'hasBalance'
    page = 1,
    limit = 20,
  } = filters;

  // Build registration where clause
  const registrationWhere = {
    registrationStatus: { [Op.in]: ['SUBMITTED', 'CONFIRMED'] },
  };

  if (profileId) {
    registrationWhere.profileId = profileId;
  }

  if (companyId) {
    registrationWhere.companyId = companyId;
  }

  if (firstName) {
    registrationWhere[Op.and] = registrationWhere[Op.and] || [];
    registrationWhere[Op.and].push(
      sequelize.where(
        sequelize.fn('UPPER', sequelize.col('registration.firstName')),
        { [Op.like]: `%${firstName.toUpperCase()}%` },
      ),
    );
  }

  if (middleName) {
    registrationWhere[Op.and] = registrationWhere[Op.and] || [];
    registrationWhere[Op.and].push(
      sequelize.where(
        sequelize.fn('UPPER', sequelize.col('registration.middleName')),
        { [Op.like]: `%${middleName.toUpperCase()}%` },
      ),
    );
  }

  if (lastName) {
    registrationWhere[Op.and] = registrationWhere[Op.and] || [];
    registrationWhere[Op.and].push(
      sequelize.where(
        sequelize.fn('UPPER', sequelize.col('registration.lastName')),
        { [Op.like]: `%${lastName.toUpperCase()}%` },
      ),
    );
  }

  // Build invoice where clause
  const invoiceWhere = {
    invoiceStatus: { [Op.ne]: 'CANCELLED' },
  };

  if (dateFrom || dateTo) {
    invoiceWhere.createdAt = {};
    if (dateFrom) {
      invoiceWhere.createdAt[Op.gte] = new Date(dateFrom);
    }
    if (dateTo) {
      const endDate = new Date(dateTo);
      endDate.setHours(23, 59, 59, 999);
      invoiceWhere.createdAt[Op.lte] = endDate;
    }
  }

  // Balance filter
  if (balanceFilter === 'zero') {
    invoiceWhere.balance = 0;
  } else if (balanceFilter === 'hasBalance') {
    invoiceWhere.balance = { [Op.ne]: 0 };
  }

  // Get all matching invoices with registration data
  const offset = (page - 1) * limit;

  // First, get registration IDs that match the filters
  // Then get the latest invoice for each registration
  const invoices = await Invoice.findAll({
    where: invoiceWhere,
    include: [
      {
        model: Registration,
        as: 'registration',
        where: registrationWhere,
        required: true,
        include: [
          {
            model: Company,
            as: 'company',
            include: [{ model: Country, as: 'country' }],
          },
          {
            model: Country,
            as: 'nationality',
          },
          {
            model: ParticipationType,
            as: 'participation',
          },
          {
            model: Spouse,
            as: 'spouse',
          },
        ],
      },
    ],
    order: [['createdAt', 'DESC']],
  });

  // Group by registrationId and keep only the latest invoice
  const latestInvoicesByRegistration = {};
  invoices.forEach(invoice => {
    const regId = invoice.registrationId;
    if (
      !latestInvoicesByRegistration[regId] ||
      invoice.createdAt > latestInvoicesByRegistration[regId].createdAt
    ) {
      latestInvoicesByRegistration[regId] = invoice;
    }
  });

  const uniqueInvoices = Object.values(latestInvoicesByRegistration);

  // Apply pagination
  const totalCount = uniqueInvoices.length;
  const paginatedInvoices = uniqueInvoices.slice(offset, offset + limit);

  // Format response with all fee items
  const formattedInvoices = paginatedInvoices.map(invoice => {
    const reg = invoice.registration;
    return {
      invoiceId: invoice.id,
      serialNumber: invoice.serialNumber,
      registrationId: invoice.registrationId,
      profileId: reg?.profileId,
      // Participant info
      firstName: reg?.firstName,
      middleName: reg?.middleName,
      lastName: reg?.lastName,
      fullName: `${reg?.firstName || ''} ${reg?.middleName || ''} ${
        reg?.lastName || ''
      }`.trim(),
      email: reg?.email,
      // Company info
      companyId: reg?.companyId,
      companyName: reg?.company?.name,
      companyCountry: reg?.company?.country?.name,
      // Participation type
      participationType: reg?.participation?.title,
      // Fee items with discounts
      items: {
        participation: {
          fees: parseFloat(invoice.participationFees) || 0,
          discount: parseFloat(invoice.participationDiscount) || 0,
          disclosure: invoice.participationDisclosure,
          payment:
            (parseFloat(invoice.participationFees) || 0) -
            (parseFloat(invoice.participationDiscount) || 0),
          currency: invoice.participationCurrency || 'USD',
        },
        spouse: {
          fees: parseFloat(invoice.spouseFees) || 0,
          discount: parseFloat(invoice.spouseDiscount) || 0,
          disclosure: invoice.spouseDisclosure,
          payment:
            (parseFloat(invoice.spouseFees) || 0) -
            (parseFloat(invoice.spouseDiscount) || 0),
          currency: invoice.spouseCurrency || 'USD',
        },
        trip: {
          fees: parseFloat(invoice.tripFees) || 0,
          discount: parseFloat(invoice.tripDiscount) || 0,
          disclosure: invoice.tripDisclosure,
          payment:
            (parseFloat(invoice.tripFees) || 0) -
            (parseFloat(invoice.tripDiscount) || 0),
          currency: invoice.tripCurrency || 'USD',
        },
        spouseTrip: {
          fees: parseFloat(invoice.spouseTripFees) || 0,
          discount: parseFloat(invoice.spouseTripDiscount) || 0,
          disclosure: invoice.spouseTripDisclosure,
          payment:
            (parseFloat(invoice.spouseTripFees) || 0) -
            (parseFloat(invoice.spouseTripDiscount) || 0),
          currency: invoice.spouseTripCurrency || 'USD',
        },
        amman: {
          fees: parseFloat(invoice.ammanTotal) || 0,
          discount: parseFloat(invoice.ammanDiscount) || 0,
          disclosure: invoice.ammanDisclosure,
          payment:
            (parseFloat(invoice.ammanTotal) || 0) -
            (parseFloat(invoice.ammanDiscount) || 0),
          currency: invoice.ammanCurrency || 'USD',
        },
        deadSea: {
          fees: parseFloat(invoice.deadSeaTotal) || 0,
          discount: parseFloat(invoice.deadSeaDiscount) || 0,
          disclosure: invoice.deadSeaDisclosure,
          payment:
            (parseFloat(invoice.deadSeaTotal) || 0) -
            (parseFloat(invoice.deadSeaDiscount) || 0),
          currency: invoice.deadSeaCurrency || 'USD',
        },
      },
      // Totals
      totalFees: parseFloat(invoice.totalValueJD) || 0,
      totalDiscount: parseFloat(invoice.totalDiscount) || 0,
      totalPayment:
        (parseFloat(invoice.totalValueJD) || 0) -
        (parseFloat(invoice.totalDiscount) || 0),
      balance: parseFloat(invoice.balance) || 0,
      // Payment info
      paidAmount: parseFloat(invoice.paidAmount) || 0,
      paidCurrency: invoice.paidCurrency,
      paidAt: invoice.paidAt,
      paymentSource: invoice.paymentSource,
      paymentStatus: reg?.paymentStatus,
      // Invoice status
      invoiceStatus: invoice.invoiceStatus,
      fawaterkomStatus: invoice.fawaterkomStatus,
      // Dates
      createdAt: invoice.createdAt,
      updatedAt: invoice.updatedAt,
    };
  });

  return {
    invoices: formattedInvoices,
    pagination: {
      total: totalCount,
      page,
      limit,
      totalPages: Math.ceil(totalCount / limit),
    },
  };
};

/**
 * Get invoice by ID with full details
 * @param {number} invoiceId - Invoice ID
 * @returns {Promise<Object>} Invoice with registration details
 */
const getInvoiceById = async invoiceId => {
  const invoice = await Invoice.findByPk(invoiceId, {
    include: [
      {
        model: Registration,
        as: 'registration',
        include: [
          {
            model: Company,
            as: 'company',
            include: [{ model: Country, as: 'country' }],
          },
          { model: Country, as: 'nationality' },
          { model: ParticipationType, as: 'participation' },
          { model: Spouse, as: 'spouse' },
        ],
      },
    ],
  });

  return invoice;
};

/**
 * Admin Save Invoice - Consolidated function that handles:
 * - Update discounts and disclosures for each item
 * - Update paid status for each item
 * - Calculate totals and balance
 * - Process Fawaterkom if needed (for newly paid items or if already paid and changed)
 * - Generate receipt
 * - Send confirmation email
 * @param {number} invoiceId - Invoice ID
 * @param {Object} data - All invoice update data
 * @returns {Promise<Object>} Result with updated invoice and status
 */
const adminSaveInvoice = async (invoiceId, data) => {
  const {
    // Discounts
    participationDiscount = 0,
    participationDisclosure,
    spouseDiscount = 0,
    spouseDisclosure,
    tripDiscount = 0,
    tripDisclosure,
    spouseTripDiscount = 0,
    spouseTripDisclosure,
    ammanDiscount = 0,
    ammanDisclosure,
    deadSeaDiscount = 0,
    deadSeaDisclosure,
    // Paid status for each item
    participationPaid = false,
    spousePaid = false,
    tripPaid = false,
    spouseTripPaid = false,
    ammanPaid = false,
    deadSeaPaid = false,
    // Options
    sendEmail = false,
  } = data;

  // Get current invoice with registration
  const currentInvoice = await getInvoiceById(invoiceId);
  if (!currentInvoice) {
    throw new Error('Invoice not found');
  }

  const registration = currentInvoice.registration;
  if (!registration) {
    throw new Error('Registration not found for this invoice');
  }

  // Check previous paid states to detect changes
  const wasPreviouslyPaid = currentInvoice.paidAt !== null;
  const previousPaidItems = {
    participation: currentInvoice.participationPaid || false,
    spouse: currentInvoice.spousePaid || false,
    trip: currentInvoice.tripPaid || false,
    spouseTrip: currentInvoice.spouseTripPaid || false,
    amman: currentInvoice.ammanPaid || false,
    deadSea: currentInvoice.deadSeaPaid || false,
  };

  // Calculate amounts after discount for each item
  const participationAmount = Math.max(
    0,
    (parseFloat(currentInvoice.participationFees) || 0) -
      parseFloat(participationDiscount),
  );
  const spouseAmount = Math.max(
    0,
    (parseFloat(currentInvoice.spouseFees) || 0) - parseFloat(spouseDiscount),
  );
  const tripAmount = Math.max(
    0,
    (parseFloat(currentInvoice.tripFees) || 0) - parseFloat(tripDiscount),
  );
  const spouseTripAmount = Math.max(
    0,
    (parseFloat(currentInvoice.spouseTripFees) || 0) -
      parseFloat(spouseTripDiscount),
  );
  const ammanAmount = Math.max(
    0,
    (parseFloat(currentInvoice.ammanTotal) || 0) - parseFloat(ammanDiscount),
  );
  const deadSeaAmount = Math.max(
    0,
    (parseFloat(currentInvoice.deadSeaTotal) || 0) -
      parseFloat(deadSeaDiscount),
  );

  // Calculate total discount
  const totalDiscountAmount =
    parseFloat(participationDiscount) +
    parseFloat(spouseDiscount) +
    parseFloat(tripDiscount) +
    parseFloat(spouseTripDiscount) +
    parseFloat(ammanDiscount) +
    parseFloat(deadSeaDiscount);

  // Calculate total fees (original amounts)
  const totalFees =
    (parseFloat(currentInvoice.participationFees) || 0) +
    (parseFloat(currentInvoice.spouseFees) || 0) +
    (parseFloat(currentInvoice.tripFees) || 0) +
    (parseFloat(currentInvoice.spouseTripFees) || 0) +
    (parseFloat(currentInvoice.ammanTotal) || 0) +
    (parseFloat(currentInvoice.deadSeaTotal) || 0);

  // Calculate paid amount (sum of items marked as paid, after discounts)
  const paidAmount =
    (participationPaid ? participationAmount : 0) +
    (spousePaid ? spouseAmount : 0) +
    (tripPaid ? tripAmount : 0) +
    (spouseTripPaid ? spouseTripAmount : 0) +
    (ammanPaid ? ammanAmount : 0) +
    (deadSeaPaid ? deadSeaAmount : 0);

  // Calculate new total after discount
  const newTotalJD = Math.max(0, totalFees - totalDiscountAmount);
  const newTotalUSD =
    Math.round((newTotalJD / INVOICE_CONFIG.exchangeRate) * 100) / 100;

  // Calculate balance (total after discount - paid amount)
  const balance = newTotalJD - paidAmount;

  // Check if all items are paid
  const allItemsPaid =
    participationPaid &&
    spousePaid &&
    tripPaid &&
    spouseTripPaid &&
    ammanPaid &&
    deadSeaPaid;

  // Check if any item is newly paid
  const hasNewlyPaidItems =
    (participationPaid && !previousPaidItems.participation) ||
    (spousePaid && !previousPaidItems.spouse) ||
    (tripPaid && !previousPaidItems.trip) ||
    (spouseTripPaid && !previousPaidItems.spouseTrip) ||
    (ammanPaid && !previousPaidItems.amman) ||
    (deadSeaPaid && !previousPaidItems.deadSea);

  // Determine if we need to process Fawaterkom
  const needsFawaterkom = hasNewlyPaidItems && paidAmount > 0;
  const needsReverse = wasPreviouslyPaid && hasNewlyPaidItems;

  // Update invoice with all data
  const updateData = {
    // Discounts
    participationDiscount,
    participationDisclosure,
    spouseDiscount,
    spouseDisclosure,
    tripDiscount,
    tripDisclosure,
    spouseTripDiscount,
    spouseTripDisclosure,
    ammanDiscount,
    ammanDisclosure,
    deadSeaDiscount,
    deadSeaDisclosure,
    // Paid status
    participationPaid,
    spousePaid,
    tripPaid,
    spouseTripPaid,
    ammanPaid,
    deadSeaPaid,
    // Totals
    totalDiscount: totalDiscountAmount,
    totalValueJD: newTotalJD,
    totalValueUSD: newTotalUSD,
    paidAmount,
    balance,
  };

  // If any payment is made, mark payment details
  if (paidAmount > 0) {
    updateData.paidCurrency = 'JOD';
    updateData.paymentSource = 'SYSTEM';
    if (!currentInvoice.paidAt) {
      updateData.paidAt = new Date();
    }
  }

  await Invoice.update(updateData, { where: { id: invoiceId } });

  // Update registration payment status based on balance
  if (balance === 0 && paidAmount > 0) {
    await Registration.update(
      { paymentStatus: 'PAID' },
      { where: { id: registration.id } },
    );
  } else if (paidAmount > 0 && balance > 0) {
    await Registration.update(
      { paymentStatus: 'PARTIAL' },
      { where: { id: registration.id } },
    );
  }

  let fawaterkomResult = null;
  let reverseResult = null;

  // Handle Fawaterkom submission
  if (needsFawaterkom) {
    // If was previously paid and needs changes, reverse first
    if (needsReverse && currentInvoice.fawaterkomInvoiceId) {
      try {
        reverseResult = await reverseFawaterkomInvoice(invoiceId);
      } catch (reverseError) {
        console.error(
          'Error reversing Fawaterkom invoice:',
          reverseError.message,
        );
      }
    }

    // Submit new/updated invoice to Fawaterkom
    try {
      fawaterkomResult = await submitToFawaterkom(invoiceId, paidAmount, 'JOD');
    } catch (fawaterkomError) {
      console.error('Error submitting to Fawaterkom:', fawaterkomError.message);
      fawaterkomResult = { success: false, error: fawaterkomError.message };
    }
  }

  // Get updated invoice
  const updatedInvoice = await getInvoiceById(invoiceId);

  // Send confirmation email if requested and payment was made
  let emailResult = null;
  if (sendEmail && paidAmount > 0) {
    try {
      emailResult = await sendInvoiceConfirmationEmail(invoiceId);
    } catch (emailError) {
      console.error('Error sending confirmation email:', emailError.message);
      emailResult = { success: false, error: emailError.message };
    }
  }

  return {
    success: true,
    invoice: updatedInvoice,
    summary: {
      totalFees,
      totalDiscount: totalDiscountAmount,
      totalAfterDiscount: newTotalJD,
      paidAmount,
      balance,
      allItemsPaid,
    },
    items: {
      participation: {
        fees: parseFloat(currentInvoice.participationFees) || 0,
        discount: parseFloat(participationDiscount),
        payment: participationAmount,
        paid: participationPaid,
      },
      spouse: {
        fees: parseFloat(currentInvoice.spouseFees) || 0,
        discount: parseFloat(spouseDiscount),
        payment: spouseAmount,
        paid: spousePaid,
      },
      trip: {
        fees: parseFloat(currentInvoice.tripFees) || 0,
        discount: parseFloat(tripDiscount),
        payment: tripAmount,
        paid: tripPaid,
      },
      spouseTrip: {
        fees: parseFloat(currentInvoice.spouseTripFees) || 0,
        discount: parseFloat(spouseTripDiscount),
        payment: spouseTripAmount,
        paid: spouseTripPaid,
      },
      amman: {
        fees: parseFloat(currentInvoice.ammanTotal) || 0,
        discount: parseFloat(ammanDiscount),
        payment: ammanAmount,
        paid: ammanPaid,
      },
      deadSea: {
        fees: parseFloat(currentInvoice.deadSeaTotal) || 0,
        discount: parseFloat(deadSeaDiscount),
        payment: deadSeaAmount,
        paid: deadSeaPaid,
      },
    },
    fawaterkomResult,
    reverseResult,
    emailResult,
  };
};

/**
 * Process payment for invoice with discount (for unpaid invoices)
 * Creates new invoice, marks as paid, submits to Fawaterkom
 * @param {number} invoiceId - Invoice ID
 * @returns {Promise<Object>} Result with receipt and QR code
 */
const processInvoicePayment = async invoiceId => {
  const invoice = await getInvoiceById(invoiceId);
  if (!invoice) {
    throw new Error('Invoice not found');
  }

  const registration = invoice.registration;
  if (!registration) {
    throw new Error('Registration not found');
  }

  // Get the amount after discount
  const totalAfterDiscount = parseFloat(invoice.totalValueJD) || 0;

  // Update registration payment status
  await Registration.update(
    { paymentStatus: 'PAID' },
    { where: { id: registration.id } },
  );

  // Submit to Fawaterkom and generate receipt
  const result = await submitToFawaterkom(invoiceId, totalAfterDiscount, 'JOD');

  // Update invoice with payment source
  await Invoice.update(
    {
      paymentSource: 'SYSTEM',
      balance: 0,
    },
    { where: { id: invoiceId } },
  );

  return {
    success: true,
    invoice: result.invoice,
    fawaterkomResult: result.fawaterkomResult,
  };
};

/**
 * Reverse Fawaterkom invoice and create credit note
 * For when user has already paid and gets a discount (refund scenario)
 * @param {number} invoiceId - Original invoice ID
 * @returns {Promise<Object>} Result with reversal status
 */
const reverseFawaterkomInvoice = async invoiceId => {
  const {
    reverseInvoiceToFawaterkom,
    getFawaterkomConfig,
  } = require('./jordanEinvoise.service');

  const invoice = await getInvoiceById(invoiceId);
  if (!invoice) {
    throw new Error('Invoice not found');
  }

  if (!invoice.fawaterkomInvoiceId) {
    // No Fawaterkom invoice to reverse
    return { success: false, message: 'No Fawaterkom invoice to reverse' };
  }

  const fawaterkomConfig = getFawaterkomConfig();

  // Calculate the refund amount (balance will be negative if overpaid)
  const refundAmount =
    parseFloat(invoice.balance) < 0 ? Math.abs(parseFloat(invoice.balance)) : 0;

  if (refundAmount <= 0) {
    return { success: false, message: 'No refund amount to process' };
  }

  // Create credit note data
  const creditNoteData = {
    TransactionNumber: `CN-${invoice.serialNumber}`,
    UUID: uuidv4().toUpperCase(),
    TransactionDate: new Date().toISOString().split('T')[0],
    TransactionType: '2', // Credit note
    PaymentMethod: '022',
    OriginalInvoiceUUID: invoice.fawaterkomInvoiceId,

    TaxNumber: fawaterkomConfig.taxNumber,
    ActivityNumber: fawaterkomConfig.activityNumber,
    ClientName: fawaterkomConfig.companyName,

    BuyerName:
      `${invoice.registration?.firstName || ''} ${
        invoice.registration?.lastName || ''
      }`.trim() || 'N/A',

    Currency: 'JOD',
    Total: refundAmount,
    TotalDiscount: 0,
    TotalTax: 0,
    SpecialTax: 0,

    Note: `Credit note for GAIF 2026 - Discount applied to Invoice ${invoice.serialNumber}`,

    Items: [
      {
        RowNum: 1,
        ItemName: 'Discount/Refund',
        ItemQty: 1.0,
        ItemSalePriceExc: refundAmount,
        ItemDiscExc: 0,
        ItemTotal: refundAmount,
        ItemTax: 0,
        ItemTaxRate: 0,
      },
    ],
  };

  // Send credit note (reverse invoice) to Fawaterkom
  const result = await reverseInvoiceToFawaterkom(creditNoteData);

  if (result.success) {
    // Update invoice with reversal info
    await Invoice.update(
      {
        invoiceStatus: 'REVERSED',
        refundAmount,
      },
      { where: { id: invoiceId } },
    );
  }

  return result;
};

/**
 * Send confirmation email for invoice
 * @param {number} invoiceId - Invoice ID
 * @returns {Promise<Object>} Email send result
 */
const sendInvoiceConfirmationEmail = async invoiceId => {
  const invoice = await getInvoiceById(invoiceId);
  if (!invoice || !invoice.registration) {
    throw new Error('Invoice or registration not found');
  }

  const {
    sendPaymentReceiptEmail,
  } = require('./registrationNotification.service');
  await sendPaymentReceiptEmail(invoice.registration, invoice);

  return { success: true, message: 'Confirmation email sent' };
};

module.exports = {
  INVOICE_CONFIG,
  calculateFees,
  formatCurrency,
  getNextSerialNumber,
  createInvoice,
  createVersionedInvoice,
  getInvoiceByRegistrationId,
  getInvoicesByRegistrationId,
  generateInvoicePDF,
  generatePaymentReceiptPDF,
  submitToFawaterkom,
  // Admin functions
  getInvoiceList,
  getInvoiceById,
  adminSaveInvoice,
  processInvoicePayment,
  reverseFawaterkomInvoice,
  sendInvoiceConfirmationEmail,
};
