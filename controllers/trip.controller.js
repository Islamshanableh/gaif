const httpStatus = require('http-status');
const catchAsync = require('../utils/catchAsync');
const { tripService } = require('../services');
const { uploadFile } = require('../utils/fileUpload');

exports.createTrip = catchAsync(async (req, res) => {
  const payload = req?.body;

  if (req.files && req.files.image) {
    const imagePath = await uploadFile(req.files.image, 'trips');
    payload.image = imagePath;
  }

  const result = await tripService.createTrip(payload);
  res.status(httpStatus.CREATED).send({ result });
});

exports.updateTrip = catchAsync(async (req, res) => {
  const id = parseInt(req?.query?.id, 10);
  const payload = req?.body;

  if (req.files && req.files.image) {
    const imagePath = await uploadFile(req.files.image, 'trips');
    payload.image = imagePath;
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

  // Convert string boolean to actual boolean
  if (query.isActive !== undefined) {
    query.isActive = query.isActive === 'true';
  }

  const result = await tripService.getTrips(query);
  res.status(httpStatus.OK).send({ result });
});

exports.deleteTrip = catchAsync(async (req, res) => {
  const id = parseInt(req?.query?.id, 10);
  const result = await tripService.deleteTrip(id);
  res.status(httpStatus.OK).send({ result });
});
