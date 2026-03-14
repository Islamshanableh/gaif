const httpStatus = require('http-status');
const catchAsync = require('../utils/catchAsync');
const meetingRoomInvoiceService = require('../services/meetingRoomInvoice.service');
const auditService = require('../services/audit.service');

exports.createMeetingRoomInvoice = catchAsync(async (req, res) => {
  const result = await meetingRoomInvoiceService.createMeetingRoomInvoice(
    req.body,
    req.user.sub.id,
  );
  await auditService.logCreate({
    userId: req.user.sub.id,
    entityType: 'MeetingRoomInvoice',
    entityId: result.id,
    entityName: result.serialNumber,
    newData: result,
    req,
  });
  res.status(httpStatus.CREATED).send({ result });
});

exports.getMeetingRoomInvoiceList = catchAsync(async (req, res) => {
  const result = await meetingRoomInvoiceService.getMeetingRoomInvoiceList({
    page: req.query.page ? parseInt(req.query.page, 10) : 1,
    limit: req.query.limit ? parseInt(req.query.limit, 10) : 20,
    status: req.query.status,
  });
  res.status(httpStatus.OK).send(result);
});

exports.getMeetingRoomInvoiceById = catchAsync(async (req, res) => {
  const result = await meetingRoomInvoiceService.getMeetingRoomInvoiceById(
    req.params.id,
  );
  res.status(httpStatus.OK).send({ result });
});

exports.downloadMeetingRoomInvoicePDF = catchAsync(async (req, res) => {
  const pdfBuffer = await meetingRoomInvoiceService.downloadMeetingRoomInvoicePDF(
    req.params.id,
  );
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader(
    'Content-Disposition',
    `attachment; filename="MeetingRoom_Invoice_${req.params.id}.pdf"`,
  );
  res.send(pdfBuffer);
});

exports.resendMeetingRoomInvoiceEmail = catchAsync(async (req, res) => {
  const result = await meetingRoomInvoiceService.resendMeetingRoomInvoiceEmail(
    req.params.id,
  );
  res.status(httpStatus.OK).send({ result });
});

exports.deleteMeetingRoomInvoice = catchAsync(async (req, res) => {
  const { id } = req.params;
  const result = await meetingRoomInvoiceService.deleteMeetingRoomInvoice(id);
  await auditService.logDelete({
    userId: req.user.sub.id,
    entityType: 'MeetingRoomInvoice',
    entityId: parseInt(id, 10),
    entityName: `Invoice #${id}`,
    deletedData: { id },
    req,
  });
  res.status(httpStatus.OK).send({ result });
});

exports.sendToFawaterkom = catchAsync(async (req, res) => {
  const { invoiceIds } = req.body;
  const results = await meetingRoomInvoiceService.sendMeetingRoomInvoicesToFawaterkom(invoiceIds);
  res.status(httpStatus.OK).send({ results });
});

exports.reverseFromFawaterkom = catchAsync(async (req, res) => {
  const { invoiceIds } = req.body;
  const results = await meetingRoomInvoiceService.reverseMeetingRoomInvoicesFromFawaterkom(invoiceIds);
  res.status(httpStatus.OK).send({ results });
});
