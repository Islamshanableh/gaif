/* eslint-disable no-await-in-loop */
/* eslint-disable no-restricted-syntax */
const httpStatus = require('http-status');
const { Prisma } = require('@prisma/client');
const { prisma } = require('./prisma.service');
const config = require('../config/config');
const ApiError = require('../utils/ApiError');

// Helper function to add CDN prefix to file paths
const addCdnPrefix = filePath => {
  if (filePath) {
    return `${config.cdnPrefix}/${filePath}`;
  }
  return filePath;
};

exports.createTrip = async payload => {
  const result = await prisma.trip.create({
    data: {
      name: payload.name,
      nameAr: payload.nameAr,
      description: payload.description,
      descriptionAr: payload.descriptionAr,
      price: new Prisma.Decimal(payload.price),
      currency: payload.currency || 'JD',
      tripDate: payload.tripDate,
      maxParticipants: payload.maxParticipants,
      image: payload.image,
    },
  });

  if (result.image) {
    result.image = addCdnPrefix(result.image);
  }

  return result;
};

exports.updateTrip = async (id, payload) => {
  const updateData = { ...payload };

  if (payload.price !== undefined) {
    updateData.price = new Prisma.Decimal(payload.price);
  }

  const result = await prisma.trip.update({
    where: { id },
    data: updateData,
  });

  if (result.image) {
    result.image = addCdnPrefix(result.image);
  }

  return result;
};

exports.getTripById = async id => {
  const result = await prisma.trip.findUnique({
    where: { id },
  });

  if (!result) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Trip not found');
  }

  if (result.image) {
    result.image = addCdnPrefix(result.image);
  }

  return result;
};

exports.getTrips = async query => {
  const where = {};

  if (query.isActive !== undefined) {
    where.isActive = query.isActive;
  } else {
    where.isActive = true;
  }

  const result = await prisma.trip.findMany({
    where,
    orderBy: { tripDate: 'asc' },
  });

  result.forEach(trip => {
    if (trip.image) {
      trip.image = addCdnPrefix(trip.image);
    }
  });

  return result;
};

exports.deleteTrip = async id => {
  const result = await prisma.trip.update({
    where: { id },
    data: { isActive: false },
  });

  return result;
};
