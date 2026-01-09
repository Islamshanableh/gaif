const Joi = require('joi');

const directionEnum = ['AMMAN_TO_DEAD_SEA', 'DEAD_SEA_TO_AMMAN'];

exports.createTransportationSchedule = {
  body: Joi.object().keys({
    direction: Joi.string()
      .valid(...directionEnum)
      .required(),
    scheduleDate: Joi.date().required(),
    departureTime: Joi.string().max(10).required(),
    expectedArrivalTime: Joi.string().max(10).required(),
    route: Joi.string().max(200).required(),
    routeAr: Joi.string().max(200).allow('', null).optional(),
    availableSeats: Joi.number().allow(null).optional(),
  }),
};

exports.updateTransportationSchedule = {
  body: Joi.object().keys({
    direction: Joi.string()
      .valid(...directionEnum)
      .optional(),
    scheduleDate: Joi.date().optional(),
    departureTime: Joi.string().max(10).optional(),
    expectedArrivalTime: Joi.string().max(10).optional(),
    route: Joi.string().max(200).optional(),
    routeAr: Joi.string().max(200).allow('', null).optional(),
    availableSeats: Joi.number().allow(null).optional(),
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

exports.getSchedules = {
  query: Joi.object().keys({
    direction: Joi.string()
      .valid(...directionEnum)
      .optional(),
    scheduleDate: Joi.date().optional(),
    isActive: Joi.boolean().optional(),
  }),
};
