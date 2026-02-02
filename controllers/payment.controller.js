const httpStatus = require('http-status');
const catchAsync = require('../utils/catchAsync');
const paymentService = require('../services/payment.service');
const config = require('../config/config');

/**
 * Initiate checkout - creates a MEPS Hosted Checkout session
 * GET /api/v1/payment/checkout?registrationId=123
 * Returns a page that redirects to the MEPS payment page
 */
exports.initiateCheckout = catchAsync(async (req, res) => {
  const { registrationId } = req.query;

  if (!registrationId) {
    return res
      .status(httpStatus.BAD_REQUEST)
      .json({ message: 'registrationId is required' });
  }

  const session = await paymentService.createCheckoutSession(
    parseInt(registrationId, 10),
  );

  // Return an HTML page that loads the MEPS checkout JS and opens the payment page
  const { meps } = config;
  const checkoutJsUrl = `${meps.gatewayUrl}/checkout/version/${meps.apiVersion}/checkout.js`;

  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>GAIF 2026 - Payment</title>
  <style>
    body {
      font-family: Arial, sans-serif;
      display: flex;
      justify-content: center;
      align-items: center;
      min-height: 100vh;
      margin: 0;
      background-color: #f5f5f5;
    }
    .container {
      text-align: center;
      padding: 40px;
      background: white;
      border-radius: 8px;
      box-shadow: 0 2px 10px rgba(0,0,0,0.1);
    }
    .spinner {
      border: 4px solid #f3f3f3;
      border-top: 4px solid #0066cc;
      border-radius: 50%;
      width: 40px;
      height: 40px;
      animation: spin 1s linear infinite;
      margin: 20px auto;
    }
    @keyframes spin {
      0% { transform: rotate(0deg); }
      100% { transform: rotate(360deg); }
    }
    .error { color: #cc0000; display: none; }
  </style>
  <script src="${checkoutJsUrl}"
    data-error="errorCallback"
    data-cancel="${config.urls.frontend}/payment/cancelled"
  ></script>
</head>
<body>
  <div class="container">
    <h2>GAIF 2026 - Conference Payment</h2>
    <p>Invoice: <strong>${session.serialNumber}</strong></p>
    <p>Amount: <strong>${session.amount.toFixed(2)} ${session.currency}</strong></p>
    <div class="spinner" id="spinner"></div>
    <p id="loading">Redirecting to payment page...</p>
    <p class="error" id="error">An error occurred. Please try again or contact support.</p>
  </div>
  <script>
    function errorCallback(error) {
      document.getElementById('spinner').style.display = 'none';
      document.getElementById('loading').style.display = 'none';
      document.getElementById('error').style.display = 'block';
      console.error('Checkout error:', error);
    }

    Checkout.configure({
      merchant: '${meps.merchantId}',
      session: {
        id: '${session.sessionId}'
      },
      interaction: {
        merchant: {
          name: 'GAIF 2026'
        },
        displayControl: {
          billingAddress: 'HIDE',
          customerEmail: 'HIDE',
          shipping: 'HIDE'
        }
      }
    });

    Checkout.showPaymentPage();
  </script>
</body>
</html>`;

  res.setHeader('Content-Type', 'text/html');
  return res.send(html);
});

/**
 * Payment result callback - MEPS redirects here after payment
 * GET /api/v1/payment/result?registrationId=123&invoiceId=456
 */
exports.paymentResult = catchAsync(async (req, res) => {
  const { registrationId, invoiceId } = req.query;

  if (!registrationId || !invoiceId) {
    return res.status(httpStatus.BAD_REQUEST).json({
      message: 'registrationId and invoiceId are required',
    });
  }

  const result = await paymentService.verifyAndUpdatePayment(
    parseInt(registrationId, 10),
    parseInt(invoiceId, 10),
  );

  // Redirect to frontend with payment result
  const frontendUrl = config.urls.frontend;
  if (result.success) {
    return res.redirect(
      `${frontendUrl}/payment/success?registrationId=${registrationId}`,
    );
  }
  return res.redirect(
    `${frontendUrl}/payment/failed?registrationId=${registrationId}&status=${result.status}`,
  );
});

/**
 * Check payment status (API endpoint for frontend polling)
 * GET /api/v1/payment/status?registrationId=123
 */
exports.checkPaymentStatus = catchAsync(async (req, res) => {
  const { registrationId } = req.query;

  if (!registrationId) {
    return res
      .status(httpStatus.BAD_REQUEST)
      .json({ message: 'registrationId is required' });
  }

  const { Registration } = require('../services/db.service');
  const registration = await Registration.findByPk(
    parseInt(registrationId, 10),
    {
      attributes: ['id', 'paymentStatus'],
    },
  );

  if (!registration) {
    return res
      .status(httpStatus.NOT_FOUND)
      .json({ message: 'Registration not found' });
  }

  return res.json({
    registrationId: registration.id,
    paymentStatus: registration.paymentStatus,
  });
});
