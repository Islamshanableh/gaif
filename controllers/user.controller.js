const httpStatus = require('http-status');
const catchAsync = require('../utils/catchAsync');
const { userService } = require('../services');
const auditService = require('../services/audit.service');

exports.createUser = catchAsync(async (req, res) => {
  const result = await userService.register(req.body);

  // Audit log
  await auditService.logCreate({
    userId: req.user.sub.id,
    entityType: 'User',
    entityId: result.id,
    entityName: result.email,
    newData: result,
    req,
  });

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
  const id = req.query.id;

  // Get old data before update for audit
  const oldData = await userService.getUserById(id);

  const result = await userService.updateUserById({
    id,
    ...req.body,
  });
  if (!result) {
    return res.status(httpStatus.NOT_FOUND).send({ message: 'User not found' });
  }

  // Audit log
  await auditService.logUpdate({
    userId: req.user.sub.id,
    entityType: 'User',
    entityId: parseInt(id, 10),
    entityName: result?.email || oldData?.email,
    oldData,
    newData: result,
    req,
  });

  res.status(httpStatus.OK).send(result);
});

exports.deleteUser = catchAsync(async (req, res) => {
  const id = req.query.id;

  // Get data before delete for audit
  const oldData = await userService.getUserById(id);

  await userService.deleteUserById(id);

  // Audit log
  await auditService.logDelete({
    userId: req.user.sub.id,
    entityType: 'User',
    entityId: parseInt(id, 10),
    entityName: oldData?.email,
    deletedData: oldData,
    req,
  });

  res.status(httpStatus.OK).send({ message: 'User deleted successfully' });
});

exports.updatePassword = catchAsync(async (req, res) => {
  const userId = req.user.sub.id;
  const result = await userService.updateUserPassword(userId, req.body);
  res.status(httpStatus.OK).send(result);
});

exports.approveUser = catchAsync(async (req, res) => {
  const { id } = req.body;

  // Get old data before approve for audit
  const oldData = await userService.getUserById(id);

  const result = await userService.approveUserById(req.body);

  // Audit log (approve is an update action)
  await auditService.logUpdate({
    userId: req.user.sub.id,
    entityType: 'User',
    entityId: parseInt(id, 10),
    entityName: result?.email || oldData?.email,
    oldData,
    newData: result,
    req,
  });

  res.status(httpStatus.OK).send(result);
});
