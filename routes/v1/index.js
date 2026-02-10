const express = require('express');

const router = express.Router();

const authRoute = require('./auth.route');
const participationTypeRoute = require('./participationType.route');
const settingRoute = require('./setting.route');
const companyRoute = require('./company.route');
const accommodationRoute = require('./accommodation.route');
const registrationRoute = require('./registration.route');
const tripRoute = require('./trip.route');
const fileRoute = require('./file.route');
const mfaRoute = require('./mfa.route');
const userRoute = require('./user.route');
const paymentRoute = require('./payment.route');
const auditRoute = require('./audit.route');
const insightsRoute = require('./insights.route');
const invoiceRoute = require('./invoice.route');

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
    path: '/file',
    route: fileRoute,
  },
  {
    path: '/mfa',
    route: mfaRoute,
  },
  {
    path: '/user',
    route: userRoute,
  },
  {
    path: '/payment',
    route: paymentRoute,
  },
  {
    path: '/audit',
    route: auditRoute,
  },
  {
    path: '/insights',
    route: insightsRoute,
  },
  {
    path: '/invoice',
    route: invoiceRoute,
  },
];

defaultRoutes.forEach(route => {
  router.use(route.path, route.route);
});

module.exports = router;
