/* eslint-disable no-await-in-loop */
/* eslint-disable no-restricted-syntax */
const httpStatus = require('http-status');
const {
  ParticipationType,
  ParticipationTypeCountry,
  Country,
  Op,
  sequelize,
} = require('./db.service');
const ApiError = require('../utils/ApiError');

exports.createParticipationType = async payload => {
  const { countryIds, ...participationData } = payload;
  const transaction = await sequelize.transaction();

  try {
    const result = await ParticipationType.create(participationData, {
      transaction,
    });

    // Add countries if provided
    if (countryIds && countryIds.length > 0) {
      await ParticipationTypeCountry.bulkCreate(
        countryIds.map(countryId => ({
          participationTypeId: result.id,
          countryId,
        })),
        { transaction },
      );
    }

    await transaction.commit();

    // Fetch with countries (sorted alphabetically)
    const participationType = await ParticipationType.findByPk(result.id, {
      include: [
        {
          model: Country,
          as: 'countries',
          through: { attributes: [] },
        },
      ],
      order: [[{ model: Country, as: 'countries' }, 'name', 'ASC']],
    });

    return participationType.toJSON();
  } catch (e) {
    await transaction.rollback();
    if (e.name === 'SequelizeUniqueConstraintError') {
      const field = e.errors?.[0]?.path || 'field';
      const msg = `${field.replace(/_/g, ' ')} already exists`;
      throw new ApiError(httpStatus.BAD_REQUEST, msg);
    }
    throw e;
  }
};

exports.getParticipationTypeList = async query => {
  const {
    page = 1,
    limit = 10,
    search,
    allowForRegister,
    countryId,
  } = query || {};
  const offset = (page - 1) * limit;

  const where = {
    isActive: true,
  };

  if (search) {
    where.title = { [Op.like]: `%${search}%` };
  }

  if (allowForRegister !== undefined) {
    where.allowForRegister = allowForRegister;
  }

  // Build include for countries (sorted alphabetically by name)
  const include = [
    {
      model: Country,
      as: 'countries',
      through: { attributes: [] }, // Hide junction table attributes
    },
  ];

  // If filtering by countryId, we need to filter participation types that have this country
  let participationTypeIds = null;
  if (countryId) {
    const ptCountries = await ParticipationTypeCountry.findAll({
      where: { countryId },
      attributes: ['participationTypeId'],
    });
    participationTypeIds = ptCountries.map(ptc => ptc.participationTypeId);
    if (participationTypeIds.length > 0) {
      where.id = { [Op.in]: participationTypeIds };
    } else {
      // No participation types for this country
      return {
        data: [],
        pagination: {
          page,
          limit,
          total: 0,
          totalPages: 0,
        },
      };
    }
  }

  const { count: total, rows: participationTypes } =
    await ParticipationType.findAndCountAll({
      where,
      offset,
      limit,
      order: [
        ['createdAt', 'DESC'],
        [{ model: Country, as: 'countries' }, 'name', 'ASC'],
      ],
      include,
      distinct: true,
    });

  return {
    data: participationTypes.map(p => p.toJSON()),
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
};

exports.getParticipationTypeById = async id => {
  const result = await ParticipationType.findOne({
    where: { id },
    include: [
      {
        model: Country,
        as: 'countries',
        through: { attributes: [] },
      },
    ],
    order: [[{ model: Country, as: 'countries' }, 'name', 'ASC']],
  });

  return result ? result.toJSON() : null;
};

exports.deleteParticipationType = async id => {
  await ParticipationType.update({ isActive: false }, { where: { id } });

  const result = await ParticipationType.findByPk(id);
  return result ? result.toJSON() : null;
};

exports.updateParticipationType = async payload => {
  const { id, countryIds, ...updateData } = payload;
  const transaction = await sequelize.transaction();

  try {
    await ParticipationType.update(updateData, {
      where: { id },
      transaction,
    });

    // Update countries if provided
    if (countryIds !== undefined) {
      // Remove existing countries
      await ParticipationTypeCountry.destroy({
        where: { participationTypeId: id },
        transaction,
      });

      // Add new countries
      if (countryIds && countryIds.length > 0) {
        await ParticipationTypeCountry.bulkCreate(
          countryIds.map(countryId => ({
            participationTypeId: id,
            countryId,
          })),
          { transaction },
        );
      }
    }

    await transaction.commit();

    const result = await ParticipationType.findByPk(id, {
      include: [
        {
          model: Country,
          as: 'countries',
          through: { attributes: [] },
        },
      ],
      order: [[{ model: Country, as: 'countries' }, 'name', 'ASC']],
    });
    return result ? result.toJSON() : null;
  } catch (e) {
    await transaction.rollback();
    if (e.name === 'SequelizeUniqueConstraintError') {
      const field = e.errors?.[0]?.path || 'field';
      const msg = `${field.replace(/_/g, ' ')} already exists`;
      throw new ApiError(httpStatus.BAD_REQUEST, msg);
    }
    throw e;
  }
};
