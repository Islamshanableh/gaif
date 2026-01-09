/* eslint-disable no-await-in-loop */
/* eslint-disable no-restricted-syntax */
const httpStatus = require('http-status');
const { prisma } = require('./prisma.service');
const ApiError = require('../utils/ApiError');

exports.createTransportationSchedule = async payload => {
  const result = await prisma.transportationSchedule.create({
    data: {
      direction: payload.direction,
      scheduleDate: payload.scheduleDate,
      departureTime: payload.departureTime,
      expectedArrivalTime: payload.expectedArrivalTime,
      route: payload.route,
      routeAr: payload.routeAr,
      availableSeats: payload.availableSeats,
    },
  });

  return result;
};

exports.updateTransportationSchedule = async (id, payload) => {
  const result = await prisma.transportationSchedule.update({
    where: { id },
    data: payload,
  });

  return result;
};

exports.getTransportationScheduleById = async id => {
  const result = await prisma.transportationSchedule.findUnique({
    where: { id },
  });

  if (!result) {
    throw new ApiError(
      httpStatus.NOT_FOUND,
      'Transportation schedule not found',
    );
  }

  return result;
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

  const result = await prisma.transportationSchedule.findMany({
    where,
    orderBy: [{ scheduleDate: 'asc' }, { departureTime: 'asc' }],
  });

  return result;
};

exports.deleteTransportationSchedule = async id => {
  const result = await prisma.transportationSchedule.update({
    where: { id },
    data: { isActive: false },
  });

  return result;
};
