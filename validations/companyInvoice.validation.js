const Joi = require('joi');

exports.createCompanyInvoice = {
  body: Joi.object().keys({
    companyId: Joi.number().required(),
    totalAmount: Joi.number().min(0).required(),
    discount: Joi.number().min(0).default(0),
    // Currency is automatically fetched from company's participation type
    description: Joi.string().max(1000).allow('', null).optional(),
    invoiceDate: Joi.date().required(),
    dueDate: Joi.date().optional(),
    sendEmail: Joi.boolean().default(true),
  }),
};

exports.getById = {
  params: Joi.object().keys({
    id: Joi.number().required(),
  }),
};

exports.getByCompanyId = {
  params: Joi.object().keys({
    companyId: Joi.number().required(),
  }),
};

exports.getCompanyInvoiceList = {
  query: Joi.object().keys({
    companyId: Joi.number().optional(),
    status: Joi.string().valid('PENDING', 'PAID', 'CANCELLED').optional(),
    dateFrom: Joi.date().optional(),
    dateTo: Joi.date().optional(),
    page: Joi.number().min(1).default(1),
    limit: Joi.number().min(1).max(100).default(20),
  }),
};

exports.updateCompanyInvoice = {
  params: Joi.object().keys({
    id: Joi.number().required(),
  }),
  body: Joi.object().keys({
    totalAmount: Joi.number().min(0).optional(),
    discount: Joi.number().min(0).optional(),
    // Currency is automatically determined from company's participation type
    description: Joi.string().max(1000).allow('', null).optional(),
    invoiceDate: Joi.date().optional(),
    dueDate: Joi.date().optional(),
    status: Joi.string().valid('PENDING', 'PAID', 'CANCELLED').optional(),
  }),
};

exports.markAsPaid = {
  params: Joi.object().keys({
    id: Joi.number().required(),
  }),
  body: Joi.object().keys({
    paidAmount: Joi.number().min(0).optional(),
    paymentReference: Joi.string().max(100).allow('', null).optional(),
  }),
};

exports.adminSaveCompanyInvoice = {
  params: Joi.object().keys({
    id: Joi.number().required(),
  }),
  body: Joi.object().keys({
    // Amount fields
    totalAmount: Joi.number().min(0).optional(),
    discount: Joi.number().min(0).optional(),
    // Currency is automatically determined from company's participation type
    // Info fields
    description: Joi.string().max(1000).allow('', null).optional(),
    invoiceDate: Joi.date().optional(),
    dueDate: Joi.date().allow(null).optional(),
    // Payment fields
    markAsPaid: Joi.boolean().default(false),
    paidAmount: Joi.number().min(0).optional(),
    paidCurrency: Joi.string().valid('JD', 'USD').optional(),
    paymentReference: Joi.string().max(100).allow('', null).optional(),
    // Email option
    sendEmail: Joi.boolean().default(false),
  }),
};
