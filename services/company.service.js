/* eslint-disable no-await-in-loop */
/* eslint-disable no-restricted-syntax */
const httpStatus = require('http-status');
const { Prisma } = require('@prisma/client');
const { prisma } = require('./prisma.service');
const config = require('../config/config');
const ApiError = require('../utils/ApiError');

exports.createCompany = async payload => {
  const result = await prisma.company
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

exports.getCompanyList = async payload => {
  const {
    page = 1,
    limit = 10,
    search,
    countryId,
    participationId,
  } = payload;
  const skip = (page - 1) * limit;

  const where = {
    isActive: true,
  };

  if (countryId) {
    where.countryId = countryId;
  }

  if (participationId) {
    where.participationId = participationId;
  }

  if (search) {
    where.OR = [
      { name: { contains: search } },
      { email: { contains: search } },
    ];
  }

  const [companies, total] = await Promise.all([
    prisma.company.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: 'desc' },
      include: {
        country: true,
        participation: true,
      },
    }),
    prisma.company.count({ where }),
  ]);

  companies.forEach(item => {
    if (item.logo) {
      item.logo = `${config.cdnPrefix}/${item.logo}`;
    }
  });

  return {
    data: companies,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
};

exports.getCompanyById = async id => {
  const result = await prisma.company.findFirst({
    where: {
      id,
    },
  });
  if (result.logo) {
    result.logo = `${config.cdnPrefix}/${result.logo}`;
  }

  return result;
};

exports.deleteCompany = async id => {
  const result = await prisma.company.update({
    where: {
      id,
    },
    data: {
      isActive: false,
    },
  });

  return result;
};

exports.updateCompany = async payload => {
  const result = await prisma.company
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
