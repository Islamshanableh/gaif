const permissions = require('./route.permissions');

module.exports = {
  types: [
    'ADMINISTRATOR',
    'GAIF_ADMIN',
    'REGISTRATION_ADMIN',
    'USER',
    'WORKER',
    'GUEST',
  ],
  ADMINISTRATOR: {
    rights: [
      permissions.ADMINISTRATOR.create,
      permissions.ADMINISTRATOR.update,
      permissions.ADMINISTRATOR.read,
      permissions.ADMINISTRATOR.manageUsers,
    ],
  },
  GAIF_ADMIN: {
    rights: [
      permissions.GAIF_ADMIN.create,
      permissions.GAIF_ADMIN.update,
      permissions.GAIF_ADMIN.read,
      permissions.GAIF_ADMIN.manageUsers,
    ],
  },
  REGISTRATION_ADMIN: {
    rights: [
      permissions.REGISTRATION_ADMIN.create,
      permissions.REGISTRATION_ADMIN.update,
      permissions.REGISTRATION_ADMIN.read,
    ],
  },
};
