const express = require('express');

const validate = require('../../middlewares/validate');
const { auth } = require('../../middlewares/auth');

const { participationTypeController } = require('../../controllers');

const { participationTypeValidation } = require('../../validations');

const { routePermissions } = require('../../constants');

const router = express.Router();

router
  .route('/')
  .post(
    auth(routePermissions.ADMINISTRATOR.create),
    validate(participationTypeValidation.createParticipationType),
    participationTypeController.createParticipationType,
  )
  .get(
    auth(routePermissions.ADMINISTRATOR.read),
    validate(participationTypeValidation.getById),
    participationTypeController.getParticipationTypeById,
  )
  .put(
    auth(routePermissions.ADMINISTRATOR.update),
    validate(participationTypeValidation.updateParticipationType),
    participationTypeController.updateParticipationType,
  )
  .delete(
    auth(routePermissions.ADMINISTRATOR.update),
    validate(participationTypeValidation.getById),
    participationTypeController.deleteParticipationType,
  );

router
  .route('/list')
  .get(
    validate(participationTypeValidation.getParticipationTypeList),
    participationTypeController.getParticipationTypeList,
  );

module.exports = router;
