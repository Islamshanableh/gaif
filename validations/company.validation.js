const Joi = require('joi');

exports.createCompany = {
  body: Joi.object().keys({
    name: Joi.string().required(),
    email: Joi.string().required(),
    entryDate: Joi.date(),
    expirationDate: Joi.date(),
    countryId: Joi.number().required(),
    participationId: Joi.number().required(),
    logoId: Joi.number().allow(null).optional(),
    numberOfFreeSeats: Joi.number().allow(null).optional(),
    available: Joi.number().allow(null).optional(),
    allowFreeSeats: Joi.boolean().optional(),
    order: Joi.number().allow(null).optional(),
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
    logoId: Joi.number().allow(null).optional(),
    numberOfFreeSeats: Joi.number().allow(null).optional(),
    available: Joi.number().allow(null).optional(),
    allowFreeSeats: Joi.boolean().optional(),
    order: Joi.number().allow(null).optional(),
  }),
  query: Joi.object().keys({
    id: Joi.number().required(),
  }),
};

exports.getCompanyList = {
  query: Joi.object().keys({
    page: Joi.number().min(1).default(1),
    limit: Joi.number().min(1).max(100).default(10),
    search: Joi.string().allow('', null).optional(),
    countryId: Joi.number().optional(),
    participationId: Joi.number().optional(),
    all: Joi.boolean().optional(),
  }),
};
