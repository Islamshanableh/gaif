const Joi = require('joi');

exports.createCompany = {
  body: Joi.object().keys({
    name: Joi.string().required(),
    email: Joi.string().required(),
    entryDate: Joi.date().required(),
    expirationDate: Joi.date().required(),
    countryId: Joi.number().required(),
    participationId: Joi.number().required(),
  }),
};

exports.getById = {
  query: Joi.object().keys({
    id: Joi.number().required(),
  }),
};

exports.updateCompany = {
  body: Joi.object().keys({
    name: Joi.string(),
    email: Joi.string(),
    entryDate: Joi.date(),
    expirationDate: Joi.date(),
    countryId: Joi.number(),
    participationId: Joi.number(),
  }),
  query: Joi.object().keys({
    id: Joi.number().required(),
  }),
};

exports.getCompanyList = {
  body: Joi.object().keys({
    countryId: Joi.number(),
    participationId: Joi.number(),
  }),
};
