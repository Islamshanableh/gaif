const httpStatus = require('http-status');
const catchAsync = require('../utils/catchAsync');
const { participationTypeService } = require('../services');

exports.createParticipationType = catchAsync(async (req, res) => {
  const payload = req?.body;

  const result = await participationTypeService.createParticipationType(
    payload,
  );
  res.status(httpStatus.OK).send({ result });
});

exports.updateParticipationType = catchAsync(async (req, res) => {
  const id = req?.query?.id;
  const payload = req?.body;

  const result = await participationTypeService.updateParticipationType({
    ...payload,
    id,
  });
  res.status(httpStatus.OK).send({ result });
});

exports.deleteParticipationType = catchAsync(async (req, res) => {
  const id = req?.query?.id;

  const result = await participationTypeService.deleteParticipationType(id);
  res.status(httpStatus.OK).send({ result });
});

exports.getParticipationTypeById = catchAsync(async (req, res) => {
  const id = req?.query?.id;

  const result = await participationTypeService.getParticipationTypeById(id);
  res.status(httpStatus.OK).send({ result });
});

exports.getParticipationTypeList = catchAsync(async (req, res) => {
  const search = req?.query?.search;
  const result = await participationTypeService.getParticipationTypeList(
    search,
  );
  res.status(httpStatus.OK).send({ result });
});
