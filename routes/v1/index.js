const express = require('express');

const router = express.Router();

const authRoute = require('./auth.route');
const participationTypeRoute = require('./participationType.route');
const settingRoute = require('./setting.route');
const companyRoute = require('./company.route');

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
];

defaultRoutes.forEach(route => {
  router.use(route.path, route.route);
});

module.exports = router;
