const httpStatus = require('http-status');
const catchAsync = require('../utils/catchAsync');
const companyInvoiceService = require('../services/companyInvoice.service');

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

  const pdfBuffer =
    await companyInvoiceService.generateCompanyInvoicePDF(invoice);

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

module.exports = {
  createCompanyInvoice,
  getCompanyInvoiceById,
  getCompanyInvoices,
  getCompanyInvoiceList,
  updateCompanyInvoice,
  downloadCompanyInvoicePDF,
  resendCompanyInvoiceEmail,
  markCompanyInvoiceAsPaid,
  adminSaveCompanyInvoice,
};
