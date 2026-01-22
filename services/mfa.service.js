const speakeasy = require('speakeasy');
const QRCode = require('qrcode');
const httpStatus = require('http-status');
const { User } = require('./db.service');
const ApiError = require('../utils/ApiError');
const config = require('../config/config');

/**
 * Generate MFA secret and QR code for user setup
 * @param {number} userId - User ID
 * @returns {Promise<Object>} - Secret and QR code data URL
 */
exports.generateMfaSecret = async userId => {
  const user = await User.findByPk(userId);

  if (!user) {
    throw new ApiError(httpStatus.NOT_FOUND, 'User not found');
  }

  if (user.mfaEnabled) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'MFA is already enabled');
  }

  // Generate secret
  const secret = speakeasy.generateSecret({
    name: `${config.appName} (${user.email})`,
    issuer: config.appName,
    length: 32,
  });

  // Store the secret temporarily (not enabled yet)
  await User.update(
    { mfaSecret: secret.base32 },
    { where: { id: userId } },
  );

  // Generate QR code as data URL
  const qrCodeDataUrl = await QRCode.toDataURL(secret.otpauth_url);

  return {
    secret: secret.base32,
    qrCode: qrCodeDataUrl,
    otpauthUrl: secret.otpauth_url,
  };
};

/**
 * Verify MFA token and enable MFA for user (during setup)
 * @param {number} userId - User ID
 * @param {string} token - 6-digit TOTP token
 * @returns {Promise<Object>} - Success status
 */
exports.verifyAndEnableMfa = async (userId, token) => {
  const user = await User.findByPk(userId);

  if (!user) {
    throw new ApiError(httpStatus.NOT_FOUND, 'User not found');
  }

  if (user.mfaEnabled) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'MFA is already enabled');
  }

  if (!user.mfaSecret) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'MFA setup not initiated. Please generate QR code first');
  }

  // Verify the token
  const isValid = speakeasy.totp.verify({
    secret: user.mfaSecret,
    encoding: 'base32',
    token,
    window: 1, // Allow 1 step before/after for clock drift
  });

  if (!isValid) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'Invalid verification code');
  }

  // Enable MFA
  await User.update(
    { mfaEnabled: true },
    { where: { id: userId } },
  );

  return { message: 'MFA enabled successfully' };
};

/**
 * Verify MFA token during login
 * @param {number} userId - User ID
 * @param {string} token - 6-digit TOTP token
 * @returns {Promise<boolean>} - Whether token is valid
 */
exports.verifyMfaToken = async (userId, token) => {
  const user = await User.findByPk(userId);

  if (!user) {
    throw new ApiError(httpStatus.NOT_FOUND, 'User not found');
  }

  if (!user.mfaEnabled || !user.mfaSecret) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'MFA is not enabled for this user');
  }

  const isValid = speakeasy.totp.verify({
    secret: user.mfaSecret,
    encoding: 'base32',
    token,
    window: 1,
  });

  if (!isValid) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'Invalid MFA code');
  }

  return true;
};

/**
 * Disable MFA for user
 * @param {number} userId - User ID
 * @param {string} token - 6-digit TOTP token for verification
 * @returns {Promise<Object>} - Success status
 */
exports.disableMfa = async (userId, token) => {
  const user = await User.findByPk(userId);

  if (!user) {
    throw new ApiError(httpStatus.NOT_FOUND, 'User not found');
  }

  if (!user.mfaEnabled) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'MFA is not enabled');
  }

  // Verify token before disabling
  const isValid = speakeasy.totp.verify({
    secret: user.mfaSecret,
    encoding: 'base32',
    token,
    window: 1,
  });

  if (!isValid) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'Invalid verification code');
  }

  // Disable MFA and clear secret
  await User.update(
    { mfaEnabled: false, mfaSecret: null },
    { where: { id: userId } },
  );

  return { message: 'MFA disabled successfully' };
};

/**
 * Check if user has MFA enabled
 * @param {number} userId - User ID
 * @returns {Promise<boolean>} - Whether MFA is enabled
 */
exports.isMfaEnabled = async userId => {
  const user = await User.findByPk(userId);

  if (!user) {
    throw new ApiError(httpStatus.NOT_FOUND, 'User not found');
  }

  return user.mfaEnabled === true;
};
