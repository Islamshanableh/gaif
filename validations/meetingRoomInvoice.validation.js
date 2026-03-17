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
    discountDisclosure: Joi.string().max(500).allow(null, '').optional(),
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

exports.updateMeetingRoomInvoice = {
  params: Joi.object().keys({
    id: Joi.number().required(),
  }),
  body: Joi.object().keys({
    country: Joi.string().optional(),
    company: Joi.string().optional(),
    contactPerson: Joi.string().optional(),
    email: Joi.string().email().optional(),
    mobile: Joi.string().optional(),
    amountJD: Joi.number().min(0).optional(),
    discount: Joi.number().min(0).optional(),
    discountDisclosure: Joi.string().max(500).allow(null, '').optional(),
    description: Joi.string().allow(null, '').optional(),
    status: Joi.string().valid(...STATUSES).optional(),
    // Paid
    markAsPaid: Joi.boolean().default(false),
    paidAmount: Joi.number().min(0).optional(),
  }),
};
