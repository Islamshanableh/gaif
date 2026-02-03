const httpStatus = require('http-status');
const catchAsync = require('../utils/catchAsync');
const { participationTypeService } = require('../services');
const auditService = require('../services/audit.service');

exports.createParticipationType = catchAsync(async (req, res) => {
  const payload = req?.body;

  const result =
    await participationTypeService.createParticipationType(payload);

  // Audit log
  await auditService.logCreate({
    userId: req.user.sub.id,
    entityType: 'ParticipationType',
    entityId: result.id,
    entityName: result.title,
    newData: result,
    req,
  });

  res.status(httpStatus.OK).send({ result });
});

exports.updateParticipationType = catchAsync(async (req, res) => {
  const id = req?.query?.id;
  const payload = req?.body;

  // Get old data before update for audit
  const oldData = await participationTypeService.getParticipationTypeById(id);

  const result = await participationTypeService.updateParticipationType({
    ...payload,
    id,
  });

  // Audit log
  await auditService.logUpdate({
    userId: req.user.sub.id,
    entityType: 'ParticipationType',
    entityId: parseInt(id, 10),
    entityName: result?.title || oldData?.title,
    oldData,
    newData: result,
    req,
  });

  res.status(httpStatus.OK).send({ result });
});

exports.deleteParticipationType = catchAsync(async (req, res) => {
  const id = req?.query?.id;

  // Get data before delete for audit
  const oldData = await participationTypeService.getParticipationTypeById(id);

  const result = await participationTypeService.deleteParticipationType(id);

  // Audit log
  await auditService.logDelete({
    userId: req.user.sub.id,
    entityType: 'ParticipationType',
    entityId: parseInt(id, 10),
    entityName: oldData?.title,
    deletedData: oldData,
    req,
  });

  res.status(httpStatus.OK).send({ result });
});

exports.getParticipationTypeById = catchAsync(async (req, res) => {
  const id = req?.query?.id;

  const result = await participationTypeService.getParticipationTypeById(id);
  res.status(httpStatus.OK).send({ result });
});

exports.getParticipationTypeList = catchAsync(async (req, res) => {
  const query = req?.query;
  // Convert string numbers to actual numbers
  if (query.page) query.page = parseInt(query.page, 10);
  if (query.limit) query.limit = parseInt(query.limit, 10);

  const result =
    await participationTypeService.getParticipationTypeList(query);
  res.status(httpStatus.OK).send({ result });
});
