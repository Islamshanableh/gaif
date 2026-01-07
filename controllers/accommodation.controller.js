const httpStatus = require('http-status');
const catchAsync = require('../utils/catchAsync');
const { accommodationService } = require('../services');

exports.createAccommodation = catchAsync(async (req, res) => {
  const payload = req?.body;

  const result = await accommodationService.createAccommodation(payload);
  res.status(httpStatus.OK).send({ result });
});

exports.updateAccommodation = catchAsync(async (req, res) => {
  const id = req?.query?.id;
  const payload = req?.body;

  const result = await accommodationService.updateAccommodation({
    ...payload,
    id,
  });
  res.status(httpStatus.OK).send({ result });
});

exports.deleteAccommodation = catchAsync(async (req, res) => {
  const id = req?.query?.id;

  const result = await accommodationService.deleteAccommodation(id);
  res.status(httpStatus.OK).send({ result });
});

exports.getAccommodationById = catchAsync(async (req, res) => {
  const id = req?.query?.id;

  const result = await accommodationService.getAccommodationById(id);
  res.status(httpStatus.OK).send({ result });
});

exports.getAccommodationList = catchAsync(async (req, res) => {
  const payload = req?.body;
  const result = await accommodationService.getAccommodationList(payload);
  res.status(httpStatus.OK).send({ result });
});
