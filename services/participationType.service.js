/* eslint-disable no-await-in-loop */
/* eslint-disable no-restricted-syntax */
const httpStatus = require('http-status');
const { Prisma } = require('@prisma/client');
const { prisma } = require('./prisma.service');
const ApiError = require('../utils/ApiError');

exports.createParticipationType = async payload => {
  const result = await prisma.participationType
    .create({
      data: {
        ...payload,
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

exports.getParticipationTypeList = async query => {
  const { page = 1, limit = 10, search } = query || {};
  const skip = (page - 1) * limit;

  const where = {
    isActive: true,
  };

  if (search) {
    where.title = { contains: search };
  }

  const [participationTypes, total] = await Promise.all([
    prisma.participationType.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: 'desc' },
    }),
    prisma.participationType.count({ where }),
  ]);

  return {
    data: participationTypes,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
};

exports.getParticipationTypeById = async id => {
  const result = await prisma.participationType.findFirst({
    where: {
      id,
    },
  });

  return result;
};

exports.deleteParticipationType = async id => {
  const result = await prisma.participationType.update({
    where: {
      id,
    },
    data: {
      isActive: false,
    },
  });

  return result;
};

exports.updateParticipationType = async payload => {
  const result = await prisma.participationType
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
