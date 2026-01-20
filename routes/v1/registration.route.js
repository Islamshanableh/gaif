const express = require('express');

const validate = require('../../middlewares/validate');
const parseFormData = require('../../middlewares/parseFormData');
const { auth } = require('../../middlewares/auth');

const { registrationController } = require('../../controllers');
const registrationActionController = require('../../controllers/registrationAction.controller');

const { registrationValidation } = require('../../validations');

const { routePermissions } = require('../../constants');

const router = express.Router();

// Main registration routes
router
  .route('/')
  .post(
    parseFormData(['spouse', 'trips']),
    validate(registrationValidation.createFullRegistration),
    registrationController.createRegistration,
  )
  .get(
    validate(registrationValidation.getById),
    registrationController.getRegistrationById,
  )
  .put(
    parseFormData(['spouse', 'trips']),
    registrationController.updateRegistration,
  )
  .delete(
    validate(registrationValidation.getById),
    registrationController.deleteRegistration,
  );

// Get all registrations with pagination (Admin only)
router
  .route('/list')
  .get(
    auth(routePermissions.ADMINISTRATOR.read),
    validate(registrationValidation.getRegistrations),
    registrationController.getRegistrations,
  );

// Submit registration (final step)
router
  .route('/submit')
  .post(
    validate(registrationValidation.submitRegistration),
    registrationController.submitRegistration,
  );

// Upload visa documents
router
  .route('/visa-documents')
  .post(
    validate(registrationValidation.uploadVisaDocuments),
    registrationController.uploadVisaDocuments,
  );

// Upload spouse visa documents
router
  .route('/spouse-visa-documents')
  .post(
    validate(registrationValidation.getById),
    registrationController.uploadSpouseVisaDocuments,
  );

// Company action routes (confirm/decline registration)
// These are public routes accessed via secure tokens in emails
router.get(
  '/company-action/confirm',
  registrationActionController.companyConfirm,
);
router.get(
  '/company-action/decline',
  registrationActionController.companyDecline,
);

// View registration details via secure token
router.get('/view', registrationActionController.viewRegistration);

// View/Download invoice via secure token
router.get('/invoice', registrationActionController.viewInvoice);

module.exports = router;
