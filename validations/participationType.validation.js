const Joi = require('joi');

exports.createParticipationType = {
  body: Joi.object().keys({
    title: Joi.string().required(),
    price: Joi.number().required(),
    fees: Joi.boolean().required(),
    spouse: Joi.boolean().required(),
    petra: Joi.boolean().required(),
    petraSpouse: Joi.boolean().required(),
    accommodationAqaba: Joi.boolean().required(),
    accommodationAmman: Joi.boolean().required(),
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
    fees: Joi.boolean(),
    spouse: Joi.boolean(),
    petra: Joi.boolean(),
    petraSpouse: Joi.boolean(),
    accommodationAqaba: Joi.boolean().required(),
    accommodationAmman: Joi.boolean().required(),
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
  }),
};
