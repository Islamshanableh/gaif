const Joi = require('joi');

exports.verifyMfaSetup = {
  body: Joi.object().keys({
    token: Joi.string()
      .length(6)
      .pattern(/^[0-9]+$/)
      .required()
      .messages({
        'string.length': 'MFA code must be 6 digits',
        'string.pattern.base': 'MFA code must contain only numbers',
      }),
  }),
};

exports.verifyMfaLogin = {
  body: Joi.object().keys({
    tempToken: Joi.string().required(),
    token: Joi.string()
      .length(6)
      .pattern(/^[0-9]+$/)
      .required()
      .messages({
        'string.length': 'MFA code must be 6 digits',
        'string.pattern.base': 'MFA code must contain only numbers',
      }),
  }),
};

exports.disableMfa = {
  body: Joi.object().keys({
    token: Joi.string()
      .length(6)
      .pattern(/^[0-9]+$/)
      .required()
      .messages({
        'string.length': 'MFA code must be 6 digits',
        'string.pattern.base': 'MFA code must contain only numbers',
      }),
  }),
};
