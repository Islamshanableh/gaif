const permissions = require('./route.permissions');

module.exports = {
  types: ['ADMIN', 'USER', 'WORKER', 'GUEST'],
  ADMIN: {
    rights: [
      permissions.ADMIN.create,
      permissions.ADMIN.update,
      permissions.ADMIN.read,
    ],
  },
};
