const Joi = require('joi');

exports.userList = {
  query: Joi.object().keys({
    status: Joi.string().required(),
  }),
};

exports.getById = {
  query: Joi.object().keys({
    id: Joi.number().required(),
  }),
};

exports.updatePassword = {
  body: Joi.object().keys({
    oldPassword: Joi.string(),
    password: Joi.string().min(8).required().messages({
      'string.min': 'Password must be at least 8 characters long',
      'any.required': 'Password is required',
    }),
    confirmPassword: Joi.string()
      .valid(Joi.ref('password'))
      .required()
      .messages({
        'any.only': 'Passwords do not match',
        'any.required': 'Confirm password is required',
      }),
  }),
};

exports.approveUser = {
  body: Joi.object().keys({
    id: Joi.number().required(),
    role: Joi.string().required().valid('ADMIN', 'USER'),
    sectionsIds: Joi.array().items(Joi.number().required()).required(),
  }),
};
