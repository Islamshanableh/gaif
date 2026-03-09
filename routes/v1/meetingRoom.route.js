const express = require('express');
const validate = require('../../middlewares/validate');
const { auth } = require('../../middlewares/auth');
const meetingRoomController = require('../../controllers/meetingRoom.controller');
const meetingRoomValidation = require('../../validations/meetingRoom.validation');
const { routePermissions } = require('../../constants');

const router = express.Router();

router
  .route('/')
  .post(
    auth(routePermissions.ADMINISTRATOR.create),
    validate(meetingRoomValidation.createMeetingRoom),
    meetingRoomController.createMeetingRoom,
  )
  .get(
    auth(routePermissions.ADMINISTRATOR.read),
    validate(meetingRoomValidation.getMeetingRoomList),
    meetingRoomController.getMeetingRoomList,
  );

router
  .route('/:id')
  .get(
    auth(routePermissions.ADMINISTRATOR.read),
    validate(meetingRoomValidation.getMeetingRoomById),
    meetingRoomController.getMeetingRoomById,
  )
  .put(
    auth(routePermissions.ADMINISTRATOR.update),
    validate(meetingRoomValidation.updateMeetingRoom),
    meetingRoomController.updateMeetingRoom,
  )
  .delete(
    auth(routePermissions.ADMINISTRATOR.update),
    validate(meetingRoomValidation.deleteMeetingRoom),
    meetingRoomController.deleteMeetingRoom,
  );

module.exports = router;
