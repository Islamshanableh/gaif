const express = require('express');

const validate = require('../../middlewares/validate');
const { auth } = require('../../middlewares/auth');
const invoiceController = require('../../controllers/invoice.controller');
const { invoiceValidation } = require('../../validations');
const { routePermissions } = require('../../constants');

const router = express.Router();

// Get list of invoices (admin only)
router
  .route('/list')
  .get(
    auth(routePermissions.ADMINISTRATOR.read),
    validate(invoiceValidation.getInvoiceList),
    invoiceController.getInvoiceList,
  );

// Get invoice by ID (admin only)
router
  .route('/:id')
  .get(
    auth(routePermissions.ADMINISTRATOR.read),
    validate(invoiceValidation.getById),
    invoiceController.getInvoiceById,
  );

// Admin Save Invoice - Consolidated endpoint that handles:
// - Update discounts and disclosures for each item
// - Update paid status for each item (admin can mark each item as paid)
// - Calculate totals and balance
// - Process Fawaterkom if needed
// - Generate receipt
// - Send confirmation email
router
  .route('/:id/save')
  .post(
    auth(routePermissions.ADMINISTRATOR.update),
    validate(invoiceValidation.adminSaveInvoice),
    invoiceController.adminSaveInvoice,
  );

// Download invoice PDF
router
  .route('/:id/pdf')
  .get(
    auth(routePermissions.ADMINISTRATOR.read),
    validate(invoiceValidation.getById),
    invoiceController.downloadInvoicePDF,
  );

// Download payment receipt PDF
router
  .route('/:id/receipt')
  .get(
    auth(routePermissions.ADMINISTRATOR.read),
    validate(invoiceValidation.getById),
    invoiceController.downloadReceiptPDF,
  );

// Resend confirmation email to registration
router
  .route('/:id/resend-email')
  .post(
    auth(routePermissions.ADMINISTRATOR.update),
    validate(invoiceValidation.getById),
    invoiceController.resendConfirmationEmail,
  );

module.exports = router;
