const httpStatus = require('http-status');
const catchAsync = require('../utils/catchAsync');
const { settingService } = require('../services');

// const ApiError = require('../utils/ApiError');
// const { errorMessage } = require('../utils/helpers');

exports.createSection = catchAsync(async (req, res) => {
  const payload = req?.body;

  const result = await settingService.createSection(payload);
  res.status(httpStatus.OK).send({ result });
});

exports.createCheckList = catchAsync(async (req, res) => {
  const payload = req?.body;

  const result = await settingService.createCheckList(payload);
  res.status(httpStatus.OK).send({ result });
});

exports.createMaterial = catchAsync(async (req, res) => {
  const payload = req?.body;

  const result = await settingService.createMaterial(payload);
  res.status(httpStatus.OK).send({ result });
});

exports.updateSection = catchAsync(async (req, res) => {
  const id = req?.query?.id;
  const payload = req?.body;

  const result = await settingService.updateSection({ ...payload, id });
  res.status(httpStatus.OK).send({ result });
});

exports.updateCheckList = catchAsync(async (req, res) => {
  const id = req?.query?.id;
  const payload = req?.body;

  const result = await settingService.updateCheckList({ ...payload, id });
  res.status(httpStatus.OK).send({ result });
});

exports.updateMaterial = catchAsync(async (req, res) => {
  const id = req?.query?.id;
  const payload = req?.body;

  const result = await settingService.updateMaterial({ ...payload, id });
  res.status(httpStatus.OK).send({ result });
});

exports.deleteSection = catchAsync(async (req, res) => {
  const id = req?.query?.id;

  const result = await settingService.deleteSection(id);
  res.status(httpStatus.OK).send({ result });
});

exports.deleteCheckList = catchAsync(async (req, res) => {
  const id = req?.query?.id;

  const result = await settingService.deleteCheckList(id);
  res.status(httpStatus.OK).send({ result });
});

exports.deleteMaterial = catchAsync(async (req, res) => {
  const id = req?.query?.id;

  const result = await settingService.deleteMaterial(id);
  res.status(httpStatus.OK).send({ result });
});

exports.getSection = catchAsync(async (req, res) => {
  const id = req?.query?.id;

  const result = await settingService.getSectionById(id);
  res.status(httpStatus.OK).send({ result });
});

exports.getCheckListById = catchAsync(async (req, res) => {
  const id = req?.query?.id;

  const result = await settingService.getCheckListById(id);
  res.status(httpStatus.OK).send({ result });
});

exports.getMaterial = catchAsync(async (req, res) => {
  const id = req?.query?.id;

  const result = await settingService.getMaterialById(id);
  res.status(httpStatus.OK).send({ result });
});

exports.getSectionList = catchAsync(async (req, res) => {
  const search = req?.query?.search;
  const result = await settingService.getSectionList(search);
  res.status(httpStatus.OK).send({ result });
});

exports.getSectionListFilter = catchAsync(async (req, res) => {
  const payload = req?.body;
  const result = await settingService.getSectionListFilter(payload);
  res.status(httpStatus.OK).send({ result });
});

exports.getCheckList = catchAsync(async (req, res) => {
  const result = await settingService.getCheckList();
  res.status(httpStatus.OK).send({ result });
});

exports.getMaterialList = catchAsync(async (req, res) => {
  const result = await settingService.getMaterialList();
  res.status(httpStatus.OK).send({ result });
});

exports.createMerchant = catchAsync(async (req, res) => {
  const payload = req?.body;

  const result = await settingService.createMerchant(payload);
  res.status(httpStatus.OK).send({ result });
});

exports.updateMerchant = catchAsync(async (req, res) => {
  const id = req?.query?.id;
  const payload = req?.body;

  const result = await settingService.updateMerchant({ ...payload, id });
  res.status(httpStatus.OK).send({ result });
});

exports.getMerchantList = catchAsync(async (req, res) => {
  const result = await settingService.getMerchantList();
  res.status(httpStatus.OK).send({ result });
});

exports.deleteMerchant = catchAsync(async (req, res) => {
  const id = req?.query?.id;

  const result = await settingService.deleteMerchant(id);
  res.status(httpStatus.OK).send({ result });
});

exports.getMerchantById = catchAsync(async (req, res) => {
  const id = req?.query?.id;

  const result = await settingService.getMerchantById(id);
  res.status(httpStatus.OK).send({ result });
});
