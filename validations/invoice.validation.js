const Joi = require('joi');

exports.getInvoiceList = {
  query: Joi.object().keys({
    profileId: Joi.number().optional(),
    companyId: Joi.number().optional(),
    firstName: Joi.string().optional(),
    middleName: Joi.string().optional(),
    lastName: Joi.string().optional(),
    dateFrom: Joi.date().optional(),
    dateTo: Joi.date().optional(),
    balanceFilter: Joi.string().valid('all', 'zero', 'hasBalance').optional(),
    page: Joi.number().min(1).default(1),
    limit: Joi.number().min(1).max(100).default(20),
    exportAll: Joi.string().valid('true', 'false').optional(),
  }),
};

exports.getById = {
  params: Joi.object().keys({
    id: Joi.number().required(),
  }),
};

exports.adminSaveInvoice = {
  params: Joi.object().keys({
    id: Joi.number().required(),
  }),
  body: Joi.object().keys({
    // Discounts for each item
    participationDiscount: Joi.number().min(0).default(0),
    participationDisclosure: Joi.string().max(500).allow('', null).optional(),
    spouseDiscount: Joi.number().min(0).default(0),
    spouseDisclosure: Joi.string().max(500).allow('', null).optional(),
    tripDiscount: Joi.number().min(0).default(0),
    tripDisclosure: Joi.string().max(500).allow('', null).optional(),
    spouseTripDiscount: Joi.number().min(0).default(0),
    spouseTripDisclosure: Joi.string().max(500).allow('', null).optional(),
    ammanDiscount: Joi.number().min(0).default(0),
    ammanDisclosure: Joi.string().max(500).allow('', null).optional(),
    deadSeaDiscount: Joi.number().min(0).default(0),
    deadSeaDisclosure: Joi.string().max(500).allow('', null).optional(),
    // Paid status for each item
    participationPaid: Joi.boolean().default(false),
    spousePaid: Joi.boolean().default(false),
    tripPaid: Joi.boolean().default(false),
    spouseTripPaid: Joi.boolean().default(false),
    ammanPaid: Joi.boolean().default(false),
    deadSeaPaid: Joi.boolean().default(false),
    // Send email option
    sendEmail: Joi.boolean().default(false),
  }),
};
