const httpStatus = require('http-status');
const catchAsync = require('../utils/catchAsync');
const ApiError = require('../utils/ApiError');
const companyInvoiceService = require('../services/companyInvoice.service');
const registrationTokenService = require('../services/registrationToken.service');

/**
 * Create a company invoice
 * POST /api/v1/company-invoice
 */
const createCompanyInvoice = catchAsync(async (req, res) => {
  const data = req.body;
  const userId = req.user.id;
  const sendEmail = data.sendEmail !== false; // Default to true

  const result = await companyInvoiceService.createAndSendCompanyInvoice(
    data,
    userId,
    sendEmail,
  );

  res.status(httpStatus.CREATED).send(result);
});

/**
 * Get company invoice by ID
 * GET /api/v1/company-invoice/:id
 */
const getCompanyInvoiceById = catchAsync(async (req, res) => {
  const { id } = req.params;
  const invoice = await companyInvoiceService.getCompanyInvoiceById(
    parseInt(id, 10),
  );

  if (!invoice) {
    return res
      .status(httpStatus.NOT_FOUND)
      .json({ message: 'Invoice not found' });
  }

  return res.status(httpStatus.OK).send(invoice);
});

/**
 * Get all invoices for a company
 * GET /api/v1/company-invoice/company/:companyId
 */
const getCompanyInvoices = catchAsync(async (req, res) => {
  const { companyId } = req.params;
  const invoices = await companyInvoiceService.getCompanyInvoices(
    parseInt(companyId, 10),
  );

  res.status(httpStatus.OK).send(invoices);
});

/**
 * Get company invoice list with filters
 * GET /api/v1/company-invoice/list
 */
const getCompanyInvoiceList = catchAsync(async (req, res) => {
  const filters = {
    companyId: req.query.companyId
      ? parseInt(req.query.companyId, 10)
      : undefined,
    status: req.query.status,
    dateFrom: req.query.dateFrom,
    dateTo: req.query.dateTo,
    page: parseInt(req.query.page, 10) || 1,
    limit: parseInt(req.query.limit, 10) || 20,
  };

  const result = await companyInvoiceService.getCompanyInvoiceList(filters);
  res.status(httpStatus.OK).send(result);
});

/**
 * Update company invoice
 * PUT /api/v1/company-invoice/:id
 */
const updateCompanyInvoice = catchAsync(async (req, res) => {
  const { id } = req.params;
  const data = req.body;

  const invoice = await companyInvoiceService.updateCompanyInvoice(
    parseInt(id, 10),
    data,
  );

  if (!invoice) {
    return res
      .status(httpStatus.NOT_FOUND)
      .json({ message: 'Invoice not found' });
  }

  return res.status(httpStatus.OK).send(invoice);
});

/**
 * Download company invoice PDF
 * GET /api/v1/company-invoice/:id/pdf
 */
const downloadCompanyInvoicePDF = catchAsync(async (req, res) => {
  const { id } = req.params;

  const invoice = await companyInvoiceService.getCompanyInvoiceById(
    parseInt(id, 10),
  );

  if (!invoice) {
    return res
      .status(httpStatus.NOT_FOUND)
      .json({ message: 'Invoice not found' });
  }

  const rawPdf =
    await companyInvoiceService.generateCompanyInvoicePDF(invoice);
  const pdfBuffer = Buffer.isBuffer(rawPdf) ? rawPdf : Buffer.from(rawPdf);

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader(
    'Content-Disposition',
    `attachment; filename=invoice_${invoice.serialNumber}.pdf`,
  );
  return res.send(pdfBuffer);
});

/**
 * Resend company invoice email
 * POST /api/v1/company-invoice/:id/send-email
 */
const resendCompanyInvoiceEmail = catchAsync(async (req, res) => {
  const { id } = req.params;

  const invoice = await companyInvoiceService.getCompanyInvoiceById(
    parseInt(id, 10),
  );

  if (!invoice) {
    return res
      .status(httpStatus.NOT_FOUND)
      .json({ message: 'Invoice not found' });
  }

  const result = await companyInvoiceService.sendCompanyInvoiceEmail(invoice);
  return res.status(httpStatus.OK).send(result);
});

