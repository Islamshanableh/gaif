const Joi = require('joi');

exports.createTicket = {
  body: Joi.object().keys({
    title: Joi.string().required(),
    fields: Joi.object(),
    userId: Joi.number(),
    sectionId: Joi.number().required(),
    files: Joi.array(),
  }),
};

exports.getById = {
  query: Joi.object().keys({
    id: Joi.number(),
  }),
  body: Joi.object().keys({
    ids: Joi.array(),
  }),
};

exports.update = {
  body: Joi.object().keys({
    id: Joi.number().required(),
    title: Joi.string(),
    fields: Joi.object(),
    userId: Joi.number(),
    sectionId: Joi.number(),
    files: Joi.array(),
  }),
};

exports.moveTickets = {
  body: Joi.object().keys({
    ids: Joi.array().items(Joi.number().required()).required(),
    sectionId: Joi.number().required(),
  }),
};

exports.changeColorTickets = {
  body: Joi.object().keys({
    ids: Joi.array().items(Joi.number().required()).required(),
    color: Joi.string().required(),
  }),
};

exports.createComment = {
  body: Joi.object().keys({
    content: Joi.string().required(),
    ticketId: Joi.number(),
    subTicketId: Joi.number(),
  }),
};

exports.updateComment = {
  body: Joi.object().keys({
    content: Joi.string().required(),
    commentId: Joi.number().required(),
  }),
};

exports.createSubTicket = {
  body: Joi.object().keys({
    title: Joi.string().required(),
    ticketId: Joi.number().required(),
    fields: Joi.object(),
    userId: Joi.number(),
    files: Joi.array(),
  }),
};

exports.updateSubTicket = {
  body: Joi.object().keys({
    id: Joi.number().required(),
    ticketId: Joi.number(),
    title: Joi.string(),
    fields: Joi.object(),
    userId: Joi.number(),
    files: Joi.array(),
  }),
};

exports.createCommentSubTicket = {
  body: Joi.object().keys({
    content: Joi.string().required(),
    subTicketId: Joi.number().required(),
  }),
};
