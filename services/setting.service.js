const { Country, Op } = require('./db.service');

exports.getCountries = async search => {
  const where = {};

  if (search) {
    where.name = { [Op.like]: `%${search}%` };
  }

  const result = await Country.findAll({ where });

  return result.map(country => country.toJSON());
};
