const httpStatus = require('http-status');
const catchAsync = require('../utils/catchAsync');
const meetingRoomService = require('../services/meetingRoom.service');
const auditService = require('../services/audit.service');

exports.createMeetingRoom = catchAsync(async (req, res) => {
  const result = await meetingRoomService.createMeetingRoom(req.body);
  await auditService.logCreate({
    userId: req.user.sub.id,
    entityType: 'MeetingRoom',
    entityId: result.id,
    entityName: result.name,
    newData: result,
    req,
  });
  res.status(httpStatus.OK).send({ result });
});

exports.getMeetingRoomById = catchAsync(async (req, res) => {
  const result = await meetingRoomService.getMeetingRoomById(req.params.id);
  res.status(httpStatus.OK).send({ result });
});

exports.getMeetingRoomList = catchAsync(async (req, res) => {
  const result = await meetingRoomService.getMeetingRoomList({
    type: req.query.type,
    floor: req.query.floor,
    status: req.query.status,
    page: req.query.page ? parseInt(req.query.page, 10) : 1,
    limit: req.query.limit ? parseInt(req.query.limit, 10) : 20,
    all: req.query.all,
  });
  res.status(httpStatus.OK).send(result);
});

exports.updateMeetingRoom = catchAsync(async (req, res) => {
  const { id } = req.params;
  const oldData = await meetingRoomService.getMeetingRoomById(id);
  const result = await meetingRoomService.updateMeetingRoom(id, req.body);
  await auditService.logUpdate({
    userId: req.user.sub.id,
    entityType: 'MeetingRoom',
    entityId: parseInt(id, 10),
    entityName: result.name,
    oldData,
    newData: result,
    req,
  });
  res.status(httpStatus.OK).send({ result });
});

exports.deleteMeetingRoom = catchAsync(async (req, res) => {
  const { id } = req.params;
  const oldData = await meetingRoomService.getMeetingRoomById(id);
  const result = await meetingRoomService.deleteMeetingRoom(id);
  await auditService.logDelete({
    userId: req.user.sub.id,
    entityType: 'MeetingRoom',
    entityId: parseInt(id, 10),
    entityName: oldData.name,
    deletedData: oldData,
    req,
  });
  res.status(httpStatus.OK).send({ result });
});
