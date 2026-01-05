const httpStatus = require('http-status');
const catchAsync = require('../utils/catchAsync');
const { ticketService } = require('../services');

// const ApiError = require('../utils/ApiError');
// const { errorMessage } = require('../utils/helpers');

exports.createTicket = catchAsync(async (req, res) => {
  const result = await ticketService.createTicket(req.body);
  res.status(httpStatus.OK).send({ result });
});

exports.updateTicket = catchAsync(async (req, res) => {
  const payload = req?.body;
  const userId = req?.user?.sub?.id;

  const result = await ticketService.updateTicket(payload, userId);
  res.status(httpStatus.OK).send({ result });
});

exports.getTicketById = catchAsync(async (req, res) => {
  const result = await ticketService.getTicketById(req?.query?.id);
  res.status(httpStatus.OK).send({ result });
});

exports.deleteTicket = catchAsync(async (req, res) => {
  const result = await ticketService.deleteTicket(req?.query?.id);
  res.status(httpStatus.OK).send({ result });
});

exports.moveTickets = catchAsync(async (req, res) => {
  const result = await ticketService.moveTickets(req.body);
  res.status(httpStatus.OK).send({ result });
});

exports.changeColorTickets = catchAsync(async (req, res) => {
  const result = await ticketService.changeColorTickets(req.body);
  res.status(httpStatus.OK).send({ result });
});

exports.uploadFilesTicket = catchAsync(async (req, res) => {
  const result = await ticketService.uploadFiles(req.files);
  res.status(httpStatus.OK).send({ result });
});

exports.createComment = catchAsync(async (req, res) => {
  const userId = req?.user?.sub?.id;
  const result = await ticketService.createComment({ ...req.body, userId });
  res.status(httpStatus.OK).send({ result });
});

exports.updateComment = catchAsync(async (req, res) => {
  const userId = req?.user?.sub?.id;
  const result = await ticketService.updateComment({ ...req.body, userId });
  res.status(httpStatus.OK).send({ result });
});

exports.deleteComment = catchAsync(async (req, res) => {
  const userId = req?.user?.sub?.id;
  const result = await ticketService.deleteComment({
    commentId: req?.query?.id,
    userId,
  });
  res.status(httpStatus.OK).send({ result });
});

exports.deleteFile = catchAsync(async (req, res) => {
  const result = await ticketService.deleteFile(req?.query?.id);
  res.status(httpStatus.OK).send({ result });
});

exports.archivedTicket = catchAsync(async (req, res) => {
  if (req?.body?.ids?.length) {
    const result = await ticketService.archivedMultiTickets(req?.body?.ids);
    return res.status(httpStatus.OK).send({ result });
  }
  const result = await ticketService.archivedTicket(req?.query?.id);
  res.status(httpStatus.OK).send({ result });
});

// =====================================================
// subTicket
exports.createSubTicket = catchAsync(async (req, res) => {
  const result = await ticketService.createSubTicket(req.body);
  res.status(httpStatus.OK).send({ result });
});

exports.updateSubTicket = catchAsync(async (req, res) => {
  const payload = req?.body;
  const userId = req?.user?.sub?.id;

  const result = await ticketService.updateSubTicket(payload, userId);
  res.status(httpStatus.OK).send({ result });
});

exports.getSubTicketById = catchAsync(async (req, res) => {
  const result = await ticketService.getSubTicketById(req?.query?.id);
  res.status(httpStatus.OK).send({ result });
});

exports.deleteSubTicket = catchAsync(async (req, res) => {
  const result = await ticketService.deleteSubTicket(req?.query?.id);
  res.status(httpStatus.OK).send({ result });
});

exports.archivedSubTicket = catchAsync(async (req, res) => {
  const result = await ticketService.archivedSubTicket(req?.query?.id);
  res.status(httpStatus.OK).send({ result });
});
