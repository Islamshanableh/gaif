const permissions = require('./route.permissions');

module.exports = {
  types: ['ADMINISTRATOR', 'USER', 'WORKER', 'GUEST'],
  ADMINISTRATOR: {
    rights: [
      permissions.ADMINISTRATOR.create,
      permissions.ADMINISTRATOR.update,
      permissions.ADMINISTRATOR.read,
    ],
  },
};
