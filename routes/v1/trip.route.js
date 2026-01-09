const express = require('express');

const validate = require('../../middlewares/validate');
const { auth } = require('../../middlewares/auth');

const { tripController } = require('../../controllers');

const { tripValidation } = require('../../validations');

const { routePermissions } = require('../../constants');

const router = express.Router();

router
  .route('/')
  .post(
    auth(routePermissions.ADMINISTRATOR.create),
    validate(tripValidation.createTrip),
    tripController.createTrip,
  )
  .get(validate(tripValidation.getById), tripController.getTripById)
  .put(
    auth(routePermissions.ADMINISTRATOR.update),
    validate(tripValidation.updateTrip),
    tripController.updateTrip,
  )
  .delete(
    auth(routePermissions.ADMINISTRATOR.update),
    validate(tripValidation.getById),
    tripController.deleteTrip,
  );

router
  .route('/list')
  .get(validate(tripValidation.getTrips), tripController.getTrips);

module.exports = router;
