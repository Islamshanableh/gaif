const config = require('../config/config');

class ApiError extends Error {
  constructor(
    statusCode,
    message,
    validation,
    isOperational = true,
    stack = '',
  ) {
    super(message);
    this.statusCode = statusCode;
    this.validation = validation || undefined;
    if (config.env === 'development' || config.env === 'staging') {
      this.isOperational = isOperational;
      this.stack = stack || Error.captureStackTrace(this, this.constructor);
      this.stack = this.stack?.split(' ').join('');
    }
  }
}

module.exports = ApiError;
