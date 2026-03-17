const express = require('express');

const validate = require('../../middlewares/validate');
const { auth } = require('../../middlewares/auth');
const companyInvoiceController = require('../../controllers/companyInvoice.controller');
const companyInvoiceValidation = require('../../validations/companyInvoice.validation');
const { routePermissions } = require('../../constants');

const router = express.Router();

// Create company invoice (admin only)
router
  .route('/')
  .post(
    auth(routePermissions.ADMINISTRATOR.create),
    validate(companyInvoiceValidation.createCompanyInvoice),
    companyInvoiceController.createCompanyInvoice,
  );

// Get list of company invoices (admin only)
router
  .route('/list')
  .get(
    auth(routePermissions.ADMINISTRATOR.read),
    validate(companyInvoiceValidation.getCompanyInvoiceList),
    companyInvoiceController.getCompanyInvoiceList,
  );

// Company invoice report — registrations with invoice + QR code + company invoice info
router
  .route('/report')
  .get(
    auth(routePermissions.ADMINISTRATOR.read),
    validate(companyInvoiceValidation.getCompanyInvoiceReport),
    companyInvoiceController.getCompanyInvoiceReport,
  );

// Get invoices for a specific company (admin only)
router
  .route('/company/:companyId')
  .get(
    auth(routePermissions.ADMINISTRATOR.read),
    validate(companyInvoiceValidation.getByCompanyId),
    companyInvoiceController.getCompanyInvoices,
  );

// Get company invoice by ID (admin only)
router
  .route('/:id')
  .get(
    auth(routePermissions.ADMINISTRATOR.read),
    validate(companyInvoiceValidation.getById),
    companyInvoiceController.getCompanyInvoiceById,
  );

// Update company invoice (admin only)
router
  .route('/:id')
  .put(
    auth(routePermissions.ADMINISTRATOR.update),
    validate(companyInvoiceValidation.updateCompanyInvoice),
    companyInvoiceController.updateCompanyInvoice,
  );

// Download company invoice PDF (admin only)
router
  .route('/:id/pdf')
  .get(
    auth(routePermissions.ADMINISTRATOR.read),
    validate(companyInvoiceValidation.getById),
    companyInvoiceController.downloadCompanyInvoicePDF,
  );

// Resend company invoice email (admin only)
router
  .route('/:id/send-email')
  .post(
    auth(routePermissions.ADMINISTRATOR.update),
    validate(companyInvoiceValidation.getById),
    companyInvoiceController.resendCompanyInvoiceEmail,
  );

// Mark company invoice as paid (admin only)
router
  .route('/:id/mark-paid')
  .post(
    auth(routePermissions.ADMINISTRATOR.update),
    validate(companyInvoiceValidation.markAsPaid),
    companyInvoiceController.markCompanyInvoiceAsPaid,
  );

// Update registrations linked to a company invoice (add/remove)
router
  .route('/:id/registrations')
  .put(
    auth(routePermissions.ADMINISTRATOR.update),
    validate(companyInvoiceValidation.updateCompanyInvoiceRegistrations),
    companyInvoiceController.updateCompanyInvoiceRegistrations,
  );

// Admin Save Company Invoice - Consolidated endpoint (admin only)
// Handles: update amounts, discounts, description, mark as paid, send email
router
  .route('/:id/save')
  .post(
    auth(routePermissions.ADMINISTRATOR.update),
    validate(companyInvoiceValidation.adminSaveCompanyInvoice),
    companyInvoiceController.adminSaveCompanyInvoice,
  );

module.exports = router;
