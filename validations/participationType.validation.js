const Joi = require('joi');

exports.createParticipationType = {
  body: Joi.object().keys({
    title: Joi.string().required(),
    price: Joi.number().required(),
    spousePrice: Joi.number().allow(null).optional(),
    specialPrice: Joi.number().allow(null).optional(),
    currency: Joi.string().max(10).allow('', null).optional(),
    allowForRegister: Joi.boolean().optional(),
    allowCreateCompany: Joi.boolean().optional(),
    requireConfirmationFromCompany: Joi.boolean().optional(),
    countryIds: Joi.array().items(Joi.number()).optional(),
    fees: Joi.boolean().required(),
    spouse: Joi.boolean().required(),
    petra: Joi.boolean().required(),
    petraSpouse: Joi.boolean().required(),
    accommodationAqaba: Joi.boolean().required(),
    accommodationAmman: Joi.boolean().required(),
    order: Joi.number().min(0).optional(),
  }),
};

exports.getById = {
  query: Joi.object().keys({
    id: Joi.number().required(),
  }),
};

exports.updateParticipationType = {
  body: Joi.object().keys({
    title: Joi.string(),
    price: Joi.number(),
    spousePrice: Joi.number().allow(null).optional(),
    specialPrice: Joi.number().allow(null).optional(),
    currency: Joi.string().max(10).allow('', null).optional(),
    allowForRegister: Joi.boolean().optional(),
    allowCreateCompany: Joi.boolean().optional(),
    requireConfirmationFromCompany: Joi.boolean().optional(),
    countryIds: Joi.array().items(Joi.number()).optional(),
    fees: Joi.boolean(),
    spouse: Joi.boolean(),
    petra: Joi.boolean(),
    petraSpouse: Joi.boolean(),
    accommodationAqaba: Joi.boolean(),
    accommodationAmman: Joi.boolean(),
    order: Joi.number().min(0).optional(),
  }),
  query: Joi.object().keys({
    id: Joi.number().required(),
  }),
};

exports.getParticipationTypeList = {
  query: Joi.object().keys({
    page: Joi.number().min(1).default(1),
    limit: Joi.number().min(1).max(100).default(10),
    search: Joi.string().allow('', null).optional(),
    allowForRegister: Joi.boolean().optional(),
    countryId: Joi.number().optional(),
  }),
};
