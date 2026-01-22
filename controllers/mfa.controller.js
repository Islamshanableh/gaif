const httpStatus = require('http-status');
const catchAsync = require('../utils/catchAsync');
const { mfaService, tokenService } = require('../services');

/**
 * Generate MFA secret and QR code for setup
 * Requires authenticated user
 */
exports.setupMfa = catchAsync(async (req, res) => {
  const userId = req.user.sub.id;
  const result = await mfaService.generateMfaSecret(userId);

  res.status(httpStatus.OK).send({
    message: 'Scan the QR code with Google Authenticator',
    qrCode: result.qrCode,
    secret: result.secret, // For manual entry if QR scan fails
  });
});

/**
 * Verify MFA token and enable MFA (during setup)
 * Requires authenticated user
 */
exports.verifySetup = catchAsync(async (req, res) => {
  const userId = req.user.sub.id;
  const { token } = req.body;

  const result = await mfaService.verifyAndEnableMfa(userId, token);

  res.status(httpStatus.OK).send(result);
});

/**
 * Verify MFA token during login
 * Uses temporary token from login response
 */
exports.verifyLogin = catchAsync(async (req, res) => {
  const { tempToken, token } = req.body;

  // Verify the temporary token
  const decoded = await tokenService.verifyToken(tempToken);

  if (decoded.type !== 'MFA_PENDING') {
    return res.status(httpStatus.BAD_REQUEST).send({
      message: 'Invalid temporary token',
    });
  }

  // Verify MFA code
  await mfaService.verifyMfaToken(decoded.sub.id, token);

  // Generate full auth tokens
  const user = decoded.sub;
  delete user.password;
  delete user.mfaSecret;

  const tokens = await tokenService.generateAuthTokens(user);

  res.status(httpStatus.OK).send({
    message: 'MFA verification successful',
    user,
    tokens,
  });
});

/**
 * Disable MFA for user
 * Requires authenticated user and MFA verification
 */
exports.disableMfa = catchAsync(async (req, res) => {
  const userId = req.user.sub.id;
  const { token } = req.body;

  const result = await mfaService.disableMfa(userId, token);

  res.status(httpStatus.OK).send(result);
});

/**
 * Get MFA status for user
 * Requires authenticated user
 */
exports.getMfaStatus = catchAsync(async (req, res) => {
  const userId = req.user.sub.id;
  const isEnabled = await mfaService.isMfaEnabled(userId);

  res.status(httpStatus.OK).send({
    mfaEnabled: isEnabled,
  });
});
