const httpStatus = require('http-status');
const catchAsync = require('../utils/catchAsync');
const { transportationScheduleService } = require('../services');
const auditService = require('../services/audit.service');

exports.createTransportationSchedule = catchAsync(async (req, res) => {
  const payload = req?.body;
  const result =
    await transportationScheduleService.createTransportationSchedule(payload);

  // Audit log
  await auditService.logCreate({
    userId: req.user.id,
    entityType: 'TransportationSchedule',
    entityId: result.id,
    entityName: `${result.fromLocation} to ${result.toLocation}`,
    newData: result,
    req,
  });

  res.status(httpStatus.CREATED).send({ result });
});

exports.updateTransportationSchedule = catchAsync(async (req, res) => {
  const id = parseInt(req?.query?.id, 10);
  const payload = req?.body;

  // Get old data before update for audit
  const oldData =
    await transportationScheduleService.getTransportationScheduleById(id);

  const result =
    await transportationScheduleService.updateTransportationSchedule(
      id,
      payload,
    );

  // Audit log
  await auditService.logUpdate({
    userId: req.user.id,
    entityType: 'TransportationSchedule',
    entityId: id,
    entityName: `${result?.fromLocation || oldData?.fromLocation} to ${result?.toLocation || oldData?.toLocation}`,
    oldData,
    newData: result,
    req,
  });

  res.status(httpStatus.OK).send({ result });
});

exports.getTransportationScheduleById = catchAsync(async (req, res) => {
  const id = parseInt(req?.query?.id, 10);
  const result =
    await transportationScheduleService.getTransportationScheduleById(id);
  res.status(httpStatus.OK).send({ result });
});

exports.getTransportationSchedules = catchAsync(async (req, res) => {
  const query = req?.query;

  const result = await transportationScheduleService.getTransportationSchedules(
    query,
  );
  res.status(httpStatus.OK).send({ result });
});

exports.deleteTransportationSchedule = catchAsync(async (req, res) => {
  const id = parseInt(req?.query?.id, 10);

  // Get data before delete for audit
  const oldData =
    await transportationScheduleService.getTransportationScheduleById(id);

  const result =
    await transportationScheduleService.deleteTransportationSchedule(id);

  // Audit log
  await auditService.logDelete({
    userId: req.user.id,
    entityType: 'TransportationSchedule',
    entityId: id,
    entityName: `${oldData?.fromLocation} to ${oldData?.toLocation}`,
    deletedData: oldData,
    req,
  });

  res.status(httpStatus.OK).send({ result });
});
