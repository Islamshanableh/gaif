const jwt = require('jsonwebtoken');
const fs = require('fs');
const httpStatus = require('http-status');
const config = require('../config/config');
const { accessTokenExpires } = require('../utils/helpers');
const { auth } = require('../constants/service.constants');
const ApiError = require('../utils/ApiError');

const JWT_PK = fs.readFileSync('./private.key', 'utf8');
const JWT_PUK = fs.readFileSync('./public.key', 'utf8');

const generateToken = (user, expires, type, secret = JWT_PK) => {
  const payload = {
    sub: user,
    type,
  };

  const signOptions = { expiresIn: expires, algorithm: 'RS256' };

  return jwt.sign(payload, secret, signOptions);
};

exports.verifyToken = async token => {
  // console.log(token,"ggggggggggggggggggggggggggggggggg");
  try {
    const tokenDoc = jwt.verify(token, JWT_PUK);
    return tokenDoc;
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      throw new ApiError(httpStatus.UNAUTHORIZED, 'token has been expired');
    } else {
      throw new ApiError(httpStatus.UNAUTHORIZED, 'invalid token');
    }
  }
};

exports.generateAuthTokens = async user => {
  const accessToken = generateToken(
    user,
    config.jwt.exp_in_hr,
    auth.tokenTypes.ACCESS,
  );
  const refreshToken = generateToken(
    user.id,
    config.jwt.ref_exp_in_days,
    auth.tokenTypes.REFRESH,
  );

  return {
    access: {
      token: accessToken,
      expires: accessTokenExpires(1),
    },
    refresh: {
      token: refreshToken,
      expires: accessTokenExpires(720),
    },
  };
};

exports.generateGuestAuthTokens = async payload => {
  const accessToken = generateToken(
    {
      role: 'GUEST',
      payload,
    },
    config.jwt.exp_in_hr,
    auth.tokenTypes.ACCESS,
  );
  const refreshToken = generateToken(
    payload.id,
    config.jwt.ref_exp_in_days,
    auth.tokenTypes.REFRESH,
  );

  return {
    access: {
      token: accessToken,
      expires: accessTokenExpires(1),
    },
    refresh: {
      token: refreshToken,
      expires: accessTokenExpires(720),
    },
  };
};

exports.generateOtpRegistrationToken = async otp => {
  const resetPasswordToken = generateToken(
    otp,
    config.jwt.exp_in_min,
    auth.tokenTypes.VERIFY_MOBILE,
  );

  return resetPasswordToken;
};

exports.generateVerifyEmailToken = async user => {
  const verifyEmailToken = generateToken(
    user,
    config.jwt.exp_in_hr,
    auth.tokenTypes.VERIFY_EMAIL,
  );
  return verifyEmailToken;
};

/**
 * Generate temporary token for MFA verification during login
 * Token expires in 5 minutes
 */
exports.generateMfaTempToken = async user => {
  const mfaTempToken = generateToken(
    user,
    '5m', // 5 minutes to complete MFA
    auth.tokenTypes.MFA_PENDING,
  );
  return mfaTempToken;
};
