const httpStatus = require('http-status');
const catchAsync = require('../utils/catchAsync');
const meetingRoomReservationService = require('../services/meetingRoomReservation.service');
const auditService = require('../services/audit.service');

exports.getAvailableRooms = catchAsync(async (req, res) => {
  const result = await meetingRoomReservationService.getAvailableRooms({
    type: req.query.type,
    floor: req.query.floor,
    page: req.query.page ? parseInt(req.query.page, 10) : 1,
    limit: req.query.limit ? parseInt(req.query.limit, 10) : 20,
  });
  res.status(httpStatus.OK).send(result);
});

exports.createReservation = catchAsync(async (req, res) => {
  const result = await meetingRoomReservationService.createReservation(req.body);
  res.status(httpStatus.CREATED).send({ result });
});

exports.getReservationList = catchAsync(async (req, res) => {
  const result = await meetingRoomReservationService.getReservationList({
    page: req.query.page ? parseInt(req.query.page, 10) : 1,
    limit: req.query.limit ? parseInt(req.query.limit, 10) : 20,
  });
  res.status(httpStatus.OK).send(result);
});

exports.deleteReservation = catchAsync(async (req, res) => {
  const { id } = req.params;
  const result = await meetingRoomReservationService.deleteReservation(id);
  await auditService.logDelete({
    userId: req.user.sub.id,
    entityType: 'MeetingRoomReservation',
    entityId: parseInt(id, 10),
    entityName: `Reservation #${id}`,
    deletedData: { id },
    req,
  });
  res.status(httpStatus.OK).send({ result });
});
