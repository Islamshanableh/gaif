const Joi = require('joi');

const STATUSES = ['pending', 'paid', 'cancelled'];

exports.createMeetingRoomInvoice = {
  body: Joi.object().keys({
    country: Joi.string().required(),
    company: Joi.string().required(),
    contactPerson: Joi.string().required(),
    email: Joi.string().email().required(),
    mobile: Joi.string().required(),
    amountJD: Joi.number().min(0).required(),
    discount: Joi.number().min(0).default(0),
    description: Joi.string().allow(null, '').optional(),
  }),
};

exports.getMeetingRoomInvoiceList = {
  query: Joi.object().keys({
    status: Joi.string().valid(...STATUSES).optional(),
    page: Joi.number().min(1).default(1),
    limit: Joi.number().min(1).max(100).default(20),
  }),
};

exports.getMeetingRoomInvoiceById = {
  params: Joi.object().keys({
    id: Joi.number().required(),
  }),
};

exports.downloadPDF = {
  params: Joi.object().keys({
    id: Joi.number().required(),
  }),
};

exports.resendEmail = {
  params: Joi.object().keys({
    id: Joi.number().required(),
  }),
};

exports.deleteMeetingRoomInvoice = {
  params: Joi.object().keys({
    id: Joi.number().required(),
  }),
};
