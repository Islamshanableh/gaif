const httpStatus = require('http-status');
const { IpDeniedError } = require('express-ipfilter');
const { Sequelize } = require('../services/db.service');
const config = require('../config/config');
const ApiError = require('../utils/ApiError');

const errorConverter = (err, req, res, next) => {
  let error = err;

  if (!(error instanceof ApiError)) {
    // Check for Sequelize-specific errors
    const isSequelizeError =
      error instanceof Sequelize.ValidationError ||
      error instanceof Sequelize.UniqueConstraintError ||
      error instanceof Sequelize.ForeignKeyConstraintError ||
      error instanceof Sequelize.DatabaseError;

    const statusCode =
      error.statusCode || isSequelizeError
        ? httpStatus.BAD_REQUEST
        : httpStatus.INTERNAL_SERVER_ERROR;

    const message = error.message || httpStatus[statusCode];

    if (err instanceof IpDeniedError)
      error = new ApiError(statusCode, message, error.meta, false);
    else
      error = new ApiError(statusCode, message, error.meta, false, err.stack);
  }
  next(error);
};

// eslint-disable-next-line no-unused-vars
const errorHandler = (err, req, res, next) => {
  let { statusCode, message } = err;
  if (config.env === 'production' && !err.isOperational) {
    statusCode = httpStatus.INTERNAL_SERVER_ERROR;
    message = httpStatus[httpStatus.INTERNAL_SERVER_ERROR];
  }

  res.locals.errorMessage = err.message;
  const response = {
    code: statusCode,
    message,
    ...(config.env === 'development' && { validation: err.validation }),
    ...(config.env === 'development' && { stack: err.stack }),
  };

  console.log(
    '~ file: error.js ~ line 39 ~ errorHandler ~ message : ',
    message,
  );

  res.status(statusCode || 200).send(response);
};

module.exports = {
  errorConverter,
  errorHandler,
};
