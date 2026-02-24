/* eslint-disable no-await-in-loop */
/* eslint-disable no-restricted-syntax */
const httpStatus = require('http-status');
const {
  Company,
  Country,
  ParticipationType,
  File,
  Op,
} = require('./db.service');
const ApiError = require('../utils/ApiError');

exports.createCompany = async payload => {
  try {
    const result = await Company.create(payload);
    return result.toJSON();
  } catch (e) {
    if (e.name === 'SequelizeUniqueConstraintError') {
      const field = e.errors?.[0]?.path || 'field';
      const msg = `${field.replace(/_/g, ' ')} already exists`;
      throw new ApiError(httpStatus.BAD_REQUEST, msg);
    }
    throw e;
  }
};

exports.getCompanyList = async payload => {
  const {
    page = 1,
    limit = 10,
    search,
    countryId,
    participationId,
    all,
  } = payload;

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
    where[Op.or] = [
      { name: { [Op.like]: `%${search}%` } },
      { email: { [Op.like]: `%${search}%` } },
    ];
  }

  const include = [
    { model: Country, as: 'country' },
    { model: ParticipationType, as: 'participation' },
    {
      model: File,
      as: 'logo',
      attributes: ['id', 'fileKey', 'fileName', 'fileType'],
    },
  ];

  const order = [
    ['order', 'ASC'],
    ['name', 'ASC'],
  ];

  if (all) {
    const companies = await Company.findAll({ where, order, include });
    return { data: companies.map(item => item.toJSON()) };
  }

  const offset = (page - 1) * limit;
  const { count: total, rows: companies } = await Company.findAndCountAll({
    where,
    offset,
    limit,
    order,
    include,
  });

  return {
    data: companies.map(item => item.toJSON()),
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
};

exports.getCompanyById = async id => {
  const result = await Company.findOne({
    where: { id },
    include: [
      { model: Country, as: 'country' },
      { model: ParticipationType, as: 'participation' },
      {
        model: File,
        as: 'logo',
        attributes: ['id', 'fileKey', 'fileName', 'fileType'],
      },
    ],
  });

  if (!result) {
    return null;
  }

  return result.toJSON();
};

exports.deleteCompany = async id => {
  await Company.update({ isActive: false }, { where: { id } });

  const result = await Company.findByPk(id);
  return result ? result.toJSON() : null;
};

exports.updateCompany = async payload => {
  const { id, ...updateData } = payload;

  try {
    await Company.update(updateData, {
      where: { id },
    });

    const result = await Company.findByPk(id);
    return result ? result.toJSON() : null;
  } catch (e) {
    if (e.name === 'SequelizeUniqueConstraintError') {
      const field = e.errors?.[0]?.path || 'field';
      const msg = `${field.replace(/_/g, ' ')} already exists`;
      throw new ApiError(httpStatus.BAD_REQUEST, msg);
    }
    throw e;
  }
};
