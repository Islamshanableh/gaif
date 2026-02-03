const httpStatus = require('http-status');
const catchAsync = require('../utils/catchAsync');
const { accommodationService } = require('../services');
const { uploadFile } = require('../utils/fileUpload');
const auditService = require('../services/audit.service');

exports.createAccommodation = catchAsync(async (req, res) => {
  const payload = req?.body;

  if (req.files && req.files.hotelImages) {
    const images = Array.isArray(req.files.hotelImages)
      ? req.files.hotelImages
      : [req.files.hotelImages];

    const uploadPromises = images.map(image =>
      uploadFile(image, 'accommodations'),
    );
    const imagePaths = await Promise.all(uploadPromises);
    payload.hotelImages = imagePaths.map(path => ({ fileKey: path }));
  }

  const result = await accommodationService.createAccommodation(payload);

  // Audit log
  await auditService.logCreate({
    userId: req.user.sub.id,
    entityType: 'Accommodation',
    entityId: result.id,
    entityName: result.hotelName,
    newData: result,
    req,
  });

  res.status(httpStatus.OK).send({ result });
});

exports.updateAccommodation = catchAsync(async (req, res) => {
  const id = req?.query?.id;
  const payload = req?.body;

  // Get old data before update for audit
  const oldData = await accommodationService.getAccommodationById(id);

  if (req.files && req.files.hotelImages) {
    const images = Array.isArray(req.files.hotelImages)
      ? req.files.hotelImages
      : [req.files.hotelImages];

    const uploadPromises = images.map(image =>
      uploadFile(image, 'accommodations'),
    );
    const imagePaths = await Promise.all(uploadPromises);
    payload.hotelImages = imagePaths.map(path => ({ fileKey: path }));
  }

  const result = await accommodationService.updateAccommodation({
    ...payload,
    id,
  });

  // Audit log
  await auditService.logUpdate({
    userId: req.user.sub.id,
    entityType: 'Accommodation',
    entityId: parseInt(id, 10),
    entityName: result?.hotelName || oldData?.hotelName,
    oldData,
    newData: result,
    req,
  });

  res.status(httpStatus.OK).send({ result });
});

exports.deleteAccommodation = catchAsync(async (req, res) => {
  const id = req?.query?.id;

  // Get data before delete for audit
  const oldData = await accommodationService.getAccommodationById(id);

  const result = await accommodationService.deleteAccommodation(id);

  // Audit log
  await auditService.logDelete({
    userId: req.user.sub.id,
    entityType: 'Accommodation',
    entityId: parseInt(id, 10),
    entityName: oldData?.hotelName,
    deletedData: oldData,
    req,
  });

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
