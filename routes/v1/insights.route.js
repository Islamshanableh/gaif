const express = require('express');

const { auth } = require('../../middlewares/auth');
const insightsController = require('../../controllers/insights.controller');
const { routePermissions } = require('../../constants');

const router = express.Router();

// All insights routes require admin authentication
router
  .route('/')
  .get(
    auth(
      routePermissions.ADMINISTRATOR.read,
      routePermissions.REGISTRATION_ADMIN.read,
    ),
    insightsController.getAllInsights,
  );

router
  .route('/accommodation')
  .get(
    auth(
      routePermissions.ADMINISTRATOR.read,
      routePermissions.REGISTRATION_ADMIN.read,
    ),
    insightsController.getAccommodationInsights,
  );

router
  .route('/visa')
  .get(
    auth(
      routePermissions.ADMINISTRATOR.read,
      routePermissions.REGISTRATION_ADMIN.read,
    ),
    insightsController.getVisaInsights,
  );

router
  .route('/payment')
  .get(
    auth(
      routePermissions.ADMINISTRATOR.read,
      routePermissions.REGISTRATION_ADMIN.read,
    ),
    insightsController.getPaymentInsights,
  );

router
  .route('/registrations')
  .get(
    auth(
      routePermissions.ADMINISTRATOR.read,
      routePermissions.REGISTRATION_ADMIN.read,
    ),
    insightsController.getMonthlyRegistrations,
  );

router
  .route('/totals')
  .get(
    auth(
      routePermissions.ADMINISTRATOR.read,
      routePermissions.REGISTRATION_ADMIN.read,
    ),
    insightsController.getDashboardTotals,
  );

router
  .route('/participation-types')
  .get(
    auth(
      routePermissions.ADMINISTRATOR.read,
      routePermissions.REGISTRATION_ADMIN.read,
    ),
    insightsController.getParticipationTypeInsights,
  );

module.exports = router;
