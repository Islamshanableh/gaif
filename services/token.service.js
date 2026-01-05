const jwt = require('jsonwebtoken');
const fs = require('fs');
const httpStatus = require('http-status');
const config = require('../config/config');
const { accessTokenExpires } = require('../utils/helpers');
const { auth } = require('../constants/service.constants');
const userService = require('./user.service');
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
const generateWorkerToken = (worker, expires, type, secret = JWT_PK) => {
  const payload = {
    sub: worker,
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

exports.generateResetPasswordToken = async email => {
  const user = await userService.findUserByEmail(email);

  if (!user) {
    throw new ApiError(httpStatus.NOT_FOUND, 'No users found with this email');
  }

  if (user?.isSocial || !user?.havePassword) {
    throw new ApiError(
      httpStatus.NOT_FOUND,
      'This email is using social credential please try logging in using social options ',
    );
  }

  const resetPasswordToken = generateToken(
    user.id,
    config.jwt.exp_in_min,
    auth.tokenTypes.RESET_PASSWORD,
  );

  return resetPasswordToken;
};

exports.generateResetAdminPasswordToken = async email => {
  const worker = await userService.findWorkerByEmail(email);

  if (!worker) {
    throw new ApiError(httpStatus.NOT_FOUND, 'No users found with this email');
  }

  const resetPasswordToken = generateToken(
    worker.id,
    config.jwt.exp_in_min,
    auth.tokenTypes.RESET_PASSWORD,
  );

  return resetPasswordToken;
};

exports.generateOtpRegistrationToken = async otp => {
  const resetPasswordToken = generateToken(
    otp,
    config.jwt.exp_in_min,
    auth.tokenTypes.VERIFY_MOBILE,
  );

  return resetPasswordToken;
};

exports.generateResetPasswordWorkerToken = async email => {
  const worker = await userService.findWorkerByEmail(email);

  if (!worker) {
    throw new ApiError(
      httpStatus.NOT_FOUND,
      'No workers found with this email',
    );
  }

  const resetPasswordToken = generateWorkerToken(
    worker.id,
    config.jwt.exp_in_min,
    auth.tokenTypes.RESET_PASSWORD,
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
