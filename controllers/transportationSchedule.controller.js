const httpStatus = require('http-status');
const catchAsync = require('../utils/catchAsync');
const { transportationScheduleService } = require('../services');

exports.createTransportationSchedule = catchAsync(async (req, res) => {
  const payload = req?.body;
  const result =
    await transportationScheduleService.createTransportationSchedule(payload);
  res.status(httpStatus.CREATED).send({ result });
});

exports.updateTransportationSchedule = catchAsync(async (req, res) => {
  const id = parseInt(req?.query?.id, 10);
  const payload = req?.body;
  const result =
    await transportationScheduleService.updateTransportationSchedule(
      id,
      payload,
    );
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
  const result =
    await transportationScheduleService.deleteTransportationSchedule(id);
  res.status(httpStatus.OK).send({ result });
});
