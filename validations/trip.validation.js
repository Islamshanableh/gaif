const Joi = require('joi');

const tripTypes = ['participation', 'spouse'];

exports.createTrip = {
  body: Joi.object().keys({
    type: Joi.string().valid(...tripTypes).allow(null).optional(),
    name: Joi.string().max(200).required(),
    nameAr: Joi.string().max(200).allow('', null).optional(),
    description: Joi.string().allow('', null).optional(),
    descriptionAr: Joi.string().allow('', null).optional(),
    price: Joi.number().precision(2).required(),
    currency: Joi.string().max(10).default('JD'),
    tripDate: Joi.date().allow(null).optional(),
    maxParticipants: Joi.number().allow(null).optional(),
    imageId: Joi.number().allow(null).optional(),
  }),
};

exports.updateTrip = {
  body: Joi.object().keys({
    type: Joi.string().valid(...tripTypes).allow(null).optional(),
    name: Joi.string().max(200).optional(),
    nameAr: Joi.string().max(200).allow('', null).optional(),
    description: Joi.string().allow('', null).optional(),
    descriptionAr: Joi.string().allow('', null).optional(),
    price: Joi.number().precision(2).optional(),
    currency: Joi.string().max(10).optional(),
    tripDate: Joi.date().allow(null).optional(),
    maxParticipants: Joi.number().allow(null).optional(),
    imageId: Joi.number().allow(null).optional(),
    isActive: Joi.boolean().optional(),
  }),
  query: Joi.object().keys({
    id: Joi.number().required(),
  }),
};

exports.getById = {
  query: Joi.object().keys({
    id: Joi.number().required(),
  }),
};

exports.getTrips = {
  query: Joi.object().keys({
    isActive: Joi.boolean().optional(),
    type: Joi.string().valid(...tripTypes).optional(),
  }),
};
