/* eslint-disable no-await-in-loop */
/* eslint-disable no-restricted-syntax */
const httpStatus = require('http-status');
const { Prisma } = require('@prisma/client');
const { prisma } = require('./prisma.service');
const ApiError = require('../utils/ApiError');

exports.createAccommodation = async payload => {
  const hotelRoom = payload?.hotelRoom;
  const hotelImages = payload?.hotelImages;
  const result = await prisma.accommodation
    .create({
      data: {
        ...payload,
        hotelRoom: hotelRoom
          ? {
              create: hotelRoom?.map(room => ({
                roomCategory: room.roomCategory,
                roomCategoryInArabic: room.roomCategoryInArabic,
                numberOfRooms: room.numberOfRooms,
                single: room.single,
                double: room.double,
                available: room.available,
              })),
            }
          : undefined,

        hotelImages: hotelImages
          ? {
              create: hotelImages?.map(image => ({
                fileKey: image.fileKey,
              })),
            }
          : undefined,
      },
    })
    .catch(e => {
      if (e instanceof Prisma.PrismaClientKnownRequestError) {
        if (typeof e === 'string') e = JSON.parse(e);
        const errMeta = e?.meta;
        if (e.code === 'P2002') {
          if (
            errMeta &&
            errMeta?.target &&
            typeof errMeta.target === 'string'
          ) {
            const arr = errMeta.target
              .replaceAll('_', ' ')
              .replace('key', '')
              .concat('allready exists')
              .split(' ');

            arr.shift();
            const msg = arr.join(' ');

            throw new ApiError(httpStatus.BAD_REQUEST, msg);
          }
        } else if (e?.meta?.target && typeof e.meta.target === 'string') {
          const msg = e?.meta?.target
            .replaceAll('_', ' ')
            .replace('key', '')
            .concat('allready exists');
          throw new ApiError(httpStatus.BAD_REQUEST, msg);
        }
      }
    });

  return result;
};

exports.getAccommodationList = async () => {
  const result = await prisma.accommodation.findMany({
    where: {
      isActive: true,
    },
  });

  return result;
};

exports.getAccommodationById = async id => {
  const result = await prisma.accommodation.findFirst({
    where: {
      id,
    },
  });

  return result;
};

exports.deleteAccommodation = async id => {
  const result = await prisma.accommodation.update({
    where: {
      id,
    },
    data: {
      isActive: false,
    },
  });

  return result;
};

exports.updateAccommodation = async payload => {
  const result = await prisma.accommodation
    .update({
      where: {
        id: payload.id,
      },
      data: payload,
    })
    .catch(e => {
      if (e instanceof Prisma.PrismaClientKnownRequestError) {
        if (typeof e === 'string') e = JSON.parse(e);
        const errMeta = e?.meta;
        if (e.code === 'P2002') {
          if (
            errMeta &&
            errMeta?.target &&
            typeof errMeta.target === 'string'
          ) {
            const arr = errMeta.target
              .replaceAll('_', ' ')
              .replace('key', '')
              .concat('allready exists')
              .split(' ');

            arr.shift();
            const msg = arr.join(' ');

            throw new ApiError(httpStatus.BAD_REQUEST, msg);
          }
        } else if (e?.meta?.target && typeof e.meta.target === 'string') {
          const msg = e?.meta?.target
            .replaceAll('_', ' ')
            .replace('key', '')
            .concat('allready exists');
          throw new ApiError(httpStatus.BAD_REQUEST, msg);
        }
      }
    });

  return result;
};
