/* eslint-disable no-await-in-loop */
/* eslint-disable no-restricted-syntax */
const httpStatus = require('http-status');
const { TransportationSchedule } = require('./db.service');
const ApiError = require('../utils/ApiError');

exports.createTransportationSchedule = async payload => {
  const result = await TransportationSchedule.create({
    direction: payload.direction,
    scheduleDate: payload.scheduleDate,
    departureTime: payload.departureTime,
    expectedArrivalTime: payload.expectedArrivalTime,
    route: payload.route,
    routeAr: payload.routeAr,
    availableSeats: payload.availableSeats,
  });

  return result.toJSON();
};

exports.updateTransportationSchedule = async (id, payload) => {
  await TransportationSchedule.update(payload, {
    where: { id },
  });

  const result = await TransportationSchedule.findByPk(id);
  return result ? result.toJSON() : null;
};

exports.getTransportationScheduleById = async id => {
  const result = await TransportationSchedule.findByPk(id);

  if (!result) {
    throw new ApiError(
      httpStatus.NOT_FOUND,
      'Transportation schedule not found',
    );
  }

  return result.toJSON();
};

exports.getTransportationSchedules = async query => {
  const where = {};

  if (query.direction) {
    where.direction = query.direction;
  }

  if (query.scheduleDate) {
    where.scheduleDate = query.scheduleDate;
  }

  if (query.isActive !== undefined) {
    where.isActive = query.isActive;
  } else {
    where.isActive = true;
  }

  const result = await TransportationSchedule.findAll({
    where,
    order: [['scheduleDate', 'ASC'], ['departureTime', 'ASC']],
  });

  return result.map(schedule => schedule.toJSON());
};

exports.deleteTransportationSchedule = async id => {
  await TransportationSchedule.update(
    { isActive: false },
    { where: { id } }
  );

  const result = await TransportationSchedule.findByPk(id);
  return result ? result.toJSON() : null;
};
