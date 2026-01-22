const express = require('express');

const validate = require('../../middlewares/validate');
const { auth } = require('../../middlewares/auth');

const router = express.Router();
const { mfaController } = require('../../controllers');
const { mfaValidation } = require('../../validations');

// Setup MFA - Generate QR code (requires auth)
router.route('/setup').post(auth(), mfaController.setupMfa);

// Verify setup and enable MFA (requires auth)
router
  .route('/verify-setup')
  .post(
    auth(),
    validate(mfaValidation.verifyMfaSetup),
    mfaController.verifySetup,
  );

// Verify MFA during login (no auth required, uses temp token)
router
  .route('/verify')
  .post(validate(mfaValidation.verifyMfaLogin), mfaController.verifyLogin);

// Disable MFA (requires auth + MFA code)
router
  .route('/disable')
  .post(auth(), validate(mfaValidation.disableMfa), mfaController.disableMfa);

// Get MFA status (requires auth)
router.route('/status').get(auth(), mfaController.getMfaStatus);

module.exports = router;
