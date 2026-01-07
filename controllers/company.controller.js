const httpStatus = require('http-status');
const catchAsync = require('../utils/catchAsync');
const { companyService } = require('../services');
const { uploadFile } = require('../utils/fileUpload');

exports.createCompany = catchAsync(async (req, res) => {
  const payload = req?.body;

  if (req.files && req.files.logo) {
    const logoPath = await uploadFile(req.files.logo, 'companies');
    payload.logo = logoPath;
  }

  const result = await companyService.createCompany(payload);
  res.status(httpStatus.OK).send({ result });
});

exports.updateCompany = catchAsync(async (req, res) => {
  const id = req?.query?.id;
  const payload = req?.body;

  if (req.files && req.files.logo) {
    const logoPath = await uploadFile(req.files.logo, 'companies');
    payload.logo = logoPath;
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
  const payload = req?.body;
  const result = await companyService.getCompanyList(payload);
  res.status(httpStatus.OK).send({ result });
});
