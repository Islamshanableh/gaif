const Joi = require('joi');

exports.loginByEmailAndPassword = {
  body: Joi.object().keys({
    email: Joi.string().email().required().max(320),
    password: Joi.string().required(),
  }),
};

exports.register = {
  body: Joi.object().keys({
    fullName: Joi.string().required().max(40),
    password: Joi.string().required(),
    email: Joi.string().required().email(),
    mobile: Joi.string().required(),
  }),
};

exports.refreshToken = {
  body: Joi.object().keys({
    token: Joi.string().required(),
  }),
};

exports.forgetPassword = {
  body: Joi.object().keys({
    email: Joi.string().email().required(),
  }),
};

exports.verifyCode = {
  body: Joi.object().keys({
    code: Joi.string().required(),
    token: Joi.string().required(),
  }),
};
