const httpStatus = require('http-status');
const catchAsync = require('../utils/catchAsync');
const { companyService } = require('../services');
const { uploadFileToDb } = require('../utils/fileUpload');

exports.createCompany = catchAsync(async (req, res) => {
  const payload = req?.body;

  if (req.files && req.files.logo) {
    const uploadedFile = await uploadFileToDb(
      req.files.logo,
      'company',
      null,
      'logo',
    );
    payload.logoId = uploadedFile.id;
  }

  const result = await companyService.createCompany(payload);
  res.status(httpStatus.OK).send({ result });
});

exports.updateCompany = catchAsync(async (req, res) => {
  const id = req?.query?.id;
  const payload = req?.body;

  if (req.files && req.files.logo) {
    const uploadedFile = await uploadFileToDb(
      req.files.logo,
      'company',
      parseInt(id, 10),
      'logo',
    );
    payload.logoId = uploadedFile.id;
  }

  const result = await companyService.updateCompany({
    ...payload,
    id,
  });
  res.status(httpStatus.OK).send({ result });
});

exports.deleteCompany = catchAsync(async (req, res) => {
  const id = req?.query?.id;

  const result = await companyService.deleteCompany(id);
  res.status(httpStatus.OK).send({ result });
});

exports.getCompanyById = catchAsync(async (req, res) => {
  const id = req?.query?.id;

  const result = await companyService.getCompanyById(id);
  res.status(httpStatus.OK).send({ result });
});

exports.getCompanyList = catchAsync(async (req, res) => {
  const query = req?.query;
  // Convert string numbers to actual numbers
  if (query.page) query.page = parseInt(query.page, 10);
  if (query.limit) query.limit = parseInt(query.limit, 10);
  if (query.countryId) query.countryId = parseInt(query.countryId, 10);
  if (query.participationId)
    query.participationId = parseInt(query.participationId, 10);

  const result = await companyService.getCompanyList(query);
  res.status(httpStatus.OK).send({ result });
});
