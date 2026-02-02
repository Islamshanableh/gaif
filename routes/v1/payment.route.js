const express = require('express');
const paymentController = require('../../controllers/payment.controller');

const router = express.Router();

// Initiate checkout - creates MEPS session and redirects to payment page
// Public route accessed via link in approval email
router.get('/checkout', paymentController.initiateCheckout);

// Payment result callback - MEPS redirects here after payment attempt
router.get('/result', paymentController.paymentResult);

// Check payment status (for frontend polling)
router.get('/status', paymentController.checkPaymentStatus);

module.exports = router;
