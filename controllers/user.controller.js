const httpStatus = require('http-status');
const catchAsync = require('../utils/catchAsync');
const { userService } = require('../services');

// const ApiError = require('../utils/ApiError');
// const { errorMessage } = require('../utils/helpers');

exports.getUserById = catchAsync(async (req, res) => {
  const id = req?.user?.sub?.id;

  const result = await userService.getUserById(id);
  res.status(httpStatus.OK).send({ result });
});

exports.updateUserPassword = catchAsync(async (req, res) => {
  const id = req?.user?.sub?.id;
  const payload = req?.body;

  const result = await userService.updateUserPassword(id, payload);
  res.status(httpStatus.OK).send({ result });
});

exports.updateUser = catchAsync(async (req, res) => {
  const payload = req?.body;

  const result = await userService.updateUserById(payload);
  res.status(httpStatus.OK).send({ result });
});

exports.deleteUser = catchAsync(async (req, res) => {
  const id = req?.query?.id;

  const result = await userService.deleteUserById(id);
  res.status(httpStatus.OK).send({ result });
});

exports.userList = catchAsync(async (req, res) => {
  const status = req?.query?.status;

  const result = await userService.getUserList(status);
  res.status(httpStatus.OK).send({ result });
});

exports.approveUser = catchAsync(async (req, res) => {
  const payload = req?.body;

  const result = await userService.approveUserById(payload);
  res.status(httpStatus.OK).send({ result });
});
