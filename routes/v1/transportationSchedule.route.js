const express = require('express');

const validate = require('../../middlewares/validate');
const { auth } = require('../../middlewares/auth');

const { transportationScheduleController } = require('../../controllers');

const { transportationScheduleValidation } = require('../../validations');

const { routePermissions } = require('../../constants');

const router = express.Router();

router
  .route('/')
  .post(
    auth(routePermissions.ADMINISTRATOR.create),
    validate(transportationScheduleValidation.createTransportationSchedule),
    transportationScheduleController.createTransportationSchedule,
  )
  .get(
    validate(transportationScheduleValidation.getById),
    transportationScheduleController.getTransportationScheduleById,
  )
  .put(
    auth(routePermissions.ADMINISTRATOR.update),
    validate(transportationScheduleValidation.updateTransportationSchedule),
    transportationScheduleController.updateTransportationSchedule,
  )
  .delete(
    auth(routePermissions.ADMINISTRATOR.update),
    validate(transportationScheduleValidation.getById),
    transportationScheduleController.deleteTransportationSchedule,
  );

router
  .route('/list')
  .get(
    validate(transportationScheduleValidation.getSchedules),
    transportationScheduleController.getTransportationSchedules,
  );

module.exports = router;
