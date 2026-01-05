const httpStatus = require('http-status');
const catchAsync = require('../utils/catchAsync');
const { settingService } = require('../services');

// const ApiError = require('../utils/ApiError');
// const { errorMessage } = require('../utils/helpers');

exports.getCountries = catchAsync(async (req, res) => {
  const search = req?.query?.search;

  const result = await settingService.getCountries(search);
  res.status(httpStatus.OK).send({ result });
});
