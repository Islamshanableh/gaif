/* eslint-disable no-param-reassign */

const bcrypt = require('bcryptjs');
const httpStatus = require('http-status');

const { User, Op } = require('./db.service');

const ApiError = require('../utils/ApiError');

// Standard bcrypt salt rounds (10 is recommended for security/performance balance)
const SALT_ROUNDS = 10;

exports.register = async payload => {
  // Check email uniqueness before creating
  const existingUser = await User.findOne({
    where: { email: payload.email, isActive: true },
  });
  if (existingUser) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'Email already exists');
  }

  payload.password = bcrypt.hashSync(payload.password, SALT_ROUNDS);

  try {
    const user = await User.create(payload);
    const userData = user.toJSON();
    delete userData.password;
    return userData;
  } catch (e) {
    // Handle unique constraint violations
    if (e.name === 'SequelizeUniqueConstraintError') {
      const field = e.errors?.[0]?.path || 'field';
      const msg = `${field.replace(/_/g, ' ')} already exists`;
      throw new ApiError(httpStatus.BAD_REQUEST, msg);
    }
    throw e;
  }
};

exports.getUserById = async id => {
  const result = await User.findOne({
    where: { id },
  });

  return result ? result.toJSON() : null;
};

exports.approveUserById = async payload => {
  const result = await User.update(
    {
      status: 'APPROVED',
      role: payload?.role,
    },
    {
      where: { id: payload?.id },
      returning: true,
    },
  );

  // Fetch the updated user
  const updatedUser = await User.findByPk(payload?.id);
  return updatedUser ? updatedUser.toJSON() : null;
};

exports.updateUserById = async payload => {
  const { id, ...updateData } = payload;

  // Ensure email uniqueness if email is being updated
  if (updateData.email) {
    const existingUser = await User.findOne({
      where: {
        email: updateData.email,
        id: { [Op.ne]: id },
        isActive: true,
      },
    });
    if (existingUser) {
      throw new ApiError(httpStatus.BAD_REQUEST, 'Email already exists');
    }
  }

  // Hash password if provided
  if (updateData.password) {
    updateData.password = bcrypt.hashSync(updateData.password, SALT_ROUNDS);
  }

  await User.update(updateData, {
    where: { id },
  });

  const result = await User.findByPk(id);
  if (result) {
    const userData = result.toJSON();
    delete userData.password;
    return userData;
  }
  return null;
};

exports.updateUserPassword = async (id, payload) => {
  if (payload.oldPassword) {
    const user = await User.findByPk(id);

    if (!user) {
      throw new ApiError(httpStatus.NOT_FOUND, 'User not found');
    }

    const isPasswordMatched = bcrypt.compareSync(
      payload.oldPassword,
      user.password,
    );

    if (!isPasswordMatched) {
      throw new ApiError(httpStatus.BAD_REQUEST, 'Invalid old password');
    }
  }

  const password = bcrypt.hashSync(payload.password, SALT_ROUNDS);

  await User.update({ password }, { where: { id } });

  const result = await User.findByPk(id);
  return result ? result.toJSON() : null;
};

exports.deleteUserById = async id => {
  const userInfo = await User.findByPk(id);

  if (userInfo) {
    // Use short suffix to avoid exceeding column length limits
    const suffix = Date.now().toString().slice(-8);
    await User.update(
      {
        isActive: false,
        email: `${userInfo.email}-${suffix}`,
        mobile: userInfo.mobile ? `del-${suffix}` : null,
      },
      { where: { id } },
    );
  }
};

exports.getUserList = async query => {
  const { page = 1, limit = 10, status, role, search } = query || {};
  const offset = (page - 1) * limit;

  const where = {
    isActive: true,
  };

  if (status) {
    where.status = status;
  }

  if (role) {
    where.role = role;
  }

  if (search) {
    where[Op.or] = [
      { email: { [Op.like]: `%${search}%` } },
      { fullName: { [Op.like]: `%${search}%` } },
    ];
  }

  const { count: total, rows: users } = await User.findAndCountAll({
    where,
    offset,
    limit,
    order: [['createdAt', 'DESC']],
    attributes: { exclude: ['password', 'mfaSecret'] },
  });

  return {
    data: users.map(user => user.toJSON()),
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
};
