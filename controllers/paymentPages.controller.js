const config = require('../config/config');

const baseStyles = `
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    font-family: Arial, sans-serif;
    display: flex;
    justify-content: center;
    align-items: center;
    min-height: 100vh;
    background-color: #f5f5f5;
  }
  .card {
    text-align: center;
    padding: 48px 40px;
    background: white;
    border-radius: 10px;
    box-shadow: 0 2px 16px rgba(0,0,0,0.1);
    max-width: 480px;
    width: 90%;
  }
  .icon {
    width: 72px;
    height: 72px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    margin: 0 auto 24px;
    font-size: 36px;
  }
  .icon.success { background-color: #e8f5e9; }
  .icon.error   { background-color: #fdecea; }
  .icon.warning { background-color: #fff8e1; }
  h1 { font-size: 22px; margin-bottom: 12px; }
  h1.success { color: #2e7d32; }
  h1.error   { color: #c62828; }
  h1.warning { color: #e65100; }
  p { color: #555; font-size: 15px; line-height: 1.6; margin-bottom: 8px; }
  .ref { color: #888; font-size: 13px; margin-top: 16px; }
  .btn {
    display: inline-block;
    margin-top: 28px;
    padding: 12px 28px;
    border-radius: 6px;
    font-size: 15px;
    font-weight: bold;
    text-decoration: none;
    cursor: pointer;
  }
  .btn-primary {
    background-color: #1a3d7c;
    color: white;
  }
  .btn-secondary {
    background-color: #f5f5f5;
    color: #333;
    border: 1px solid #ccc;
    margin-left: 10px;
  }
  .divider { border: none; border-top: 1px solid #eee; margin: 24px 0; }
  .support { font-size: 13px; color: #888; margin-top: 16px; }
`;

const pageTemplate = (title, bodyContent) => `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title} - GAIF 2026</title>
  <style>${baseStyles}</style>
</head>
<body>
  <div class="card">
    ${bodyContent}
  </div>
</body>
</html>`;

/**
 * GET /payment/success?registrationId=123
 */
exports.successPage = (req, res) => {
  const { registrationId } = req.query;
  const apiUrl = config.urls.api || '';

  const html = pageTemplate('Payment Successful', `
    <div class="icon success">✓</div>
    <h1 class="success">Payment Successful</h1>
    <p>Thank you! Your payment has been confirmed and a receipt has been sent to your email address.</p>
    <p>You will receive a confirmation email with your invoice shortly.</p>
    ${registrationId ? `<p class="ref">Registration ID: <strong>${parseInt(registrationId, 10)}</strong></p>` : ''}
    <hr class="divider">
    <p class="support">For any questions, please contact us at<br><strong>info@gaif2026.com</strong></p>
  `);

  res.setHeader('Content-Type', 'text/html');
  return res.send(html);
};

/**
 * GET /payment/failed?registrationId=123&status=DECLINED
 */
exports.failedPage = (req, res) => {
  const { registrationId, status } = req.query;
  const apiBase = config.urls.api || '';
  const retryUrl = registrationId
    ? `${apiBase}/payment/checkout?registrationId=${parseInt(registrationId, 10)}`
    : null;

  const statusMessages = {
    DECLINED: 'Your payment was declined by the bank. Please check your card details or try a different card.',
    EXPIRED: 'The payment session has expired. Please try again.',
    CANCELLED: 'The payment was cancelled.',
    FAILED: 'The payment could not be processed. Please try again.',
  };

  const statusText = statusMessages[status] || 'The payment could not be processed. Please try again or contact support.';

  const html = pageTemplate('Payment Failed', `
    <div class="icon error">✕</div>
    <h1 class="error">Payment Failed</h1>
    <p>${statusText}</p>
    ${status ? `<p class="ref">Status: <strong>${status}</strong></p>` : ''}
    ${registrationId ? `<p class="ref">Registration ID: <strong>${parseInt(registrationId, 10)}</strong></p>` : ''}
    <hr class="divider">
    ${retryUrl ? `<a class="btn btn-primary" href="${retryUrl}">Try Again</a>` : ''}
    <p class="support" style="margin-top:20px;">Need help? Contact us at<br><strong>info@gaif2026.com</strong></p>
  `);

  res.setHeader('Content-Type', 'text/html');
  return res.send(html);
};

/**
 * GET /payment/cancelled
 */
exports.cancelledPage = (req, res) => {
  const { registrationId } = req.query;
  const apiBase = config.urls.api || '';
  const retryUrl = registrationId
    ? `${apiBase}/payment/checkout?registrationId=${parseInt(registrationId, 10)}`
    : null;

  const html = pageTemplate('Payment Cancelled', `
    <div class="icon warning">⚠</div>
    <h1 class="warning">Payment Cancelled</h1>
    <p>You cancelled the payment. Your registration is still pending.</p>
    <p>You can complete the payment at any time using the link provided in your email.</p>
    ${registrationId ? `<p class="ref">Registration ID: <strong>${parseInt(registrationId, 10)}</strong></p>` : ''}
    <hr class="divider">
    ${retryUrl ? `<a class="btn btn-primary" href="${retryUrl}">Complete Payment</a>` : ''}
    <p class="support" style="margin-top:20px;">Need help? Contact us at<br><strong>info@gaif2026.com</strong></p>
  `);

  res.setHeader('Content-Type', 'text/html');
  return res.send(html);
};
