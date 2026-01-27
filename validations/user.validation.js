const Joi = require('joi');

// Valid user roles
const validRoles = [
  'ADMINISTRATOR',
  'GAIF_ADMIN',
  'REGISTRATION_ADMIN',
  'USER',
];

exports.createUser = {
  body: Joi.object().keys({
    email: Joi.string().email().required(),
    password: Joi.string().min(8).required().messages({
      'string.min': 'Password must be at least 8 characters long',
      'any.required': 'Password is required',
    }),
    fullName: Joi.string().max(320).required(),
    role: Joi.string()
      .valid(...validRoles)
      .required(),
    status: Joi.string().valid('APPROVED', 'PENDING').default('APPROVED'),
  }),
};

exports.updateUser = {
  body: Joi.object().keys({
    email: Joi.string().email().optional(),
    fullName: Joi.string().max(320).optional(),
    password: Joi.string().min(8).optional().messages({
      'string.min': 'Password must be at least 8 characters long',
    }),
    role: Joi.string()
      .valid(...validRoles)
      .optional(),
    status: Joi.string().valid('APPROVED', 'PENDING').optional(),
    isActive: Joi.boolean().optional(),
  }),
  query: Joi.object().keys({
    id: Joi.number().required(),
  }),
};

exports.userList = {
  query: Joi.object().keys({
    status: Joi.string().optional(),
    role: Joi.string()
      .valid(...validRoles)
      .optional(),
    page: Joi.number().min(1).default(1),
    limit: Joi.number().min(1).max(100).default(10),
    search: Joi.string().allow('', null).optional(),
  }),
};

exports.getById = {
  query: Joi.object().keys({
    id: Joi.number().required(),
  }),
};

exports.deleteUser = {
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
    role: Joi.string()
      .required()
      .valid(...validRoles),
  }),
};
