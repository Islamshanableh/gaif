const httpStatus = require('http-status');
const { Op } = require('sequelize');
const { MeetingRoom } = require('./db.service');
const ApiError = require('../utils/ApiError');

exports.createMeetingRoom = async payload => {
  try {
    const result = await MeetingRoom.create(payload);
    return result.toJSON();
  } catch (error) {
    if (error.name === 'SequelizeUniqueConstraintError') {
      throw new ApiError(
        httpStatus.BAD_REQUEST,
        'Meeting room code already exists',
      );
    }
    throw error;
  }
};

exports.getMeetingRoomById = async id => {
  const result = await MeetingRoom.findOne({ where: { id, isActive: true } });
  if (!result) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Meeting room not found');
  }
  return result.toJSON();
};

exports.getMeetingRoomList = async ({
  type,
  floor,
  status,
  page = 1,
  limit = 20,
  all = false,
}) => {
  const where = { isActive: true };

  if (type) where.type = type;
  if (floor) where.floor = { [Op.like]: `%${floor}%` };
  if (status) where.status = status;

  if (all) {
    const rows = await MeetingRoom.findAll({
      where,
      order: [['createdAt', 'DESC']],
    });
    return { data: rows.map(r => r.toJSON()) };
  }

  const offset = (page - 1) * limit;

  const { count: total, rows } = await MeetingRoom.findAndCountAll({
    where,
    order: [['createdAt', 'DESC']],
    offset,
    limit,
  });

  return {
    data: rows.map(r => r.toJSON()),
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
};

exports.updateMeetingRoom = async (id, payload) => {
  const room = await MeetingRoom.findOne({ where: { id, isActive: true } });
  if (!room) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Meeting room not found');
  }

  try {
    await MeetingRoom.update(payload, { where: { id } });
  } catch (error) {
    if (error.name === 'SequelizeUniqueConstraintError') {
      throw new ApiError(
        httpStatus.BAD_REQUEST,
        'Meeting room code already exists',
      );
    }
    throw error;
  }

  const result = await MeetingRoom.findByPk(id);
  return result.toJSON();
};

exports.deleteMeetingRoom = async id => {
  const room = await MeetingRoom.findOne({ where: { id, isActive: true } });
  if (!room) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Meeting room not found');
  }
  await MeetingRoom.update({ isActive: false }, { where: { id } });
  return { success: true };
};
