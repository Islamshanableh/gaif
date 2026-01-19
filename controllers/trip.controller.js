const httpStatus = require('http-status');
const catchAsync = require('../utils/catchAsync');
const { tripService } = require('../services');
const { uploadFileToDb } = require('../utils/fileUpload');

exports.createTrip = catchAsync(async (req, res) => {
  const payload = req?.body;

  if (req.files && req.files.image) {
    const uploadedFile = await uploadFileToDb(req.files.image, 'trip', null, 'image');
    payload.imageId = uploadedFile.id;
  }

  const result = await tripService.createTrip(payload);
  res.status(httpStatus.CREATED).send({ result });
});

exports.updateTrip = catchAsync(async (req, res) => {
  const id = parseInt(req?.query?.id, 10);
  const payload = req?.body;

  if (req.files && req.files.image) {
    const uploadedFile = await uploadFileToDb(req.files.image, 'trip', id, 'image');
    payload.imageId = uploadedFile.id;
  }

  const result = await tripService.updateTrip(id, payload);
  res.status(httpStatus.OK).send({ result });
});

exports.getTripById = catchAsync(async (req, res) => {
  const id = parseInt(req?.query?.id, 10);
  const result = await tripService.getTripById(id);
  res.status(httpStatus.OK).send({ result });
});

exports.getTrips = catchAsync(async (req, res) => {
  const query = req?.query;

  const result = await tripService.getTrips(query);
  res.status(httpStatus.OK).send({ result });
});

exports.deleteTrip = catchAsync(async (req, res) => {
  const id = parseInt(req?.query?.id, 10);
  const result = await tripService.deleteTrip(id);
  res.status(httpStatus.OK).send({ result });
});
