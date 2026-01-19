const Joi = require('joi');

exports.uploadFile = {
  body: Joi.object().keys({
    entityType: Joi.string().max(50).allow('', null).optional(),
    entityId: Joi.number().allow(null).optional(),
    fieldName: Joi.string().max(100).allow('', null).optional(),
  }),
};

exports.uploadMultipleFiles = {
  body: Joi.object().keys({
    entityType: Joi.string().max(50).allow('', null).optional(),
    entityId: Joi.number().allow(null).optional(),
  }),
};

exports.getFileById = {
  params: Joi.object().keys({
    id: Joi.number().required(),
  }),
};

exports.getFileByKey = {
  params: Joi.object().keys({
    fileKey: Joi.string().required(),
  }),
};

exports.getFilesByEntity = {
  params: Joi.object().keys({
    entityType: Joi.string().required(),
    entityId: Joi.number().required(),
  }),
};

exports.updateFileEntity = {
  params: Joi.object().keys({
    id: Joi.number().required(),
  }),
  body: Joi.object().keys({
    entityType: Joi.string().max(50).required(),
    entityId: Joi.number().allow(null).optional(),
    fieldName: Joi.string().max(100).allow('', null).optional(),
  }),
};
