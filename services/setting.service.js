const { prisma } = require('./prisma.service');

exports.getCountries = async search => {
  const result = await prisma.country.findMany({
    where: {
      name: { contains: search },
    },
  });

  return result;
};
