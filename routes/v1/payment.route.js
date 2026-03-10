const express = require('express');
const paymentController = require('../../controllers/payment.controller');
const { auth } = require('../../middlewares/auth');
const { routePermissions } = require('../../constants');

const router = express.Router();

// Initiate checkout - creates MEPS session and redirects to payment page
// Public route accessed via link in approval email
router.get('/checkout', paymentController.initiateCheckout);

// Payment result callback - MEPS redirects here after payment attempt
router.get('/result', paymentController.paymentResult);

// Check payment status (for frontend polling)
router.get('/status', paymentController.checkPaymentStatus);

// Company invoice checkout - creates MEPS session for company invoice total
router.get('/company-checkout', paymentController.initiateCompanyCheckout);

// Company invoice payment result callback - MEPS redirects here after payment
router.get('/company-result', paymentController.companyPaymentResult);

// Meeting room invoice checkout - creates MEPS session
router.get('/meeting-room-checkout', paymentController.initiateMeetingRoomCheckout);

// Meeting room invoice payment result callback - MEPS redirects here after payment
router.get('/meeting-room-result', paymentController.meetingRoomPaymentResult);

// Admin endpoint to mark payment as paid (SYSTEM payment)
router.post(
  '/admin/mark-paid',
  auth(routePermissions.ADMINISTRATOR.update),
  paymentController.adminMarkAsPaid,
);

module.exports = router;
