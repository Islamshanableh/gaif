const httpStatus = require('http-status');
const catchAsync = require('../utils/catchAsync');
const { authService, tokenService, userService } = require('../services');
const pick = require('../utils/pick');

exports.register = catchAsync(async (req, res) => {
  const user = await userService.register(req.body);
  res.status(httpStatus.CREATED).send({ user });
});

exports.loginByEmailAndPassword = catchAsync(async (req, res) => {
  const payload = pick(req.body, ['email', 'password']);
  const user = await authService.loginByEmailAndPassword(payload);

  // Check if MFA is enabled for this user
  if (user.mfaEnabled) {
    // Generate temporary token for MFA verification
    const tempToken = await tokenService.generateMfaTempToken(user);

    return res.status(httpStatus.OK).send({
      mfaRequired: true,
      tempToken,
      message: 'Please enter your MFA code from Google Authenticator',
    });
  }

  // No MFA, return full tokens
  const tokens = await tokenService.generateAuthTokens(user);
  res.status(httpStatus.ACCEPTED).send({ user, tokens });
});

exports.refreshToken = catchAsync(async (req, res) => {
  const user = await authService.refreshAuth(req?.body?.token);

  res.status(httpStatus.ACCEPTED).send({ user });
});

exports.forgetPassword = catchAsync(async (req, res) => {
  const token = await authService.forgetPassword(req?.body);

  res.status(httpStatus.ACCEPTED).send(token);
});

exports.verifyCode = catchAsync(async (req, res) => {
  const user = await authService.verifyCode({
    ...req.body,
  });
  const tokens = await tokenService.generateAuthTokens(user);
  res.status(httpStatus.ACCEPTED).send({ user, tokens });
});
