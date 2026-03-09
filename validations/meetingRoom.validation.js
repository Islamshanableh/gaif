const Joi = require('joi');

const TYPES = ['room', 'table'];
const STATUSES = ['active', 'inactive'];

exports.createMeetingRoom = {
  body: Joi.object().keys({
    type: Joi.string().valid(...TYPES).required(),
    floor: Joi.string().required(),
    name: Joi.string().required(),
    banquet: Joi.string().allow(null, '').optional(),
    area: Joi.string().allow(null, '').optional(),
    code: Joi.string().max(100).allow(null, '').optional(),
    priceUSD: Joi.number().min(0).optional(),
    status: Joi.string().valid(...STATUSES).default('active'),
  }),
};

exports.getMeetingRoomById = {
  params: Joi.object().keys({
    id: Joi.number().required(),
  }),
};

exports.getMeetingRoomList = {
  query: Joi.object().keys({
    type: Joi.string().valid(...TYPES).optional(),
    floor: Joi.string().optional(),
    status: Joi.string().valid(...STATUSES).optional(),
    page: Joi.number().min(1).default(1),
    limit: Joi.number().min(1).max(100).default(20),
  }),
};

exports.updateMeetingRoom = {
  params: Joi.object().keys({
    id: Joi.number().required(),
  }),
  body: Joi.object().keys({
    type: Joi.string().valid(...TYPES).optional(),
    floor: Joi.string().allow(null, '').optional(),
    name: Joi.string().optional(),
    banquet: Joi.string().allow(null, '').optional(),
    area: Joi.string().allow(null, '').optional(),
    code: Joi.string().max(100).allow(null, '').optional(),
    priceUSD: Joi.number().min(0).allow(null).optional(),
    status: Joi.string().valid(...STATUSES).optional(),
  }),
};

exports.deleteMeetingRoom = {
  params: Joi.object().keys({
    id: Joi.number().required(),
  }),
};
