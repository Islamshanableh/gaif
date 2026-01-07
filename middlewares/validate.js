const Joi = require('joi');
const httpStatus = require('http-status');
const pick = require('../utils/pick');
const ApiError = require('../utils/ApiError');

const validate = schema => (req, res, next) => {
  const validSchema = pick(schema, ['params', 'query', 'body']);
  const object = pick(req, Object.keys(validSchema));
  const isRegistrationRequest = req?.body?.password && true;

  const { value, error } = Joi.compile(validSchema)
    .prefs({ errors: { label: 'key' } })
    .validate(object, { abortEarly: false });

  if (error) {
    const errorMessage = error.details.map(details => details);
    error.customMessage = 'Validation Failed';

    console.log(errorMessage);
    if (isRegistrationRequest) {
      if (Array.isArray(errorMessage) && errorMessage.length) {
        error.customMessage = errorMessage[0].message
          .replaceAll(/[^a-z0-9 ]/gi, '')
          .replace(/([A-Z])/g, ' $1');

        error.customMessage =
          error.customMessage.charAt(0).toUpperCase() +
          error.customMessage.slice(1);
      }
    } else {
      return next(new ApiError(httpStatus.BAD_REQUEST, error));
    }
    return next(new ApiError(httpStatus.BAD_REQUEST, error.customMessage));
  }
  Object.assign(req, value);
  return next();
};

module.exports = validate;
