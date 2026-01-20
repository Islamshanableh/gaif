const crypto = require('crypto');
const { RegistrationToken, Registration, Company } = require('../models');

// Token types for different actions
const TOKEN_TYPES = {
  COMPANY_CONFIRM: 'COMPANY_CONFIRM',
  COMPANY_DECLINE: 'COMPANY_DECLINE',
  VIEW_REGISTRATION: 'VIEW_REGISTRATION',
  VIEW_INVOICE: 'VIEW_INVOICE',
  UPDATE_REGISTRATION: 'UPDATE_REGISTRATION',
};

// Token types that can only be used once
const ONE_TIME_USE_TOKENS = [
  TOKEN_TYPES.COMPANY_CONFIRM,
  TOKEN_TYPES.COMPANY_DECLINE,
];

/**
 * Generate a secure random token
 * @returns {string} 64-character hex string
 */
const generateSecureToken = () => {
  return crypto.randomBytes(32).toString('hex');
};

/**
 * Create and store a token in the database
 * @param {number} registrationId - Registration ID
 * @param {string} tokenType - Type of token (from TOKEN_TYPES)
 * @param {Object} options - Additional options
 * @param {number} [options.companyId] - Company ID (for company actions)
 * @param {Date} [options.expiresAt] - Optional expiration date (null = never expires)
 * @returns {Promise<string>} The generated token
 */
const createToken = async (registrationId, tokenType, options = {}) => {
  const token = generateSecureToken();

  await RegistrationToken.create({
    token,
    registrationId,
    tokenType,
    companyId: options.companyId || null,
    expiresAt: options.expiresAt || null, // null means never expires
    used: false,
    isActive: true,
  });

  return token;
};

/**
 * Verify a token and return its data
 * @param {string} token - Token to verify
 * @param {string} expectedType - Expected token type
 * @param {Object} options - Verification options
 * @param {boolean} [options.markAsUsed=false] - Whether to mark token as used after verification
 * @returns {Promise<Object>} Token data with registration
 * @throws {Error} If token is invalid, expired, or already used
 */
const verifyToken = async (token, expectedType, options = {}) => {
  const { markAsUsed = false } = options;

  const tokenRecord = await RegistrationToken.findOne({
    where: {
      token,
      isActive: true,
    },
    include: [
      {
        model: Registration,
        as: 'registration',
      },
      {
        model: Company,
        as: 'company',
      },
    ],
  });

  if (!tokenRecord) {
    throw new Error('Invalid token');
  }

  if (tokenRecord.tokenType !== expectedType) {
    throw new Error('Invalid token type');
  }

  // Check if token is expired (only if expiresAt is set)
  if (tokenRecord.expiresAt && new Date() > new Date(tokenRecord.expiresAt)) {
    throw new Error('Token has expired');
  }

  // Check if one-time-use token has already been used
  if (ONE_TIME_USE_TOKENS.includes(tokenRecord.tokenType) && tokenRecord.used) {
    throw new Error('Token has already been used');
  }

  // Mark as used if requested
  if (markAsUsed) {
    await tokenRecord.update({
      used: true,
      usedAt: new Date(),
    });
  }

  return {
    registrationId: tokenRecord.registrationId,
    companyId: tokenRecord.companyId,
    tokenType: tokenRecord.tokenType,
    registration: tokenRecord.registration,
    company: tokenRecord.company,
  };
};

/**
 * Invalidate all tokens for a registration
 * @param {number} registrationId - Registration ID
 * @param {string} [tokenType] - Optional specific token type to invalidate
 */
const invalidateTokens = async (registrationId, tokenType = null) => {
  const where = { registrationId, isActive: true };
  if (tokenType) {
    where.tokenType = tokenType;
  }

  await RegistrationToken.update(
    { isActive: false },
    { where }
  );
};

// ============================================================================
// Token Generation Functions
// ============================================================================

/**
 * Generate company confirmation token
 * @param {number} registrationId - Registration ID
 * @param {number} companyId - Company ID
 * @returns {Promise<string>} Token
 */
const generateCompanyConfirmToken = async (registrationId, companyId) => {
  // Invalidate any existing confirm/decline tokens for this registration
  await invalidateTokens(registrationId, TOKEN_TYPES.COMPANY_CONFIRM);
  await invalidateTokens(registrationId, TOKEN_TYPES.COMPANY_DECLINE);

  return createToken(registrationId, TOKEN_TYPES.COMPANY_CONFIRM, { companyId });
};

/**
 * Generate company decline token
 * @param {number} registrationId - Registration ID
 * @param {number} companyId - Company ID
 * @returns {Promise<string>} Token
 */
const generateCompanyDeclineToken = async (registrationId, companyId) => {
  return createToken(registrationId, TOKEN_TYPES.COMPANY_DECLINE, { companyId });
};

/**
 * Generate view registration token
 * @param {number} registrationId - Registration ID
 * @returns {Promise<string>} Token
 */
const generateViewRegistrationToken = async registrationId => {
  return createToken(registrationId, TOKEN_TYPES.VIEW_REGISTRATION);
};

/**
 * Generate view invoice token
 * @param {number} registrationId - Registration ID
 * @returns {Promise<string>} Token
 */
const generateViewInvoiceToken = async registrationId => {
  return createToken(registrationId, TOKEN_TYPES.VIEW_INVOICE);
};

/**
 * Generate update registration token
 * @param {number} registrationId - Registration ID
 * @returns {Promise<string>} Token
 */
const generateUpdateRegistrationToken = async registrationId => {
  return createToken(registrationId, TOKEN_TYPES.UPDATE_REGISTRATION);
};

// ============================================================================
// Token Verification Functions
// ============================================================================

/**
 * Verify company confirm token
 * @param {string} token - Token to verify
 * @returns {Promise<Object>} Decoded payload with registrationId and companyId
 */
const verifyCompanyConfirmToken = async token => {
  return verifyToken(token, TOKEN_TYPES.COMPANY_CONFIRM, { markAsUsed: true });
};

/**
 * Verify company decline token
 * @param {string} token - Token to verify
 * @returns {Promise<Object>} Decoded payload with registrationId and companyId
 */
const verifyCompanyDeclineToken = async token => {
  return verifyToken(token, TOKEN_TYPES.COMPANY_DECLINE, { markAsUsed: true });
};

/**
 * Verify view registration token
 * @param {string} token - Token to verify
 * @returns {Promise<Object>} Decoded payload with registrationId
 */
const verifyViewRegistrationToken = async token => {
  return verifyToken(token, TOKEN_TYPES.VIEW_REGISTRATION);
};

/**
 * Verify view invoice token
 * @param {string} token - Token to verify
 * @returns {Promise<Object>} Decoded payload with registrationId
 */
const verifyViewInvoiceToken = async token => {
  return verifyToken(token, TOKEN_TYPES.VIEW_INVOICE);
};

/**
 * Verify update registration token
 * @param {string} token - Token to verify
 * @returns {Promise<Object>} Decoded payload with registrationId
 */
const verifyUpdateRegistrationToken = async token => {
  return verifyToken(token, TOKEN_TYPES.UPDATE_REGISTRATION);
};

module.exports = {
  TOKEN_TYPES,
  createToken,
  verifyToken,
  invalidateTokens,
  generateCompanyConfirmToken,
  generateCompanyDeclineToken,
  generateViewRegistrationToken,
  generateViewInvoiceToken,
  generateUpdateRegistrationToken,
  verifyCompanyConfirmToken,
  verifyCompanyDeclineToken,
  verifyViewRegistrationToken,
  verifyViewInvoiceToken,
  verifyUpdateRegistrationToken,
};
