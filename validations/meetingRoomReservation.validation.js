const Joi = require('joi');

const TYPES = ['room', 'table'];

exports.getAvailableRooms = {
  query: Joi.object().keys({
    type: Joi.string().valid(...TYPES).optional(),
    floor: Joi.string().optional(),
    page: Joi.number().min(1).default(1),
    limit: Joi.number().min(1).max(100).default(20),
    all: Joi.boolean().optional(),
  }),
};

exports.createReservation = {
  body: Joi.object().keys({
    meetingRoomId: Joi.number().required(),
    country: Joi.string().required(),
    company: Joi.string().required(),
    contactPerson: Joi.string().required(),
    email: Joi.string().email().required(),
    mobile: Joi.string().required(),
    branding: Joi.boolean().default(false),
    description: Joi.string().allow(null, '').optional(),
  }),
};

exports.getReservationList = {
  query: Joi.object().keys({
    page: Joi.number().min(1).default(1),
    limit: Joi.number().min(1).max(100).default(20),
  }),
};

exports.deleteReservation = {
  params: Joi.object().keys({
    id: Joi.number().required(),
  }),
};
