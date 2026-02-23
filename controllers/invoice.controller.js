const httpStatus = require('http-status');
const catchAsync = require('../utils/catchAsync');
const invoiceService = require('../services/invoice.service');
const registrationNotificationService = require('../services/registrationNotification.service');

/**
 * Get list of invoices with filters
 * GET /api/v1/invoice/list
 */
const getInvoiceList = catchAsync(async (req, res) => {
  const filters = {
    profileId: req.query.profileId,
    companyId: req.query.companyId,
    firstName: req.query.firstName,
    middleName: req.query.middleName,
    lastName: req.query.lastName,
    dateFrom: req.query.dateFrom,
    dateTo: req.query.dateTo,
    balanceFilter: req.query.balanceFilter,
    page: parseInt(req.query.page, 10) || 1,
    limit: parseInt(req.query.limit, 10) || 20,
    exportAll: req.query.exportAll === 'true', // Flag to return all data without pagination
  };

  const result = await invoiceService.getInvoiceList(filters);
  res.status(httpStatus.OK).send(result);
});

/**
 * Get invoice by ID
 * GET /api/v1/invoice/:id
 */
const getInvoiceById = catchAsync(async (req, res) => {
  const { id } = req.params;
  const invoice = await invoiceService.getInvoiceById(parseInt(id, 10));

  if (!invoice) {
    return res
      .status(httpStatus.NOT_FOUND)
      .json({ message: 'Invoice not found' });
  }

  // Format invoice for response
  const reg = invoice.registration;
  const formattedInvoice = {
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
    // Fee items with discounts and paid status
    items: {
      participation: {
        fees: parseFloat(invoice.participationFees) || 0,
        discount: parseFloat(invoice.participationDiscount) || 0,
        disclosure: invoice.participationDisclosure,
        payment:
          (parseFloat(invoice.participationFees) || 0) -
          (parseFloat(invoice.participationDiscount) || 0),
        paid: invoice.participationPaid || false,
        currency: invoice.participationCurrency || 'USD',
      },
      spouse: {
        fees: parseFloat(invoice.spouseFees) || 0,
        discount: parseFloat(invoice.spouseDiscount) || 0,
        disclosure: invoice.spouseDisclosure,
        payment:
          (parseFloat(invoice.spouseFees) || 0) -
          (parseFloat(invoice.spouseDiscount) || 0),
        paid: invoice.spousePaid || false,
        currency: invoice.spouseCurrency || 'USD',
      },
      trip: {
        fees: parseFloat(invoice.tripFees) || 0,
        discount: parseFloat(invoice.tripDiscount) || 0,
        disclosure: invoice.tripDisclosure,
        payment:
          (parseFloat(invoice.tripFees) || 0) -
          (parseFloat(invoice.tripDiscount) || 0),
        paid: invoice.tripPaid || false,
        currency: invoice.tripCurrency || 'USD',
      },
      spouseTrip: {
        fees: parseFloat(invoice.spouseTripFees) || 0,
        discount: parseFloat(invoice.spouseTripDiscount) || 0,
        disclosure: invoice.spouseTripDisclosure,
        payment:
          (parseFloat(invoice.spouseTripFees) || 0) -
          (parseFloat(invoice.spouseTripDiscount) || 0),
        paid: invoice.spouseTripPaid || false,
        currency: invoice.spouseTripCurrency || 'USD',
      },
      amman: {
        fees: parseFloat(invoice.ammanTotal) || 0,
        discount: parseFloat(invoice.ammanDiscount) || 0,
        disclosure: invoice.ammanDisclosure,
        payment:
          (parseFloat(invoice.ammanTotal) || 0) -
          (parseFloat(invoice.ammanDiscount) || 0),
        paid: invoice.ammanPaid || false,
        currency: invoice.ammanCurrency || 'USD',
      },
      deadSea: {
        fees: parseFloat(invoice.deadSeaTotal) || 0,
        discount: parseFloat(invoice.deadSeaDiscount) || 0,
        disclosure: invoice.deadSeaDisclosure,
        payment:
          (parseFloat(invoice.deadSeaTotal) || 0) -
          (parseFloat(invoice.deadSeaDiscount) || 0),
        paid: invoice.deadSeaPaid || false,
        currency: invoice.deadSeaCurrency || 'USD',
      },
    },
    // Totals
    totalFees:
      (parseFloat(invoice.participationFees) || 0) +
      (parseFloat(invoice.spouseFees) || 0) +
      (parseFloat(invoice.tripFees) || 0) +
      (parseFloat(invoice.spouseTripFees) || 0) +
      (parseFloat(invoice.ammanTotal) || 0) +
      (parseFloat(invoice.deadSeaTotal) || 0),
    totalDiscount: parseFloat(invoice.totalDiscount) || 0,
    totalPayment: parseFloat(invoice.totalValueJD) || 0,
    paidAmount: parseFloat(invoice.paidAmount) || 0,
    balance: parseFloat(invoice.balance) || 0,
    // Payment info
    paidCurrency: invoice.paidCurrency,
    paidAt: invoice.paidAt,
    paymentSource: invoice.paymentSource,
    paymentStatus: reg?.paymentStatus,
    // Invoice status
    invoiceStatus: invoice.invoiceStatus,
    fawaterkomStatus: invoice.fawaterkomStatus,
    qrCode: invoice.qrCode,
    // Dates
    createdAt: invoice.createdAt,
    updatedAt: invoice.updatedAt,
  };

  return res.status(httpStatus.OK).send(formattedInvoice);
});

