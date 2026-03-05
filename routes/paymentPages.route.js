const express = require('express');
const paymentPagesController = require('../controllers/paymentPages.controller');

const router = express.Router();

// Payment result pages — served at /payment/* (root level, not under /api/v1)
router.get('/success', paymentPagesController.successPage);
router.get('/failed', paymentPagesController.failedPage);
router.get('/cancelled', paymentPagesController.cancelledPage);

// Company invoice payment result pages
router.get('/company-success', paymentPagesController.companySuccessPage);
router.get('/company-failed', paymentPagesController.companyFailedPage);

module.exports = router;
