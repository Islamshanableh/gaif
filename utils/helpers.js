const moment = require('moment');
const jwt = require('jsonwebtoken');
const httpStatus = require('http-status');
const bcrypt = require('bcryptjs');
const ApiError = require('./ApiError');
const config = require('../config/config');

exports.groupBy = function (xs, key) {
  return xs.reduce(function (rv, x) {
    // eslint-disable-next-line no-param-reassign
    (rv[x[key]] = rv[x[key]] || []).push(x);
    return rv;
  }, {});
};

exports.uuidv4 = function () {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
    // eslint-disable-next-line no-bitwise
    const r = (Math.random() * 16) | 0;
    // eslint-disable-next-line no-bitwise
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
};

exports.genrateTestID = function name(diagnose, id) {
  const zDigits = new Array(11 - id.toString().length).join(0);

  return `${diagnose + zDigits + id}`;
};

exports.addHoursToDate = function (hours) {
  return moment().add(hours, 'hours');
};

exports.addMinToDate = function (mins) {
  return moment().add(mins, 'minutes');
};

exports.addDaysToDate = function (days) {
  return moment().add(days, 'days');
};

exports.addOneDayToDate = function (date) {
  if (date) return moment(date.toISOString()).add(1, 'days').toISOString();
};

exports.subtractOneDayFromDate = function (date) {
  if (date) return moment(date.toISOString()).subtract(1, 'days').toISOString();
};

exports.generateHashedFromOtp = async otp => {
  const salt = await bcrypt.genSalt(5);
  const hash = await bcrypt.hash(otp, salt);
  return hash;
};

exports.generateOtp = function () {
  return Math.floor(10000 + Math.random() * 90000);
};

exports.isMatchedOtp = (_otp, OTP) => {
  return bcrypt.compareSync(_otp, OTP);
};

exports.calculateTaxTotal = async (price, taxRate) => {
  const isFloat = n => Number(n) === n && n % 1 !== 0;
  const tax_ = isFloat(taxRate) ? taxRate : taxRate / 100;

  const taxAmmount = price * tax_;
  return taxAmmount;
};

exports.accessTokenExpires = gold =>
  new Date(moment().add(gold, 'hours').toDate().getTime());

exports.errorMessage = (email, mobile, username, user) => {
  if (user?.email === email) {
    return 'Email already registered & Verified';
  }

  if (user?.mobile === mobile) {
    return 'Mobile already registered & Verified';
  }

  if (user?.username === username) {
    return 'Username already registered & Verified';
  }

  return 'allready registered please login or change your password';
};

exports.snooze = ms => new Promise(resolve => setTimeout(resolve, ms));

exports.sortArrayByDisplayName = array => {
  const sorted = array.sort((a, b) => {
    if (a && b) {
      const numA = parseInt(a.skuMain.split('-')[1], 10);
      const numB = parseInt(b.skuMain.split('-')[1], 10);
      return numA - numB;
    }
    return null;
  });

  return this.getUniqueItems(sorted, 'skuMain');
};

exports.generateSixDigitCode = () => {
  return Math.floor(100000 + Math.random() * 900000);
};

exports.generateHashedFromOtp = async otp => {
  const salt = await bcrypt.genSalt(5);
  const hash = await bcrypt.hash(Number(otp).toString(), salt);
  return hash;
};

exports.generateToken = (payload, expiresIn) => {
  const secret = config?.hash?.secret;

  const signOptions = { expiresIn, algorithm: 'HS256' };

  return jwt.sign(payload, secret, signOptions);
};

exports.isMatchedOtp = (_otp, OTP) => {
  return bcrypt.compareSync(_otp, OTP);
};

exports.verifyToken = async token => {
  try {
    const secret = config?.hash?.secret;
    const tokenDoc = jwt.verify(token, secret);
    return tokenDoc;
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      throw new ApiError(httpStatus.UNAUTHORIZED, 'Code has been expired');
    } else {
      throw new ApiError(httpStatus.UNAUTHORIZED, 'invalid token');
    }
  }
};
