const httpStatus = require('http-status');
const { MeetingRoom, MeetingRoomReservation } = require('./db.service');
const ApiError = require('../utils/ApiError');

exports.getAvailableRooms = async ({ type, floor, page = 1, limit = 20 }) => {
  const { Op } = require('sequelize');

  const where = { isActive: true, status: 'active' };
  if (type) where.type = type;
  if (floor) where.floor = { [Op.like]: `%${floor}%` };

  const offset = (page - 1) * limit;

  const { count: total, rows } = await MeetingRoom.findAndCountAll({
    where,
    include: [
      {
        model: MeetingRoomReservation,
        as: 'reservation',
        required: false,
      },
    ],
    order: [['createdAt', 'DESC']],
    offset,
    limit,
  });

  const data = rows.filter(r => !r.reservation).map(r => r.toJSON());

  return {
    data,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
};

exports.createReservation = async payload => {
  const existing = await MeetingRoomReservation.findOne({
    where: { meetingRoomId: payload.meetingRoomId },
  });

  if (existing) {
    throw new ApiError(
      httpStatus.CONFLICT,
      'This meeting room is already reserved',
    );
  }

  const room = await MeetingRoom.findOne({
    where: { id: payload.meetingRoomId, isActive: true, status: 'active' },
  });

  if (!room) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Meeting room not found');
  }

  const result = await MeetingRoomReservation.create(payload);
  return result.toJSON();
};

exports.getReservationList = async ({ page = 1, limit = 20 }) => {
  const offset = (page - 1) * limit;

  const { count: total, rows } = await MeetingRoomReservation.findAndCountAll({
    include: [
      {
        model: MeetingRoom,
        as: 'meetingRoom',
        attributes: ['id', 'name', 'type', 'floor', 'code', 'priceUSD'],
      },
    ],
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

exports.deleteReservation = async id => {
  const reservation = await MeetingRoomReservation.findByPk(id);
  if (!reservation) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Reservation not found');
  }
  await reservation.destroy();
  return { success: true };
};
