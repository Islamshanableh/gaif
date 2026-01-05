const express = require('express');

const router = express.Router();
// const mockRoute = require('./mock.route');
const authRoute = require('./auth.route');
const userRoute = require('./user.route');
const settingRoute = require('./setting.route');
const ticketRoute = require('./ticket.route');

const defaultRoutes = [
  {
    path: '/auth',
    route: authRoute,
  },
  {
    path: '/users',
    route: userRoute,
  },
  {
    path: '/setting',
    route: settingRoute,
  },
  {
    path: '/ticket',
    route: ticketRoute,
  },
];

defaultRoutes.forEach(route => {
  router.use(route.path, route.route);
});

module.exports = router;
