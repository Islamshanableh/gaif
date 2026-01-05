const Joi = require('joi');

exports.create = {
  body: Joi.object().keys({
    title: Joi.string().required(),
  }),
  query: Joi.object().keys({
    id: Joi.number(),
  }),
};

exports.getById = {
  query: Joi.object().keys({
    id: Joi.number().required(),
  }),
};

exports.updateSection = {
  body: Joi.object().keys({
    title: Joi.string(),
    order: Joi.number(),
  }),
  query: Joi.object().keys({
    id: Joi.number(),
  }),
};

exports.getSectionListFilter = {
  body: Joi.object().keys({
    column: Joi.string().required(),
    value: Joi.string().required(),
  }),
};

exports.update = {
  body: Joi.object().keys({
    title: Joi.string(),
    order: Joi.number(),
  }),
  query: Joi.object().keys({
    id: Joi.number(),
  }),
};
