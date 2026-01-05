const { roles } = require('../constants');

const roleRights = new Map();

roles?.types?.map(ty =>
  roles[ty] ? roleRights.set(ty, [...roles[ty]?.rights]) : [],
);

module.exports = {
  roleRights,
};
