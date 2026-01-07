const express = require('express');

const validate = require('../../middlewares/validate');
const { auth } = require('../../middlewares/auth');
const parseFormData = require('../../middlewares/parseFormData');

const { accommodationController } = require('../../controllers');

const { accommodationValidation } = require('../../validations');

const { routePermissions } = require('../../constants');

const router = express.Router();

router
  .route('/')
  .post(
    auth(routePermissions.ADMINISTRATOR.create),
    parseFormData(['hotelRooms', 'hotelImages']),
    validate(accommodationValidation.createAccommodation),
    accommodationController.createAccommodation,
  )
  .get(
    validate(accommodationValidation.getById),
    accommodationController.getAccommodationById,
  )
  .put(
    auth(routePermissions.ADMINISTRATOR.update),
    parseFormData(['hotelRooms', 'hotelImages']),
    validate(accommodationValidation.updateAccommodation),
    accommodationController.updateAccommodation,
  )
  .delete(
    auth(routePermissions.ADMINISTRATOR.update),
    validate(accommodationValidation.getById),
    accommodationController.deleteAccommodation,
  );

router
  .route('/list')
  .post(
    validate(accommodationValidation.getAccommodationList),
    accommodationController.getAccommodationList,
  );

module.exports = router;
