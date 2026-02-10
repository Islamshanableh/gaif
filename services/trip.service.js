/* eslint-disable no-await-in-loop */
/* eslint-disable no-restricted-syntax */
const httpStatus = require('http-status');
const { Trip, File } = require('./db.service');
const ApiError = require('../utils/ApiError');

exports.createTrip = async payload => {
  const result = await Trip.create({
    type: payload.type,
    name: payload.name,
    nameAr: payload.nameAr,
    description: payload.description,
    descriptionAr: payload.descriptionAr,
    price: payload.price,
    currency: payload.currency || 'JD',
    tripDate: payload.tripDate,
    maxParticipants: payload.maxParticipants,
    imageId: payload.imageId,
  });

  return result.toJSON();
};

exports.updateTrip = async (id, payload) => {
  await Trip.update(payload, {
    where: { id },
  });

  const result = await Trip.findByPk(id, {
    include: [
      {
        model: File,
        as: 'image',
        attributes: ['id', 'fileKey', 'fileName', 'fileType'],
      },
    ],
  });

  return result.toJSON();
};

exports.getTripById = async id => {
  const result = await Trip.findByPk(id, {
    include: [
      {
        model: File,
        as: 'image',
        attributes: ['id', 'fileKey', 'fileName', 'fileType'],
      },
    ],
  });

  if (!result) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Trip not found');
  }

  return result.toJSON();
};

exports.getTrips = async query => {
  const where = {};

  // For admin, return all records (active and inactive)
  // For registration (non-admin), return only active records
  if (query.forAdmin) {
    // If forAdmin is true, don't filter by isActive unless explicitly specified
    if (query.isActive !== undefined) {
      where.isActive = query.isActive;
    }
  } else if (query.isActive !== undefined) {
    where.isActive = query.isActive;
  } else {
    where.isActive = true;
  }

  if (query.type) {
    where.type = query.type;
  }

  const result = await Trip.findAll({
    where,
    order: [['tripDate', 'ASC']],
    include: [
      {
        model: File,
        as: 'image',
        attributes: ['id', 'fileKey', 'fileName', 'fileType'],
      },
    ],
  });

  return result.map(trip => trip.toJSON());
};

exports.deleteTrip = async id => {
  await Trip.update({ isActive: false }, { where: { id } });

  const result = await Trip.findByPk(id);
  return result ? result.toJSON() : null;
};