/**
 * Admin Save Invoice - Consolidated endpoint that handles:
 * - Update discounts and disclosures for each item
 * - Update paid status for each item
 * - Calculate totals and balance
 * - Process Fawaterkom if needed
 * - Generate receipt
 * - Send confirmation email
 * POST /api/v1/invoice/:id/save
 */
const adminSaveInvoice = catchAsync(async (req, res) => {
  const { id } = req.params;
  const data = req.body;

  const result = await invoiceService.adminSaveInvoice(parseInt(id, 10), data);
  res.status(httpStatus.OK).send(result);
});

/**
 * Generate and download invoice PDF
 * GET /api/v1/invoice/:id/pdf
 */
const downloadInvoicePDF = catchAsync(async (req, res) => {
  const { id } = req.params;

  const invoice = await invoiceService.getInvoiceById(parseInt(id, 10));
  if (!invoice || !invoice.registration) {
    return res
      .status(httpStatus.NOT_FOUND)
      .json({ message: 'Invoice or registration not found' });
  }

  const pdfBuffer = await invoiceService.generateInvoicePDF(
    invoice.registration,
    invoice,
  );

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader(
    'Content-Disposition',
    `attachment; filename=pre_invoice_${invoice.serialNumber}.pdf`,
  );
  return res.send(pdfBuffer);
});

/**
 * Generate and download payment receipt PDF
 * GET /api/v1/invoice/:id/receipt
 */
const downloadReceiptPDF = catchAsync(async (req, res) => {
  const { id } = req.params;

  const invoice = await invoiceService.getInvoiceById(parseInt(id, 10));
  if (!invoice || !invoice.registration) {
    return res
      .status(httpStatus.NOT_FOUND)
      .json({ message: 'Invoice or registration not found' });
  }

  if (!invoice.paidAt) {
    return res
      .status(httpStatus.BAD_REQUEST)
      .json({ message: 'Invoice has not been paid yet' });
  }

  const pdfBuffer = await invoiceService.generatePaymentReceiptPDF(
    invoice.registration,
    invoice,
  );

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader(
    'Content-Disposition',
    `attachment; filename=invoice_${invoice.serialNumber}.pdf`,
  );
  return res.send(pdfBuffer);
});

/**
 * Resend confirmation email to a registration
 * POST /api/v1/invoice/:id/resend-email
 */
const resendConfirmationEmail = catchAsync(async (req, res) => {
  const { id } = req.params;

  // Get the invoice to find the registration ID
  const invoice = await invoiceService.getInvoiceById(parseInt(id, 10));
  if (!invoice) {
    return res
      .status(httpStatus.NOT_FOUND)
      .json({ message: 'Invoice not found' });
  }

  const result = await registrationNotificationService.resendConfirmationEmail(
    invoice.registrationId,
  );

  res.status(httpStatus.OK).send(result);
});

module.exports = {
  getInvoiceList,
  getInvoiceById,
  adminSaveInvoice,
  downloadInvoicePDF,
  downloadReceiptPDF,
  resendConfirmationEmail,
};
