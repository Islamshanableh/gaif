const bcrypt = require('bcryptjs');
const httpStatus = require('http-status');
const { User } = require('./db.service');
const tokenService = require('./token.service');
const ApiError = require('../utils/ApiError');
const { auth } = require('../constants/service.constants');
const {
  generateSixDigitCode,
  generateHashedFromOtp,
  generateToken,
  verifyToken,
  isMatchedOtp,
} = require('../utils/helpers');
const { sendEmail } = require('../utils/email');
const config = require('../config/config');

const getUserDetail = async payload => {
  const user = await User.findOne({
    where: {
      email: payload.email,
    },
  });

  if (!user) {
    throw new ApiError(httpStatus.NOT_FOUND, 'user not found');
  }

  return user.toJSON();
};

exports.loginByEmailAndPassword = async ({ email, password }) => {
  const user = await getUserDetail({ email });

  const isPasswordMatched = bcrypt.compareSync(password, user.password);

  if (!isPasswordMatched)
    throw new ApiError(
      httpStatus.UNAUTHORIZED,
      'invalid username/email or password',
      [{ context: { key: 'password' }, message: 'Invalid email or password' }],
    );

  delete user.password;
  return user;
};

exports.refreshAuth = async refreshToken => {
  try {
    const refreshTokenDoc = await tokenService.verifyToken(
      refreshToken,
      auth.tokenTypes.REFRESH,
    );

    const user = await User.findByPk(refreshTokenDoc.sub);

    if (!user) {
      throw new Error(httpStatus.UNAUTHORIZED, 'Please Authenticate');
    }

    const token = tokenService.generateAuthTokens(user.toJSON());
    return token;
  } catch (error) {
    throw new ApiError(httpStatus.UNAUTHORIZED, 'Please authenticate');
  }
};

exports.forgetPassword = async payload => {
  const findUser = await getUserDetail(payload);

  const otp = generateSixDigitCode();

  const hashOtp = await generateHashedFromOtp(otp);

  const token = generateToken(
    {
      hashOtp,
      userId: findUser?.id,
      email: findUser.email,
      type: 'forgetPassword',
    },
    config.jwt.reset_exp_in_min,
  );

  await sendEmail(
    payload.email,
    `here is the otp for reset password ${otp}`,
    'forget password',
  );

  return { token };
};

exports.verifyCode = async payload => {
  const token = await verifyToken(payload.token);
  const isMatched = isMatchedOtp(payload.code, token.hashOtp);

  if (!isMatched) {
    throw new ApiError(httpStatus.BAD_REQUEST, `Incorrect code`);
  }

  const user = await getUserDetail(token.email);
  delete user.password;
  return user;
};
