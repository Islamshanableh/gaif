const httpStatus = require('http-status');
const catchAsync = require('../utils/catchAsync');
const { userService } = require('../services');

exports.createUser = catchAsync(async (req, res) => {
  const result = await userService.register(req.body);
  res.status(httpStatus.CREATED).send(result);
});

exports.getUsers = catchAsync(async (req, res) => {
  const result = await userService.getUserList(req.query);
  res.status(httpStatus.OK).send(result);
});

exports.getUserById = catchAsync(async (req, res) => {
  const result = await userService.getUserById(req.query.id);
  if (!result) {
    return res.status(httpStatus.NOT_FOUND).send({ message: 'User not found' });
  }
  res.status(httpStatus.OK).send(result);
});

exports.updateUser = catchAsync(async (req, res) => {
  const result = await userService.updateUserById({
    id: req.query.id,
    ...req.body,
  });
  if (!result) {
    return res.status(httpStatus.NOT_FOUND).send({ message: 'User not found' });
  }
  res.status(httpStatus.OK).send(result);
});

exports.deleteUser = catchAsync(async (req, res) => {
  await userService.deleteUserById(req.query.id);
  res.status(httpStatus.OK).send({ message: 'User deleted successfully' });
});

exports.updatePassword = catchAsync(async (req, res) => {
  const userId = req.user.sub.id;
  const result = await userService.updateUserPassword(userId, req.body);
  res.status(httpStatus.OK).send(result);
});

exports.approveUser = catchAsync(async (req, res) => {
  const result = await userService.approveUserById(req.body);
  res.status(httpStatus.OK).send(result);
});