/**
 * Mark company invoice as paid
 * POST /api/v1/company-invoice/:id/mark-paid
 */
const markCompanyInvoiceAsPaid = catchAsync(async (req, res) => {
  const { id } = req.params;
  const { paidAmount, paymentReference } = req.body;

  const invoice = await companyInvoiceService.getCompanyInvoiceById(
    parseInt(id, 10),
  );

  if (!invoice) {
    return res
      .status(httpStatus.NOT_FOUND)
      .json({ message: 'Invoice not found' });
  }

  const updatedInvoice = await companyInvoiceService.updateCompanyInvoice(
    parseInt(id, 10),
    {
      status: 'PAID',
      paidAmount: paidAmount || invoice.netAmount,
      paidAt: new Date(),
      paymentReference,
    },
  );

  return res.status(httpStatus.OK).send(updatedInvoice);
});

/**
 * Admin Save Company Invoice - Consolidated endpoint that handles:
 * - Update total amount and discount
 * - Update description and dates
 * - Mark as paid if specified
 * - Send email with updated invoice
 * POST /api/v1/company-invoice/:id/save
 */
const adminSaveCompanyInvoice = catchAsync(async (req, res) => {
  const { id } = req.params;
  const data = req.body;

  const result = await companyInvoiceService.adminSaveCompanyInvoice(
    parseInt(id, 10),
    data,
  );

  res.status(httpStatus.OK).send(result);
});

/**
 * Update registrations linked to a company invoice
 * PUT /api/v1/company-invoice/:id/registrations
 */
const updateCompanyInvoiceRegistrations = catchAsync(async (req, res) => {
  const { id } = req.params;
  const { registrationIds } = req.body;
  const result = await companyInvoiceService.updateCompanyInvoiceRegistrations(
    parseInt(id, 10),
    registrationIds,
  );
  res.status(httpStatus.OK).send({ result });
});

const getCompanyInvoiceReport = catchAsync(async (req, res) => {
  const result = await companyInvoiceService.getCompanyInvoiceReport({
    companyId: req.query.companyId
      ? parseInt(req.query.companyId, 10)
      : undefined,
    countryId: req.query.countryId
      ? parseInt(req.query.countryId, 10)
      : undefined,
    companyInvoiceId: req.query.companyInvoiceId
      ? parseInt(req.query.companyInvoiceId, 10)
      : undefined,
    page: parseInt(req.query.page, 10) || 1,
    limit: parseInt(req.query.limit, 10) || 20,
    all: req.query.all,
  });
  res.status(httpStatus.OK).send(result);
});

/**
 * View company invoice PDF via secure token (no auth required)
 * GET /api/v1/company-invoice/view?token=xxx
 */
const viewCompanyInvoicePDF = catchAsync(async (req, res) => {
  const { token, download } = req.query;

  if (!token) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'Token is required');
  }

  let decoded;
  try {
    decoded = await registrationTokenService.verifyViewCompanyInvoiceToken(
      token,
    );
  } catch (error) {
    throw new ApiError(httpStatus.UNAUTHORIZED, error.message);
  }

  const invoice = await companyInvoiceService.getCompanyInvoiceById(
    decoded.companyInvoiceId,
  );

  if (!invoice) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Invoice not found');
  }

  const rawPdf =
    await companyInvoiceService.generateCompanyInvoicePDF(invoice);
  const pdfBuffer = Buffer.isBuffer(rawPdf) ? rawPdf : Buffer.from(rawPdf);

  const filename = `GAIF_Company_Invoice_${invoice.serialNumber}.pdf`;
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader(
    'Content-Disposition',
    download === 'true'
      ? `attachment; filename="${filename}"`
      : `inline; filename="${filename}"`,
  );
  return res.send(pdfBuffer);
});

module.exports = {
  createCompanyInvoice,
  getCompanyInvoiceById,
  getCompanyInvoices,
  getCompanyInvoiceList,
  updateCompanyInvoice,
  downloadCompanyInvoicePDF,
  viewCompanyInvoicePDF,
  resendCompanyInvoiceEmail,
  markCompanyInvoiceAsPaid,
  adminSaveCompanyInvoice,
  updateCompanyInvoiceRegistrations,
  getCompanyInvoiceReport,
};
