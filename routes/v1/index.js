const express = require('express');

const router = express.Router();

const authRoute = require('./auth.route');
const participationTypeRoute = require('./participationType.route');
const settingRoute = require('./setting.route');
const companyRoute = require('./company.route');
const accommodationRoute = require('./accommodation.route');

const defaultRoutes = [
  {
    path: '/auth',
    route: authRoute,
  },
  {
    path: '/participation-type',
    route: participationTypeRoute,
  },
  {
    path: '/setting',
    route: settingRoute,
  },
  {
    path: '/company',
    route: companyRoute,
  },
  {
    path: '/accommodation',
    route: accommodationRoute,
  },
];

defaultRoutes.forEach(route => {
  router.use(route.path, route.route);
});

module.exports = router;
