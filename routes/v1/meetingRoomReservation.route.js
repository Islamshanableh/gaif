const express = require('express');
const validate = require('../../middlewares/validate');
const { auth } = require('../../middlewares/auth');
const meetingRoomReservationController = require('../../controllers/meetingRoomReservation.controller');
const meetingRoomReservationValidation = require('../../validations/meetingRoomReservation.validation');
const { routePermissions } = require('../../constants');

const router = express.Router();

// Public: list available rooms
router.get(
  '/rooms',
  validate(meetingRoomReservationValidation.getAvailableRooms),
  meetingRoomReservationController.getAvailableRooms,
);

// Public: submit a reservation
router.post(
  '/',
  validate(meetingRoomReservationValidation.createReservation),
  meetingRoomReservationController.createReservation,
);

// Admin: list all reservations
router.get(
  '/',
  auth(routePermissions.ADMINISTRATOR.read),
  validate(meetingRoomReservationValidation.getReservationList),
  meetingRoomReservationController.getReservationList,
);

// Admin: delete reservation (frees the room)
router.delete(
  '/:id',
  auth(routePermissions.ADMINISTRATOR.update),
  validate(meetingRoomReservationValidation.deleteReservation),
  meetingRoomReservationController.deleteReservation,
);

module.exports = router;
