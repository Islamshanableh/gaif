const express = require('express');

const router = express.Router();

const authRoute = require('./auth.route');
const participationTypeRoute = require('./participationType.route');
const settingRoute = require('./setting.route');
const companyRoute = require('./company.route');
const accommodationRoute = require('./accommodation.route');
const registrationRoute = require('./registration.route');
const tripRoute = require('./trip.route');
const transportationScheduleRoute = require('./transportationSchedule.route');
const fileRoute = require('./file.route');
const mfaRoute = require('./mfa.route');

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
  {
    path: '/registration',
    route: registrationRoute,
  },
  {
    path: '/trip',
    route: tripRoute,
  },
  {
    path: '/transportation-schedule',
    route: transportationScheduleRoute,
  },
  {
    path: '/file',
    route: fileRoute,
  },
  {
    path: '/mfa',
    route: mfaRoute,
  },
];

defaultRoutes.forEach(route => {
  router.use(route.path, route.route);
});

module.exports = router;
