/* eslint-disable no-await-in-loop */
/* eslint-disable no-restricted-syntax */
const httpStatus = require('http-status');
const { Prisma } = require('@prisma/client');
const { prisma } = require('./prisma.service');
const config = require('../config/config');
const ApiError = require('../utils/ApiError');

exports.createAccommodation = async payload => {
  const hotelRooms = payload?.hotelRooms;
  const hotelImages = payload?.hotelImages;
  delete payload?.hotelRooms;
  delete payload?.hotelImages;
  const result = await prisma.accommodation.create({
    data: {
      ...payload,
      hotelRooms: hotelRooms
        ? {
            create: hotelRooms?.map(room => ({
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
  });

  return result;
};

exports.getAccommodationList = async () => {
  const result = await prisma.accommodation.findMany({
    where: {
      isActive: true,
    },
    include: {
      hotelImages: true,
      hotelRooms: true,
    },
  });

  result.map(item => {
    item?.hotelImages?.map(image => {
      if (image?.fileKey) {
        image.fileKey = `${config.cdnPrefix}/${image.fileKey}`;
      }
      return image;
    });
    return item;
  });

  return result;
};

exports.getAccommodationById = async id => {
  const result = await prisma.accommodation.findFirst({
    where: {
      id,
    },
    include: {
      hotelImages: true,
      hotelRooms: true,
    },
  });

  result?.hotelImages?.map(item => {
    if (item.fileKey) {
      item.fileKey = `${config.cdnPrefix}/${item.fileKey}`;
    }
    return item;
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
  const hotelImages = payload?.hotelImages;
  const updateData = { ...payload };
  delete updateData.hotelImages;

  const result = await prisma.accommodation
    .update({
      where: {
        id: payload.id,
      },
      data: {
        ...updateData,
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
