const { PrismaClient, Prisma } = require('@prisma/client');

const config = require('../config/config');

exports.prisma = new PrismaClient({
  log: config.env === 'rel' ? ['query', 'error'] : ['error'],
});

exports.prismaBase = Prisma;
