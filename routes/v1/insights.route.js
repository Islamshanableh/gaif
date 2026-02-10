const express = require('express');

const { auth } = require('../../middlewares/auth');
const insightsController = require('../../controllers/insights.controller');
const { routePermissions } = require('../../constants');

const router = express.Router();

// All insights routes require admin authentication
router.route('/').get(auth(routePermissions.ADMINISTRATOR.read), insightsController.getAllInsights);

router
  .route('/accommodation')
  .get(auth(routePermissions.ADMINISTRATOR.read), insightsController.getAccommodationInsights);

router.route('/visa').get(auth(routePermissions.ADMINISTRATOR.read), insightsController.getVisaInsights);

router.route('/payment').get(auth(routePermissions.ADMINISTRATOR.read), insightsController.getPaymentInsights);

router
  .route('/registrations')
  .get(auth(routePermissions.ADMINISTRATOR.read), insightsController.getMonthlyRegistrations);

module.exports = router;
